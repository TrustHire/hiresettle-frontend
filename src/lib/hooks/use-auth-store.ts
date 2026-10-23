import { create } from 'zustand';
import type { User } from '@/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Decode the `exp` claim from a JWT without verifying the signature.
 * Returns the expiry timestamp in seconds, or null when it cannot be read.
 */
function getJwtExp(token: string): number | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    // atob works in both browser and modern Node/Edge environments
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof decoded.exp === 'number' ? decoded.exp : null;
  } catch {
    return null;
  }
}

/**
 * Set the `hiresettle_token` cookie so its max-age matches the JWT's own
 * expiry.  Falls back to 7 days when the claim is absent.
 * The cookie is NOT HttpOnly here because the edge middleware needs to read it;
 * for full HttpOnly security wire up the /api/auth/session route handler noted
 * in the backend coordination comment below.
 */
function setTokenCookie(token: string): void {
  const exp = getJwtExp(token);
  const maxAge = exp ? Math.max(0, exp - Math.floor(Date.now() / 1000)) : 7 * 24 * 60 * 60;
  document.cookie = `hiresettle_token=${token}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

function clearTokenCookie(): void {
  document.cookie = 'hiresettle_token=; path=/; max-age=0; SameSite=Lax';
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface AuthState {
  address: string | null;
  /** Raw JWT – kept in memory only; the authoritative copy lives in the cookie. */
  token: string | null;
  user: User | null;
  isConnected: boolean;
  /**
   * Becomes true once `rehydrate()` has run, regardless of whether a valid
   * session was found.  Pages should wait for this before treating a null
   * address as "logged out".
   */
  isHydrated: boolean;

  setAuth: (address: string, token: string, user: User) => void;
  setAddress: (address: string) => void;
  logout: () => void;
  rehydrate: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  address: null,
  token: null,
  user: null,
  isConnected: false,
  isHydrated: false,

  setAuth: (address, token, user) => {
    if (typeof window !== 'undefined') {
      // NOTE: for full HttpOnly security, replace this with a call to a
      // Next.js route handler (e.g. POST /api/auth/session) that sets the
      // cookie server-side with HttpOnly; Secure; SameSite=Strict, and
      // coordinate the equivalent logout endpoint with hiresettle-backend.
      // The token should then NOT be stored in localStorage at all.
      localStorage.setItem('hiresettle_address', address);
      setTokenCookie(token);
    }
    set({ address, token, user, isConnected: true, isHydrated: true });
  },

  setAddress: (address) => set({ address, isConnected: true }),

  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('hiresettle_address');
      clearTokenCookie();
    }
    set({ address: null, token: null, user: null, isConnected: false, isHydrated: true });
  },

  rehydrate: () => {
    if (typeof window !== 'undefined') {
      const address = localStorage.getItem('hiresettle_address');
      // The token lives in the cookie; read it from document.cookie so the
      // in-memory value stays in sync (axios reads from the cookie directly).
      const cookieToken = document.cookie
        .split('; ')
        .find((row) => row.startsWith('hiresettle_token='))
        ?.split('=')[1] ?? null;

      if (cookieToken && address) {
        // Verify the token hasn't already expired client-side before restoring
        const exp = getJwtExp(cookieToken);
        const isExpired = exp !== null && exp < Math.floor(Date.now() / 1000);
        if (!isExpired) {
          set({ token: cookieToken, address, isConnected: true, isHydrated: true });
          return;
        }
        // Token is expired – clear stale data and fall through to isHydrated=true
        localStorage.removeItem('hiresettle_address');
        clearTokenCookie();
      } else {
        // Clean up any orphaned localStorage entry
        if (address && !cookieToken) localStorage.removeItem('hiresettle_address');
      }
    }
    // No valid session found — mark as hydrated so pages know auth is "logged out"
    set({ isHydrated: true });
  },
}));
