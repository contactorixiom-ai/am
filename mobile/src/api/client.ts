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
