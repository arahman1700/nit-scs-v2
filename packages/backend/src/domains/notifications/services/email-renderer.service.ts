import { prisma } from '../../../utils/prisma.js';

/**
 * Render an email template by substituting {{variable}} placeholders
 * with the provided values.
 *
 * Returns null if the template does not exist or is inactive.
 */
export async function renderEmailTemplate(
  templateCode: string,
  variables: Record<string, string>,
): Promise<{ subject: string; html: string } | null> {
  const template = await prisma.emailTemplate.findUnique({
    where: { code: templateCode },
  });
  if (!template || !template.isActive) return null;

  let subject = template.subject;
  let html = template.bodyHtml;
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`;
    subject = subject.replaceAll(placeholder, value);
    html = html.replaceAll(placeholder, value);
  }
  return { subject, html };
}
