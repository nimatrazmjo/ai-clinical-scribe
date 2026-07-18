import type { ApiErrorEnvelope } from '@contracts';

// Where the API lives, resolved in priority order:
//   1. An explicit, non-empty VITE_API_URL (escape hatch — e.g. point local
//      work at a remote backend).
//   2. A production build → same origin (''): nginx serves the SPA and proxies
//      /api/* to the backend. This leans on Vite's built-in import.meta.env.PROD
//      (always true under `vite build`), NOT on a VITE_API_URL value threaded
//      through Docker ENV — so it can't regress if that var fails to propagate.
//   3. Dev (vite dev server, no nginx) → the backend directly on :3000.
const explicitApiUrl = import.meta.env['VITE_API_URL'] as string | undefined;
const BASE_URL =
  explicitApiUrl && explicitApiUrl.length > 0
    ? explicitApiUrl
    : import.meta.env.PROD
      ? ''
      : 'http://localhost:3000';

// Empty base = same-origin = requests flow through nginx, which proxies only
// /api/* and strips that prefix before forwarding. Call sites use bare backend
// paths ('/auth/login'), so the marker is added here. When BASE_URL points
// straight at the backend (dev, or an explicit override), no prefix is added —
// backend routes are root-mounted (no setGlobalPrefix).
const API_PREFIX = BASE_URL === '' ? '/api' : '';

export class ApiError extends Error {
  statusCode: number;
  code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

// Registered by AuthProvider to clear session on TOKEN_EXPIRED from any request.
let _onUnauthorized: (() => void) | null = null;

export function registerUnauthorizedHandler(cb: () => void) {
  _onUnauthorized = cb;
}

async function parseError(res: Response): Promise<ApiError> {
  try {
    const body = (await res.json()) as Partial<ApiErrorEnvelope>;
    const err = new ApiError(
      res.status,
      body.code ?? 'INTERNAL_ERROR',
      body.message ?? res.statusText,
    );
    if (err.code === 'TOKEN_EXPIRED') _onUnauthorized?.();
    return err;
  } catch {
    return new ApiError(res.status, 'INTERNAL_ERROR', res.statusText);
  }
}

function getToken(): string | null {
  return sessionStorage.getItem('access_token');
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${API_PREFIX}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...options.headers,
    },
  });

  if (!res.ok) throw await parseError(res);

  const text = await res.text();
  return text ? (JSON.parse(text) as T) : ({} as T);
}

export const apiClient = {
  get: <T>(path: string, options?: { signal?: AbortSignal }) =>
    request<T>(path, { signal: options?.signal }),

  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  put: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),

  streamPost: (path: string, body?: unknown, signal?: AbortSignal): Promise<Response> =>
    fetch(`${BASE_URL}${API_PREFIX}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        ...authHeaders(),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    }),
};
