import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import type { PrismaMock } from '../../../test-utils/prisma-mock.js';

const { mockPrisma, mockBuildSchemaPrompt, mockValidateQuery } = vi.hoisted(() => {
  return {
    mockPrisma: {} as PrismaMock & {
      aiConversation: any;
      aiMessage: any;
    },
    mockBuildSchemaPrompt: vi.fn(() => 'SCHEMA_PROMPT'),
    mockValidateQuery: vi.fn(() => ({ valid: true })),
  };
});

vi.mock('../../../utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('./ai-schema-context.js', () => ({
  buildSchemaPrompt: mockBuildSchemaPrompt,
  validateQuery: mockValidateQuery,
}));
vi.mock('../../../utils/scope-filter.js', () => ({
  buildScopeFilter: vi.fn(() => ({})),
}));
vi.mock('../../../config/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { createPrismaMock } from '../../../test-utils/prisma-mock.js';
import { chat, listConversations, getConversation, deleteConversation } from './ai-chat.service.js';

// Mock the dynamic import of Anthropic SDK
const mockAnthropicCreate = vi.fn();

// We need to mock the getAnthropicClient function's dynamic import
// by intercepting the Function constructor used for dynamic import
const originalFunction = globalThis.Function;
vi.stubGlobal(
  'Function',
  vi.fn((...args: string[]) => {
    // Intercept the dynamic import call for '@anthropic-ai/sdk'
    if (args[0] === 'p' && args[1]?.includes('import(p)')) {
      return () =>
        Promise.resolve({
          Anthropic: class {
            messages = { create: mockAnthropicCreate };
          },
        });
    }
    return new originalFunction(...args);
  }),
);

function createModelMock() {
  return {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
    upsert: vi.fn(),
    aggregate: vi.fn(),
  };
}

describe('ai-chat.service', () => {
  beforeEach(() => {
    Object.assign(mockPrisma, createPrismaMock());
    (mockPrisma as any).aiConversation = createModelMock();
    (mockPrisma as any).aiMessage = createModelMock();
    mockAnthropicCreate.mockReset();
    mockValidateQuery.mockReturnValue({ valid: true });
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
    vi.stubEnv('AI_ALLOW_SQL_EXECUTION', 'false');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // ---------------------------------------------------------------------------
  // chat — conversation creation
  // ---------------------------------------------------------------------------
  describe('chat', () => {
    it('should create a new conversation when conversationId is undefined', async () => {
      mockPrisma.aiConversation.create.mockResolvedValue({ id: 'conv-1' });
      mockPrisma.aiMessage.create.mockResolvedValue({});
      mockPrisma.aiMessage.findMany.mockResolvedValue([{ role: 'user', content: 'hello', createdAt: new Date() }]);
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: '{"query": null, "explanation": "Hello!"}' }],
      });

      const result = await chat('user-1', undefined, 'hello', 'admin');

      expect(mockPrisma.aiConversation.create).toHaveBeenCalledWith({
        data: { userId: 'user-1', title: 'hello' },
      });
      expect(result.conversationId).toBe('conv-1');
    });

    it('should use existing conversationId when provided', async () => {
      mockPrisma.aiMessage.create.mockResolvedValue({});
      mockPrisma.aiMessage.findMany.mockResolvedValue([{ role: 'user', content: 'test', createdAt: new Date() }]);
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: '{"query": null, "explanation": "OK"}' }],
      });

      const result = await chat('user-1', 'existing-conv', 'test', 'admin');

      expect(mockPrisma.aiConversation.create).not.toHaveBeenCalled();
      expect(result.conversationId).toBe('existing-conv');
    });

    it('should save user message to database', async () => {
      mockPrisma.aiMessage.create.mockResolvedValue({});
      mockPrisma.aiMessage.findMany.mockResolvedValue([]);
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'plain response' }],
      });

      await chat('user-1', 'conv-1', 'my question', 'admin');

      expect(mockPrisma.aiMessage.create).toHaveBeenCalledWith({
        data: { conversationId: 'conv-1', role: 'user', content: 'my question' },
      });
    });

    it('should load conversation history limited to 10 messages', async () => {
      mockPrisma.aiMessage.create.mockResolvedValue({});
      mockPrisma.aiMessage.findMany.mockResolvedValue([]);
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'response' }],
      });

      await chat('user-1', 'conv-1', 'test', 'admin');

      expect(mockPrisma.aiMessage.findMany).toHaveBeenCalledWith({
        where: { conversationId: 'conv-1' },
        orderBy: { createdAt: 'asc' },
        take: 10,
      });
    });

    it('should return plain text when AI response is not JSON', async () => {
      mockPrisma.aiMessage.create.mockResolvedValue({});
      mockPrisma.aiMessage.findMany.mockResolvedValue([]);
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Just a plain answer' }],
      });

      const result = await chat('user-1', 'conv-1', 'test', 'admin');

      expect(result.message.content).toBe('Just a plain answer');
      expect(result.message.generatedQuery).toBeUndefined();
    });

    it('should return explanation when query is null in JSON response', async () => {
      mockPrisma.aiMessage.create.mockResolvedValue({});
      mockPrisma.aiMessage.findMany.mockResolvedValue([]);
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: '{"query": null, "explanation": "Cannot answer with SQL"}' }],
      });

      const result = await chat('user-1', 'conv-1', 'test', 'admin');

      expect(result.message.content).toBe('Cannot answer with SQL');
      expect(result.message.generatedQuery).toBeUndefined();
    });

    it('should block query when validation fails', async () => {
      mockPrisma.aiMessage.create.mockResolvedValue({});
      mockPrisma.aiMessage.findMany.mockResolvedValue([]);
      mockValidateQuery.mockReturnValue({ valid: false, reason: 'DROP TABLE detected' });
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: '{"query": "DROP TABLE users", "explanation": "Nope"}' }],
      });

      const result = await chat('user-1', 'conv-1', 'test', 'admin');

      expect(result.message.content).toContain('blocked for safety');
      expect(result.message.content).toContain('DROP TABLE detected');
      expect(result.message.generatedQuery).toBeUndefined();
    });

    it('should not execute query when AI_ALLOW_SQL_EXECUTION is false', async () => {
      vi.stubEnv('AI_ALLOW_SQL_EXECUTION', 'false');
      mockPrisma.aiMessage.create.mockResolvedValue({});
      mockPrisma.aiMessage.findMany.mockResolvedValue([]);
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: '{"query": "SELECT * FROM items", "explanation": "All items"}' }],
      });

      const result = await chat('user-1', 'conv-1', 'test', 'admin');

      expect(result.message.content).toContain('Query execution is disabled');
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('should not execute query for non-admin users even if SQL execution is enabled', async () => {
      vi.stubEnv('AI_ALLOW_SQL_EXECUTION', 'true');
      mockPrisma.aiMessage.create.mockResolvedValue({});
      mockPrisma.aiMessage.findMany.mockResolvedValue([]);
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: '{"query": "SELECT * FROM items", "explanation": "Items"}' }],
      });

      const result = await chat('user-1', 'conv-1', 'test', 'warehouse_staff');

      expect(result.message.content).toContain('restricted to admin');
    });

    it('should execute query for admin when SQL execution is enabled', async () => {
      vi.stubEnv('AI_ALLOW_SQL_EXECUTION', 'true');
      mockPrisma.aiMessage.create.mockResolvedValue({});
      mockPrisma.aiMessage.findMany.mockResolvedValue([]);
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: '{"query": "SELECT * FROM items", "explanation": "All items"}' }],
      });

      const queryResult = [{ id: '1', item_name: 'Bolt' }];
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        return fn({
          $executeRaw: vi.fn(),
          $queryRaw: vi.fn().mockResolvedValue(queryResult),
        });
      });

      const result = await chat('user-1', 'conv-1', 'test', 'admin');

      expect(result.message.content).toBe('All items');
      expect(result.message.resultData).toEqual(queryResult);
    });

    it('should handle query execution failure gracefully', async () => {
      vi.stubEnv('AI_ALLOW_SQL_EXECUTION', 'true');
      mockPrisma.aiMessage.create.mockResolvedValue({});
      mockPrisma.aiMessage.findMany.mockResolvedValue([]);
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: '{"query": "SELECT bad", "explanation": "Oops"}' }],
      });
      mockPrisma.$transaction.mockRejectedValue(new Error('SQL error'));

      const result = await chat('user-1', 'conv-1', 'test', 'admin');

      expect(result.message.content).toContain('tried to run a query but it failed');
    });

    it('should save assistant message to database', async () => {
      mockPrisma.aiMessage.create.mockResolvedValue({});
      mockPrisma.aiMessage.findMany.mockResolvedValue([]);
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'a response' }],
      });

      await chat('user-1', 'conv-1', 'test', 'admin');

      // Second create call is the assistant message
      const calls = mockPrisma.aiMessage.create.mock.calls;
      expect(calls.length).toBe(2);
      expect(calls[1][0].data.role).toBe('assistant');
      expect(calls[1][0].data.content).toBe('a response');
    });

    it('should truncate conversation title to 100 characters', async () => {
      const longMessage = 'x'.repeat(200);
      mockPrisma.aiConversation.create.mockResolvedValue({ id: 'conv-new' });
      mockPrisma.aiMessage.create.mockResolvedValue({});
      mockPrisma.aiMessage.findMany.mockResolvedValue([]);
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'ok' }],
      });

      await chat('user-1', undefined, longMessage, 'admin');

      expect(mockPrisma.aiConversation.create).toHaveBeenCalledWith({
        data: { userId: 'user-1', title: longMessage.slice(0, 100) },
      });
    });

    it('should return correct ChatResult structure', async () => {
      mockPrisma.aiMessage.create.mockResolvedValue({});
      mockPrisma.aiMessage.findMany.mockResolvedValue([]);
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'response text' }],
      });

      const result = await chat('user-1', 'conv-1', 'test', 'admin');

      expect(result).toEqual({
        conversationId: 'conv-1',
        message: {
          role: 'assistant',
          content: 'response text',
          generatedQuery: undefined,
          resultData: undefined,
        },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // listConversations
  // ---------------------------------------------------------------------------
  describe('listConversations', () => {
    it('should query conversations for the given user', async () => {
      mockPrisma.aiConversation.findMany.mockResolvedValue([]);

      await listConversations('user-1');

      expect(mockPrisma.aiConversation.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { updatedAt: 'desc' },
        take: 20,
        include: { _count: { select: { messages: true } } },
      });
    });

    it('should return the list from prisma', async () => {
      const convs = [{ id: 'c1' }, { id: 'c2' }];
      mockPrisma.aiConversation.findMany.mockResolvedValue(convs);

      const result = await listConversations('user-1');

      expect(result).toEqual(convs);
    });
  });

  // ---------------------------------------------------------------------------
  // getConversation
  // ---------------------------------------------------------------------------
  describe('getConversation', () => {
    it('should find conversation by id and userId', async () => {
      mockPrisma.aiConversation.findFirst.mockResolvedValue({ id: 'conv-1' });

      await getConversation('conv-1', 'user-1');

      expect(mockPrisma.aiConversation.findFirst).toHaveBeenCalledWith({
        where: { id: 'conv-1', userId: 'user-1' },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      });
    });

    it('should return null when conversation not found', async () => {
      mockPrisma.aiConversation.findFirst.mockResolvedValue(null);

      const result = await getConversation('missing', 'user-1');

      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // deleteConversation
  // ---------------------------------------------------------------------------
  describe('deleteConversation', () => {
    it('should delete conversation and return true when found', async () => {
      mockPrisma.aiConversation.deleteMany.mockResolvedValue({ count: 1 });

      const result = await deleteConversation('conv-1', 'user-1');

      expect(result).toBe(true);
      expect(mockPrisma.aiConversation.deleteMany).toHaveBeenCalledWith({
        where: { id: 'conv-1', userId: 'user-1' },
      });
    });

    it('should return false when no conversation was deleted', async () => {
      mockPrisma.aiConversation.deleteMany.mockResolvedValue({ count: 0 });

      const result = await deleteConversation('missing', 'user-1');

      expect(result).toBe(false);
    });
  });
});
