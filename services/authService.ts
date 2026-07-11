import api from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Helper to save tokens after login/signup
const saveTokens = async (accessToken: string, refreshToken: string) => {
  await AsyncStorage.setItem('accessToken', accessToken);
  await AsyncStorage.setItem('refreshToken', refreshToken);
};

// Helper to clear user cache
const clearUserCache = async () => {
  await AsyncStorage.removeItem('accessToken');
  await AsyncStorage.removeItem('refreshToken');
  await AsyncStorage.removeItem('cachedUserName');
  await AsyncStorage.removeItem('cachedUserId');
};

// ── SIGN UP ──────────────────────────────────────────────
export const signUp = async (name: string, email: string, password: string) => {
  const response = await api.post('/auth/signup', { name, email, password });
  await saveTokens(response.data.data.accessToken, response.data.data.refreshToken);
  // Cache name immediately after signup
  const firstName = response.data.data?.user?.first_name || name.split(' ')[0];
  if (firstName) await AsyncStorage.setItem('cachedUserName', firstName);
  if (response.data.data?.user?.id) await AsyncStorage.setItem('cachedUserId', response.data.data.user.id);
  return response.data.data; // contains user object too
};

// ── SIGN IN ──────────────────────────────────────────────
export const signIn = async (email: string, password: string) => {
  const response = await api.post('/auth/login', { email, password });
  await saveTokens(response.data.data.accessToken, response.data.data.refreshToken);
  // Cache name immediately after login
  const firstName = response.data.data?.user?.first_name || response.data.data?.profile?.first_name;
  if (firstName) await AsyncStorage.setItem('cachedUserName', firstName);
  if (response.data.data?.user?.id) await AsyncStorage.setItem('cachedUserId', response.data.data.user.id);
  return response.data.data;
};

// ── GOOGLE LOGIN ─────────────────────────────────────────
export const googleLogin = async (googleIdToken: string) => {
  const response = await api.post('/auth/google', { token: googleIdToken });
  await saveTokens(response.data.data.accessToken, response.data.data.refreshToken);
  const firstName = response.data.data?.user?.first_name;
  if (firstName) await AsyncStorage.setItem('cachedUserName', firstName);
  if (response.data.data?.user?.id) await AsyncStorage.setItem('cachedUserId', response.data.data.user.id);
  return response.data.data;
};

// ── APPLE LOGIN ─────────────────────────────────────────
export const appleLogin = async (appleIdentityToken: string) => {
  const response = await api.post('/auth/apple', { token: appleIdentityToken });
  await saveTokens(response.data.data.accessToken, response.data.data.refreshToken);
  const firstName = response.data.data?.user?.first_name || 'User';
  if (firstName) await AsyncStorage.setItem('cachedUserName', firstName);
  if (response.data.data?.user?.id) await AsyncStorage.setItem('cachedUserId', response.data.data.user.id);
  return response.data.data;
};

// ── FORGOT PASSWORD ──────────────────────────────────────
export const forgotPassword = async (email: string) => {
  const response = await api.post('/auth/forgot-password', { email });
  return response.data.data || response.data;
};

// ── VERIFY OTP ───────────────────────────────────────────
export const verifyOtp = async (email: string, otp: string) => {
  const response = await api.post('/auth/verify-otp', { email, otp });
  return response.data.data || response.data;
};

// ── RESET PASSWORD ───────────────────────────────────────
export const resetPassword = async (email: string, otp: string, newPassword: string) => {
  const response = await api.post('/auth/reset-password', { email, otp, newPassword });
  return response.data.data || response.data;
};

// ── LOGOUT ───────────────────────────────────────────────
// Clears ALL cached data: tokens, user name, user ID, and all partner/room caches
export const logout = async () => {
  await AsyncStorage.clear();
};

// ── GET MY PROFILE (raw API) ──────────────────────────────
export const getMyProfile = async () => {
  const response = await api.get('/profile/me');
  return response.data.data.profile;
};

// ── GET PROFILE WITH CACHING ─────────────────────────────
// Reads from cache first (instant). Falls back to API if not cached, then saves the result.
export const getMyProfileCached = async (): Promise<{ id: string | null; firstName: string }> => {
  const cachedName = await AsyncStorage.getItem('cachedUserName');
  const cachedId = await AsyncStorage.getItem('cachedUserId');

  // Return instantly if we have both cached values
  if (cachedName && cachedId) {
    return { id: cachedId, firstName: cachedName };
  }

  // Fall back to API and persist the result for next time
  try {
    const profile = await getMyProfile();
    const firstName = profile?.first_name || profile?.users?.name?.split(' ')[0] || 'User';
    const userId = profile?.id || null;
    if (firstName) await AsyncStorage.setItem('cachedUserName', firstName);
    if (userId) await AsyncStorage.setItem('cachedUserId', userId);
    return { id: userId, firstName };
  } catch {
    // Network down — return whatever we had cached
    return { id: cachedId ?? null, firstName: cachedName ?? 'User' };
  }
};