import { useSidebar } from '@/context/SidebarContext';
import { useThemeToggle } from '@/hooks/use-color-scheme';
import { Ionicons } from '@expo/vector-icons';
import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect, router } from 'expo-router';
import { Image, ScrollView, StatusBar, Text, TextInput, TouchableOpacity, View, ActivityIndicator, DeviceEventEmitter, Modal } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, interpolateColor } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getMyProfileCached, updateMyProfile } from '@/services/authService';
import { getActiveRoom, clearRoomCache } from '@/services/roomService';
import GameSocket from '@/services/socketService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ANIMATED_AVATARS, AVATAR_CATEGORIES, AnimatedAvatar } from '@/constants/avatars';

function SmoothThemeSwitch({ isDark, onToggle }: { isDark: boolean; onToggle: () => void }) {
  const progress = useSharedValue(isDark ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(isDark ? 1 : 0, {
      damping: 16,
      stiffness: 160,
      mass: 0.7,
    });
  }, [isDark, progress]);

  const animatedTrackStyle = useAnimatedStyle(() => {
    const backgroundColor = interpolateColor(
      progress.value,
      [0, 1],
      ['#e2e8f0', '#0f766e']
    );
    const borderColor = interpolateColor(
      progress.value,
      [0, 1],
      ['#cbd5e1', '#2dd4bf']
    );
    return {
      backgroundColor,
      borderColor,
    };
  });

  const animatedThumbStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: progress.value * 24 }],
    };
  });

  const sunStyle = useAnimatedStyle(() => {
    return {
      opacity: 1 - progress.value * 0.75,
      transform: [{ scale: 1 - progress.value * 0.2 }],
    };
  });

  const moonStyle = useAnimatedStyle(() => {
    return {
      opacity: 0.25 + progress.value * 0.75,
      transform: [{ scale: 0.8 + progress.value * 0.2 }],
    };
  });

  return (
    <View className="p-1" pointerEvents="none">
      <Animated.View
        style={[
          {
            width: 54,
            height: 30,
            borderRadius: 20,
            borderWidth: 1.5,
            padding: 2,
            justifyContent: 'center',
          },
          animatedTrackStyle,
        ]}
      >
        <View className="flex-row justify-between items-center px-1.5 absolute inset-0">
          <Animated.View style={sunStyle}>
            <Ionicons name="sunny" size={12} color="#f59e0b" />
          </Animated.View>
          <Animated.View style={moonStyle}>
            <Ionicons name="moon" size={12} color="#5eead4" />
          </Animated.View>
        </View>
        <Animated.View
          style={[
            {
              width: 22,
              height: 22,
              borderRadius: 11,
              backgroundColor: '#ffffff',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.25,
              shadowRadius: 3,
              elevation: 4,
              alignItems: 'center',
              justifyContent: 'center',
            },
            animatedThumbStyle,
          ]}
        >
          <Ionicons
            name={isDark ? 'moon' : 'sunny'}
            size={12}
            color={isDark ? '#0d9488' : '#f59e0b'}
          />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const formatRoomActiveTime = (createdAt?: string | null) => {
  if (!createdAt) return 'No Active Room';
  const created = new Date(createdAt);
  const now = new Date();
  const diffMs = Math.max(0, now.getTime() - created.getTime());

  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    if (hours > 0) {
      return `Room Active for ${days}d ${hours}h`;
    }
    return `Room Active for ${days} ${days === 1 ? 'day' : 'days'}`;
  }

  if (hours > 0) {
    return `Room Active for ${hours}h ${minutes}m`;
  }

  return `Room Active for ${minutes} ${minutes === 1 ? 'min' : 'mins'}`;
};

