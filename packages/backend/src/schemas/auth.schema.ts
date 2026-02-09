import { z } from 'zod';

// ── Password Strength ───────────────────────────────────────────────────

const strongPassword = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must not exceed 128 characters')
  .refine(val => /[A-Z]/.test(val), 'Password must contain at least one uppercase letter')
  .refine(val => /[a-z]/.test(val), 'Password must contain at least one lowercase letter')
  .refine(val => /[0-9]/.test(val), 'Password must contain at least one number');

// ── Schemas ─────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: z.string().email('Valid email is required'),
  password: z.string().min(1, 'Password is required'),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: strongPassword,
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Valid email is required'),
});

export const resetPasswordSchema = z.object({
  email: z.string().email('Valid email is required'),
  code: z.string().min(6, 'Code must be 6 digits').max(6, 'Code must be 6 digits'),
  newPassword: strongPassword,
});
