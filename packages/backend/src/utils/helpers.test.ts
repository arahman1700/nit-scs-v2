import { describe, it, expect } from 'vitest';
import { clientIp } from './helpers.js';

describe('clientIp', () => {
  it('returns string ip as-is', () => {
    const req = { ip: '192.168.1.1' } as never;
    expect(clientIp(req)).toBe('192.168.1.1');
  });

  it('returns first element when ip is an array', () => {
    const req = { ip: ['10.0.0.1', '10.0.0.2'] } as never;
    expect(clientIp(req)).toBe('10.0.0.1');
  });

  it('returns undefined when ip is undefined', () => {
    const req = { ip: undefined } as never;
    expect(clientIp(req)).toBeUndefined();
  });
});
