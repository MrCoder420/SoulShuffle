import api from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Helper to save tokens after login/signup
const saveTokens = async (accessToken: string, refreshToken: string) => {
  await AsyncStorage.setItem('accessToken', accessToken);
  await AsyncStorage.setItem('refreshToken', refreshToken);

  // Sync push token to backend for the authenticated user
  try {
    const pushToken = await AsyncStorage.getItem('expoPushToken');
    if (pushToken) {
      await api.post('/notifications/register-push-token', { pushToken });
    }
  } catch (e) {
    // silently fail
  }
};

// Helper to clear user cache
const clearUserCache = async () => {
  await AsyncStorage.removeItem('accessToken');
  await AsyncStorage.removeItem('refreshToken');
  await AsyncStorage.removeItem('cachedUserName');
  await AsyncStorage.removeItem('cachedUserId');
  await AsyncStorage.removeItem('cachedUserAvatar');
};

// ── SIGN UP ──────────────────────────────────────────────
export const signUp = async (name: string, email: string, password: string) => {
  const response = await api.post('/auth/signup', { name, email, password });
  await saveTokens(response.data.data.accessToken, response.data.data.refreshToken);
  
  const enteredFirstName = (name || '').trim().split(' ')[0];
  const firstName = response.data.data?.user?.first_name 
    || response.data.data?.profile?.first_name 
    || response.data.data?.user?.name?.split(' ')[0] 
    || enteredFirstName;

  if (firstName) await AsyncStorage.setItem('cachedUserName', firstName);
  if (response.data.data?.user?.id) await AsyncStorage.setItem('cachedUserId', response.data.data.user.id);
  if (response.data.data?.profile?.avatar_url) await AsyncStorage.setItem('cachedUserAvatar', response.data.data.profile.avatar_url);
  return response.data.data;
};

// ── SIGN IN ──────────────────────────────────────────────
export const signIn = async (email: string, password: string) => {
  const response = await api.post('/auth/login', { email, password });
  await saveTokens(response.data.data.accessToken, response.data.data.refreshToken);

  const firstName = response.data.data?.user?.first_name 
    || response.data.data?.profile?.first_name 
    || response.data.data?.user?.name?.split(' ')[0];

  if (firstName) await AsyncStorage.setItem('cachedUserName', firstName);
  if (response.data.data?.user?.id) await AsyncStorage.setItem('cachedUserId', response.data.data.user.id);
  if (response.data.data?.profile?.avatar_url) await AsyncStorage.setItem('cachedUserAvatar', response.data.data.profile.avatar_url);
  return response.data.data;
};

// ── GOOGLE LOGIN ─────────────────────────────────────────
export const googleLogin = async (googleIdToken: string) => {
  const response = await api.post('/auth/google', { token: googleIdToken });
  await saveTokens(response.data.data.accessToken, response.data.data.refreshToken);
  const firstName = response.data.data?.user?.first_name || response.data.data?.user?.name?.split(' ')[0];
  if (firstName) await AsyncStorage.setItem('cachedUserName', firstName);
  if (response.data.data?.user?.id) await AsyncStorage.setItem('cachedUserId', response.data.data.user.id);
  if (response.data.data?.profile?.avatar_url) await AsyncStorage.setItem('cachedUserAvatar', response.data.data.profile.avatar_url);
  return response.data.data;
};

// ── APPLE LOGIN ─────────────────────────────────────────
export const appleLogin = async (appleIdentityToken: string) => {
  const response = await api.post('/auth/apple', { token: appleIdentityToken });
  await saveTokens(response.data.data.accessToken, response.data.data.refreshToken);
  const firstName = response.data.data?.user?.first_name || response.data.data?.user?.name?.split(' ')[0];
  if (firstName) await AsyncStorage.setItem('cachedUserName', firstName);
  if (response.data.data?.user?.id) await AsyncStorage.setItem('cachedUserId', response.data.data.user.id);
  if (response.data.data?.profile?.avatar_url) await AsyncStorage.setItem('cachedUserAvatar', response.data.data.profile.avatar_url);
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
export const logout = async () => {
  await AsyncStorage.clear();
};

// ── GET MY PROFILE (raw API) ──────────────────────────────
export const getMyProfile = async () => {
  const response = await api.get('/profile/me');
  return response.data.data.profile;
};

// ── UPDATE MY PROFILE ─────────────────────────────────────
export const updateMyProfile = async (updateData: { first_name?: string; last_name?: string; avatar_url?: string; bio?: string }) => {
  const response = await api.put('/profile/me', updateData);
  if (updateData.avatar_url) {
    await AsyncStorage.setItem('cachedUserAvatar', updateData.avatar_url);
  }
  if (updateData.first_name) {
    await AsyncStorage.setItem('cachedUserName', updateData.first_name);
  }
  return response.data.data.profile;
};

// ── GET PROFILE WITH CACHING ─────────────────────────────
export const getMyProfileCached = async (): Promise<{ id: string | null; firstName: string; avatarUrl: string | null }> => {
  const cachedName = await AsyncStorage.getItem('cachedUserName');
  const cachedId = await AsyncStorage.getItem('cachedUserId');
  const cachedAvatar = await AsyncStorage.getItem('cachedUserAvatar');

  if (cachedName && cachedName !== 'User' && cachedId) {
    return { id: cachedId, firstName: cachedName, avatarUrl: cachedAvatar };
  }

  try {
    const profile = await getMyProfile();
    const firstName = profile?.first_name || profile?.users?.name?.split(' ')[0] || (cachedName && cachedName !== 'User' ? cachedName : '');
    const userId = profile?.id || cachedId || null;
    const avatarUrl = profile?.avatar_url || cachedAvatar || null;
    if (firstName && firstName !== 'User') await AsyncStorage.setItem('cachedUserName', firstName);
    if (userId) await AsyncStorage.setItem('cachedUserId', userId);
    if (avatarUrl) await AsyncStorage.setItem('cachedUserAvatar', avatarUrl);
    return { id: userId, firstName, avatarUrl };
  } catch {
    return { id: cachedId ?? null, firstName: cachedName && cachedName !== 'User' ? cachedName : '', avatarUrl: cachedAvatar ?? null };
  }
};