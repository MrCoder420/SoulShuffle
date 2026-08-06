import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// ─── SERVER CONFIGURATION ─────────────────────────────────
// Set to true to use your local Express backend, or false to use the AWS test server.
const USE_LOCAL_BACKEND = false; 

const AWS_BACKEND_URL = 'http://54.91.119.137:3000/api/v1';

// Dynamic Localhost Resolution (for iOS Simulators, Android Emulators, and Physical Devices)
const getLocalBackendUrl = () => {
  if (Platform.OS === 'web') {
    return 'http://localhost:3000/api/v1';
  }
  
  // expoConfig?.hostUri is "192.168.x.x:8081" when running Expo Go
  const hostUri = Constants.expoConfig?.hostUri;
  const ip = hostUri ? hostUri.split(':')[0] : null;
  
  if (ip) {
    return `http://${ip}:3000/api/v1`;
  }
  
  return Platform.OS === 'android' ? 'http://10.0.2.2:3000/api/v1' : 'http://localhost:3000/api/v1';
};

export const BASE_URL = USE_LOCAL_BACKEND ? getLocalBackendUrl() : AWS_BACKEND_URL;

console.log(`📡 Connecting API to: ${BASE_URL}`);

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

const isAuthRequest = (url = '') => url.includes('/auth/');

// ─── TOKEN REFRESH WITH QUEUE ──────────────────────────────
// Prevents multiple simultaneous refresh calls when several requests 401 at once
let isRefreshing = false;
let refreshSubscribers: ((token: string | null) => void)[] = [];

const onRefreshed = (token: string | null) => {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
};

const addRefreshSubscriber = (callback: (token: string | null) => void) => {
  refreshSubscribers.push(callback);
};

const refreshAccessToken = async (): Promise<string | null> => {
  const refreshToken = await AsyncStorage.getItem('refreshToken');
  if (!refreshToken) return null;

  const res = await axios.post(`${BASE_URL}/auth/refresh-token`, { refreshToken });
  const newAccessToken = res.data.data.accessToken;
  const newRefreshToken = res.data.data.refreshToken;

  await AsyncStorage.setItem('accessToken', newAccessToken);
  await AsyncStorage.setItem('refreshToken', newRefreshToken);

  try {
    const GameSocket = (await import('./socketService')).default;
    GameSocket.updateToken(newAccessToken);
  } catch (e) {
    // Ignore if socket not loaded
  }

  return newAccessToken;
};

// Clear only auth tokens (not all app data) and redirect to login
const handleAuthFailure = async () => {
  await AsyncStorage.removeItem('accessToken');
  await AsyncStorage.removeItem('refreshToken');
  // Lazy import to avoid circular dependency with expo-router
  try {
    const { router } = await import('expo-router');
    router.replace('/');
  } catch {
    // Router not ready yet — ignore, user will hit 401s until navigated manually
  }
};

// ─── REQUEST INTERCEPTOR ───────────────────────────────────
// Automatically attaches accessToken to every request
api.interceptors.request.use(async (config) => {
  const requestUrl = config.url || '';
  const token = await AsyncStorage.getItem('accessToken');

  if (token) {
    if (config.headers && typeof config.headers.set === 'function') {
      config.headers.set('Authorization', `Bearer ${token}`);
    } else {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    console.log(`[API REQUEST] ${config.method?.toUpperCase()} ${requestUrl} - Token: ${token.substring(0, 15)}...`);
  } else {
    console.log(`[API REQUEST] ${config.method?.toUpperCase()} ${requestUrl} - NO TOKEN`);
  }

  return config;
});

// ─── RESPONSE INTERCEPTOR ─────────────────────────────────
// If token expired (401), silently refresh and retry once.
// Uses a queue so concurrent requests don't all trigger refresh simultaneously.
api.interceptors.response.use(
  (response) => response, // success — just return it
  async (error) => {
    const originalRequest = error.config;
    const requestUrl = originalRequest?.url || '';

    // Don't attempt refresh for auth endpoints — these 401s are real auth failures
    if (isAuthRequest(requestUrl)) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      console.log(`[API RESPONSE] 401 Unauthorized for ${requestUrl} — attempting token refresh`);
      originalRequest._retry = true;

      if (isRefreshing) {
        // Queue this request until the in-progress refresh resolves
        return new Promise((resolve, reject) => {
          addRefreshSubscriber((newToken) => {
            if (newToken) {
              originalRequest.headers = originalRequest.headers || {};
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
              resolve(api(originalRequest));
            } else {
              reject(error);
            }
          });
        });
      }

      isRefreshing = true;
      try {
        const newAccessToken = await refreshAccessToken();
        isRefreshing = false;

        if (!newAccessToken) {
          onRefreshed(null);
          await handleAuthFailure();
          return Promise.reject(error);
        }

        onRefreshed(newAccessToken);
        // Retry the original request with the new token
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        isRefreshing = false;
        onRefreshed(null);
        // Refresh failed — clear tokens only, redirect to login
        await handleAuthFailure();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
