import { Page } from '@playwright/test';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Shared login state
let cachedToken: string | null = null;
let cachedRefreshToken: string | null = null;
let tokenExpiresAt = 0;

/**
 * Clear Redis rate limit keys.
 */
async function clearRateLimits() {
  try {
    await execAsync('docker exec nit-scs-redis redis-cli DEL "rl:auth:::1:/login" "rl:global:::1"');
  } catch {
    // ignore
  }
}

/**
 * Login via API and cache the tokens.
 */
async function getAuthTokens(): Promise<{ token: string; refreshToken: string }> {
  const now = Date.now();
  if (cachedToken && cachedRefreshToken && tokenExpiresAt > now + 120_000) {
    return { token: cachedToken, refreshToken: cachedRefreshToken };
  }

  await clearRateLimits();

  const res = await fetch('http://localhost:4000/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@nit.sa', password: 'Admin@2026!' }),
  });

  if (!res.ok) {
    throw new Error(`Login API failed: ${res.status} ${await res.text()}`);
  }

  const json = await res.json();
  const data = json.data || json;
  const token = data.accessToken || data.token;
  const _refreshToken = data.refreshToken;

  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
  tokenExpiresAt = payload.exp * 1000;

  cachedToken = token;
  cachedRefreshToken = refreshToken;

  return { token, refreshToken };
}

let navCount = 0;

/**
 * Navigate to a URL with authentication.
 * Uses addInitScript to inject tokens BEFORE any app JS runs.
 */
export async function gotoAuth(page: Page, url: string) {
  const { token, refreshToken: _refreshToken } = await getAuthTokens();

  navCount++;
  if (navCount % 30 === 0) {
    await clearRateLimits();
  }

  // Add init script that runs before any page JS - this sets the access token
  // in localStorage so the app sees it immediately on load.
  // The refresh token is handled via httpOnly cookie (set by the server).
  await page.addInitScript(
    ({ t }) => {
      try {
        localStorage.setItem('nit_scs_token', t);
      } catch {
        // ignore - might be about:blank
      }
    },
    { t: token },
  );

  // Navigate directly to target
  await page.goto(url);
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
}
