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
  withCredentials: false, // explicite : pas de cookies, Authorization header only
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
    const r = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
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

// Teste la connexion au backend. Renvoie un diagnostic lisible plutôt
// que de jeter, pour pouvoir l'afficher à l'utilisateur.
export async function checkHealth(): Promise<HealthResult> {
  try {
    const r = await axios.get(`${API_URL}/health`, { timeout: 12000 });
    const dbOk = (r.data as { db?: string })?.db === 'ok';
    return {
      ok: true,
      status: r.status,
      message: dbOk ? 'Serveur connecté' : 'Serveur OK, base de données indisponible',
    };
  } catch (e) {
    if (axios.isAxiosError(e)) {
      if (e.response) {
        return { ok: false, status: e.response.status, message: `Serveur a répondu ${e.response.status}` };
      }
      if (e.code === 'ECONNABORTED') {
        return { ok: false, status: null, message: 'Délai dépassé — serveur trop lent ou endormi' };
      }
      return { ok: false, status: null, message: `Injoignable (${e.code ?? 'réseau/CORS'})` };
    }
    return { ok: false, status: null, message: 'Erreur inconnue' };
  }
}
