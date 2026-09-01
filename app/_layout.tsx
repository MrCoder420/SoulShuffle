import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import '../global.css';
import { SidebarProvider } from '@/context/SidebarContext';
import { NotificationProvider } from '@/context/NotificationContext';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useEffect } from 'react';
import RevenueCatService from '@/services/revenueCatService';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CustomDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#121212', // Clean dark background
    card: '#1E1E1E', // Slightly lighter for cards/surfaces
    text: '#ECEDEE', // Soft white text
  },
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    const initRC = async () => {
      // Try to get cached user ID so purchases map correctly on startup
      const userId = await AsyncStorage.getItem('cachedUserId');
      if (userId) {
        await RevenueCatService.initialize(userId);
      } else {
        // Fallback to anonymous init if not logged in
        await RevenueCatService.initialize('anonymous_user');
      }
    };
    initRC();
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider value={colorScheme === 'dark' ? CustomDarkTheme : DefaultTheme}>
        <SidebarProvider>
          <NotificationProvider>
            <Stack>
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="questionnaire" options={{ headerShown: false, gestureEnabled: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="notifications" options={{ headerShown: false }} />
              <Stack.Screen name="coin-toss" options={{ headerShown: false, presentation: 'card' }} />
              <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
            </Stack>
            <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
          </NotificationProvider>
        </SidebarProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

