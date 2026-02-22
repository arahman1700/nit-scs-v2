import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth.js';
import { requireRole as _requireRole } from '../../middleware/rbac.js';
import { aiRateLimiter } from '../../middleware/rate-limiter.js';
import { chat, listConversations, getConversation, deleteConversation } from './ai-chat.service.js';

const chatRequestSchema = z.object({
  conversationId: z.string().uuid().optional().nullable(),
  message: z.string().min(1).max(4000),
});

const router = Router();
router.use(authenticate);

// ── Chat ───────────────────────────────────────────────────────────────

router.post('/chat', aiRateLimiter(30, 3600), async (req, res, next) => {
  try {
    const parsed = chatRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, message: 'Invalid request', errors: parsed.error.flatten().fieldErrors });
      return;
    }
    const { conversationId, message } = parsed.data;
    const result = await chat(req.user!.userId, conversationId ?? undefined, message, req.user!.systemRole);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// ── Conversations ──────────────────────────────────────────────────────

router.get('/conversations', async (req, res, next) => {
  try {
    const conversations = await listConversations(req.user!.userId);
    res.json({ success: true, data: conversations });
  } catch (err) {
    next(err);
  }
});

router.get('/conversations/:id', async (req, res, next) => {
  try {
    const conversation = await getConversation(req.params.id as string, req.user!.userId);
    if (!conversation) {
      res.status(404).json({ success: false, message: 'Conversation not found' });
      return;
    }
    res.json({ success: true, data: conversation });
  } catch (err) {
    next(err);
  }
});

router.delete('/conversations/:id', async (req, res, next) => {
  try {
    const deleted = await deleteConversation(req.params.id as string, req.user!.userId);
    if (!deleted) {
      res.status(404).json({ success: false, message: 'Conversation not found' });
      return;
    }
    res.json({ success: true, message: 'Conversation deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
