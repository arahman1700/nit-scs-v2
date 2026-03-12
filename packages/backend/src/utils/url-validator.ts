import { URL } from 'node:url';

// Private/internal IP ranges that should never be accessed via webhooks
const BLOCKED_IP_PATTERNS = [
  /^127\./, // Loopback
  /^10\./, // Private class A
  /^172\.(1[6-9]|2\d|3[01])\./, // Private class B
  /^192\.168\./, // Private class C
  /^169\.254\./, // Link-local
  /^0\./, // Current network
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // Shared address space
  /^::1$/, // IPv6 loopback
  /^fe80:/i, // IPv6 link-local
  /^fc00:/i, // IPv6 unique local
  /^fd/i, // IPv6 unique local
];

const ALLOWED_SCHEMES = ['https:'];

/**
 * Validates a webhook URL to prevent SSRF attacks.
 * - Only allows https:// scheme
 * - Blocks private/internal IP addresses
 * - Blocks localhost and common internal hostnames
 */
export function validateWebhookUrl(rawUrl: string): { valid: boolean; reason?: string } {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { valid: false, reason: 'Invalid URL format' };
  }

  // Scheme check
  if (!ALLOWED_SCHEMES.includes(parsed.protocol)) {
    return { valid: false, reason: `Scheme '${parsed.protocol}' not allowed. Only HTTPS is permitted.` };
  }

  // Block localhost variants
  const hostname = parsed.hostname.toLowerCase();
  if (
    hostname === 'localhost' ||
    hostname === '0.0.0.0' ||
    hostname === '[::1]' ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.svc.cluster.local') // Kubernetes internal
  ) {
    return { valid: false, reason: `Hostname '${hostname}' is not allowed for webhooks` };
  }

  // Block private IP ranges
  for (const pattern of BLOCKED_IP_PATTERNS) {
    if (pattern.test(hostname)) {
      return { valid: false, reason: `IP address '${hostname}' is in a blocked private range` };
    }
  }

  // Block metadata endpoints (AWS, GCP, Azure)
  if (hostname === '169.254.169.254' || hostname === 'metadata.google.internal') {
    return { valid: false, reason: `Cloud metadata endpoint '${hostname}' is blocked` };
  }

  return { valid: true };
}
