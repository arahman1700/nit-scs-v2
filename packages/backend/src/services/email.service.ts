import { Resend } from 'resend';
import Handlebars from 'handlebars';
import { prisma } from '../utils/prisma.js';
import { log } from '../config/logger.js';

// ── Resend Client (lazy init) ───────────────────────────────────────────

let resendClient: Resend | null = null;

function getResend(): Resend {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY environment variable is not set');
    }
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

function getFromEmail(): string {
  const name = process.env.RESEND_FROM_NAME || 'NIT Logistics';
  const email = process.env.RESEND_FROM_EMAIL || 'noreply@nit.sa';
  return `${name} <${email}>`;
}

// ── Constants ────────────────────────────────────────────────────────────

const MAX_RETRIES = 3;
const BATCH_SIZE = 50;

// ── Send Templated Email ────────────────────────────────────────────────

export interface SendTemplatedEmailParams {
  templateCode: string;
  to: string | string[];
  variables?: Record<string, unknown>;
  referenceTable?: string;
  referenceId?: string;
}

/**
 * Send an email using a stored Handlebars template.
 *
 * - `to` can be a direct email, an array of emails, or "role:manager" to resolve
 *   all active employees with that system role.
 * - Creates an EmailLog entry with the fully rendered HTML (for reliable retries).
 * - On failure, the email remains queued for retry by processQueuedEmails().
 */
export async function sendTemplatedEmail(params: SendTemplatedEmailParams): Promise<void> {
  const { templateCode, variables = {}, referenceTable, referenceId } = params;

  // Resolve template
  const template = await prisma.emailTemplate.findUnique({ where: { code: templateCode } });
  if (!template) {
    log('error', `[Email] Template not found: ${templateCode}`);
    return;
  }
  if (!template.isActive) {
    log('info', `[Email] Template '${templateCode}' is inactive — skipping`);
    return;
  }

  // Resolve recipients
  const recipients = await resolveRecipients(params.to);
  if (recipients.length === 0) {
    log('info', `[Email] No recipients resolved for '${templateCode}'`);
    return;
  }

  // Compile template with variables ONCE
  const subjectCompiled = Handlebars.compile(template.subject);
  const bodyCompiled = Handlebars.compile(template.bodyHtml);
  const subject = subjectCompiled(variables);
  const html = bodyCompiled(variables);

  // Send to each recipient
  for (const email of recipients) {
    // Store the rendered HTML so retries don't need the original variables
    const emailLog = await prisma.emailLog.create({
      data: {
        templateId: template.id,
        toEmail: email,
        subject,
        bodyHtml: html,
        status: 'queued',
        retryCount: 0,
        referenceTable,
        referenceId,
      },
    });

    // Attempt immediate send
    await attemptSend(emailLog.id, email, subject, html);
  }
}

/**
 * Attempt to send a single email. Updates the EmailLog record.
 */
async function attemptSend(logId: string, toEmail: string, subject: string, html: string): Promise<boolean> {
  try {
    const resend = getResend();
    const result = await resend.emails.send({
      from: getFromEmail(),
      to: toEmail,
      subject,
      html,
    });

    await prisma.emailLog.update({
      where: { id: logId },
      data: {
        status: 'sent',
        externalId: result.data?.id,
        sentAt: new Date(),
        retryCount: { increment: 1 },
      },
    });

    log('info', `[Email] Sent to ${toEmail} (id: ${result.data?.id})`);
    return true;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);

    // Check if we've exceeded retries
    const currentLog = await prisma.emailLog.findUnique({
      where: { id: logId },
      select: { retryCount: true },
    });

    const retryCount = (currentLog?.retryCount ?? 0) + 1;
    const isFinalFailure = retryCount >= MAX_RETRIES;

    await prisma.emailLog.update({
      where: { id: logId },
      data: {
        status: isFinalFailure ? 'failed' : 'queued',
        error: errorMsg,
        retryCount,
      },
    });

    log(
      isFinalFailure ? 'error' : 'warn',
      `[Email] ${isFinalFailure ? 'Permanently failed' : `Retry ${retryCount}/${MAX_RETRIES} queued`} for ${toEmail}: ${errorMsg}`,
    );
    return false;
  }
}

// ── Process Queued Emails (Retry) ────────────────────────────────────────

/**
 * Process all queued/failed-but-retriable emails.
 * Should be called by a cron/scheduler. Uses the stored rendered HTML,
 * so variables are not needed at retry time.
 *
 * Returns the number of successfully sent emails.
 */
export async function processQueuedEmails(): Promise<number> {
  const queued = await prisma.emailLog.findMany({
    where: {
      status: 'queued',
      retryCount: { lt: MAX_RETRIES },
    },
    take: BATCH_SIZE,
    orderBy: { createdAt: 'asc' },
  });

  if (queued.length === 0) return 0;

  log('info', `[Email] Processing ${queued.length} queued email(s)`);
  let sent = 0;

  for (const emailLog of queued) {
    // Use the stored rendered HTML
    const html = emailLog.bodyHtml;
    if (!html) {
      // Fallback: should not happen, but mark as failed
      await prisma.emailLog.update({
        where: { id: emailLog.id },
        data: { status: 'failed', error: 'No rendered HTML stored for retry' },
      });
      continue;
    }

    const success = await attemptSend(emailLog.id, emailLog.toEmail, emailLog.subject, html);
    if (success) sent++;

    // Small delay between sends to respect rate limits
    if (queued.length > 10) {
      await new Promise(r => setTimeout(r, 200));
    }
  }

  log('info', `[Email] Retry batch complete: ${sent}/${queued.length} sent`);
  return sent;
}

/**
 * Preview a template with sample variables (no email sent).
 */
export function previewTemplate(bodyHtml: string, subject: string, variables: Record<string, unknown>) {
  const subjectCompiled = Handlebars.compile(subject);
  const bodyCompiled = Handlebars.compile(bodyHtml);
  return {
    subject: subjectCompiled(variables),
    html: bodyCompiled(variables),
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────

async function resolveRecipients(to: string | string[]): Promise<string[]> {
  if (Array.isArray(to)) return to;

  // Role-based: "role:manager" → all active users with that role
  if (to.startsWith('role:')) {
    const role = to.slice(5);
    const employees = await prisma.employee.findMany({
      where: { systemRole: role, isActive: true },
      select: { email: true },
    });
    return employees.map(e => e.email);
  }

  return [to];
}
