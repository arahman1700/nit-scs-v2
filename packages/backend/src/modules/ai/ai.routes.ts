import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireRole as _requireRole } from '../../middleware/rbac.js';
import { chat, listConversations, getConversation, deleteConversation } from './ai-chat.service.js';

const router = Router();
router.use(authenticate);

// ── Chat ───────────────────────────────────────────────────────────────

router.post('/chat', async (req, res, next) => {
  try {
    const { conversationId, message } = req.body;
    const result = await chat(req.user!.userId, conversationId, message, req.user!.systemRole);
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
    const conversation = await getConversation(req.params.id as string);
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
    await deleteConversation(req.params.id as string);
    res.json({ success: true, message: 'Conversation deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
