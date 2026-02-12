import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { listSuggestions, dismissSuggestion, applySuggestion, generateSuggestions } from './ai-suggestions.service.js';

const router = Router();
router.use(authenticate);

// ── List Suggestions ───────────────────────────────────────────────────

router.get('/', async (req, res, next) => {
  try {
    const status = req.query.status as string | undefined;
    const suggestions = await listSuggestions(status);
    res.json({ success: true, data: suggestions });
  } catch (err) {
    next(err);
  }
});

// ── Dismiss a Suggestion ───────────────────────────────────────────────

router.put('/:id/dismiss', async (req, res, next) => {
  try {
    const suggestion = await dismissSuggestion(req.params.id as string);
    res.json({ success: true, data: suggestion });
  } catch (err) {
    next(err);
  }
});

// ── Apply a Suggestion ─────────────────────────────────────────────────

router.put('/:id/apply', async (req, res, next) => {
  try {
    const suggestion = await applySuggestion(req.params.id as string);
    res.json({ success: true, data: suggestion });
  } catch (err) {
    next(err);
  }
});

// ── Manually Trigger Analysis (Admin) ──────────────────────────────────

router.post('/analyze', requireRole('admin'), async (_req, res, next) => {
  try {
    const count = await generateSuggestions();
    res.json({ success: true, data: { created: count } });
  } catch (err) {
    next(err);
  }
});

export default router;