export default function Profile() {
  const { openSidebar } = useSidebar();
  const { colorScheme, toggleTheme } = useThemeToggle();
  const isDark = colorScheme === 'dark';

  const [userName, setUserName] = useState('User');
  const [partnerName, setPartnerName] = useState('Partner');
  const [partnerAvatar, setPartnerAvatar] = useState<string>(ANIMATED_AVATARS[1].url);
  const [activeRoom, setActiveRoom] = useState<any>(null);
  const [roomActiveTimeText, setRoomActiveTimeText] = useState<string>('No Active Room');
  const [userAvatar, setUserAvatar] = useState<string>(ANIMATED_AVATARS[0].url);
  const [isUpdatingAvatar, setIsUpdatingAvatar] = useState(false);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [selectedAvatarCategory, setSelectedAvatarCategory] = useState<string>('All');

  // ── Load cached profile & active room instantly on mount ───────────────────
  useEffect(() => {
    const loadCachedInitialState = async () => {
      try {
        const cachedAvatar = await AsyncStorage.getItem('cachedUserAvatar');
        if (cachedAvatar) setUserAvatar(cachedAvatar);

        const cachedName = await AsyncStorage.getItem('cachedUserName');
        if (cachedName) setUserName(cachedName);

        const cachedRoomStr = await AsyncStorage.getItem('cachedActiveRoom');
        if (cachedRoomStr) {
          const cachedRoom = JSON.parse(cachedRoomStr);
          if (cachedRoom && cachedRoom.id) {
            setActiveRoom(cachedRoom);
            if (cachedRoom.created_at) {
              setRoomActiveTimeText(formatRoomActiveTime(cachedRoom.created_at));
            }
            const cachedPartnerName = await AsyncStorage.getItem(`partnerName_${cachedRoom.id}`);
            if (cachedPartnerName) setPartnerName(cachedPartnerName);

            const cachedPartnerAvatar = await AsyncStorage.getItem(`partnerAvatar_${cachedRoom.id}`);
            if (cachedPartnerAvatar) setPartnerAvatar(cachedPartnerAvatar);
          }
        }
      } catch (e) {
        console.log('Error loading initial cached state in profile:', e);
      }
    };
    loadCachedInitialState();
  }, []);

  useEffect(() => {
    if (!activeRoom?.created_at || (activeRoom?.status !== 'ACTIVE' && !activeRoom?.partner_id)) {
      setRoomActiveTimeText(activeRoom?.status === 'WAITING' ? 'Waiting for Partner...' : 'No Active Room');
      return;
    }

    const updateActiveTime = () => {
      setRoomActiveTimeText(formatRoomActiveTime(activeRoom.created_at));
    };

    updateActiveTime();
    const interval = setInterval(updateActiveTime, 10000); // Live dynamic updates

    return () => clearInterval(interval);
  }, [activeRoom?.created_at, activeRoom?.status, activeRoom?.partner_id]);

  // ── Favorite Memory State ──────────────────────────
  const [favoriteMemory, setFavoriteMemory] = useState<string>('');
  const [isEditingMemory, setIsEditingMemory] = useState<boolean>(false);
  const [tempMemoryText, setTempMemoryText] = useState<string>('');

  useEffect(() => {
    const loadFavoriteMemory = async () => {
      try {
        const savedMemory = await AsyncStorage.getItem('user_favorite_memory');
        if (savedMemory) {
          setFavoriteMemory(savedMemory);
        }
      } catch (err) {
        console.log('Failed to load favorite memory:', err);
      }
    };
    loadFavoriteMemory();
  }, []);

  const handleSaveFavoriteMemory = async () => {
    const trimmed = tempMemoryText.trim();
    setFavoriteMemory(trimmed);
    setIsEditingMemory(false);
    try {
      if (trimmed) {
        await AsyncStorage.setItem('user_favorite_memory', trimmed);
      } else {
        await AsyncStorage.removeItem('user_favorite_memory');
      }
    } catch (err) {
      console.log('Failed to save favorite memory:', err);
    }
  };

  const loadProfileAndRoom = useCallback(async () => {
    // ── Step 1: Load user name & avatar from cache & profile API ──
    let myUserId: string | undefined;
    try {
      const cachedAvatar = await AsyncStorage.getItem('cachedUserAvatar');
      if (cachedAvatar) setUserAvatar(cachedAvatar);

      const cachedName = await AsyncStorage.getItem('cachedUserName');
      if (cachedName) setUserName(cachedName);

      const profile = await getMyProfileCached().catch(() => null);
      if (profile?.id) myUserId = profile.id;
      if (profile?.firstName) {
        setUserName(profile.firstName);
        await AsyncStorage.setItem('cachedUserName', profile.firstName);
      }
      if (profile?.avatarUrl) {
        setUserAvatar(profile.avatarUrl);
        await AsyncStorage.setItem('cachedUserAvatar', profile.avatarUrl);
      }
    } catch (err) {
      console.log('Profile cache read failed in profile.tsx:', err);
    }

    // ── Step 2: Load room + partner details ──
    try {
      let room: any = null;
      try {
        room = await getActiveRoom();
      } catch (e) {
        // Fallback to cache on network error
      }

      if (!room) {
        const cachedRoomStr = await AsyncStorage.getItem('cachedActiveRoom');
        if (cachedRoomStr) {
          room = JSON.parse(cachedRoomStr);
        }
      }

      if (room && (room.status === 'ACTIVE' || room.partner_id)) {
        setActiveRoom(room);
        await AsyncStorage.setItem('cachedActiveRoom', JSON.stringify(room));

        // Determine if current user is the host
        
          // Determine if current user is the host. If myUserId is missing, we check if current user is partner.
          // If we can't tell, default to true but this should rarely happen.
          let isHost = true;
          if (myUserId) {
            isHost = (myUserId === room.host_id);
          } else {
            const cachedId = await AsyncStorage.getItem('cachedUserId');
            if (cachedId) isHost = (cachedId === room.host_id);
          }


        // Partner Name
        let resolvedName = isHost ? room.partner_name : room.host_name;
        if (!resolvedName) {
          resolvedName = await AsyncStorage.getItem(`partnerName_${room.id}`);
        }
        const finalPartnerName = resolvedName || 'Partner';
        setPartnerName(finalPartnerName);
        if (room.id) await AsyncStorage.setItem(`partnerName_${room.id}`, finalPartnerName);

        // Partner Avatar
        let resolvedAvatar = isHost ? room.partner_avatar : room.host_avatar;
        if (!resolvedAvatar) {
          resolvedAvatar = await AsyncStorage.getItem(`partnerAvatar_${room.id}`);
        }
        const finalPartnerAvatar = resolvedAvatar || ANIMATED_AVATARS[1].url;
        setPartnerAvatar(finalPartnerAvatar);
        if (room.id) await AsyncStorage.setItem(`partnerAvatar_${room.id}`, finalPartnerAvatar);

        if (room.created_at) {
          setRoomActiveTimeText(formatRoomActiveTime(room.created_at));
        }
      } else if (room && room.status === 'WAITING') {
        setActiveRoom(room);
        setPartnerName('');
        setPartnerAvatar('');
        setRoomActiveTimeText('Waiting for Partner...');
      } else {
        // Only clear if confirmed no active room
        const cachedRoomStr = await AsyncStorage.getItem('cachedActiveRoom');
        if (!cachedRoomStr) {
          setActiveRoom(null);
          setPartnerName('');
          setPartnerAvatar('');
          setRoomActiveTimeText('No Active Room');
        }
      }
    } catch (err) {
      console.log('Active room fetch failed in profile.tsx:', err);
    }
  }, []);

  // Reload profile on mount and real-time socket events
  useEffect(() => {
    loadProfileAndRoom();

    const sub = DeviceEventEmitter.addListener('profile:updated', (data) => {
      if (data?.avatarUrl) setUserAvatar(data.avatarUrl);
      if (data?.firstName) setUserName(data.firstName);
    });

    const clearSub = DeviceEventEmitter.addListener('app:clearRoom', () => {
      setActiveRoom(null);
      setPartnerName('');
      setPartnerAvatar('');
      setRoomActiveTimeText('No Active Room');
    });

    const refreshSub = DeviceEventEmitter.addListener('app:refreshDashboard', () => {
      loadProfileAndRoom();
    });

    const roomSub = DeviceEventEmitter.addListener('room:updated', () => {
      loadProfileAndRoom();
    });

    const onPartnerLeft = async () => {
      console.log('[Profile] Live partner_left/room_left received');
      await clearRoomCache();
      setActiveRoom(null);
      setPartnerName('');
      setPartnerAvatar('');
      setRoomActiveTimeText('No Active Room');
    };

    const onPartnerJoined = () => {
      console.log('[Profile] Live partner_joined received');
      loadProfileAndRoom();
    };

    const onGameEvent = async (payload: any) => {
      if (payload.eventType === 'PARTNER_INFO') {
        const { first_name, avatar_url } = payload.data || {};
        if (first_name) {
          setPartnerName(first_name);
          const currentRoomStr = await AsyncStorage.getItem('cachedActiveRoom');
          if (currentRoomStr) {
            const currentRoom = JSON.parse(currentRoomStr);
            if (currentRoom && currentRoom.id) await AsyncStorage.setItem(`partnerName_${currentRoom.id}`, first_name);
          }
        }
        if (avatar_url) {
          setPartnerAvatar(avatar_url);
          const currentRoomStr = await AsyncStorage.getItem('cachedActiveRoom');
          if (currentRoomStr) {
            const currentRoom = JSON.parse(currentRoomStr);
            if (currentRoom && currentRoom.id) await AsyncStorage.setItem(`partnerAvatar_${currentRoom.id}`, avatar_url);
          }
        }
      }
    };

    GameSocket.on('partner_left', onPartnerLeft);
    GameSocket.on('room_left', onPartnerLeft);
    GameSocket.on('room_closed', onPartnerLeft);
    GameSocket.on('partner_joined', onPartnerJoined);
    GameSocket.on('room_updated', loadProfileAndRoom);
    GameSocket.on('game_event', onGameEvent);

    return () => {
      sub.remove();
      clearSub.remove();
      refreshSub.remove();
      roomSub.remove();
      GameSocket.off('partner_left', onPartnerLeft);
      GameSocket.off('room_left', onPartnerLeft);
      GameSocket.off('room_closed', onPartnerLeft);
      GameSocket.off('partner_joined', onPartnerJoined);
      GameSocket.off('room_updated', loadProfileAndRoom);
      GameSocket.off('game_event', onGameEvent);
    };
  }, [loadProfileAndRoom]);

  // Reload dynamically whenever screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadProfileAndRoom();
    }, [loadProfileAndRoom])
  );

  // ── Animated Avatar Selection Handler ──────────────────────────
  const handleSelectAnimatedAvatar = async (avatar: AnimatedAvatar) => {
    try {
      setIsUpdatingAvatar(true);
      setUserAvatar(avatar.url);
      await AsyncStorage.setItem('cachedUserAvatar', avatar.url);

      try {
        await updateMyProfile({ avatar_url: avatar.url });
        DeviceEventEmitter.emit('profile:updated', { avatarUrl: avatar.url });
      } catch (e) {
        console.log('Failed to save profile avatar to backend:', e);
      }

      // Broadcast over socket if active room exists
      if (activeRoom && activeRoom.code) {
        GameSocket.sendGameEvent(activeRoom.code, 'PARTNER_INFO', {
          first_name: userName,
          avatar_url: avatar.url
        });
      }
    } catch (err) {
      console.log('Error selecting avatar:', err);
    } finally {
      setIsUpdatingAvatar(false);
      setIsAvatarModalOpen(false);
    }
  };

  const filteredAvatars = selectedAvatarCategory === 'All'
    ? ANIMATED_AVATARS
    : ANIMATED_AVATARS.filter((av) => av.category === selectedAvatarCategory);

  // ── Suggestion form state ───────────────────────────────
  const CATEGORIES = ['Romantic 💕', 'Adventure 🏕️', 'Cozy 🕯️', 'Spicy 🔥', 'Creative 🎨'];
  const [suggestionText, setSuggestionText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);

  const handleSubmitSuggestion = () => {
    if (!suggestionText.trim()) return;
    setSubmitted(true);
    setSuggestionText('');
    setSelectedCategory('');
    setTimeout(() => setSubmitted(false), 3500);
  };

  return (
    <SafeAreaView className="flex-1 bg-[#fdfaf9] dark:bg-[#0F0608]" edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={isDark ? "#0F0608" : "#fdfaf9"} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 160 }}>

        {/* Header */}
        <View className="flex-row items-center justify-between px-6 pt-5 pb-3">
          <TouchableOpacity onPress={openSidebar}>
            <Ionicons name="menu-outline" size={30} color={isDark ? "#fff" : "#9f1239"} />
          </TouchableOpacity>
          <View className="flex-row items-center gap-1.5">
            <Ionicons name="infinite" size={28} color={isDark ? "#fda4af" : "#be123c"} style={{ transform: [{ rotate: '-15deg' }] }} />
            <Text className="text-red-700 dark:text-rose-400 font-black text-xl tracking-tight">SoulShuffle</Text>
          </View>
          <TouchableOpacity onPress={() => setIsAvatarModalOpen(true)} className="w-8 h-8 rounded-full bg-rose-500/10 dark:bg-rose-950/40 items-center justify-center border border-rose-200 dark:border-rose-950/30 p-0.5">
            <Image
              source={{ uri: userAvatar }}
              className="w-6 h-6"
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>

        {/* Profile Avatars Section */}
        {(() => {
          const isPairActive = Boolean(activeRoom && (activeRoom.status === 'ACTIVE' || activeRoom.partner_id || (partnerName && partnerName !== 'Partner')));

          if (isPairActive) {
            return (
              <View className="items-center mt-4">
                <View className="flex-row justify-center relative w-full h-44 items-center">
                  {/* Left Image (User's 3D Avatar with Edit Button) */}
                  <TouchableOpacity 
                    onPress={() => setIsAvatarModalOpen(true)}
                    activeOpacity={0.9}
                    className="absolute right-1/2 mr-[-12px] bg-slate-900 dark:bg-[#200e14] rounded-t-[40px] rounded-br-[40px] rounded-bl-[10px] overflow-hidden w-40 h-40 z-10 border-2 border-rose-400/40 shadow-xl items-center justify-center p-3"
                  >
                    <Image
                      source={{ uri: userAvatar || ANIMATED_AVATARS[0].url }}
                      className="w-24 h-24"
                      resizeMode="contain"
                    />
                    {/* Overlay with animated avatar edit icon */}
                    <View className="absolute inset-0 bg-black/15 items-center justify-center">
                      {isUpdatingAvatar ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                      ) : (
                        <View className="bg-rose-600/90 p-1.5 rounded-full shadow-md flex-row items-center gap-1 px-3 absolute bottom-3">
                          <Ionicons name="sparkles" size={12} color="white" />
                          <Text className="text-white font-black text-[9px] tracking-wider uppercase">Avatars ✨</Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>

                  {/* Right Image (Partner's 3D Avatar) */}
                  <View className="absolute left-1/2 ml-[-12px] bg-teal-950/80 dark:bg-[#132321] rounded-t-[40px] rounded-bl-[40px] rounded-br-[10px] overflow-hidden w-40 h-40 border-2 border-teal-400/40 shadow-xl items-center justify-center p-3">
                    <Image
                      source={{ uri: partnerAvatar || ANIMATED_AVATARS[1].url }}
                      className="w-24 h-24"
                      resizeMode="contain"
                    />
                  </View>

                  {/* Shared Badge */}
                  <View className="absolute bottom-[-10px] z-20 bg-[#0d5f5a] dark:bg-teal-600 px-4 py-2 rounded-full flex-row items-center justify-center shadow-lg border border-teal-300/30">
                    <Ionicons name="heart" size={12} color="white" />
                    <Text className="text-white font-bold text-[10px] ml-1 tracking-widest uppercase">Happy Together</Text>
                  </View>
                </View>

                <Text className="text-3xl font-black text-[#af2c3b] dark:text-white mt-8 tracking-tight text-center">
                  {userName} & {partnerName || 'Partner'}
                </Text>
                <Text className="text-slate-500 dark:text-slate-400 font-medium text-sm mt-1">
                  {roomActiveTimeText}
                </Text>
              </View>
            );
          }

          // Solo User Avatar (No Active Pair)
          return (
            <View className="items-center mt-4">
              <View className="relative items-center justify-center">
                <TouchableOpacity 
                  onPress={() => setIsAvatarModalOpen(true)}
                  activeOpacity={0.9}
                  className="bg-slate-900 dark:bg-[#200e14] rounded-[36px] overflow-hidden w-36 h-36 border-2 border-rose-400/40 shadow-xl items-center justify-center p-3"
                >
                  <Image
                    source={{ uri: userAvatar }}
                    className="w-24 h-24"
                    resizeMode="contain"
                  />
                  {/* Overlay with animated avatar edit icon */}
                  <View className="absolute inset-0 bg-black/15 items-center justify-center">
                    {isUpdatingAvatar ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <View className="bg-rose-600/90 p-1.5 rounded-full shadow-md flex-row items-center gap-1 px-3 absolute bottom-3">
                        <Ionicons name="sparkles" size={12} color="white" />
                        <Text className="text-white font-black text-[9px] tracking-wider uppercase">Avatars ✨</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              </View>

              <Text className="text-3xl font-black text-[#af2c3b] dark:text-white mt-6 tracking-tight">
                {userName}
              </Text>
              <Text className="text-slate-500 dark:text-slate-400 font-medium text-sm mt-1">
                {roomActiveTimeText}
              </Text>
            </View>
          );
        })()}

        {/* Top Cards Info */}
        <View className="px-6 mt-8">
          <View className="bg-[#e4dad6]/30 dark:bg-[#271318]/80 rounded-[24px] p-6 border border-slate-100 dark:border-rose-950/30 overflow-hidden relative">
            {isEditingMemory ? (
              <View className="z-10">
                <View className="flex-row items-center justify-between mb-3">
                  <Text className="text-base font-bold text-slate-800 dark:text-white tracking-tight">Favorite Memory</Text>
                  <TouchableOpacity onPress={() => setIsEditingMemory(false)}>
                    <Ionicons name="close-circle" size={20} color={isDark ? "#94a3b8" : "#64748b"} />
                  </TouchableOpacity>
                </View>

                <TextInput
                  multiline
                  numberOfLines={3}
                  value={tempMemoryText}
                  onChangeText={setTempMemoryText}
                  placeholder="Share your favorite couple memory here... 💕"
                  placeholderTextColor={isDark ? "rgba(255,255,255,0.4)" : "#94a3b8"}
                  className="bg-white dark:bg-[#1a0c10] border border-rose-200 dark:border-rose-950/40 rounded-2xl p-3.5 text-sm font-medium text-slate-800 dark:text-white mb-3 min-h-[80px]"
                  style={{ textAlignVertical: 'top' }}
                  autoFocus
                />

                <View className="flex-row items-center justify-end gap-2">
                  <TouchableOpacity 
                    onPress={() => setIsEditingMemory(false)}
                    className="px-4 py-2 rounded-full border border-slate-300 dark:border-slate-700"
                  >
                    <Text className="text-xs font-bold text-slate-600 dark:text-slate-300">Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={handleSaveFavoriteMemory}
                    className="bg-[#af2c3b] dark:bg-rose-600 px-4 py-2 rounded-full flex-row items-center"
                  >
                    <Ionicons name="checkmark-circle" size={14} color="white" />
                    <Text className="text-xs font-bold text-white ml-1">Save Memory</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View className="z-10">
                <View className="flex-row items-center justify-between mb-3">
                  <Text className="text-base font-bold text-slate-800 dark:text-white tracking-tight">Favorite Memory</Text>
                  <TouchableOpacity 
                    onPress={() => {
                      setTempMemoryText(favoriteMemory);
                      setIsEditingMemory(true);
                    }}
                    className="flex-row items-center bg-white/80 dark:bg-rose-950/50 px-3 py-1 rounded-full border border-rose-200/50 dark:border-rose-900/40"
                  >
                    <Ionicons name="pencil" size={12} color={isDark ? "#f43f5e" : "#af2c3b"} />
                    <Text className="text-[11px] font-bold text-[#af2c3b] dark:text-rose-400 ml-1">
                      {favoriteMemory ? 'Edit' : 'Add'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {favoriteMemory ? (
                  <Text className="text-sm font-medium italic text-slate-600 dark:text-slate-300 leading-6 pr-6">
                    &quot;{favoriteMemory}&quot;
                  </Text>
                ) : (
                  <TouchableOpacity 
                    activeOpacity={0.8}
                    onPress={() => {
                      setTempMemoryText('');
                      setIsEditingMemory(true);
                    }}
                    className="py-1"
                  >
                    <Text className="text-sm font-medium italic text-slate-400 dark:text-slate-400 leading-6 pr-6">
                      No favorite memory added yet. Tap here to write down your special moment together! 💕
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity 
                  onPress={() => {
                    setTempMemoryText(favoriteMemory);
                    setIsEditingMemory(true);
                  }} 
                  className="mt-4 flex-row items-center"
                >
                  <Text className="text-xs font-bold text-[#af2c3b] dark:text-rose-400 tracking-wide uppercase">
                    {favoriteMemory ? 'Update Memory' : '+ Add Favorite Memory'}
                  </Text>
                  <Ionicons name="arrow-forward" size={12} color={isDark ? "#f43f5e" : "#af2c3b"} className="ml-1" />
                </TouchableOpacity>
              </View>
            )}
            <Ionicons name="images" size={80} color={isDark ? "#1e293b" : "#e5e5e5"} style={{ position: 'absolute', bottom: -20, right: -10, opacity: 0.8 }} />
          </View>
        </View>

        {/* ── Suggest a Card ───────────────────────────── */}
        <View className="px-6 mt-8">
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-row items-center">
              <View className="bg-violet-100 dark:bg-violet-950/60 w-8 h-8 rounded-full items-center justify-center mr-3">
                <Ionicons name="sparkles" size={14} color={isDark ? '#a78bfa' : '#7c3aed'} />
              </View>
              <Text className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">Suggest a Card</Text>
            </View>
            <View className="bg-violet-100 dark:bg-violet-900/40 px-2.5 py-1 rounded-full">
              <Text className="text-[10px] font-bold text-violet-600 dark:text-violet-300 tracking-widest uppercase">For Admins</Text>
            </View>
          </View>

          <View style={{
            backgroundColor: isDark ? '#7c2d12' : '#ff6b35',
            borderRadius: 28,
            padding: 20,
            transform: [{ translateY: -6 }],
            shadowColor: '#ea580c',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: isDark ? 0.5 : 0.45,
            shadowRadius: 18,
            elevation: 10,
            borderWidth: 1,
            borderColor: isDark ? '#c2410c' : '#fb923c',
          }}>

            {submitted ? (
              /* ── Success State ── */
              <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                  <Ionicons name="checkmark-circle" size={34} color="#fff" />
                </View>
                <Text style={{ fontSize: 16, fontWeight: '900', color: '#fff', letterSpacing: -0.5 }}>Thanks for the idea! ✨</Text>
                <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: '500', marginTop: 6, textAlign: 'center', paddingHorizontal: 16, lineHeight: 18 }}>
                  Our team will review your suggestion and may add it to the deck.
                </Text>
              </View>
            ) : (
              /* ── Input State ── */
              <View>
                <Text style={{ fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.75)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>Pick a category</Text>

                {/* Category pills */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
                  {CATEGORIES.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      onPress={() => setSelectedCategory(selectedCategory === cat ? '' : cat)}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 50,
                        borderWidth: 1.5,
                        borderColor: selectedCategory === cat ? '#fff' : 'rgba(255,255,255,0.45)',
                        backgroundColor: selectedCategory === cat ? '#fff' : 'rgba(255,255,255,0.15)',
                      }}
                    >
                      <Text style={{
                        fontSize: 12,
                        fontWeight: '700',
                        color: selectedCategory === cat ? '#ea580c' : '#fff',
                      }}>
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={{ fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.75)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>Your card idea</Text>

                {/* Text input */}
                <View style={{
                  borderWidth: inputFocused ? 2 : 1.5,
                  borderColor: inputFocused ? '#fff' : 'rgba(255,255,255,0.5)',
                  borderRadius: 16,
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  padding: 14,
                  marginBottom: 14,
                }}>
                  <TextInput
                    value={suggestionText}
                    onChangeText={setSuggestionText}
                    onFocus={() => setInputFocused(true)}
                    onBlur={() => setInputFocused(false)}
                    placeholder="e.g. Write a love letter to each other and read them aloud..."
                    placeholderTextColor="rgba(255,255,255,0.55)"
                    multiline
                    numberOfLines={3}
                    maxLength={300}
                    style={{
                      color: '#fff',
                      fontSize: 13,
                      fontWeight: '500',
                      lineHeight: 20,
                      minHeight: 72,
                      textAlignVertical: 'top',
                    }}
                  />
                </View>

                {/* Char counter + Submit */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: '500' }}>
                    {suggestionText.length}/300
                  </Text>
                  <TouchableOpacity
                    onPress={handleSubmitSuggestion}
                    disabled={!suggestionText.trim()}
                    style={{
                      backgroundColor: suggestionText.trim() ? '#fff' : 'rgba(255,255,255,0.25)',
                      paddingHorizontal: 20,
                      paddingVertical: 10,
                      borderRadius: 50,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 3 },
                      shadowOpacity: suggestionText.trim() ? 0.15 : 0,
                      shadowRadius: 6,
                      elevation: suggestionText.trim() ? 4 : 0,
                    }}
                  >
                    <Ionicons
                      name="send"
                      size={14}
                      color={suggestionText.trim() ? '#ea580c' : 'rgba(255,255,255,0.5)'}
                    />
                    <Text style={{
                      color: suggestionText.trim() ? '#ea580c' : 'rgba(255,255,255,0.5)',
                      fontSize: 13,
                      fontWeight: '800',
                    }}>
                      Submit Idea
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Settings */}
        <View className="mt-8 px-6 mb-4">
          <Text className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight mb-4">Settings</Text>

          <View className="bg-white dark:bg-[#271318] rounded-[32px] p-6 py-2 border border-slate-50/50 dark:border-rose-950/20">
            {/* Dark Mode Switch Toggle */}
            <TouchableOpacity 
              activeOpacity={0.7}
              onPress={toggleTheme}
              className="flex-row items-center justify-between py-4 border-b border-slate-100 dark:border-rose-950/20"
            >
              <View className="flex-row items-center flex-1">
                <View className="w-8 h-8 rounded-full bg-rose-500/10 dark:bg-rose-950/40 items-center justify-center">
                  <Ionicons name={isDark ? "moon" : "sunny"} size={18} color={isDark ? "#5eead4" : "#be123c"} />
                </View>
                <View className="ml-4 flex-1">
                  <Text className="text-sm font-bold text-slate-800 dark:text-white">Dark Mode</Text>
                  <Text className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5 pr-4 leading-4">
                    {isDark ? 'Dark theme active' : 'Light theme active'}
                  </Text>
                </View>
              </View>
              <SmoothThemeSwitch isDark={isDark} onToggle={toggleTheme} />
            </TouchableOpacity>

            <TouchableOpacity className="flex-row items-center justify-between py-5 border-b border-slate-100 dark:border-rose-950/20">
              <View className="flex-row items-center flex-1">
                <Ionicons name="lock-closed" size={18} color={isDark ? "#fff" : "#857169"} />
                <View className="ml-4 flex-1">
                  <Text className="text-sm font-bold text-slate-800 dark:text-white">Privacy & Data</Text>
                  <Text className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-1 pr-4 leading-4">Manage what your partner and friends see</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
            </TouchableOpacity>

            <TouchableOpacity 
              className="flex-row items-center justify-between py-5 border-b border-slate-100 dark:border-rose-950/20"
              onPress={() => router.push('/notifications')}
            >
              <View className="flex-row items-center flex-1">
                <Ionicons name="notifications" size={18} color={isDark ? "#fff" : "#857169"} />
                <View className="ml-4 flex-1">
                  <Text className="text-sm font-bold text-slate-800 dark:text-white">Notifications</Text>
                  <Text className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-1 pr-4 leading-4">Daily reminders and dare alerts</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
            </TouchableOpacity>

            <TouchableOpacity className="flex-row items-center justify-between py-5">
              <View className="flex-row items-center flex-1">
                <Ionicons name="people" size={18} color={isDark ? "#fff" : "#857169"} />
                <View className="ml-4 flex-1">
                  <Text className="text-sm font-bold text-slate-800 dark:text-white">Invite Partner</Text>
                  <Text className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-1 pr-4 leading-4">Resend invite or change partner email</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
            </TouchableOpacity>
          </View>
        </View>

      </ScrollView>

      {/* ── Modern Animated Avatar Selector Modal ────────────────── */}
      <Modal
        visible={isAvatarModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsAvatarModalOpen(false)}
      >
        <View className="flex-1 justify-end bg-black/70">
          <TouchableOpacity
            activeOpacity={1}
            className="flex-1"
            onPress={() => setIsAvatarModalOpen(false)}
          />

          <View className="bg-white dark:bg-[#1C0D12] rounded-t-[36px] max-h-[85%] p-6 pb-8 border-t border-rose-100 dark:border-rose-950/40 shadow-2xl">
            {/* Grab Handle */}
            <View className="w-12 h-1.5 rounded-full bg-slate-200 dark:bg-rose-950/60 self-center mb-4" />

            {/* Header */}
            <View className="flex-row items-center justify-between mb-1">
              <View className="flex-row items-center gap-2">
                <Text className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  Choose Avatar ✨
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsAvatarModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-rose-950/50 items-center justify-center"
              >
                <Ionicons name="close" size={20} color={isDark ? "#fda4af" : "#64748b"} />
              </TouchableOpacity>
            </View>
            <Text className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-4">
              Select an aesthetic avatar to represent you in SoulShuffle
            </Text>

            {/* Category Filter Pills */}
            <View className="mb-5">
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 10 }}>
                {AVATAR_CATEGORIES.map((cat) => {
                  const isActive = selectedAvatarCategory === cat;
                  return (
                    <TouchableOpacity
                      key={cat}
                      onPress={() => setSelectedAvatarCategory(cat)}
                      activeOpacity={0.8}
                      className={`px-4 py-2 rounded-full border ${
                        isActive
                          ? 'bg-rose-600 border-rose-600 dark:bg-rose-500 dark:border-rose-500'
                          : 'bg-slate-100 border-slate-200 dark:bg-[#271318] dark:border-rose-950/40'
                      }`}
                    >
                      <Text
                        className={`text-xs font-extrabold ${
                          isActive ? 'text-white' : 'text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Avatar Grid */}
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              <View className="flex-row flex-wrap justify-between">
                {filteredAvatars.map((item) => {
                  const isSelected = userAvatar === item.url;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      onPress={() => handleSelectAnimatedAvatar(item)}
                      activeOpacity={0.85}
                      className="w-[48%] mb-4"
                    >
                      <View
                        className={`relative rounded-3xl overflow-hidden border-2 h-36 items-center justify-center shadow-sm ${
                          isSelected
                            ? 'bg-rose-500/15 dark:bg-rose-950/60 border-rose-500 dark:border-rose-400 ring-4 ring-rose-500/20'
                            : 'bg-rose-50 dark:bg-[#200e14] border-slate-200/80 dark:border-rose-950/40'
                        }`}
                      >
                        <Image
                          source={{ uri: item.url }}
                          className="w-20 h-20"
                          resizeMode="contain"
                        />

                        {/* Emoji Tag */}
                        <View className="absolute top-2.5 left-2.5 bg-black/40 dark:bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-full flex-row items-center">
                          <Text className="text-xs font-bold text-white">
                            {item.emoji}
                          </Text>
                        </View>

                        {/* Selected Checkmark Badge */}
                        {isSelected && (
                          <View className="absolute top-2.5 right-2.5 bg-rose-600 rounded-full p-1 shadow-lg">
                            <Ionicons name="checkmark" size={12} color="white" />
                          </View>
                        )}

                        {/* Footer Name Overlay */}
                        <View className="absolute bottom-0 left-0 right-0 bg-black/40 dark:bg-black/60 py-1.5 px-2">
                          <Text className="text-white font-bold text-[11px] text-center" numberOfLines={1}>
                            {item.name}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}


