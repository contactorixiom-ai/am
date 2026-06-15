import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const API_URL =
  process.env.EXPO_PUBLIC_API_URL
  ?? (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl
  ?? 'http://localhost:3000/api/v1';

const ACCESS_TOKEN_KEY = 'axis.accessToken';
const REFRESH_TOKEN_KEY = 'axis.refreshToken';

// ─── Native fetch keeper ─────────────────────────────────────────────────
// On récupère le fetch natif sauvegardé par notre script d'init AVANT que
// le bundle Expo charge et puisse polluer window.fetch.
declare global {
  interface Window {
    __nativeFetch?: typeof fetch;
  }
}

const nativeFetch: typeof fetch =
  typeof window !== 'undefined' && typeof window.__nativeFetch === 'function'
    ? window.__nativeFetch
    : typeof window !== 'undefined' && typeof window.fetch === 'function'
      ? window.fetch.bind(window)
      : fetch;

// ─── Session ─────────────────────────────────────────────────────────────
export async function setSession(accessToken: string, refreshToken: string): Promise<void> {
  await AsyncStorage.multiSet([
    [ACCESS_TOKEN_KEY, accessToken],
    [REFRESH_TOKEN_KEY, refreshToken],
  ]);
}

export async function clearSession(): Promise<void> {
  await AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY]);
}

export async function hasSession(): Promise<boolean> {
  const token = await AsyncStorage.getItem(ACCESS_TOKEN_KEY);
  return !!token;
}

// ─── apiFetch : client HTTP minimaliste basé sur fetch natif ─────────────
export class ApiError extends Error {
  status: number | null;
  data: unknown;
  isNetworkError: boolean;
  constructor(message: string, opts: { status: number | null; data?: unknown; isNetworkError?: boolean }) {
    super(message);
    this.name = 'ApiError';
    this.status = opts.status;
    this.data = opts.data;
    this.isNetworkError = opts.isNetworkError ?? false;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  params?: Record<string, string | number | undefined>;
  skipAuth?: boolean;
  timeoutMs?: number;
}

let refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) return null;
  try {
    const r = await nativeFetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!r.ok) throw new Error('refresh failed');
    const data = await r.json();
    await AsyncStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken);
    if (data.refreshToken) await AsyncStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
    return data.accessToken as string;
  } catch {
    await AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY]);
    return null;
  }
}

export async function apiFetch<T = unknown>(path: string, opts: RequestOptions = {}): Promise<T> {
  const method = opts.method ?? 'GET';

  // URL avec query params
  let url = `${API_URL}${path}`;
  if (opts.params) {
    const qs = Object.entries(opts.params)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&');
    if (qs) url += `?${qs}`;
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (!opts.skipAuth) {
    const token = await AsyncStorage.getItem(ACCESS_TOKEN_KEY).catch(() => null);
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 20000);

  const doFetch = async (): Promise<Response> =>
    nativeFetch(url, {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    });

  let response: Response;
  try {
    response = await doFetch();
  } catch (e) {
    clearTimeout(timeout);
    const name = e instanceof Error ? e.name : 'Error';
    const msg = e instanceof Error ? e.message : String(e);
    throw new ApiError(`${name}: ${msg}`, { status: null, isNetworkError: true });
  }

  // 401 → tentative de refresh + replay
  if (response.status === 401 && !opts.skipAuth) {
    const newToken = await (refreshing ??= refreshAccessToken());
    refreshing = null;
    if (newToken) {
      headers.Authorization = `Bearer ${newToken}`;
      try {
        response = await doFetch();
      } catch (e) {
        clearTimeout(timeout);
        const msg = e instanceof Error ? e.message : String(e);
        throw new ApiError(msg, { status: null, isNetworkError: true });
      }
    }
  }

  clearTimeout(timeout);

  const text = await response.text();
  const data: unknown = text ? (() => { try { return JSON.parse(text); } catch { return text; } })() : null;

  if (!response.ok) {
    const d = data as { message?: string | string[] } | string | null;
    let message = `Erreur ${response.status}`;
    if (d && typeof d === 'object' && 'message' in d) {
      const m = d.message;
      message = Array.isArray(m) ? m.join('\n') : String(m);
    } else if (typeof d === 'string' && d) {
      message = d;
    }
    throw new ApiError(message, { status: response.status, data });
  }

  return data as T;
}

// ─── Diagnostic ──────────────────────────────────────────────────────────
export const API_BASE_URL = API_URL;

export interface HealthResult {
  ok: boolean;
  status: number | null;
  message: string;
}

export async function checkHealth(): Promise<HealthResult> {
  try {
    const data = await apiFetch<{ status?: string; db?: string }>('/health', {
      skipAuth: true,
      timeoutMs: 12000,
    });
    const dbOk = data?.db === 'ok';
    return {
      ok: true,
      status: 200,
      message: dbOk ? 'Serveur connecté' : 'Serveur OK, base de données indisponible',
    };
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.isNetworkError) return { ok: false, status: null, message: e.message };
      return { ok: false, status: e.status, message: e.message };
    }
    return { ok: false, status: null, message: 'Erreur inconnue' };
  }
}
