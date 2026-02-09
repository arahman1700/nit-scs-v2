import type { PrismaMock } from '../test-utils/prisma-mock.js';

// ── Hoisted mock container ──────────────────────────────────────────────
const { mockPrisma, mockEmails } = vi.hoisted(() => {
  // Use a stable object so the lazily-cached Resend instance keeps a live reference
  const mockEmails = { send: vi.fn() };
  return {
    mockPrisma: {} as PrismaMock,
    mockEmails,
  };
});

vi.mock('../utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../config/logger.js', () => ({ log: vi.fn() }));
vi.mock('resend', () => ({
  Resend: class {
    emails = mockEmails;
  },
}));

import { createPrismaMock } from '../test-utils/prisma-mock.js';
import { sendTemplatedEmail, processQueuedEmails, previewTemplate } from './email.service.js';

// ── Helpers ─────────────────────────────────────────────────────────────

const mockSend = mockEmails.send;

const activeTemplate = {
  id: 'tpl-1',
  code: 'test_template',
  subject: 'Hello {{name}}',
  bodyHtml: '<p>Hi {{name}}</p>',
  isActive: true,
};

const inactiveTemplate = {
  ...activeTemplate,
  id: 'tpl-2',
  code: 'inactive',
  isActive: false,
};

describe('email.service', () => {
  beforeEach(() => {
    Object.assign(mockPrisma, createPrismaMock());
    mockSend.mockReset();
    process.env.RESEND_API_KEY = 'test-key';
    process.env.RESEND_FROM_NAME = 'Test';
    process.env.RESEND_FROM_EMAIL = 'test@test.com';
  });

  afterEach(() => {
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM_NAME;
    delete process.env.RESEND_FROM_EMAIL;
  });

  // ─────────────────────────────────────────────────────────────────────────
  // sendTemplatedEmail
  // ─────────────────────────────────────────────────────────────────────────
  describe('sendTemplatedEmail', () => {
    it('should send to a direct email address', async () => {
      mockPrisma.emailTemplate.findUnique.mockResolvedValue(activeTemplate);
      mockPrisma.emailLog.create.mockResolvedValue({ id: 'log-1' });
      mockSend.mockResolvedValue({ data: { id: 'ext-1' } });
      mockPrisma.emailLog.update.mockResolvedValue({});

      await sendTemplatedEmail({
        templateCode: 'test_template',
        to: 'user@test.com',
        variables: { name: 'John' },
      });

      expect(mockPrisma.emailLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          toEmail: 'user@test.com',
          subject: 'Hello John',
          bodyHtml: '<p>Hi John</p>',
          status: 'queued',
        }),
      });
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@test.com',
          subject: 'Hello John',
          html: '<p>Hi John</p>',
        }),
      );
    });

    it('should send to an array of email addresses', async () => {
      mockPrisma.emailTemplate.findUnique.mockResolvedValue(activeTemplate);
      mockPrisma.emailLog.create.mockResolvedValue({ id: 'log-1' });
      mockSend.mockResolvedValue({ data: { id: 'ext-1' } });
      mockPrisma.emailLog.update.mockResolvedValue({});

      await sendTemplatedEmail({
        templateCode: 'test_template',
        to: ['a@test.com', 'b@test.com'],
        variables: { name: 'Team' },
      });

      expect(mockPrisma.emailLog.create).toHaveBeenCalledTimes(2);
      expect(mockSend).toHaveBeenCalledTimes(2);
    });

    it('should resolve role-based recipients', async () => {
      mockPrisma.emailTemplate.findUnique.mockResolvedValue(activeTemplate);
      mockPrisma.employee.findMany.mockResolvedValue([{ email: 'manager1@test.com' }, { email: 'manager2@test.com' }]);
      mockPrisma.emailLog.create.mockResolvedValue({ id: 'log-1' });
      mockSend.mockResolvedValue({ data: { id: 'ext-1' } });
      mockPrisma.emailLog.update.mockResolvedValue({});

      await sendTemplatedEmail({
        templateCode: 'test_template',
        to: 'role:manager',
        variables: { name: 'Admin' },
      });

      expect(mockPrisma.employee.findMany).toHaveBeenCalledWith({
        where: { systemRole: 'manager', isActive: true },
        select: { email: true },
      });
      expect(mockPrisma.emailLog.create).toHaveBeenCalledTimes(2);
    });

    it('should skip when template is not found', async () => {
      mockPrisma.emailTemplate.findUnique.mockResolvedValue(null);

      await sendTemplatedEmail({
        templateCode: 'unknown_template',
        to: 'user@test.com',
      });

      expect(mockPrisma.emailLog.create).not.toHaveBeenCalled();
      expect(mockSend).not.toHaveBeenCalled();
    });

    it('should skip when template is inactive', async () => {
      mockPrisma.emailTemplate.findUnique.mockResolvedValue(inactiveTemplate);

      await sendTemplatedEmail({
        templateCode: 'inactive',
        to: 'user@test.com',
      });

      expect(mockPrisma.emailLog.create).not.toHaveBeenCalled();
      expect(mockSend).not.toHaveBeenCalled();
    });

    it('should skip when no recipients are resolved', async () => {
      mockPrisma.emailTemplate.findUnique.mockResolvedValue(activeTemplate);
      mockPrisma.employee.findMany.mockResolvedValue([]);

      await sendTemplatedEmail({
        templateCode: 'test_template',
        to: 'role:nonexistent',
      });

      expect(mockPrisma.emailLog.create).not.toHaveBeenCalled();
    });

    it('should create EmailLog per recipient with correct templateId', async () => {
      mockPrisma.emailTemplate.findUnique.mockResolvedValue(activeTemplate);
      mockPrisma.emailLog.create.mockResolvedValue({ id: 'log-1' });
      mockSend.mockResolvedValue({ data: { id: 'ext-1' } });
      mockPrisma.emailLog.update.mockResolvedValue({});

      await sendTemplatedEmail({
        templateCode: 'test_template',
        to: ['x@test.com', 'y@test.com'],
        variables: { name: 'Z' },
        referenceTable: 'mirv',
        referenceId: 'mirv-1',
      });

      for (const call of mockPrisma.emailLog.create.mock.calls) {
        expect(call[0].data.templateId).toBe('tpl-1');
        expect(call[0].data.referenceTable).toBe('mirv');
        expect(call[0].data.referenceId).toBe('mirv-1');
        expect(call[0].data.retryCount).toBe(0);
      }
    });

    it('should handle send failure gracefully and keep email queued', async () => {
      mockPrisma.emailTemplate.findUnique.mockResolvedValue(activeTemplate);
      mockPrisma.emailLog.create.mockResolvedValue({ id: 'log-1' });
      mockSend.mockRejectedValue(new Error('API error'));
      mockPrisma.emailLog.findUnique.mockResolvedValue({ retryCount: 0 });
      mockPrisma.emailLog.update.mockResolvedValue({});

      // Should not throw
      await sendTemplatedEmail({
        templateCode: 'test_template',
        to: 'user@test.com',
        variables: { name: 'Fail' },
      });

      // emailLog.update should be called to set error
      const updateCall = mockPrisma.emailLog.update.mock.calls[0][0];
      expect(updateCall.data.status).toBe('queued');
      expect(updateCall.data.error).toBe('API error');
    });

    it('should mark as failed after max retries', async () => {
      mockPrisma.emailTemplate.findUnique.mockResolvedValue(activeTemplate);
      mockPrisma.emailLog.create.mockResolvedValue({ id: 'log-1' });
      mockSend.mockRejectedValue(new Error('API down'));
      // Already at retryCount 2 → +1 = 3 >= MAX_RETRIES
      mockPrisma.emailLog.findUnique.mockResolvedValue({ retryCount: 2 });
      mockPrisma.emailLog.update.mockResolvedValue({});

      await sendTemplatedEmail({
        templateCode: 'test_template',
        to: 'user@test.com',
        variables: { name: 'Final' },
      });

      const updateCall = mockPrisma.emailLog.update.mock.calls[0][0];
      expect(updateCall.data.status).toBe('failed');
    });

    it('should update emailLog with externalId on success', async () => {
      mockPrisma.emailTemplate.findUnique.mockResolvedValue(activeTemplate);
      mockPrisma.emailLog.create.mockResolvedValue({ id: 'log-1' });
      mockSend.mockResolvedValue({ data: { id: 'resend-abc-123' } });
      mockPrisma.emailLog.update.mockResolvedValue({});

      await sendTemplatedEmail({
        templateCode: 'test_template',
        to: 'user@test.com',
        variables: { name: 'Success' },
      });

      const updateCall = mockPrisma.emailLog.update.mock.calls[0][0];
      expect(updateCall.data.status).toBe('sent');
      expect(updateCall.data.externalId).toBe('resend-abc-123');
      expect(updateCall.data.sentAt).toBeInstanceOf(Date);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // processQueuedEmails
  // ─────────────────────────────────────────────────────────────────────────
  describe('processQueuedEmails', () => {
    it('should process queued emails and return sent count', async () => {
      const queuedEmails = [
        { id: 'log-1', toEmail: 'a@test.com', subject: 'Sub 1', bodyHtml: '<p>Body 1</p>', retryCount: 0 },
        { id: 'log-2', toEmail: 'b@test.com', subject: 'Sub 2', bodyHtml: '<p>Body 2</p>', retryCount: 1 },
      ];
      mockPrisma.emailLog.findMany.mockResolvedValue(queuedEmails);
      mockSend.mockResolvedValue({ data: { id: 'ext-1' } });
      mockPrisma.emailLog.update.mockResolvedValue({});

      const sent = await processQueuedEmails();

      expect(sent).toBe(2);
      expect(mockSend).toHaveBeenCalledTimes(2);
    });

    it('should return 0 when no queued emails exist', async () => {
      mockPrisma.emailLog.findMany.mockResolvedValue([]);

      const sent = await processQueuedEmails();

      expect(sent).toBe(0);
      expect(mockSend).not.toHaveBeenCalled();
    });

    it('should mark emails with missing bodyHtml as failed', async () => {
      const queuedEmails = [{ id: 'log-1', toEmail: 'a@test.com', subject: 'Sub', bodyHtml: null, retryCount: 0 }];
      mockPrisma.emailLog.findMany.mockResolvedValue(queuedEmails);
      mockPrisma.emailLog.update.mockResolvedValue({});

      const sent = await processQueuedEmails();

      expect(sent).toBe(0);
      expect(mockPrisma.emailLog.update).toHaveBeenCalledWith({
        where: { id: 'log-1' },
        data: { status: 'failed', error: 'No rendered HTML stored for retry' },
      });
      expect(mockSend).not.toHaveBeenCalled();
    });

    it('should handle partial failures in batch', async () => {
      const queuedEmails = [
        { id: 'log-1', toEmail: 'a@test.com', subject: 'Sub 1', bodyHtml: '<p>1</p>', retryCount: 0 },
        { id: 'log-2', toEmail: 'b@test.com', subject: 'Sub 2', bodyHtml: '<p>2</p>', retryCount: 0 },
      ];
      mockPrisma.emailLog.findMany.mockResolvedValue(queuedEmails);
      mockSend
        .mockResolvedValueOnce({ data: { id: 'ext-1' } }) // first succeeds
        .mockRejectedValueOnce(new Error('rate limited')); // second fails
      mockPrisma.emailLog.update.mockResolvedValue({});
      mockPrisma.emailLog.findUnique.mockResolvedValue({ retryCount: 0 });

      const sent = await processQueuedEmails();

      expect(sent).toBe(1);
    });

    it('should query emails with status queued and retryCount < 3', async () => {
      mockPrisma.emailLog.findMany.mockResolvedValue([]);

      await processQueuedEmails();

      expect(mockPrisma.emailLog.findMany).toHaveBeenCalledWith({
        where: {
          status: 'queued',
          retryCount: { lt: 3 },
        },
        take: 50,
        orderBy: { createdAt: 'asc' },
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // previewTemplate
  // ─────────────────────────────────────────────────────────────────────────
  describe('previewTemplate', () => {
    it('should compile Handlebars subject and body', () => {
      const result = previewTemplate('<h1>Welcome {{name}}</h1>', 'Welcome {{name}}!', { name: 'Alice' });

      expect(result.subject).toBe('Welcome Alice!');
      expect(result.html).toBe('<h1>Welcome Alice</h1>');
    });

    it('should handle empty variables', () => {
      const result = previewTemplate('<p>Static content</p>', 'Static subject', {});

      expect(result.subject).toBe('Static subject');
      expect(result.html).toBe('<p>Static content</p>');
    });

    it('should handle multiple variables', () => {
      const result = previewTemplate(
        '<p>{{greeting}} {{name}}, your order #{{orderId}} is ready.</p>',
        '{{greeting}} {{name}}',
        { greeting: 'Hi', name: 'Bob', orderId: '12345' },
      );

      expect(result.subject).toBe('Hi Bob');
      expect(result.html).toBe('<p>Hi Bob, your order #12345 is ready.</p>');
    });

    it('should leave undefined variables as empty string', () => {
      const result = previewTemplate('<p>Hello {{name}}</p>', 'For {{name}}', {});

      expect(result.subject).toBe('For ');
      expect(result.html).toBe('<p>Hello </p>');
    });
  });
});
