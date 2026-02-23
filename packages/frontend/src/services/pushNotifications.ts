// ============================================================================
// Push Notification Service — Frontend
// ============================================================================
// Manages browser push notification subscription lifecycle:
// permission request, service worker subscription, and backend registration.
// ============================================================================

import { apiClient } from '@/api/client';

/**
 * Check if push notifications are supported in the current browser.
 */
export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/**
 * Request notification permission from the user.
 * Returns the permission state: 'granted', 'denied', or 'default'.
 */
export async function requestPermission(): Promise<NotificationPermission> {
  if (!isPushSupported()) return 'denied';
  return Notification.requestPermission();
}

/**
 * Get the current service worker registration (from vite-plugin-pwa).
 */
async function getSwRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  return navigator.serviceWorker.ready;
}

/**
 * Convert a base64 URL-safe string to a Uint8Array (for applicationServerKey).
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Subscribe the current browser to push notifications.
 * 1. Fetches the VAPID public key from the backend
 * 2. Creates a PushSubscription via the service worker
 * 3. Sends the subscription to the backend for storage
 */
export async function subscribeToPush(): Promise<boolean> {
  try {
    if (!isPushSupported()) return false;

    const permission = await requestPermission();
    if (permission !== 'granted') return false;

    // Get VAPID public key from backend
    const { data: vapidRes } = await apiClient.get<{ success: boolean; data: { publicKey: string } }>(
      '/push/vapid-key',
    );
    const vapidPublicKey = vapidRes.data.publicKey;

    // Get the service worker registration
    const registration = await getSwRegistration();
    if (!registration) return false;

    // Check for existing subscription
    const existing = await registration.pushManager.getSubscription();
    if (existing) {
      // Re-register with backend (in case it was lost)
      const subJson = existing.toJSON();
      await apiClient.post('/push/subscribe', {
        endpoint: existing.endpoint,
        keys: {
          p256dh: subJson.keys?.p256dh,
          auth: subJson.keys?.auth,
        },
      });
      return true;
    }

    // Create new subscription
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });

    const subJson = subscription.toJSON();
    await apiClient.post('/push/subscribe', {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subJson.keys?.p256dh,
        auth: subJson.keys?.auth,
      },
    });

    return true;
  } catch (err) {
    console.warn('Failed to subscribe to push notifications:', err);
    return false;
  }
}

/**
 * Unsubscribe from push notifications.
 * Removes the subscription from both the browser and the backend.
 */
export async function unsubscribeFromPush(): Promise<boolean> {
  try {
    const registration = await getSwRegistration();
    if (!registration) return false;

    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return true; // Already unsubscribed

    // Notify backend first
    await apiClient.delete('/push/unsubscribe', {
      data: { endpoint: subscription.endpoint },
    });

    // Unsubscribe from browser
    await subscription.unsubscribe();
    return true;
  } catch (err) {
    console.warn('Failed to unsubscribe from push notifications:', err);
    return false;
  }
}

/**
 * Check if the user is currently subscribed to push notifications.
 */
export async function isPushSubscribed(): Promise<boolean> {
  try {
    const registration = await getSwRegistration();
    if (!registration) return false;
    const subscription = await registration.pushManager.getSubscription();
    return subscription !== null;
  } catch {
    return false;
  }
}
