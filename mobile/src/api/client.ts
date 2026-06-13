import AsyncStorage from '@react-native-async-storage/async-storage';
import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import Constants from 'expo-constants';

const API_URL =
  process.env.EXPO_PUBLIC_API_URL
  ?? (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl
  ?? 'http://localhost:3000/api/v1';

const ACCESS_TOKEN_KEY = 'axis.accessToken';
const REFRESH_TOKEN_KEY = 'axis.refreshToken';

export const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  withCredentials: false,
  // IMPORTANT : utilise fetch() au lieu de XMLHttpRequest.
  // Sur Safari iOS, XHR est souvent bloqué par l'Intelligent Tracking
  // Protection pour les requêtes cross-origin. fetch() passe sans souci.
  adapter: 'fetch',
});

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await AsyncStorage.getItem(ACCESS_TOKEN_KEY);
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

let refreshing: Promise<string | null> | null = null;

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const newToken = await (refreshing ??= refreshAccessToken());
        refreshing = null;
        if (newToken) {
          original.headers.Authorization = `Bearer ${newToken}`;
          return api(original);
        }
      } catch {
        refreshing = null;
      }
    }
    return Promise.reject(error);
  },
);

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) return null;
  try {
    const r = await axios.post(`${API_URL}/auth/refresh`, { refreshToken }, { adapter: 'fetch' });
    const access = r.data.accessToken as string;
    const newRefresh = r.data.refreshToken as string;
    await AsyncStorage.setItem(ACCESS_TOKEN_KEY, access);
    if (newRefresh) await AsyncStorage.setItem(REFRESH_TOKEN_KEY, newRefresh);
    return access;
  } catch {
    await AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY]);
    return null;
  }
}

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

// Expose l'URL de l'API pour les écrans de diagnostic.
export const API_BASE_URL = API_URL;

export interface HealthResult {
  ok: boolean;
  status: number | null;
  message: string;
}

// Teste la connexion au backend via fetch() natif (plus fiable qu'axios
// sur Safari iOS qui bloque XHR par ITP).
export async function checkHealth(): Promise<HealthResult> {
  const url = `${API_URL}/health`;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    const r = await fetch(url, { method: 'GET', signal: controller.signal });
    clearTimeout(timeoutId);

    if (!r.ok) {
      return { ok: false, status: r.status, message: `Serveur a répondu ${r.status}` };
    }
    const data = await r.json().catch(() => ({}));
    const dbOk = (data as { db?: string })?.db === 'ok';
    return {
      ok: true,
      status: r.status,
      message: dbOk ? 'Serveur connecté' : 'Serveur OK, base de données indisponible',
    };
  } catch (e) {
    const name = e instanceof Error ? e.name : 'Error';
    const message = e instanceof Error ? e.message : String(e);
    if (name === 'AbortError') {
      return { ok: false, status: null, message: 'Délai dépassé (12 s)' };
    }
    return { ok: false, status: null, message: `${name}: ${message}` };
  }
}
