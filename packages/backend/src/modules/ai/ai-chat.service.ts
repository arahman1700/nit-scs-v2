/**
 * AI Chat Service — handles conversations with Claude
 *
 * Flow: User question → schema context + question sent to Claude →
 *       Claude generates SQL → validate → execute → format response
 */

import { prisma } from '../../utils/prisma.js';
import { logger } from '../../config/logger.js';
import { buildSchemaPrompt, validateQuery } from './ai-schema-context.js';
import { buildScopeFilter as _buildScopeFilter } from '../../utils/scope-filter.js';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatResult {
  conversationId: string;
  message: {
    role: 'assistant';
    content: string;
    generatedQuery?: string;
    resultData?: unknown;
  };
}

// ── Lazy-load Anthropic SDK ────────────────────────────────────────────
interface AnthropicClient {
  messages: {
    create(params: {
      model: string;
      max_tokens: number;
      system: string;
      messages: Array<{ role: string; content: string }>;
    }): Promise<{ content: Array<{ type: string; text?: string }> }>;
  };
}

let anthropicClient: AnthropicClient | null = null;

async function getAnthropicClient(): Promise<AnthropicClient> {
  if (anthropicClient) return anthropicClient;
  // Dynamic import — @anthropic-ai/sdk is an optional peer dependency.
  // We use a variable to prevent TypeScript from resolving the module at compile time.
  const pkgName = '@anthropic-ai/sdk';
  const mod = await (Function('p', 'return import(p)')(pkgName) as Promise<{
    Anthropic?: new (opts: { apiKey?: string }) => unknown;
    default?: { Anthropic?: new (opts: { apiKey?: string }) => unknown };
  }>);
  const Anthropic = mod.Anthropic ?? mod.default?.Anthropic;
  if (!Anthropic) throw new Error('Failed to load @anthropic-ai/sdk — make sure it is installed.');
  anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) as unknown as AnthropicClient;
  return anthropicClient;
}

// ── System prompt ──────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a helpful supply chain management assistant for the NIT SCS system.
You help users answer questions about their data by generating SQL queries.

${buildSchemaPrompt()}

Rules:
1. ONLY generate SELECT queries — never INSERT, UPDATE, DELETE, or DDL.
2. ONLY use tables and columns from the schema above.
3. Always add LIMIT to prevent large result sets (default LIMIT 100).
4. Return your response in this exact JSON format:
   { "query": "SELECT ...", "explanation": "Brief explanation of what the query does" }
5. If the question cannot be answered with a SQL query, respond with:
   { "query": null, "explanation": "Your helpful text answer here" }
6. Use PostgreSQL syntax.
7. For date ranges, use NOW() - INTERVAL '...' syntax.
8. Join tables as needed to provide comprehensive answers.`;

// ── Chat ───────────────────────────────────────────────────────────────

export async function chat(
  userId: string,
  conversationId: string | undefined,
  message: string,
  _userRole: string,
  _userProjectId?: string,
): Promise<ChatResult> {
  // Get or create conversation
  let convId = conversationId;
  if (!convId) {
    const conv = await prisma.aiConversation.create({
      data: {
        userId,
        title: message.slice(0, 100),
      },
    });
    convId = conv.id;
  }

  // Save user message
  await prisma.aiMessage.create({
    data: {
      conversationId: convId,
      role: 'user',
      content: message,
    },
  });

  // Load conversation history (last 10 messages for context window)
  const history = await prisma.aiMessage.findMany({
    where: { conversationId: convId },
    orderBy: { createdAt: 'asc' },
    take: 10,
  });

  const messages: ChatMessage[] = history.map(m => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

  // Call Claude
  const client = await getAnthropicClient();
  const response = await client.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: messages.map(m => ({ role: m.role, content: m.content })),
  });

  const assistantText = response.content
    .filter(c => c.type === 'text' && c.text)
    .map(c => c.text!)
    .join('\n');

  // Try to parse AI response as JSON with query
  let generatedQuery: string | undefined;
  let resultData: unknown = undefined;
  let finalContent: string;

  try {
    const parsed = JSON.parse(assistantText) as Record<string, unknown>;
    const query = parsed.query as string | undefined;
    const explanation = parsed.explanation as string | undefined;
    if (query) {
      generatedQuery = query;

      // Validate the query
      const validation = validateQuery(query);
      if (!validation.valid) {
        finalContent = `I generated a query but it was blocked for safety: ${validation.reason}\n\n${explanation || ''}`;
        generatedQuery = undefined;
      } else {
        // Execute the query inside a read-only transaction with 5s timeout
        try {
          resultData = await prisma.$transaction(
            async tx => {
              await tx.$queryRawUnsafe('SET TRANSACTION READ ONLY');
              return tx.$queryRawUnsafe(query);
            },
            { timeout: 5000 },
          );
          finalContent = explanation || 'Here are the results.';
        } catch (queryErr) {
          logger.warn({ err: queryErr, query }, 'AI query execution failed');
          finalContent = `I tried to run a query but it failed. ${explanation || 'Let me try differently.'}`;
        }
      }
    } else {
      finalContent = explanation || assistantText;
    }
  } catch {
    // Not JSON — use as plain text answer
    finalContent = assistantText;
  }

  // Save assistant message
  await prisma.aiMessage.create({
    data: {
      conversationId: convId,
      role: 'assistant',
      content: finalContent,
      generatedQuery,
      resultData: resultData ? (resultData as object) : undefined,
    },
  });

  return {
    conversationId: convId,
    message: {
      role: 'assistant',
      content: finalContent,
      generatedQuery,
      resultData,
    },
  };
}

// ── Conversation Management ────────────────────────────────────────────

export async function listConversations(userId: string) {
  return prisma.aiConversation.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    take: 20,
    include: { _count: { select: { messages: true } } },
  });
}

export async function getConversation(conversationId: string) {
  return prisma.aiConversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
    },
  });
}

export async function deleteConversation(conversationId: string) {
  await prisma.aiConversation.delete({ where: { id: conversationId } });
}
