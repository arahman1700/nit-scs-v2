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
import aiRoutes from './ai.routes.js';
import aiSuggestionRoutes from './ai-suggestions.routes.js';
import { generateSuggestions } from './ai-suggestions.service.js';
import { logger } from '../../config/logger.js';

export function initAiModule(app: Express) {
  logger.info('AI Module: initializing...');

  // Mount routes
  app.use('/api/v1/ai', aiRoutes);
  app.use('/api/v1/ai/suggestions', aiSuggestionRoutes);

  // Schedule suggestion generation every 6 hours
  const SIX_HOURS = 6 * 60 * 60 * 1000;
  setInterval(() => {
    generateSuggestions().catch(err => logger.error({ err }, 'AI Suggestions: scheduled run failed'));
  }, SIX_HOURS);

  // Run initial analysis after 30 seconds (let other services start first)
  setTimeout(() => {
    generateSuggestions().catch(err => logger.error({ err }, 'AI Suggestions: initial run failed'));
  }, 30_000);

  logger.info('AI Module: initialized (chat + suggestions)');
}
