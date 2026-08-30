import { useSidebar } from '@/context/SidebarContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { logout, getMyProfileCached } from '@/services/authService';
import { leaveRoom, getActiveRoom } from '@/services/roomService';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Platform, Text, TouchableOpacity, View, DeviceEventEmitter } from 'react-native';
import { router } from 'expo-router';
import api from '@/services/api';

import { DEFAULT_AVATAR } from '@/hooks/use-user-avatar';

export default function Sidebar() {
  const { isOpen, closeSidebar } = useSidebar();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [userName, setUserName] = useState('User');
  const [partnerName, setPartnerName] = useState<string | null>(null);
  const [connectionString, setConnectionString] = useState('');
  const [userAvatar, setUserAvatar] = useState<string>(DEFAULT_AVATAR);

  // Load names & avatar from cache on open — instant, no API call
  useEffect(() => {
    if (!isOpen) return;
    const loadNamesAndStats = async () => {
      try {
        const cachedName = await AsyncStorage.getItem('cachedUserName');
        if (cachedName) setUserName(cachedName);

        const cachedAvatar = await AsyncStorage.getItem('cachedUserAvatar');
        if (cachedAvatar) setUserAvatar(cachedAvatar);

        const room = await getActiveRoom();
        if (room && room.status === 'ACTIVE' && room.partner_id) {
          const profile = await getMyProfileCached().catch(() => null);
          const myId = profile?.id;
          const resolvedPartner = (myId === room.host_id ? room.partner_name : room.host_name) || null;
          setPartnerName(resolvedPartner);

          const cachedStats = await AsyncStorage.getItem('relationshipStats');
          if (cachedStats && !cachedStats.toLowerCase().includes('unknown')) {
            setConnectionString(`Connected for ${cachedStats}`);
          }

          api.get('/profile/relationship-stats').then(async (response) => {
            const stats = response.data?.data?.stats;
            if (stats?.formattedTime && !stats.formattedTime.toLowerCase().includes('unknown')) {
              setConnectionString(`Connected for ${stats.formattedTime}`);
              await AsyncStorage.setItem('relationshipStats', stats.formattedTime);
            }
          }).catch(() => {});
        } else {
          setPartnerName(null);
          setConnectionString('');
        }
      } catch (err) {
        setPartnerName(null);
        setConnectionString('');
      }
    };
    loadNamesAndStats();

    const sub = DeviceEventEmitter.addListener('profile:updated', (data) => {
      if (data?.avatarUrl) {
        setUserAvatar(data.avatarUrl);
      }
      if (data?.firstName) {
        setUserName(data.firstName);
      }
    });

    const clearSub = DeviceEventEmitter.addListener('app:clearRoom', () => {
      setPartnerName(null);
      setConnectionString('');
    });

    const roomSub = DeviceEventEmitter.addListener('room:updated', () => {
      loadNamesAndStats();
    });

    const closeSub = DeviceEventEmitter.addListener('app:closeSidebar', () => {
      closeSidebar();
    });

    return () => {
      sub.remove();
      clearSub.remove();
      roomSub.remove();
      closeSub.remove();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const navigateTo = (path: string) => {
    closeSidebar();
    router.push(path as any);
  };

  const showComingSoon = (feature: string) => {
    Alert.alert(
      'Coming Soon!',
      `${feature} is currently under construction. Stay tuned for updates!`,
      [{ text: 'Great!' }]
    );
  };

  const handleLogout = () => {
    Alert.alert(
      'Ready to leave?',
      'Are you sure you want to log out of your Love Dare account?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Log Out',
          style: 'destructive',
          onPress: async () => {
            console.log('[LOGOUT] Step 1: User confirmed logout');
            setIsLoggingOut(true);
            closeSidebar();
            try {
              try {
                // Lazily require to prevent crashing Expo Go
                const { GoogleSignin } = require('@react-native-google-signin/google-signin');
                
                // Configure must be called before signOut, otherwise it fails
                GoogleSignin.configure({
                  webClientId: '950734388938-qm61e894mghl4dnsi2jb27aglo1eqhbm.apps.googleusercontent.com',
                  iosClientId: '950734388938-8hldjaul248pmbdcjpj0o65m8s8o03qp.apps.googleusercontent.com',
                  offlineAccess: false,
                });

                try {
                  // If the app was restarted, the native SDK might not know we are signed in,
                  // so we should try to restore the session silently before signing out,
                  // otherwise signOut() might throw an error and fail to clear Play Services.
                  try {
                    await GoogleSignin.signInSilently();
                  } catch (e) {}
                  
                  await GoogleSignin.signOut();
                  console.log('[LOGOUT] Google session cleared.');
                } catch (e) {
                  console.log('[LOGOUT] signOut error: ', e);
                }
                
                try {
                  await GoogleSignin.revokeAccess();
                  console.log('[LOGOUT] Google access revoked to force account picker next time.');
                } catch (e) {
                  console.log('[LOGOUT] revokeAccess error: ', e);
                }
              } catch (googleErr) {
                console.log('[LOGOUT] Google sign out error (ignoring):', googleErr);
              }

              console.log('[LOGOUT] Step 2: Clearing ALL AsyncStorage data...');
              await AsyncStorage.clear();
              const tokenCheck = await AsyncStorage.getItem('accessToken');
              console.log('[LOGOUT] Step 3: Token after clear =', tokenCheck, '(must be null)');

              console.log('[LOGOUT] Step 4: Emitting app:logout for root layout to navigate...');
              DeviceEventEmitter.emit('app:logout');
              console.log('[LOGOUT] Step 5: Done.');
            } catch (e) {
              console.error('[LOGOUT] ERROR:', e);
              setIsLoggingOut(false);
            }
          }
        }
      ]
    );
  };




  // Full-screen logout loading overlay
  if (isLoggingOut) {
    return (
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#f43f5e" />
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16, marginTop: 16 }}>Logging out...</Text>
      </View>
    );
  }

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000 }}>
      <View className="flex-1 flex-row">
        {/* Backdrop Overlay */}
        <TouchableOpacity
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          className="bg-black/30 dark:bg-black/50"
          onPress={() => !isLoggingOut && closeSidebar()}
        />

        {/* Menu Panel */}
        <View className="bg-[#fff8f7] dark:bg-[#180D10] w-[80%] h-full pt-16 rounded-tr-[40px] rounded-br-[40px] shadow-slate-900/40 dark:shadow-black/60 border-r border-[#ffeceb] dark:border-rose-950/20" style={{ zIndex: 1001 }}>
          <View className="px-8 pb-8 flex-1">

            {/* Avatar Section */}
            <View className="relative w-20 h-20 mb-4 rounded-full bg-rose-500/10 dark:bg-rose-950/40 items-center justify-center p-2 border-[2.5px] border-[#e24e5d] dark:border-rose-400">
              <Image
                source={{ uri: userAvatar }}
                className="w-14 h-14"
                resizeMode="contain"
              />
            </View>

            <Text className="text-[28px] font-black text-[#af2c3b] dark:text-slate-100 tracking-tight">
              {partnerName ? `${userName} & ${partnerName}` : userName}
            </Text>
            {connectionString ? (
              <Text className="text-[14px] font-medium text-slate-600 dark:text-slate-400 mt-1 mb-8">{connectionString}</Text>
            ) : (
              <View className="mb-6" />
            )}

            {/* Menu Links */}
            <View className="mt-6 gap-1">
              <TouchableOpacity
                className="flex-row items-center py-3.5 px-2 mb-1 rounded-full"
                onPress={() => navigateTo('/')}
              >
                <View className="w-7 items-center justify-center">
                  <Ionicons name="home" size={22} color={isDark ? '#fda4af' : '#857169'} />
                </View>
                <Text className="text-[#857169] dark:text-slate-200 font-bold text-[16px] ml-4">Home</Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="flex-row items-center py-3.5 px-2 mb-1 rounded-full"
                onPress={() => navigateTo('/dares')}
              >
                <View className="w-7 items-center justify-center">
                  <Ionicons name="trophy" size={22} color={isDark ? '#fda4af' : '#857169'} />
                </View>
                <Text className="text-[#857169] dark:text-slate-200 font-bold text-[16px] ml-4">Challenges</Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="flex-row items-center py-3.5 px-2 mb-1 rounded-full"
                onPress={() => navigateTo('/history')}
              >
                <View className="w-7 items-center justify-center">
                  <Ionicons name="time" size={22} color={isDark ? '#fda4af' : '#857169'} />
                </View>
                <Text className="text-[#857169] dark:text-slate-200 font-bold text-[16px] ml-4">History</Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="flex-row items-center py-3.5 px-2 mb-1 rounded-full"
                onPress={() => navigateTo('/store')}
              >
                <View className="w-7 items-center justify-center">
                  <Ionicons name="cart" size={22} color={isDark ? '#fda4af' : '#857169'} />
                </View>
                <Text className="text-[#857169] dark:text-slate-200 font-bold text-[16px] ml-4">Store</Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="flex-row items-center py-3.5 px-2 mb-1 rounded-full"
                onPress={() => navigateTo('/coin-toss')}
              >
                <View className="w-7 items-center justify-center">
                  <Ionicons name="pricetag" size={22} color={isDark ? '#fda4af' : '#857169'} />
                </View>
                <Text className="text-[#857169] dark:text-slate-200 font-bold text-[16px] ml-4">Coin Toss</Text>
              </TouchableOpacity>
            </View>

            {/* Bottom Menu Items */}
            <View className="mt-auto">
              <TouchableOpacity
                className="flex-row items-center py-3.5 px-2 mb-2 rounded-full"
                onPress={() => navigateTo('/profile')}
              >
                <View className="w-7 items-center justify-center">
                  <Ionicons name="settings" size={22} color={isDark ? '#fda4af' : '#857169'} />
                </View>
                <Text className="text-[#857169] dark:text-slate-200 font-bold text-[16px] ml-4">Settings</Text>
              </TouchableOpacity>

              {/* Logout Button */}
              <TouchableOpacity
                onPress={handleLogout}
                className="flex-row items-center py-3.5 px-3 mb-2 rounded-full bg-rose-50 dark:bg-[#250e14] border border-transparent dark:border-rose-950/30"
              >
                <View className="w-7 items-center justify-center">
                  <Ionicons name="log-out-outline" size={22} color="#e11d48" />
                </View>
                <Text className="text-rose-600 dark:text-rose-400 font-bold text-[16px] ml-4">Log Out</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Footer */}
          <View className="px-8 pb-12 pt-4 border-t border-slate-100 dark:border-slate-800/20 bg-[#fffdfc] dark:bg-[#180D10]/40 rounded-br-[40px]">
            <Text className="text-3xl font-black italic text-[#af2c3b] dark:text-slate-100 tracking-tight mb-2">Soul Shuffle</Text>
            <Text className="text-[8px] font-bold text-slate-500 dark:text-slate-400 tracking-widest uppercase">Version 1.1.1</Text>
          </View>
        </View>
      </View>

      {/* FULL-SCREEN LOADING SPINNER */}
      {isLoggingOut && (
        <View
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 }}
          className="bg-[#180D10]/90 items-center justify-center"
        >
          <View className="bg-[#241117] p-8 rounded-[32px] items-center border border-rose-950/40 shadow-rose-900/20">
            <ActivityIndicator size="large" color="#e11d48" />
            <Text className="text-white font-bold mt-6 text-lg tracking-wide">
              Signing Out...
            </Text>
            <Text className="text-rose-400/80 text-xs font-medium mt-2">
              Securing your session
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

