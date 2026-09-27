import { AdminAuthState } from '../types';

const env = (import.meta as any).env || {};
const ADMIN_PIN = env.VITE_ADMIN_PIN || '120825';
const TOKEN_KEY = 'family_admin_token';

// Generates a local session token with expiry (30 days)
function generateSessionToken(): string {
  const payload = {
    admin: true,
    role: 'family_admin',
    iat: Date.now(),
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000,
  };
  return btoa(JSON.stringify(payload));
}

function decodeBase64Flexible(str: string): string {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  return atob(padded);
}

function isTokenValid(token: string | null): boolean {
  if (!token) return false;
  try {
    const rawDataPart = token.includes('.') ? token.split('.')[0] : token;
    const payload = JSON.parse(decodeBase64Flexible(rawDataPart));
    if (payload.admin && payload.exp && Date.now() < payload.exp) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function verifyAdminPin(
  pin: string
): Promise<{ success: boolean; token?: string; error?: string }> {
  const cleanPin = String(pin).trim();

  // Primary verification for configured 6-digit PIN (default 120825)
  if (cleanPin === ADMIN_PIN) {
    const token = generateSessionToken();
    sessionStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(TOKEN_KEY, token);
    window.dispatchEvent(new Event('family-auth-changed'));

    // Optional server sync in background without blocking login
    try {
      fetch('/api/admin/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: cleanPin }),
      }).catch(() => {});
    } catch {}

    return { success: true, token };
  }

  // Also check serverless API in case server has custom ADMIN_PIN configured in environment
  try {
    const response = await fetch('/api/admin/verify-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: cleanPin }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.success && data.token) {
        sessionStorage.setItem(TOKEN_KEY, data.token);
        localStorage.setItem(TOKEN_KEY, data.token);
        window.dispatchEvent(new Event('family-auth-changed'));
        return { success: true, token: data.token };
      }
    }
  } catch (err) {
    console.warn('[SUPABASE] Server verify check bypassed, invalid PIN provided:', err);
  }

  return { success: false, error: 'Incorrect PIN. Access denied.' };
}

export async function checkAdminSession(): Promise<boolean> {
  const token = sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
  if (!token) return false;

  if (isTokenValid(token)) {
    sessionStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(TOKEN_KEY, token);
    return true;
  }

  sessionStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_KEY);
  return false;
}

export async function logoutAdmin(): Promise<void> {
  sessionStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_KEY);
  window.dispatchEvent(new Event('family-auth-changed'));
}

export function subscribeToAuthState(callback: (state: AdminAuthState) => void): () => void {
  const checkAndUpdate = () => {
    const token = sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
    const isValid = isTokenValid(token);

    callback({
      isAuthenticated: isValid,
      isAdmin: isValid,
      method: isValid ? 'pin' : null,
      userEmail: isValid ? 'Family Admin' : null,
      userId: isValid ? 'family_admin' : null,
      token: isValid ? token : null,
    });
  };

  checkAndUpdate();

  const handleAuthChange = () => {
    checkAndUpdate();
  };

  window.addEventListener('family-auth-changed', handleAuthChange);
  window.addEventListener('storage', handleAuthChange);

  return () => {
    window.removeEventListener('family-auth-changed', handleAuthChange);
    window.removeEventListener('storage', handleAuthChange);
  };
}
