/**
 * AI Module — Optional, loaded conditionally when AI_ENABLED=true
 *
 * Provides:
 * - /api/v1/ai/chat — conversational AI assistant
 * - /api/v1/ai/conversations — conversation history
 * - /api/v1/ai/suggestions — AI-generated actionable suggestions
 * - Periodic suggestion generation (every 6 hours)
 */

import type { Express } from 'express';
import { logger } from '../../config/logger.js';
import aiRoutes from './routes/ai.routes.js';
import aiSuggestionRoutes from './routes/ai-suggestions.routes.js';
import { generateSuggestions } from './services/ai-suggestions.service.js';

export function initAiModule(app: Express) {
  logger.info('AI Module: initializing...');

  app.use('/api/v1/ai', aiRoutes);
  app.use('/api/v1/ai/suggestions', aiSuggestionRoutes);

  const SIX_HOURS = 6 * 60 * 60 * 1000;
  setInterval(() => {
    generateSuggestions().catch(err => logger.error({ err }, 'AI Suggestions: scheduled run failed'));
  }, SIX_HOURS);

  setTimeout(() => {
    generateSuggestions().catch(err => logger.error({ err }, 'AI Suggestions: initial run failed'));
  }, 30_000);

  logger.info('AI Module: initialized (chat + suggestions)');
}
