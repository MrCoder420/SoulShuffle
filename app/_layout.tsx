import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import '../global.css';
import { SidebarProvider } from '@/context/SidebarContext';

import { useColorScheme } from '@/hooks/use-color-scheme';

const CustomDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#221517',
    card: '#251719',
    text: '#e2e8f0',
  },
};

function AuthGuard() {
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    const checkAuth = async () => {
      const token = await AsyncStorage.getItem('accessToken');
      const inAuthGroup = segments[0] !== '(tabs)';
      if (!token && !inAuthGroup) {
        // No token and trying to access protected tabs → send to login
        router.replace('/');
      }
    };
    checkAuth();
  }, [segments]);

  return null;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? CustomDarkTheme : DefaultTheme}>
      <SidebarProvider>
          <AuthGuard />
          <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="questionnaire" options={{ headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="coin-toss" options={{ headerShown: false, presentation: 'card' }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      </SidebarProvider>
    </ThemeProvider>
  );
}
