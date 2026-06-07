import React from 'react';
import { View, Text, Image, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { useSidebar } from '@/context/SidebarContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { logout } from '@/services/authService';

export default function Sidebar() {
  const { isOpen, closeSidebar } = useSidebar();
  const router = useRouter();
  const pathname = usePathname();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

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
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            await logout();
            closeSidebar();
            router.replace('/' as any);
          },
        },
      ]
    );
  };

  // Helper to determine if a route is active
  const isRouteActive = (route: string) => {
    if (route === '/' && (pathname === '/' || pathname === '/index')) {
      return true;
    }
    return pathname === route;
  };

  const getLinkStyle = (route: string) => {
    const active = isRouteActive(route);
    if (active) {
      return 'flex-row items-center bg-[#e4525f] py-4 px-6 rounded-full mb-2 shadow-sm shadow-red-200 dark:shadow-none';
    }
    return 'flex-row items-center py-4 px-6 mb-2 rounded-full';
  };

  const getIconColor = (route: string) => {
    const active = isRouteActive(route);
    if (active) return '#fff';
    return isDark ? '#fda4af' : '#857169';
  };

  const getTextColor = (route: string) => {
    const active = isRouteActive(route);
    if (active) return 'text-white';
    return 'text-[#857169] dark:text-slate-300';
  };

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000 }}>
      <View className="flex-1 flex-row">
        {/* Backdrop Overlay */}
        <TouchableOpacity 
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          className="bg-black/30 dark:bg-black/50" 
          activeOpacity={1} 
          onPress={closeSidebar} 
        />
        
        {/* Menu Panel */}
        <View className="bg-[#fff8f7] dark:bg-[#2A1B1D] w-[80%] h-full pt-16 rounded-tr-[40px] rounded-br-[40px] shadow-2xl shadow-slate-900/40 dark:shadow-black/60 border-r border-[#ffeceb] dark:border-rose-950/20" style={{ zIndex: 1001 }}>
          <View className="px-8 pb-8 flex-1">
            
            {/* Avatar Section */}
            <View className="relative w-20 h-20 mb-4">
              <Image 
                source={{ uri: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&h=200&fit=crop' }} 
                className="w-full h-full rounded-full border-[3px] border-[#e24e5d] dark:border-rose-400"
              />
              <View className="absolute -bottom-1 -right-2 bg-[#0d6e67] dark:bg-teal-600 w-8 h-8 rounded-full items-center justify-center border-2 border-white dark:border-[#2A1B1D]">
                <Text className="text-white font-bold text-[11px]">14</Text>
              </View>
            </View>

            <Text className="text-[28px] font-black text-[#af2c3b] dark:text-slate-100 tracking-tight">Alex & Sam</Text>
            <Text className="text-[10px] font-bold text-[#e18e8e] dark:text-rose-400/60 tracking-[0.15em] uppercase mt-2">Level 14 Romantic</Text>
            <Text className="text-[14px] font-medium text-slate-600 dark:text-slate-400 mt-1 mb-10">Connected since 2022</Text>

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
              className="flex-row items-center py-4 px-6 mb-2 rounded-full"
              onPress={() => showComingSoon('Memory Book')}
            >
              <Ionicons name="book" size={20} color={isDark ? "#fda4af" : "#857169"} />
              <Text className="text-[#857169] dark:text-slate-300 font-bold text-[15px] ml-5">Memory Book</Text>
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
          <View className="px-8 pb-12 pt-4 border-t border-slate-100 dark:border-slate-800/20 bg-[#fffdfc] dark:bg-[#2A1B1D]/40 rounded-br-[40px]">
            <Text className="text-3xl font-black italic text-[#af2c3b] dark:text-slate-100 tracking-tight mb-2">Love Dare</Text>
            <Text className="text-[8px] font-bold text-slate-500 dark:text-slate-400 tracking-widest uppercase">Version 2.4.0 • Made with love</Text>
          </View>
        </View>
      </View>
    </View>
  );
}
