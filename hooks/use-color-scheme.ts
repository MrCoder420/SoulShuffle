import { useColorScheme as useNativeWindColorScheme } from 'nativewind';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useCallback, useRef } from 'react';
import * as Haptics from 'expo-haptics';

let hasInitializedTheme = false;
let isTogglingTheme = false;

export function useColorScheme() {
  const { colorScheme, setColorScheme } = useNativeWindColorScheme();

  useEffect(() => {
    if (!hasInitializedTheme) {
      hasInitializedTheme = true;
      AsyncStorage.getItem('theme').then((savedTheme) => {
        if (savedTheme === 'light' || savedTheme === 'dark') {
          setColorScheme(savedTheme);
        } else {
          setColorScheme('dark');
          AsyncStorage.setItem('theme', 'dark').catch(() => {});
        }
      }).catch(() => {});
    }
  }, [setColorScheme]);

  return colorScheme;
}

export function useThemeToggle() {
  const { colorScheme, setColorScheme } = useNativeWindColorScheme();
  const lastToggleTimeRef = useRef(0);

  const toggleTheme = useCallback(() => {
    const now = Date.now();
    // Debounce to prevent rapid double-trigger bouncing
    if (now - lastToggleTimeRef.current < 250 || isTogglingTheme) {
      return;
    }
    lastToggleTimeRef.current = now;
    isTogglingTheme = true;
    setTimeout(() => { isTogglingTheme = false; }, 250);

    const nextTheme = colorScheme === 'dark' ? 'light' : 'dark';
    
    // 1. Immediately update colorScheme on current JS turn
    setColorScheme(nextTheme);

    // 2. Non-blocking haptic feedback and background persistence
    setTimeout(() => {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      } catch {}
      AsyncStorage.setItem('theme', nextTheme).catch(() => {});
    }, 0);
  }, [colorScheme, setColorScheme]);

  return { colorScheme, toggleTheme, setColorScheme };
}



