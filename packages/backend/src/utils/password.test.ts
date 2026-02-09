import { hashPassword, comparePassword } from './password.js';

describe('password utilities', () => {
  describe('hashPassword', () => {
    it('returns a string different from the input', async () => {
      const password = 'mySecretPassword123';
      const hash = await hashPassword(password);

      expect(typeof hash).toBe('string');
      expect(hash).not.toBe(password);
    });

    it('returns a bcrypt hash format', async () => {
      const hash = await hashPassword('test');
      // bcrypt hashes start with $2a$ or $2b$
      expect(hash).toMatch(/^\$2[ab]\$/);
    });

    it('produces different hashes for the same password (salt)', async () => {
      const password = 'samePassword';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('comparePassword', () => {
    it('returns true for correct password', async () => {
      const password = 'correctPassword123!';
      const hash = await hashPassword(password);

      const result = await comparePassword(password, hash);
      expect(result).toBe(true);
    });

    it('returns false for wrong password', async () => {
      const hash = await hashPassword('correctPassword');

      const result = await comparePassword('wrongPassword', hash);
      expect(result).toBe(false);
    });

    it('returns false for empty password against valid hash', async () => {
      const hash = await hashPassword('somePassword');

      const result = await comparePassword('', hash);
      expect(result).toBe(false);
    });
  });
});
