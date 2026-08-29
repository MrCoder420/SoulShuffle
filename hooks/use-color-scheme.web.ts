import { useColorScheme as useNativeWindColorScheme } from 'nativewind';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useCallback, useRef } from 'react';

let hasInitializedThemeWeb = false;
let isTogglingThemeWeb = false;

export function useColorScheme() {
  const { colorScheme, setColorScheme } = useNativeWindColorScheme();

  useEffect(() => {
    if (!hasInitializedThemeWeb) {
      hasInitializedThemeWeb = true;
      AsyncStorage.getItem('theme').then((savedTheme) => {
        if (savedTheme === 'light' || savedTheme === 'dark') {
          setColorScheme(savedTheme);
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
    if (now - lastToggleTimeRef.current < 250 || isTogglingThemeWeb) {
      return;
    }
    lastToggleTimeRef.current = now;
    isTogglingThemeWeb = true;
    setTimeout(() => { isTogglingThemeWeb = false; }, 250);

    const nextTheme = colorScheme === 'dark' ? 'light' : 'dark';
    setColorScheme(nextTheme);
    AsyncStorage.setItem('theme', nextTheme).catch(() => {});
  }, [colorScheme, setColorScheme]);

  return { colorScheme, toggleTheme, setColorScheme };
}


