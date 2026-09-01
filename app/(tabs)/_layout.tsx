import { Tabs, useRouter, useSegments, usePathname, useNavigation } from 'expo-router';
import { CommonActions } from '@react-navigation/native';
import React, { useEffect, useState, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import GameSocket from '@/services/socketService';
import { getActiveRoom } from '@/services/roomService';
import { getMyProfileCached } from '@/services/authService';
import { setPendingCoinToss, saveCoinTossItem } from '@/services/coinTossService';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  DeviceEventEmitter,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/use-color-scheme';
import Sidebar from '@/components/Sidebar';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

const TABS = [
  { name: 'index',     label: 'Home',      icon: 'home-outline',      activeIcon: 'home'      },
  { name: 'dares',     label: 'Dares',     icon: 'compass-outline',   activeIcon: 'compass'   },
  { name: 'coin-toss', label: 'Toss',      icon: 'add-outline',       activeIcon: 'add'       },
  { name: 'history',   label: 'History',   icon: 'people-outline',    activeIcon: 'people'    },
  { name: 'store',     label: 'Store',     icon: 'bag-outline',       activeIcon: 'bag'       },
];

// ─── Tab Button Item ──────────────────────────────────────────────────────────
function TabItem({
  tab,
  focused,
  isDark,
  onPress,
}: {
  tab: (typeof TABS)[0];
  focused: boolean;
  isDark: boolean;
  onPress: () => void;
}) {
  const width = useSharedValue(focused ? 100 : 46);
  const textOpacity = useSharedValue(focused ? 1 : 0);
  const scale = useSharedValue(1);

  useEffect(() => {
    width.value = withSpring(focused ? 100 : 46, {
      damping: 18,
      stiffness: 150,
      mass: 0.8,
    });
    textOpacity.value = withTiming(focused ? 1 : 0, { duration: 150 });
  }, [focused]);

  const handlePress = () => {
    scale.value = withSpring(0.9, { damping: 10, stiffness: 300 }, () => {
      scale.value = withSpring(1, { damping: 12, stiffness: 240 });
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  const containerStyle = useAnimatedStyle(() => ({
    width: width.value,
    transform: [{ scale: scale.value }],
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateX: withSpring(focused ? 0 : -6) }],
  }));

  // Friendzy Colors
  const activeBg = isDark ? '#481639' : '#FCEEF5';
  const activeColor = isDark ? '#FFFFFF' : '#481639';
  const inactiveColor = isDark ? '#777777' : '#999999';

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.95}>
      <Animated.View
        style={[
          styles.tabItem,
          { backgroundColor: focused ? activeBg : 'transparent' },
          containerStyle,
        ]}
      >
        <Ionicons
          size={focused ? 20 : 24}
          name={(focused ? tab.activeIcon : tab.icon) as any}
          color={focused ? activeColor : inactiveColor}
        />
        {focused && (
          <Animated.Text
            style={[styles.labelText, { color: activeColor }, textStyle]}
            numberOfLines={1}
          >
            {tab.label}
          </Animated.Text>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Custom Floating Tab Bar ──────────────────────────────────────────────────
function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const isDark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();

  const bottomMargin = Platform.OS === 'ios'
    ? Math.max(24, insets.bottom)
    : Math.max(16, insets.bottom + 8);

  return (
    <View style={[styles.barContainer, { bottom: bottomMargin }]}>
      <View
        style={[
          styles.tabBar,
          {
            backgroundColor: isDark ? '#1E1E1E' : '#FFFFFF',
            borderColor: isDark ? '#333333' : '#F0F0F0',
            borderWidth: 1,
            shadowColor: isDark ? '#000000' : '#481639',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: isDark ? 0.5 : 0.08,
            shadowRadius: 16,
            elevation: 10,
          },
        ]}
      >
        {TABS.map((tab, index) => {
          const route = state.routes.find((r) => r.name === tab.name);
          if (!route) return null;
          const focused = state.index === state.routes.findIndex((r) => r.name === tab.name);

          return (
            <TabItem
              key={tab.name}
              tab={tab}
              focused={focused}
              isDark={isDark}
              onPress={() => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented) {
                  navigation.navigate(tab.name);
                }
              }}
            />
          );
        })}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  barContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    paddingHorizontal: 16,
  },
  tabBar: {
    flexDirection: 'row',
    height: 64,
    borderRadius: 32,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    width: '100%',
    maxWidth: 380,
    elevation: 12,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  tabItem: {
    height: 46,
    borderRadius: 23,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    gap: 6,
    overflow: 'hidden',
  },
  labelText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});

// ─── Root Layout ──────────────────────────────────────────────────────────────
export default function TabLayout() {
  const segments = useSegments();
  const pathname = usePathname();
  const router = useRouter();
  const navigation = useNavigation();

  const pathnameRef = useRef(pathname);
  const segmentsRef = useRef(segments);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    segmentsRef.current = segments;
  }, [segments]);

  // ── Global socket connection across all tabs ──
  useEffect(() => {
    let isMounted = true;
    const initGlobalSocket = async () => {
      try {
        const activeRoom = await getActiveRoom();
        if (isMounted && activeRoom?.code) {
          await GameSocket.initialize();
          await GameSocket.joinRoom(activeRoom.code);
        }
      } catch (err) {
        console.log('[TabLayout] Global socket sync error:', err);
      }
    };

    initGlobalSocket();
    return () => {
      isMounted = false;
    };
  }, []);

  // ── Global Coin Toss Real-time Interceptor & Partner Redirection ──
  useEffect(() => {
    let lastHandledEventId = '';
    let lastHandledTime = 0;

    const handleGameEvent = async (payload: any) => {
      const eventType = payload?.eventType;
      const eventData = payload?.data || payload;
      if (!eventData) return;

      if (eventType === 'COIN_TOSS' || eventType === 'COIN_FLIP_RESULT') {
        const eventId = String(eventData.eventId || eventData.timestamp || Date.now());
        if (eventId === lastHandledEventId || (Date.now() - lastHandledTime < 1500)) {
          return;
        }
        lastHandledEventId = eventId;
        lastHandledTime = Date.now();

        // Check if the current user was the flipper
        const myProfile = await getMyProfileCached().catch(() => null);
        const myId = myProfile?.id;
        const flipperId = eventData.flipperId || eventData.flipper_id;
        if (myId && flipperId && myId === flipperId) {
          // This client flipped locally, no redirection needed
          return;
        }

        const incomingResult = (eventData.result || eventData.chosen_side || 'HEADS').toUpperCase();
        const partnerChoice = (eventData.flipperChoice || eventData.choice || eventData.chosen_side || 'HEADS').toUpperCase();

        const pendingData = {
          eventId,
          flipperChoice: partnerChoice,
          choice: partnerChoice,
          result: incomingResult,
          flipperId: flipperId,
          flipperName: eventData.flipperName || 'Partner',
          winnerId: eventData.winnerId || eventData.winner_id,
          reason: eventData.reason || 'Coin Toss Decider',
          timestamp: Date.now(),
        };

        // Store into coin toss coordinator
        setPendingCoinToss(pendingData);

        // Pre-save into local storage in background
        const myOppositeChoice = partnerChoice === 'HEADS' ? 'TAILS' : 'HEADS';
        const isMeWinner = myOppositeChoice === incomingResult;
        const flipperName = eventData.flipperName || 'Partner';
        const reason = eventData.reason || 'Coin Toss Decider';

        saveCoinTossItem({
          id: eventId,
          flipperName,
          choice: partnerChoice,
          result: incomingResult,
          outcome: isMeWinner ? 'YOU WON' : `${flipperName.toUpperCase()} WON`,
          reason,
          isMeWinner,
          time: new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
          timestamp: Date.now(),
        }).catch(() => {});

        // Close sidebar if open
        DeviceEventEmitter.emit('app:closeSidebar');

        // Broadcast to CoinToss screen
        DeviceEventEmitter.emit('coin:remote_toss', pendingData);

        // Check if user is already on coin-toss
        const currentPath = pathnameRef.current || '';
        const currentSegments = (segmentsRef.current as string[]) || [];
        const isAlreadyOnCoinToss =
          currentPath.includes('/coin-toss') ||
          currentSegments.includes('coin-toss');

        if (!isAlreadyOnCoinToss) {
          console.log('[TabLayout] Partner tossed coin! Redirecting partner to /(tabs)/coin-toss from', currentPath);
          router.push('/(tabs)/coin-toss');
        }
      }
    };

    GameSocket.on('game_event', handleGameEvent);
    GameSocket.on('coin_flip_result', (data: any) => handleGameEvent({ eventType: 'COIN_FLIP_RESULT', data }));

    return () => {
      GameSocket.off('game_event', handleGameEvent);
      GameSocket.off('coin_flip_result', handleGameEvent);
    };
  }, [router]);

  // ── Logout handler: resets root Stack to login screen ──
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('app:logout', () => {
      console.log('[TABS LAYOUT] app:logout → resetting root stack to index');
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'index' }],
        })
      );
    });
    return () => sub.remove();
  }, [navigation]);

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{ headerShown: false }}
      >
        {TABS.map((tab) => (
          <Tabs.Screen key={tab.name} name={tab.name} options={{ title: tab.label }} />
        ))}
        <Tabs.Screen name="explore" options={{ href: null, title: 'Explore' }} />
        <Tabs.Screen name="chat" options={{ href: null, title: 'Chat' }} />
        <Tabs.Screen name="profile" options={{ href: null, title: 'Profile' }} />
      </Tabs>
      <Sidebar />
    </View>
  );
}


