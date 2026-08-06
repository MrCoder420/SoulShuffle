import { useState, useEffect, useCallback } from 'react';
import { DeviceEventEmitter } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ANIMATED_AVATARS } from '@/constants/avatars';
import { useFocusEffect } from 'expo-router';

export const DEFAULT_AVATAR = ANIMATED_AVATARS[0].url;

export function useUserAvatar() {
  const [avatar, setAvatar] = useState<string>(DEFAULT_AVATAR);

  // Reload avatar from cache every time the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      const loadAvatar = async () => {
        try {
          const cached = await AsyncStorage.getItem('cachedUserAvatar');
          if (cached && isMounted) {
            setAvatar(cached);
          }
        } catch (err) {
          console.log('Failed to load cached avatar:', err);
        }
      };

      loadAvatar();

      const sub = DeviceEventEmitter.addListener('profile:updated', (data) => {
        if (data?.avatarUrl && isMounted) {
          setAvatar(data.avatarUrl);
          // Also persist to cache in case it wasn't already
          AsyncStorage.setItem('cachedUserAvatar', data.avatarUrl).catch(() => {});
        }
      });

      return () => {
        isMounted = false;
        sub.remove();
      };
    }, [])
  );

  return avatar;
}
