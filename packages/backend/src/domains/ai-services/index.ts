/**
 * AI Services Domain — Optional AI-powered features.
 *
 * This domain is loaded conditionally when AI_ENABLED=true.
 * It provides conversational AI assistance and suggestion generation.
 *
 * Routes are registered via initAiModule() (not the standard barrel pattern)
 * because they require the Express app instance for conditional mounting.
 */

export { initAiModule } from './ai-module.js';
