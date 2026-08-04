import { useState, useEffect } from 'react';
import { DeviceEventEmitter } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ANIMATED_AVATARS } from '@/constants/avatars';

export const DEFAULT_AVATAR = ANIMATED_AVATARS[0].url;

export function useUserAvatar() {
  const [avatar, setAvatar] = useState<string>(DEFAULT_AVATAR);

  useEffect(() => {
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
      }
    });

    return () => {
      isMounted = false;
      sub.remove();
    };
  }, []);

  return avatar;
}
