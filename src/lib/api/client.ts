import axios from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15_000,
});

// ---------------------------------------------------------------------------
// Request interceptor — attach bearer token from cookie (not localStorage)
// ---------------------------------------------------------------------------
apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    // Read the token from the JS-readable cookie so localStorage is not the
    // source of truth.  When the backend sets an HttpOnly cookie this block
    // can be removed entirely (the browser will send the cookie automatically).
    const cookieToken = document.cookie
      .split('; ')
      .find((row) => row.startsWith('hiresettle_token='))
      ?.split('=')[1];

    if (cookieToken) {
      config.headers.Authorization = `Bearer ${cookieToken}`;
    }
  }
  return config;
});

// ---------------------------------------------------------------------------
// Response interceptor — handle 401s
// ---------------------------------------------------------------------------
apiClient.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      const requestUrl: string = err.config?.url ?? '';

      // Do not redirect when the 401 comes from an auth endpoint itself —
      // that would cause a redirect loop.
      const isAuthCall = requestUrl.startsWith('/auth');
      if (!isAuthCall) {
        // Lazily import the store to avoid a circular dependency at module
        // load time (client.ts ← services.ts ← use-auth-store would cycle).
        const { useAuthStore } = await import('@/lib/hooks/use-auth-store');
        useAuthStore.getState().logout();

        const callbackUrl = window.location.pathname + window.location.search;
        window.location.href = `/auth/login?callbackUrl=${encodeURIComponent(callbackUrl)}`;
      }
    }
    return Promise.reject(err);
  },
);
