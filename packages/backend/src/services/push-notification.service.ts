// ============================================================================
// Push Notification Service — Web Push (VAPID)
// ============================================================================
// Manages web push subscriptions and sends push notifications via the
// Web Push protocol. VAPID keys are resolved in order:
//   1. Environment variables (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
//   2. SystemSetting table in the database
//   3. Auto-generate and persist to SystemSetting for future restarts
// ============================================================================

import webPush from 'web-push';
import { prisma } from '../utils/prisma.js';
import { getEnv } from '../config/env.js';
import { logger } from '../config/logger.js';

// ── VAPID Key Management ────────────────────────────────────────────────────

let vapidConfigured = false;
let cachedPublicKey = '';
/** Prevents concurrent initialization races */
let configPromise: Promise<void> | null = null;

const VAPID_PUBLIC_KEY_SETTING = 'vapid_public_key';
const VAPID_PRIVATE_KEY_SETTING = 'vapid_private_key';
const VAPID_CATEGORY = 'push';

/**
 * Load VAPID keys from the SystemSetting table (global settings, userId=null).
 */
async function loadVapidKeysFromDb(): Promise<{ publicKey: string; privateKey: string } | null> {
  const rows = await prisma.systemSetting.findMany({
    where: {
      key: { in: [VAPID_PUBLIC_KEY_SETTING, VAPID_PRIVATE_KEY_SETTING] },
      userId: null,
    },
  });

  const pubRow = rows.find((r: { key: string }) => r.key === VAPID_PUBLIC_KEY_SETTING);
  const privRow = rows.find((r: { key: string }) => r.key === VAPID_PRIVATE_KEY_SETTING);

  if (pubRow?.value && privRow?.value) {
    return { publicKey: pubRow.value, privateKey: privRow.value };
  }
  return null;
}

/**
 * Persist VAPID keys to SystemSetting table so they survive server restarts.
 */
async function saveVapidKeysToDb(publicKey: string, privateKey: string): Promise<void> {
  await prisma.$transaction(async tx => {
    // Use raw transaction client for both operations
    const pubRow = await tx.systemSetting.findFirst({
      where: { key: VAPID_PUBLIC_KEY_SETTING, userId: null },
    });
    if (pubRow) {
      await tx.systemSetting.update({ where: { id: pubRow.id }, data: { value: publicKey } });
    } else {
      await tx.systemSetting.create({
        data: { key: VAPID_PUBLIC_KEY_SETTING, value: publicKey, category: VAPID_CATEGORY, userId: null },
      });
    }

    const privRow = await tx.systemSetting.findFirst({
      where: { key: VAPID_PRIVATE_KEY_SETTING, userId: null },
    });
    if (privRow) {
      await tx.systemSetting.update({ where: { id: privRow.id }, data: { value: privateKey } });
    } else {
      await tx.systemSetting.create({
        data: { key: VAPID_PRIVATE_KEY_SETTING, value: privateKey, category: VAPID_CATEGORY, userId: null },
      });
    }
  });
}

/**
 * Resolve VAPID keys with a 3-tier fallback:
 *   1. Environment variables
 *   2. SystemSetting table
 *   3. Generate new keys and persist to DB
 */
async function ensureVapidConfigured(): Promise<void> {
  if (vapidConfigured) return;

  // Prevent concurrent callers from running init in parallel
  if (configPromise) {
    await configPromise;
    return;
  }

  configPromise = (async () => {
    const env = getEnv();
    let publicKey = env.VAPID_PUBLIC_KEY;
    let privateKey = env.VAPID_PRIVATE_KEY;
    const subject: string = env.VAPID_SUBJECT ?? 'mailto:admin@nit-scs.com';

    // Step 1: env vars
    if (publicKey && privateKey) {
      logger.info('VAPID keys: loaded from environment variables');
    } else {
      // Step 2: database
      try {
        const dbKeys = await loadVapidKeysFromDb();
        if (dbKeys) {
          publicKey = dbKeys.publicKey;
          privateKey = dbKeys.privateKey;
          logger.info('VAPID keys: loaded from database (SystemSetting)');
        }
      } catch (err) {
        logger.warn({ err }, 'VAPID keys: failed to read from database — will generate new keys');
      }

      // Step 3: generate and persist
      if (!publicKey || !privateKey) {
        const generated = webPush.generateVAPIDKeys();
        publicKey = generated.publicKey;
        privateKey = generated.privateKey;

        try {
          await saveVapidKeysToDb(publicKey, privateKey);
          logger.info('VAPID keys: generated and saved to database for persistence');
        } catch (err) {
          logger.warn(
            { err },
            'VAPID keys: generated but failed to save to database — keys will be ephemeral this session',
          );
        }
      }
    }

    webPush.setVapidDetails(subject, publicKey, privateKey);
    cachedPublicKey = publicKey;
    vapidConfigured = true;
  })();

  await configPromise;
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
export async function getVapidPublicKey(): Promise<string> {
  await ensureVapidConfigured();
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
  await ensureVapidConfigured();

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
  await ensureVapidConfigured();

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
  await ensureVapidConfigured();

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
  await ensureVapidConfigured();

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { isActive: true },
  });

  if (subscriptions.length === 0) return;
  await sendAndCleanup(subscriptions, buildPayload(payload));
}
