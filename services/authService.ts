import api from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Helper to save tokens after login/signup
const saveTokens = async (accessToken: string, refreshToken: string) => {
  await AsyncStorage.setItem('accessToken', accessToken);
  await AsyncStorage.setItem('refreshToken', refreshToken);
};

// ── SIGN UP ──────────────────────────────────────────────
export const signUp = async (name: string, email: string, password: string) => {
  const response = await api.post('/auth/signup', { name, email, password });
  await saveTokens(response.data.data.accessToken, response.data.data.refreshToken);
  return response.data.data; // contains user object too
};

// ── SIGN IN ──────────────────────────────────────────────
export const signIn = async (email: string, password: string) => {
  const response = await api.post('/auth/login', { email, password });
  await saveTokens(response.data.data.accessToken, response.data.data.refreshToken);
  return response.data.data;
};

// ── GOOGLE LOGIN ─────────────────────────────────────────
export const googleLogin = async (googleIdToken: string) => {
  const response = await api.post('/auth/google', { token: googleIdToken });
  await saveTokens(response.data.data.accessToken, response.data.data.refreshToken);
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

// ── GET ME ───────────────────────────────────────────────
export const getMyProfile = async () => {
  const response = await api.get('/profile/me');
  return response.data.data.profile;
};