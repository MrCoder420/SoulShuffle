import { Tabs } from 'expo-router';
import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { HapticTab } from '@/components/haptic-tab';
import { useColorScheme } from '@/hooks/use-color-scheme';
import Sidebar from '@/components/Sidebar';

const TabIcon = ({ name, title, focused, color, activeIcon, isDark }: any) => {
  if (focused) {
    return (
      <View className={`w-14 h-14 rounded-full items-center justify-center shadow-lg ${isDark ? 'bg-rose-600 shadow-rose-950/40' : 'bg-[#e24e5d] shadow-red-300'}`}>
        <Ionicons size={18} name={activeIcon || name} color="#fff" />
        <Text className="text-[8px] font-bold tracking-widest mt-1 uppercase text-white">{title}</Text>
      </View>
    );
  }
  return (
    <View className="items-center justify-center">
      <Ionicons size={24} name={name} color={color} />
    </View>
  );
};

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View style={{ flex: 1 }}>
      <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarShowLabel: true,
        tabBarActiveTintColor: isDark ? '#fff' : '#e11d48',
        tabBarInactiveTintColor: isDark ? 'rgba(255, 255, 255, 0.4)' : '#9ca3af',
        tabBarStyle: {
          backgroundColor: isDark ? '#251719' : '#fff',
          borderTopWidth: 0,
          elevation: 10,
          shadowColor: isDark ? '#000' : '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: isDark ? 0.3 : 0.1,
          shadowRadius: 10,
          height: 80,
          paddingBottom: 25,
          paddingTop: 10,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
          marginTop: 4,
          letterSpacing: 0.5,
        }
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'HOME',
          tabBarIcon: ({ color, focused }) => <TabIcon name="heart-outline" activeIcon="heart" title="HOME" focused={focused} color={color} isDark={isDark} />,
          tabBarLabel: ({ focused, color }) => focused ? null : <Text style={{ fontSize: 10, fontWeight: '700', color, marginTop: 4, letterSpacing: 0.5 }}>HOME</Text>
        }}
      />
      <Tabs.Screen
        name="dares"
        options={{
          title: 'DARES',
          tabBarIcon: ({ color, focused }) => <TabIcon name="copy-outline" activeIcon="copy" title="DARES" focused={focused} color={color} isDark={isDark} />,
          tabBarLabel: ({ focused, color }) => focused ? null : <Text style={{ fontSize: 10, fontWeight: '700', color, marginTop: 4, letterSpacing: 0.5 }}>DARES</Text>
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'HISTORY',
          tabBarIcon: ({ color, focused }) => <TabIcon name="hourglass-outline" activeIcon="hourglass" title="HISTORY" focused={focused} color={color} isDark={isDark} />,
          tabBarLabel: ({ focused, color }) => focused ? null : <Text style={{ fontSize: 10, fontWeight: '700', color, marginTop: 4, letterSpacing: 0.5 }}>HISTORY</Text>
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'CHAT',
          tabBarIcon: ({ color, focused }) => <TabIcon name="chatbubbles-outline" activeIcon="chatbubbles" title="CHAT" focused={focused} color={color} isDark={isDark} />,
          tabBarLabel: ({ focused, color }) => focused ? null : <Text style={{ fontSize: 10, fontWeight: '700', color, marginTop: 4, letterSpacing: 0.5 }}>CHAT</Text>
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'PROFILE',
          tabBarIcon: ({ color, focused }) => <TabIcon name="rose-outline" activeIcon="rose" title="PROFILE" focused={focused} color={color} isDark={isDark} />,
          tabBarLabel: ({ focused, color }) => focused ? null : <Text style={{ fontSize: 10, fontWeight: '700', color, marginTop: 4, letterSpacing: 0.5 }}>PROFILE</Text>
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          href: null,
          title: 'Explore',
        }}
      />
    </Tabs>
    <Sidebar />
    </View>
  );
}
