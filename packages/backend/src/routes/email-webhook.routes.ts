import { Router, raw } from 'express';
import { Webhook } from 'svix';
import { prisma } from '../utils/prisma.js';
import { log } from '../config/logger.js';
import { getEnv } from '../config/env.js';

const router = Router();

/**
 * POST /api/webhooks/resend — Resend delivery webhook
 *
 * Resend sends webhook events via Svix. We verify the signature
 * using the RESEND_WEBHOOK_SECRET. If no secret is configured,
 * verification is skipped (dev mode only).
 *
 * See: https://resend.com/docs/dashboard/webhooks/introduction
 */
router.post('/resend', raw({ type: 'application/json' }), async (req, res) => {
  try {
    const env = getEnv();
    const webhookSecret = env.RESEND_WEBHOOK_SECRET;

    let payload: { type: string; data: { email_id: string; to: string[] } };

    if (webhookSecret) {
      // Verify Svix signature in production
      const svixId = req.headers['svix-id'] as string;
      const svixTimestamp = req.headers['svix-timestamp'] as string;
      const svixSignature = req.headers['svix-signature'] as string;

      if (!svixId || !svixTimestamp || !svixSignature) {
        log('warn', '[Webhook:Resend] Missing Svix headers — rejecting');
        res.status(401).json({ error: 'Missing webhook signature headers' });
        return;
      }

      const wh = new Webhook(webhookSecret);
      const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

      try {
        payload = wh.verify(body, {
          'svix-id': svixId,
          'svix-timestamp': svixTimestamp,
          'svix-signature': svixSignature,
        }) as typeof payload;
      } catch (err) {
        log('warn', `[Webhook:Resend] Invalid signature: ${(err as Error).message}`);
        res.status(401).json({ error: 'Invalid webhook signature' });
        return;
      }
    } else {
      // Development mode — no verification
      if (env.NODE_ENV === 'production') {
        log('error', '[Webhook:Resend] RESEND_WEBHOOK_SECRET not set in production — rejecting');
        res.status(500).json({ error: 'Webhook secret not configured' });
        return;
      }
      payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    }

    const { type, data } = payload;

    if (!type || !data?.email_id) {
      res.status(400).json({ error: 'Invalid webhook payload' });
      return;
    }

    // Map Resend event types to our status values
    const statusMap: Record<string, string> = {
      'email.sent': 'sent',
      'email.delivered': 'delivered',
      'email.bounced': 'bounced',
      'email.complained': 'bounced',
      'email.delivery_delayed': 'sent',
    };

    const newStatus = statusMap[type];
    if (!newStatus) {
      // Event type we don't track (e.g., email.opened)
      res.json({ received: true });
      return;
    }

    // Update the email log by external ID
    const updated = await prisma.emailLog.updateMany({
      where: { externalId: data.email_id },
      data: {
        status: newStatus,
        ...(newStatus === 'delivered' && { deliveredAt: new Date() }),
      },
    });

    log('info', `[Webhook:Resend] ${type} for ${data.email_id} → ${newStatus} (${updated.count} rows)`);
    res.json({ received: true, updated: updated.count });
  } catch (err) {
    log('error', `[Webhook:Resend] Error: ${err}`);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

export default router;
