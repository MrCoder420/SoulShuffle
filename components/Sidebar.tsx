import { useSidebar } from '@/context/SidebarContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { logout } from '@/services/authService';
import { leaveRoom, getActiveRoom } from '@/services/roomService';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Platform, Text, TouchableOpacity, View, DeviceEventEmitter } from 'react-native';
import api from '@/services/api';

export default function Sidebar() {
  const { isOpen, closeSidebar } = useSidebar();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [userName, setUserName] = useState('User');
  const [partnerName, setPartnerName] = useState<string | null>(null);
  const [connectionString, setConnectionString] = useState('Connected since 2022');

  // Load names from cache on open — instant, no API call
  useEffect(() => {
    if (!isOpen) return;
    const loadNamesAndStats = async () => {
      const cachedName = await AsyncStorage.getItem('cachedUserName');
      if (cachedName) setUserName(cachedName);

      const activeRoomId = await AsyncStorage.getItem('activeRoomId');
      if (activeRoomId) {
        const cachedPartner = await AsyncStorage.getItem(`partnerName_${activeRoomId}`);
        if (cachedPartner) setPartnerName(cachedPartner);
      }

      // Load cached stats first for instant rendering
      const cachedStats = await AsyncStorage.getItem('relationshipStats');
      if (cachedStats) {
        setConnectionString(`Connected for ${cachedStats}`);
      }

      // Fetch fresh stats from API in the background
      api.get('/profile/relationship-stats').then(async (response) => {
        const stats = response.data?.data?.stats;
        if (stats && stats.formattedTime) {
          setConnectionString(`Connected for ${stats.formattedTime}`);
          await AsyncStorage.setItem('relationshipStats', stats.formattedTime);
        }
      }).catch((err) => {
        console.log('Failed to fetch relationship stats in background');
      });
    };
    loadNamesAndStats();
  }, [isOpen]);

  if (!isOpen) return null;

  const navigateTo = async (path: string) => {
    closeSidebar();
    const { router } = await import('expo-router');
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


  const getLinkStyle = (route: string) => {
    return 'flex-row items-center py-4 px-6 mb-2 rounded-full';
  };

  const getIconColor = (route: string) => {
    return isDark ? '#fda4af' : '#857169';
  };

  const getTextColor = (route: string) => {
    return 'text-[#857169] dark:text-slate-300';
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
            <View className="relative w-20 h-20 mb-4">
              <Image
                source={{ uri: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&h=200&fit=crop' }}
                className="w-full h-full rounded-full border-[3px] border-[#e24e5d] dark:border-rose-400"
              />
              <View className="absolute -bottom-1 -right-2 bg-[#0d6e67] dark:bg-teal-600 w-8 h-8 rounded-full items-center justify-center border-2 border-white dark:border-[#180D10]">
                <Text className="text-white font-bold text-[11px]">14</Text>
              </View>
            </View>

            <Text className="text-[28px] font-black text-[#af2c3b] dark:text-slate-100 tracking-tight">
              {partnerName ? `${userName} & ${partnerName}` : userName}
            </Text>
            <Text className="text-[10px] font-bold text-[#e18e8e] dark:text-rose-400/60 tracking-[0.15em] uppercase mt-2">Level 14 Romantic</Text>
            <Text className="text-[14px] font-medium text-slate-600 dark:text-slate-400 mt-1 mb-10">{connectionString}</Text>

            {/* Menu Links */}
            <TouchableOpacity
              className={getLinkStyle('/')}
              onPress={() => navigateTo('/')}
            >
              <Ionicons name="home" size={20} color={getIconColor('/')} />
              <Text className={`${getTextColor('/')} font-bold text-[15px] ml-5`}>Home</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className={getLinkStyle('/dares')}
              onPress={() => navigateTo('/dares')}
            >
              <Ionicons name="trophy" size={20} color={getIconColor('/dares')} />
              <Text className={`${getTextColor('/dares')} font-bold text-[15px] ml-5`}>Challenges</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className={getLinkStyle('/history')}
              onPress={() => navigateTo('/history')}
            >
              <Ionicons name="time" size={20} color={getIconColor('/history')} />
              <Text className={`${getTextColor('/history')} font-bold text-[15px] ml-5`}>History</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className={getLinkStyle('/store')}
              onPress={() => navigateTo('/store')}
            >
              <Ionicons name="cart" size={20} color={getIconColor('/store')} />
              <Text className={`${getTextColor('/store')} font-bold text-[15px] ml-5`}>Store</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className={getLinkStyle('/coin-toss')}
              onPress={() => navigateTo('/coin-toss')}
            >
              <Ionicons name="pricetag" size={20} color={getIconColor('/coin-toss')} />
              <Text className={`${getTextColor('/coin-toss')} font-bold text-[15px] ml-5`}>Coin Toss</Text>
            </TouchableOpacity>

            {/* Bottom Menu Items */}
            <View className="mt-auto">
              <TouchableOpacity
                className={getLinkStyle('/profile')}
                onPress={() => navigateTo('/profile')}
              >
                <Ionicons name="settings" size={20} color={getIconColor('/profile')} />
                <Text className={`${getTextColor('/profile')} font-bold text-[15px] ml-5`}>Settings</Text>
              </TouchableOpacity>


              {/* Logout Button */}
              <TouchableOpacity
                onPress={handleLogout}
                className="flex-row items-center py-4 px-6 mb-2 rounded-full bg-rose-50 dark:bg-rose-950/30"
              >
                <Ionicons name="log-out-outline" size={20} color="#e11d48" />
                <Text className="text-rose-600 dark:text-rose-400 font-bold text-[15px] ml-5">Log Out</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Footer */}
          <View className="px-8 pb-12 pt-4 border-t border-slate-100 dark:border-slate-800/20 bg-[#fffdfc] dark:bg-[#180D10]/40 rounded-br-[40px]">
            <Text className="text-3xl font-black italic text-[#af2c3b] dark:text-slate-100 tracking-tight mb-2">Love Dare</Text>
            <Text className="text-[8px] font-bold text-slate-500 dark:text-slate-400 tracking-widest uppercase">Version 2.4.0 • Made with love</Text>
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

