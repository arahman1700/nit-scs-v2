// ============================================================================
// Push Notification Service — Web Push (VAPID)
// ============================================================================
// Manages web push subscriptions and sends push notifications via the
// Web Push protocol. VAPID keys are loaded from env vars or auto-generated
// once (logged to console for manual persistence).
// ============================================================================

import webPush from 'web-push';
import { prisma } from '../utils/prisma.js';
import { getEnv } from '../config/env.js';

// ── VAPID Key Management ────────────────────────────────────────────────────

let vapidConfigured = false;
let cachedPublicKey = '';

function ensureVapidConfigured(): void {
  if (vapidConfigured) return;

  const env = getEnv();
  let publicKey = env.VAPID_PUBLIC_KEY;
  let privateKey = env.VAPID_PRIVATE_KEY;
  const subject: string = env.VAPID_SUBJECT ?? 'mailto:admin@nit-scs.com';

  if (!publicKey || !privateKey) {
    console.warn('⚠  VAPID keys not found in environment — generating new keys.');
    console.warn('   Add these to your .env file for persistence:');
    const generated = webPush.generateVAPIDKeys();
    publicKey = generated.publicKey;
    privateKey = generated.privateKey;
    console.warn(`   VAPID_PUBLIC_KEY=${publicKey}`);
    console.warn(`   VAPID_PRIVATE_KEY=${privateKey}`);
  }

  webPush.setVapidDetails(subject, publicKey!, privateKey!);
  cachedPublicKey = publicKey;
  vapidConfigured = true;
}

// ── Public API ──────────────────────────────────────────────────────────────

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  url?: string;
  tag?: string;
}

/**
 * Returns the VAPID public key for frontend subscription requests.
 */
export function getVapidPublicKey(): string {
  ensureVapidConfigured();
  return cachedPublicKey;
}

/**
 * Store a push subscription for a user.
 */
export async function subscribe(
  userId: string,
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  userAgent?: string,
) {
  ensureVapidConfigured();

  return prisma.pushSubscription.upsert({
    where: {
      userId_endpoint: { userId, endpoint: subscription.endpoint },
    },
    update: {
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      userAgent: userAgent ?? null,
      isActive: true,
    },
    create: {
      userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      userAgent: userAgent ?? null,
    },
  });
}

/**
 * Remove a push subscription for a user.
 */
export async function unsubscribe(userId: string, endpoint: string): Promise<void> {
  await prisma.pushSubscription.deleteMany({
    where: { userId, endpoint },
  });
}

/**
 * Send push notifications and deactivate gone/expired subscriptions.
 */
async function sendAndCleanup(
  subscriptions: Array<{ id: string; endpoint: string; p256dh: string; auth: string }>,
  pushPayload: string,
): Promise<void> {
  const results = await Promise.allSettled(
    subscriptions.map(sub =>
      webPush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        pushPayload,
      ),
    ),
  );

  // Deactivate subscriptions that returned 410 Gone or 404 Not Found
  const gone: string[] = [];
  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      const err = result.reason as { statusCode?: number };
      if (err.statusCode === 410 || err.statusCode === 404) {
        gone.push(subscriptions[i].id);
      }
    }
  });

  if (gone.length > 0) {
    await prisma.pushSubscription.updateMany({
      where: { id: { in: gone } },
      data: { isActive: false },
    });
  }
}

function buildPayload(payload: PushPayload): string {
  return JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: payload.icon || '/pwa-192x192.png',
    url: payload.url || '/',
    tag: payload.tag,
  });
}

/**
 * Send a push notification to all active subscriptions for a user.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  ensureVapidConfigured();

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId, isActive: true },
  });

  if (subscriptions.length === 0) return;
  await sendAndCleanup(subscriptions, buildPayload(payload));
}

/**
 * Send a push notification to all users with a specific role.
 */
export async function sendPushToRole(role: string, payload: PushPayload): Promise<void> {
  ensureVapidConfigured();

  const subscriptions = await prisma.pushSubscription.findMany({
    where: {
      isActive: true,
      user: { systemRole: role, isActive: true },
    },
  });

  if (subscriptions.length === 0) return;
  await sendAndCleanup(subscriptions, buildPayload(payload));
}

/**
 * Broadcast a push notification to all active subscribers.
 */
export async function broadcastPush(payload: PushPayload): Promise<void> {
  ensureVapidConfigured();

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { isActive: true },
  });

  if (subscriptions.length === 0) return;
  await sendAndCleanup(subscriptions, buildPayload(payload));
}
