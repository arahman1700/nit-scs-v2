import { Resend } from 'resend';
import Handlebars from 'handlebars';
import jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma.js';
import { log } from '../config/logger.js';
import { getEnv } from '../config/env.js';

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
const UNSUBSCRIBE_TOKEN_EXPIRY = '365d';

// ── Unsubscribe Token ────────────────────────────────────────────────────

export interface UnsubscribePayload {
  email: string;
  templateCode: string;
  purpose: 'unsubscribe';
}

/**
 * Generate a signed JWT for email unsubscribe links.
 * The token contains the recipient email and template code, and expires in 1 year.
 */
export function generateUnsubscribeToken(recipientEmail: string, templateCode: string): string {
  const env = getEnv();
  const payload: UnsubscribePayload = {
    email: recipientEmail,
    templateCode,
    purpose: 'unsubscribe',
  };
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: UNSUBSCRIBE_TOKEN_EXPIRY });
}

/**
 * Verify and decode an unsubscribe JWT token.
 * Returns the payload or null if invalid/expired.
 */
export function verifyUnsubscribeToken(token: string): UnsubscribePayload | null {
  try {
    const env = getEnv();
    const decoded = jwt.verify(token, env.JWT_SECRET) as UnsubscribePayload;
    if (decoded.purpose !== 'unsubscribe') return null;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Build the unsubscribe URL for a given recipient and template.
 */
function buildUnsubscribeUrl(recipientEmail: string, templateCode: string): string {
  const env = getEnv();
  const token = generateUnsubscribeToken(recipientEmail, templateCode);
  const baseUrl = env.CORS_ORIGIN || 'http://localhost:4000';
  return `${baseUrl}/api/v1/notifications/unsubscribe?token=${token}`;
}

/**
 * Append a GDPR-compliant unsubscribe footer to the email HTML body.
 */
function appendUnsubscribeFooter(html: string, recipientEmail: string, templateCode: string): string {
  const unsubscribeUrl = buildUnsubscribeUrl(recipientEmail, templateCode);
  const footer = `
<hr style="border:none;border-top:1px solid #333;margin:32px 0 16px 0;" />
<p style="color:#888;font-size:11px;line-height:1.5;">
  You received this email because of your role in NIT Supply Chain.
  To manage your notification preferences, visit your settings page.
  To unsubscribe from this type of notification,
  <a href="${unsubscribeUrl}" style="color:#80D1E9;text-decoration:underline;">click here</a>.
</p>`;
  return html + footer;
}

// ── Preference Check ────────────────────────────────────────────────────

/**
 * Check if a recipient has opted out of email notifications for a given template.
 * Returns true if the email should be sent (i.e., not unsubscribed).
 */
async function isEmailEnabledForRecipient(recipientEmail: string, templateCode: string): Promise<boolean> {
  // Find the employee by email
  const employee = await prisma.employee.findUnique({
    where: { email: recipientEmail },
    select: { id: true },
  });
  if (!employee) {
    // Unknown employee — send anyway (could be external recipient)
    return true;
  }

  const pref = await prisma.notificationPreference.findUnique({
    where: {
      employeeId_templateCode: {
        employeeId: employee.id,
        templateCode,
      },
    },
    select: { emailEnabled: true },
  });

  // No preference record means default (enabled)
  if (!pref) return true;

  return pref.emailEnabled;
}

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
 * - Checks NotificationPreference before sending; skips if emailEnabled is false.
 * - Appends a GDPR-compliant unsubscribe footer to every outgoing email.
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
  const baseHtml = bodyCompiled(variables);

  // Send to each recipient
  for (const email of recipients) {
    // Check notification preference — skip if unsubscribed
    const enabled = await isEmailEnabledForRecipient(email, templateCode);
    if (!enabled) {
      log('info', `[Email] Skipping '${templateCode}' for ${email} — unsubscribed`);
      continue;
    }

    // Append unsubscribe footer per-recipient (unique token per recipient)
    const html = appendUnsubscribeFooter(baseHtml, email, templateCode);
    const unsubscribeUrl = buildUnsubscribeUrl(email, templateCode);

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

    // Attempt immediate send (with List-Unsubscribe header)
    await attemptSend(emailLog.id, email, subject, html, unsubscribeUrl);
  }
}

/**
 * Attempt to send a single email. Updates the EmailLog record.
 * Includes RFC 2369 List-Unsubscribe header when unsubscribeUrl is provided.
 */
async function attemptSend(
  logId: string,
  toEmail: string,
  subject: string,
  html: string,
  unsubscribeUrl?: string,
): Promise<boolean> {
  try {
    const resend = getResend();

    const sendPayload: {
      from: string;
      to: string;
      subject: string;
      html: string;
      headers?: Record<string, string>;
    } = {
      from: getFromEmail(),
      to: toEmail,
      subject,
      html,
    };

    // RFC 2369: List-Unsubscribe header for email client integration
    if (unsubscribeUrl) {
      sendPayload.headers = {
        'List-Unsubscribe': `<${unsubscribeUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      };
    }

    const result = await resend.emails.send(sendPayload);

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
