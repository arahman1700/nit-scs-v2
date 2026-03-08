import { describe, it, expect } from 'vitest';
import { validateWebhookUrl } from './url-validator.js';

describe('validateWebhookUrl', () => {
  // Valid URLs
  it('allows valid HTTPS URLs', () => {
    expect(validateWebhookUrl('https://api.example.com/webhook')).toEqual({ valid: true });
    expect(validateWebhookUrl('https://hooks.slack.com/services/T00/B00/xxx')).toEqual({ valid: true });
  });

  // Scheme restrictions
  it('rejects HTTP URLs', () => {
    const result = validateWebhookUrl('http://api.example.com/webhook');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('HTTPS');
  });

  it('rejects non-HTTP schemes', () => {
    expect(validateWebhookUrl('ftp://files.example.com')).toMatchObject({ valid: false });
    expect(validateWebhookUrl('file:///etc/passwd')).toMatchObject({ valid: false });
    expect(validateWebhookUrl('javascript:alert(1)')).toMatchObject({ valid: false });
  });

  // Localhost blocking
  it('rejects localhost', () => {
    expect(validateWebhookUrl('https://localhost/api')).toMatchObject({ valid: false });
    expect(validateWebhookUrl('https://localhost:3000/api')).toMatchObject({ valid: false });
  });

  it('rejects 0.0.0.0', () => {
    expect(validateWebhookUrl('https://0.0.0.0/api')).toMatchObject({ valid: false });
  });

  // Private IP blocking
  it('rejects 127.x.x.x', () => {
    expect(validateWebhookUrl('https://127.0.0.1/api')).toMatchObject({ valid: false });
    expect(validateWebhookUrl('https://127.0.0.2/api')).toMatchObject({ valid: false });
  });

  it('rejects 10.x.x.x', () => {
    expect(validateWebhookUrl('https://10.0.0.1/api')).toMatchObject({ valid: false });
    expect(validateWebhookUrl('https://10.255.255.255/api')).toMatchObject({ valid: false });
  });

  it('rejects 172.16-31.x.x', () => {
    expect(validateWebhookUrl('https://172.16.0.1/api')).toMatchObject({ valid: false });
    expect(validateWebhookUrl('https://172.31.255.255/api')).toMatchObject({ valid: false });
  });

  it('allows 172.32.x.x (not private)', () => {
    expect(validateWebhookUrl('https://172.32.0.1/api')).toEqual({ valid: true });
  });

  it('rejects 192.168.x.x', () => {
    expect(validateWebhookUrl('https://192.168.1.1/api')).toMatchObject({ valid: false });
  });

  it('rejects 169.254.x.x (link-local)', () => {
    expect(validateWebhookUrl('https://169.254.169.254/latest/meta-data/')).toMatchObject({ valid: false });
  });

  // Kubernetes/internal hostnames
  it('rejects .local and .internal hostnames', () => {
    expect(validateWebhookUrl('https://service.local/api')).toMatchObject({ valid: false });
    expect(validateWebhookUrl('https://service.internal/api')).toMatchObject({ valid: false });
    expect(validateWebhookUrl('https://my-svc.default.svc.cluster.local/api')).toMatchObject({ valid: false });
  });

  // Cloud metadata
  it('rejects cloud metadata endpoints', () => {
    expect(validateWebhookUrl('https://169.254.169.254/latest/meta-data/')).toMatchObject({ valid: false });
    expect(validateWebhookUrl('https://metadata.google.internal/computeMetadata/v1/')).toMatchObject({ valid: false });
  });

  // Invalid URLs
  it('rejects invalid URLs', () => {
    expect(validateWebhookUrl('not-a-url')).toMatchObject({ valid: false });
    expect(validateWebhookUrl('')).toMatchObject({ valid: false });
  });

  // Edge cases — SSRF bypass vectors
  it('allows HTTPS URLs with custom ports', () => {
    expect(validateWebhookUrl('https://api.example.com:8443/webhook')).toEqual({ valid: true });
  });

  it('rejects private IPs even with custom ports', () => {
    expect(validateWebhookUrl('https://10.0.0.1:8080/api')).toMatchObject({ valid: false });
    expect(validateWebhookUrl('https://192.168.1.1:443/api')).toMatchObject({ valid: false });
  });

  it('allows URLs with auth section on public hosts', () => {
    // URL parser extracts hostname correctly even with userinfo
    expect(validateWebhookUrl('https://user:pass@api.example.com/webhook')).toEqual({ valid: true });
  });

  it('rejects private hosts even with auth section', () => {
    expect(validateWebhookUrl('https://admin:pass@127.0.0.1/api')).toMatchObject({ valid: false });
    expect(validateWebhookUrl('https://admin:pass@localhost/api')).toMatchObject({ valid: false });
  });

  it('rejects IPv6 loopback in brackets', () => {
    expect(validateWebhookUrl('https://[::1]/api')).toMatchObject({ valid: false });
  });

  it('rejects shared address space (100.64-127.x.x)', () => {
    expect(validateWebhookUrl('https://100.64.0.1/api')).toMatchObject({ valid: false });
    expect(validateWebhookUrl('https://100.127.255.255/api')).toMatchObject({ valid: false });
  });

  it('allows public IP outside shared address space', () => {
    expect(validateWebhookUrl('https://100.128.0.1/api')).toEqual({ valid: true });
  });
});
