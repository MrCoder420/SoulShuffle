import { Tabs } from 'expo-router';
import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { HapticTab } from '@/components/haptic-tab';
import { useColorScheme } from '@/hooks/use-color-scheme';
import Sidebar from '@/components/Sidebar';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';

const SPRING_CONFIG = {
  damping: 14,
  stiffness: 200,
  mass: 0.8,
};

const AnimatedTabIcon = ({
  name,
  title,
  focused,
  color,
  activeIcon,
  isDark,
}: any) => {
  const scale = useSharedValue(focused ? 1 : 0.85);
  const translateY = useSharedValue(focused ? -4 : 0);
  const opacity = useSharedValue(focused ? 1 : 0.5);
  const pillOpacity = useSharedValue(focused ? 1 : 0);
  const pillScale = useSharedValue(focused ? 1 : 0.4);
  const glowOpacity = useSharedValue(focused ? 0.6 : 0);

  useEffect(() => {
    if (focused) {
      scale.value = withSpring(1.15, SPRING_CONFIG);
      translateY.value = withSpring(-6, SPRING_CONFIG);
      opacity.value = withTiming(1, { duration: 200 });
      pillOpacity.value = withTiming(1, { duration: 250 });
      pillScale.value = withSpring(1, SPRING_CONFIG);
      glowOpacity.value = withTiming(0.55, { duration: 300 });
    } else {
      scale.value = withSpring(0.88, SPRING_CONFIG);
      translateY.value = withSpring(0, SPRING_CONFIG);
      opacity.value = withTiming(0.45, { duration: 200 });
      pillOpacity.value = withTiming(0, { duration: 150 });
      pillScale.value = withSpring(0.3, SPRING_CONFIG);
      glowOpacity.value = withTiming(0, { duration: 200 });
    }
  }, [focused]);

  const iconContainerStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateY: translateY.value },
    ],
    opacity: opacity.value,
  }));

  const pillStyle = useAnimatedStyle(() => ({
    opacity: pillOpacity.value,
    transform: [{ scaleX: pillScale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const activeColor = isDark ? '#f43f5e' : '#e11d48';

  return (
    <View style={styles.tabItem}>
      {/* Glow blob behind icon */}
      <Animated.View
        style={[
          styles.glow,
          { backgroundColor: activeColor },
          glowStyle,
        ]}
      />

      {/* Icon */}
      <Animated.View style={[styles.iconWrap, iconContainerStyle]}>
        <Ionicons
          size={focused ? 22 : 22}
          name={focused ? activeIcon || name : name}
          color={focused ? activeColor : color}
        />
      </Animated.View>

      {/* Label */}
      <Text
        style={[
          styles.label,
          {
            color: focused ? activeColor : color,
            fontWeight: focused ? '800' : '500',
          },
        ]}
      >
        {title}
      </Text>

      {/* Bottom pill indicator */}
      <Animated.View
        style={[
          styles.pill,
          { backgroundColor: activeColor },
          pillStyle,
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  tabItem: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 2,
    width: 64,
    height: 56,
    position: 'relative',
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  glow: {
    position: 'absolute',
    top: 2,
    width: 36,
    height: 36,
    borderRadius: 18,
    filter: 'blur(12px)',
    // React Native doesn't support CSS filter, use shadow instead
    shadowColor: '#f43f5e',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 12,
    elevation: 8,
  },
  label: {
    fontSize: 9,
    letterSpacing: 0.6,
    marginTop: 1,
    textTransform: 'uppercase',
  },
  pill: {
    position: 'absolute',
    bottom: -2,
    width: 20,
    height: 3,
    borderRadius: 2,
  },
});

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const tabs = [
    { name: 'index', title: 'Home', icon: 'heart-outline', activeIcon: 'heart' },
    { name: 'dares', title: 'Dares', icon: 'copy-outline', activeIcon: 'copy' },
    { name: 'history', title: 'History', icon: 'hourglass-outline', activeIcon: 'hourglass' },
    { name: 'chat', title: 'Chat', icon: 'chatbubbles-outline', activeIcon: 'chatbubbles' },
    { name: 'profile', title: 'Profile', icon: 'rose-outline', activeIcon: 'rose' },
  ];

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarButton: HapticTab,
          tabBarShowLabel: false,
          tabBarActiveTintColor: isDark ? 'rgba(255,255,255,0.5)' : '#9ca3af',
          tabBarInactiveTintColor: isDark ? 'rgba(255,255,255,0.3)' : '#9ca3af',
          tabBarStyle: {
            backgroundColor: isDark ? '#1A0C0F' : '#ffffff',
            borderTopWidth: 0,
            borderTopColor: 'transparent',
            elevation: 24,
            shadowColor: isDark ? '#000' : '#be123c',
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: isDark ? 0.5 : 0.08,
            shadowRadius: 16,
            height: 76,
            paddingBottom: 10,
            paddingTop: 8,
          },
        }}
      >
        {tabs.map((tab) => (
          <Tabs.Screen
            key={tab.name}
            name={tab.name}
            options={{
              title: tab.title,
              tabBarIcon: ({ color, focused }) => (
                <AnimatedTabIcon
                  name={tab.icon}
                  activeIcon={tab.activeIcon}
                  title={tab.title}
                  focused={focused}
                  color={color}
                  isDark={isDark}
                />
              ),
            }}
          />
        ))}
        <Tabs.Screen
          name="explore"
          options={{ href: null, title: 'Explore' }}
        />
      </Tabs>
      <Sidebar />
    </View>
  );
}
