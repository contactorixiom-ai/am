import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const API_URL =
  process.env.EXPO_PUBLIC_API_URL
  ?? (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl
  ?? 'http://localhost:3000/api/v1';

const ACCESS_TOKEN_KEY = 'axis.accessToken';
const REFRESH_TOKEN_KEY = 'axis.refreshToken';

// ─── Transport HTTP ──────────────────────────────────────────────────────
// Sur web on utilise XMLHttpRequest directement plutôt que fetch : XHR ne
// peut PAS être pollué par un polyfill fetch tiers (whatwg-fetch, etc.),
// fonctionne sur Safari iOS en mode privé, et expose proprement les erreurs
// réseau via onerror. Sur natif (React Native) on utilise fetch standard.
const IS_WEB = typeof window !== 'undefined' && typeof window.XMLHttpRequest === 'function';

interface HttpResponse {
  status: number;
  ok: boolean;
  text: string;
}

function httpRequestXhr(
  url: string,
  method: string,
  headers: Record<string, string>,
  body: string | undefined,
  timeoutMs: number,
): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url, true);
    xhr.timeout = timeoutMs;
    Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.onload = () => {
      resolve({
        status: xhr.status,
        ok: xhr.status >= 200 && xhr.status < 300,
        text: xhr.responseText ?? '',
      });
    };
    xhr.onerror = () => reject(new Error(`Erreur réseau (XHR onerror, status=${xhr.status})`));
    xhr.ontimeout = () => reject(new Error(`Timeout après ${timeoutMs}ms`));
    xhr.onabort = () => reject(new Error('Requête annulée'));
    try {
      xhr.send(body);
    } catch (e) {
      reject(e instanceof Error ? e : new Error(String(e)));
    }
  });
}

async function httpRequestFetch(
  url: string,
  method: string,
  headers: Record<string, string>,
  body: string | undefined,
  timeoutMs: number,
): Promise<HttpResponse> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(url, { method, headers, body, signal: controller.signal });
    const text = await r.text();
    return { status: r.status, ok: r.ok, text };
  } finally {
    clearTimeout(t);
  }
}

const httpRequest = IS_WEB ? httpRequestXhr : httpRequestFetch;

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
    const r = await httpRequest(
      `${API_URL}/auth/refresh`,
      'POST',
      { 'Content-Type': 'application/json', Accept: 'application/json' },
      JSON.stringify({ refreshToken }),
      15000,
    );
    if (!r.ok) throw new Error('refresh failed');
    const data = JSON.parse(r.text) as { accessToken: string; refreshToken?: string };
    await AsyncStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken);
    if (data.refreshToken) await AsyncStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
    return data.accessToken;
  } catch {
    await AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY]);
    return null;
  }
}

export async function apiFetch<T = unknown>(path: string, opts: RequestOptions = {}): Promise<T> {
  const method = opts.method ?? 'GET';

  let url = `${API_URL}${path}`;
  if (opts.params) {
    const qs = Object.entries(opts.params)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&');
    if (qs) url += `?${qs}`;
  }

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (!opts.skipAuth) {
    const token = await AsyncStorage.getItem(ACCESS_TOKEN_KEY).catch(() => null);
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const body = opts.body !== undefined ? JSON.stringify(opts.body) : undefined;
  const timeoutMs = opts.timeoutMs ?? 20000;

  let response: HttpResponse;
  try {
    response = await httpRequest(url, method, headers, body, timeoutMs);
  } catch (e) {
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
        response = await httpRequest(url, method, headers, body, timeoutMs);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        throw new ApiError(msg, { status: null, isNetworkError: true });
      }
    }
  }

  const text = response.text;
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
    // Message humain : le détail technique (XHR onerror, timeout…) n'aide
    // pas l'utilisateur — on affiche une phrase claire à la place.
    if (e instanceof ApiError) {
      if (e.isNetworkError) return { ok: false, status: null, message: 'Serveur momentanément inaccessible — réessaie dans un instant.' };
      return { ok: false, status: e.status, message: `Service indisponible (erreur ${e.status ?? '?'}).` };
    }
    return { ok: false, status: null, message: 'Serveur momentanément inaccessible.' };
  }
}
