import Animated, { useSharedValue, useAnimatedScrollHandler, useAnimatedStyle, interpolate, Extrapolation } from 'react-native-reanimated';
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Dimensions, Image, TouchableOpacity, Platform, StatusBar, TextInput, Modal, ActivityIndicator, Alert, RefreshControl, DeviceEventEmitter } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useFocusEffect } from 'expo-router';
import { getActiveRoom, sendChallenge, ChallengePayload, Room } from '@/services/roomService';
import GameSocket from '@/services/socketService';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { fetchCards, fetchAvailableDeck, fetchSendLimits, SendLimits } from '@/services/cardService';
import { useSidebar } from '@/context/SidebarContext';
import { fetchStoreBundles, CardBundle } from '@/services/storeService';
import { useUserAvatar } from '@/hooks/use-user-avatar';

const sunsetPicnic = require('@/assets/images/sunset_picnic.jpeg');

const getBundleImage = (bundleName: string, defaultUrl?: string | null) => {
  const name = (bundleName || '').toLowerCase();
  if (name.includes('spicy') || name.includes('spark') || name.includes('nights')) {
    return require('../../assets/images/bundle_spicy.jpg');
  }
  if (name.includes('romantic') || name.includes('getaway') || name.includes('adventure') || name.includes('travel') || name.includes('weekend')) {
    return require('../../assets/images/bundle_romantic.jpg');
  }
  if (name.includes('cozy') || name.includes('connection') || name.includes('night') || name.includes('indoor') || name.includes('winter')) {
    return require('../../assets/images/bundle_cozy.jpg');
  }
  
  if (defaultUrl && defaultUrl.trim() !== '') {
    return { uri: defaultUrl };
  }
  
  return require('../../assets/images/bundle_cozy.jpg');
};

const FALLBACK_STORE_BUNDLES: CardBundle[] = [
  {
    id: 'dummy-spicy',
    name: 'Spicy Spark 🔥',
    description: 'Ignite passion with bold, intimate, and adventurous dares designed to bring you closer.',
    image_url: 'https://images.unsplash.com/photo-1543599538-a6c4f6cc5c05?w=500&h=400&fit=crop',
    is_active: true,
    bundle_plans: [
      { id: 'plan-spicy-1', bundle_id: 'dummy-spicy', card_count: 10, price: 99 },
      { id: 'plan-spicy-2', bundle_id: 'dummy-spicy', card_count: 25, price: 199 },
    ],
  },
  {
    id: 'dummy-romance',
    name: 'Romantic Getaway ✈️',
    description: 'Create unforgettable memories with outdoor dates, cute surprise tasks, and playful challenges.',
    image_url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=500&h=400&fit=crop',
    is_active: true,
    bundle_plans: [
      { id: 'plan-romance-1', bundle_id: 'dummy-romance', card_count: 15, price: 149 },
    ],
  },
  {
    id: 'dummy-cozy',
    name: 'Cozy Connection 🕯️',
    description: 'Warm, relaxing inside-the-house cards to connect deeply on lazy Sunday mornings or rainy evenings.',
    image_url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=500&h=400&fit=crop',
    is_active: true,
    bundle_plans: [
      { id: 'plan-cozy-1', bundle_id: 'dummy-cozy', card_count: 20, price: 99 },
    ],
  },
];

type Dare = ChallengePayload & {
  id: string | number;
  stars: number;
  isPaid: boolean;
};

// Helper to map card structure from Supabase
const mapCardToDare = (card: any): Dare => {
  const rawCategory = card.category_name || card.card_categories?.name || 'GENERAL';
  const cleanCategory = rawCategory.split('_')[0].toUpperCase();

  const difficulty = (card.attributes?.difficulty || 'MEDIUM').toUpperCase();
  const time = card.attributes?.time || '24 hrs';
  const stars = card.attributes?.stars || 2;
  const description = card.power_description || card.attributes?.description || 'No description available.';

  let image = sunsetPicnic;
  if (card.image_url) {
    image = { uri: card.image_url };
  } else {
    if (cleanCategory.includes('ROMANCE') || cleanCategory.includes('ROMANTIC')) {
      image = require('@/assets/images/couple_cover.jpeg');
    } else if (cleanCategory.includes('ADVENTURE') || cleanCategory.includes('ADVENTUROUS')) {
      image = { uri: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=400&h=400&fit=crop' };
    } else {
      image = { uri: 'https://images.unsplash.com/photo-1606503153255-59d8b8b82176?w=400&h=400&fit=crop' };
    }
  }

  return {
    id: card.deck_card_id || card.id,
    title: card.card_name || card.name,
    category: cleanCategory,
    difficulty,
    stars,
    time,
    image,
    description,
    isPaid: false
  };
};


const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ITEM_WIDTH = SCREEN_WIDTH * 0.72;
const SPACING = (SCREEN_WIDTH - ITEM_WIDTH) / 2;

const DareCarouselItem = ({ item, index, scrollX, isDark, onSelect }: any) => {
  const inputRange = [
    (index - 1) * ITEM_WIDTH,
    index * ITEM_WIDTH,
    (index + 1) * ITEM_WIDTH
  ];

  const style = useAnimatedStyle(() => {
    const scale = interpolate(scrollX.value, inputRange, [0.85, 1, 0.85], Extrapolation.CLAMP);
    const translateX = interpolate(scrollX.value, inputRange, [ITEM_WIDTH * 0.22, 0, -ITEM_WIDTH * 0.22], Extrapolation.CLAMP);
    const zIndex = interpolate(scrollX.value, [
      (index - 0.5) * ITEM_WIDTH,
      index * ITEM_WIDTH,
      (index + 0.5) * ITEM_WIDTH,
    ], [0, 100, 0], Extrapolation.CLAMP);

    return {
      transform: [{ translateX }, { scale }],
      zIndex: Math.round(zIndex)
    };
  });
  
  if (item.spacer) {
    return <View style={{ width: SPACING }} />;
  }

  const getCatColor = (cat) => {
    const c = (cat || '').toLowerCase();
    if(c.includes('romance')) return 'bg-[#ff1b6b]';
    if(c.includes('fun')) return 'bg-purple-500';
    if(c.includes('spicy')) return 'bg-[#af2c3b]';
    return 'bg-blue-500';
  };

  return (
    <Animated.View style={[{ width: ITEM_WIDTH, height: ITEM_WIDTH * 1.45, justifyContent: 'center', alignItems: 'center' }, style]}>
      <TouchableOpacity 
         activeOpacity={0.95} 
         onPress={() => onSelect(item)}
         className="w-full h-full rounded-[30px] overflow-hidden bg-slate-200 dark:bg-slate-800 shadow-xl"
         style={{ elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 15 }}
      >
        <Image source={typeof item.image === 'string' ? { uri: item.image } : item.image} style={{ width: '100%', height: '100%', position: 'absolute' }} resizeMode="cover" />
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '70%', backgroundColor: 'rgba(0,0,0,0.5)' }} />

        <View className="absolute top-5 left-5 right-5 flex-row justify-between items-start">
          <View className={`px-3.5 py-1.5 rounded-full ${getCatColor(item.category)}`}>
             <Text className="text-white text-[10px] font-black tracking-widest uppercase">{item.category}</Text>
          </View>
          <TouchableOpacity className="w-9 h-9 rounded-full bg-white/25 items-center justify-center">
             <Ionicons name="heart-outline" size={18} color="white" />
          </TouchableOpacity>
        </View>

        <View className="absolute bottom-6 left-5 right-5">
           <Text className="text-white text-[22px] font-black mb-1 tracking-tight leading-7">{item.title}</Text>
           <Text className="text-white/80 text-[13px] leading-5 mb-5" numberOfLines={2}>{item.description}</Text>
           
           <View className="flex-row items-center justify-between">
              <View className="flex-row items-center">
                 <Ionicons name="people" size={16} color="white" />
                 <Text className="text-white text-xs font-semibold ml-1.5">2+ People</Text>
              </View>
              <View className="w-11 h-11 rounded-full bg-[#ff1b6b] items-center justify-center">
                 <Ionicons name="arrow-forward" size={20} color="white" />
              </View>
           </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const DareCarousel = ({ data, isDark, onSelectDare }: any) => {
  const scrollX = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollX.value = event.contentOffset.x;
  });
  
  const paddedData = data && data.length > 0 ? [{ id: 'left-pad', spacer: true }, ...data, { id: 'right-pad', spacer: true }] : [];

  return (
    <View>
      <Animated.FlatList
        data={paddedData}
        keyExtractor={(item, index) => item.id || `spacer-${index}`}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={ITEM_WIDTH}
        decelerationRate="fast"
        bounces={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        renderItem={({ item, index }) => (
          <DareCarouselItem item={item} index={index} scrollX={scrollX} isDark={isDark} onSelect={onSelectDare} />
        )}
      />
      <View className="flex-row justify-center items-center mt-6 gap-2">
        <View className="w-6 h-2 rounded-full bg-[#ff1b6b]" />
        <View className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-700" />
        <View className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-700" />
        <View className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-700" />
      </View>
    </View>
  );
};


export default function Dares() {
  const { openSidebar } = useSidebar();
  const userAvatar = useUserAvatar();
  const router = useRouter();
  const [selectedDare, setSelectedDare] = useState<Dare | null>(null);
  const [isSending, setIsSending] = useState(false);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [room, setRoom] = useState<Room | null>(null);
  const [note, setNote] = useState<string>('');
  const [limits, setLimits] = useState<SendLimits | null>(null);

  useEffect(() => {
    if (selectedDare) {
      setNote('');
    }
  }, [selectedDare]);

  const [dares, setDares] = useState<Dare[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const getFallbackCards = () => [
    {
      id: "fallback-1",
      name: "Whisper Sweet Nothings",
      power_description: "Lean in close and whisper three things you love about your partner into their ear.",
      image_url: null,
      card_type: "ACTION",
      attributes: { difficulty: "easy", time: "5 mins", stars: 1 },
      card_categories: { id: "c1", name: "Romance_123" }
    },
    {
      id: "fallback-2",
      name: "Moonlight Walk",
      power_description: "Take a walk together under the moonlight and share a memory from when you first met.",
      image_url: null,
      card_type: "ACTION",
      attributes: { difficulty: "medium", time: "24 hrs", stars: 2 },
      card_categories: { id: "c1", name: "Romance_123" }
    },
    {
      id: "fallback-3",
      name: "Candlelight Dinner",
      power_description: "Set up a dining table with candlelight and share a home-cooked meal without any devices.",
      image_url: null,
      card_type: "ACTION",
      attributes: { difficulty: "hard", time: "1 hour", stars: 3 },
      card_categories: { id: "c1", name: "Romance_123" }
    },
    {
      id: "fallback-4",
      name: "Dance in the Rain",
      power_description: "Play your favorite slow song and slow dance together, in the rain if possible, or right in the living room.",
      image_url: null,
      card_type: "ACTION",
      attributes: { difficulty: "medium", time: "10 mins", stars: 2 },
      card_categories: { id: "c2", name: "Adventure_456" }
    },
    {
      id: "fallback-5",
      name: "Cook a New Recipe",
      power_description: "Choose a dish neither of you has ever cooked before and make it together as a team.",
      image_url: null,
      card_type: "ACTION",
      attributes: { difficulty: "medium", time: "45 mins", stars: 2 },
      card_categories: { id: "c2", name: "Adventure_456" }
    },
    {
      id: "fallback-6",
      name: "Road Trip Adventure",
      power_description: "Pick a random spot on the map within an hour's drive, go there, and find a hidden coffee shop.",
      image_url: null,
      card_type: "ACTION",
      attributes: { difficulty: "hard", time: "2 hours", stars: 3 },
      card_categories: { id: "c2", name: "Adventure_456" }
    },
    {
      id: "fallback-7",
      name: "Secret Handshake",
      power_description: "Spend 5 minutes creating a secret handshake that only the two of you know.",
      image_url: null,
      card_type: "ACTION",
      attributes: { difficulty: "easy", time: "5 mins", stars: 1 },
      card_categories: { id: "c3", name: "Fun_789" }
    },
    {
      id: "fallback-8",
      name: "Pillow Fort Night",
      power_description: "Build a massive fort out of blankets, pillows, and chairs, and watch your favorite movie inside it.",
      image_url: null,
      card_type: "ACTION",
      attributes: { difficulty: "medium", time: "1 hour", stars: 2 },
      card_categories: { id: "c3", name: "Fun_789" }
    }
  ];

  const CACHE_KEY = '@soulshuffle_dares_cache';

  const loadDares = async (silent = false, skipCache = false) => {
    try {
      if (!silent) setLoading(true);
      const appLoadStartTime = performance.now();

      // 1. FAST LOCAL LOAD (Instant UI)
      if (!skipCache) {
        try {
          const cachedData = await AsyncStorage.getItem(CACHE_KEY);
          if (cachedData) {
            const { cachedDares, cachedLimits, roomId } = JSON.parse(cachedData);
            if (cachedDares && cachedDares.length > 0) {
              setDares(cachedDares);
              if (cachedLimits) setLimits(cachedLimits);
              if (roomId) setRoom({ id: roomId, code: '', status: 'ACTIVE' } as any);
              if (!silent) setLoading(false);
            }
          }
        } catch (e) {
          console.log('Failed to load cache:', e);
        }
      }

      // 2. BACKGROUND FETCH (Update data)
      const activeRoom = await getActiveRoom();
      setRoom(activeRoom);
      
      if (activeRoom && activeRoom.status === 'ACTIVE') {
        const apiCallStartTime = performance.now();
        const [fetched, fetchedLimits] = await Promise.all([
          fetchAvailableDeck(activeRoom.id),
          fetchSendLimits(activeRoom.id)
        ]);
        const apiCallEndTime = performance.now();
        console.log(`[Performance] Dares API Call Time: ${(apiCallEndTime - apiCallStartTime).toFixed(2)} ms`);
        
        const mapped = fetched.map(mapCardToDare);
        setDares(mapped);
        setLimits(fetchedLimits);

        // Save to cache
        AsyncStorage.setItem(CACHE_KEY, JSON.stringify({
          cachedDares: mapped,
          cachedLimits: fetchedLimits,
          roomId: activeRoom.id
        })).catch(() => {});
      } else {
        setDares([]);
        setLimits(null);
        AsyncStorage.removeItem(CACHE_KEY).catch(() => {});
      }
      
      const appLoadEndTime = performance.now();
      console.log(`[Performance] Total Dares Load Time: ${(appLoadEndTime - appLoadStartTime).toFixed(2)} ms`);
    } catch (error: any) {
      console.log('Failed to fetch dares from backend:', error?.message);
      // Fallback: If we already loaded cached data on screen, keep it. 
      // Do not overwrite real cached data with fake hardcoded cards!
      setDares((prevDares) => {
        if (prevDares && prevDares.length > 0) return prevDares;
        return []; // If completely empty, just show empty, not fake cards.
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadDares();
    }, [])
  );

  useEffect(() => {
    const setupSocket = async () => {
      if (room && room.status === 'WAITING') {
        await GameSocket.initialize();
        GameSocket.joinRoom(room.code);
      }
    };
    setupSocket();
  }, [room?.code, room?.status]);

  useEffect(() => {
    const handlePartnerJoined = (payload: any) => {
      console.log('Partner joined event received in Dares, refreshing...', payload);
      loadDares(true);
    };

    const handleRoomLeft = () => {
      console.log('Room left event received in Dares, clearing state...');
      setRoom(null);
      setDares([]);
      setLimits(null);
      AsyncStorage.removeItem(CACHE_KEY).catch(() => {});
    };

    const handleGameEvent = (payload: any) => {
      if (payload.eventType === 'CARD_REJECTED') {
        console.log('Partner rejected a card, refreshing deck in 1.5s to ensure DB sync...');
        setTimeout(() => loadDares(true, true), 1500);
      }
    };

    const clearSub = DeviceEventEmitter.addListener('app:clearRoom', handleRoomLeft);

    GameSocket.on('partner_joined', handlePartnerJoined);
    GameSocket.on('partner_left', handleRoomLeft);
    GameSocket.on('room_left', handleRoomLeft);
    GameSocket.on('game_event', handleGameEvent);

    return () => {
      clearSub.remove();
      GameSocket.off('partner_joined', handlePartnerJoined);
      GameSocket.off('partner_left', handleRoomLeft);
      GameSocket.off('room_left', handleRoomLeft);
      GameSocket.off('game_event', handleGameEvent);
    };
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadDares(true);
  };

  const renderDisconnectedState = () => {
    return (
      <View className="flex-1 justify-center items-center px-8 py-16">
        <View className="bg-white dark:bg-[#271318] rounded-2xl p-8 items-center shadow-rose-100/50 border border-rose-100/50 dark:border-rose-950/20 w-full max-w-sm">
          <View className="w-20 h-20 bg-rose-50 dark:bg-rose-950/30 rounded-full items-center justify-center mb-6">
            <Ionicons name="heart-dislike-outline" size={42} color={isDark ? "#D36B93" : "#481639"} />
          </View>
          
          <Text className="text-2xl font-black text-slate-800 dark:text-white text-center mb-3 tracking-tight">
            Connection Required
          </Text>
          
          <Text className="text-slate-500 dark:text-slate-400 font-medium text-[14px] text-center leading-6 mb-8">
            Please connect to your partner first to play and share dares. Join a room or invite your partner to get started!
          </Text>

          <TouchableOpacity
            className="w-full bg-[#af2c3b] dark:bg-rose-600 rounded-full py-4 items-center justify-center shadow-rose-900/10"
            activeOpacity={0.85}
            onPress={() => router.push('/')}
          >
            <View className="flex-row items-center justify-center">
              <Ionicons name="link" size={18} color="white" />
              <Text className="text-white font-bold text-[15px] ml-2">Connect Now</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const [realStoreBundles, setRealStoreBundles] = useState<CardBundle[]>([]);

  useEffect(() => {
    const loadRealStoreBundles = async () => {
      try {
        const fetched = await fetchStoreBundles();
        if (fetched && fetched.length > 0) {
          setRealStoreBundles(fetched);
        } else {
          setRealStoreBundles(FALLBACK_STORE_BUNDLES);
        }
      } catch (e) {
        setRealStoreBundles(FALLBACK_STORE_BUNDLES);
      }
    };
    loadRealStoreBundles();
  }, []);

  const handleOpenStoreItem = (bundleId?: string) => {
    if (bundleId) {
      router.push({
        pathname: '/store',
        params: { buyBundleId: bundleId }
      });
    } else {
      router.push('/store');
    }
  };

  const handleSendChallenge = async () => {
    if (!selectedDare) return;

    const activeRoom = room || await getActiveRoom();
    if (!activeRoom) {
      Alert.alert('No Room Found', 'Create or join a room before sending a challenge.');
      return;
    }
    if (activeRoom.status !== 'ACTIVE') {
      Alert.alert('Partner Not Connected', 'Your partner needs to join the room before you can send a challenge.');
      return;
    }

    // 1. OPTIMISTIC UI UPDATE (Instantaneous Feedback)
    const targetDare = selectedDare;
    const currentNote = note;
    const backupDares = [...dares];
    
    // Hide modal and show success instantly (0ms latency perceived)
    setSelectedDare(null);
    setIsSending(false);
    Alert.alert('Challenge Sent', `${targetDare.title} was sent to your partner!`);

    // Remove card from UI state instantly
    setDares(prevDares => {
      const updatedDares = prevDares.filter(d => d.id !== targetDare.id);
      AsyncStorage.getItem(CACHE_KEY).then(cached => {
        if (cached) {
          const parsed = JSON.parse(cached);
          parsed.cachedDares = updatedDares;
          AsyncStorage.setItem(CACHE_KEY, JSON.stringify(parsed));
        }
      }).catch(() => {});
      return updatedDares;
    });

    const backupLimits = limits ? { ...limits } : null;
    let newOptimisticLimits = limits ? { ...limits } : null;
    if (limits) {
      newOptimisticLimits = {
        ...limits,
        daily_sent: limits.daily_sent + 1,
        daily_remaining: Math.max(0, limits.daily_remaining - 1),
        active_count: limits.active_count + 1,
        active_remaining: Math.max(0, limits.active_remaining - 1),
      };
      newOptimisticLimits.can_send = newOptimisticLimits.daily_remaining > 0 && newOptimisticLimits.active_remaining > 0;
      setLimits(newOptimisticLimits);
      
      // Update cache immediately to prevent stale UI on navigation
      AsyncStorage.getItem(CACHE_KEY).then(cached => {
        if (cached) {
          const parsed = JSON.parse(cached);
          parsed.cachedLimits = newOptimisticLimits;
          AsyncStorage.setItem(CACHE_KEY, JSON.stringify(parsed));
        }
      }).catch(() => {});
    }

    // 2. BACKGROUND API CALL (Non-blocking execution)
    sendChallenge(targetDare.id.toString(), currentNote, activeRoom)
      .then(async () => {
        // Emit real-time event to partner
        GameSocket.sendGameEvent(activeRoom.code, 'CHALLENGE_SENT', { 
          challenge: { ...targetDare, message: currentNote }
        });
        try {
          const freshLimits = await fetchSendLimits(activeRoom.id);
          setLimits(freshLimits);
          AsyncStorage.getItem(CACHE_KEY).then(cached => {
            if (cached) {
              const parsed = JSON.parse(cached);
              parsed.cachedLimits = freshLimits;
              AsyncStorage.setItem(CACHE_KEY, JSON.stringify(parsed));
            }
          }).catch(() => {});
        } catch (e) {}
      })
      .catch((error: any) => {
        // Revert optimistic update on failure
        setDares(backupDares);
        if (backupLimits) {
          setLimits(backupLimits);
          AsyncStorage.getItem(CACHE_KEY).then(cached => {
            if (cached) {
              const parsed = JSON.parse(cached);
              parsed.cachedLimits = backupLimits;
              AsyncStorage.setItem(CACHE_KEY, JSON.stringify(parsed));
            }
          }).catch(() => {});
        }
        if (error.response?.status === 401) {
          Alert.alert('Session Expired', 'Please sign in again before sending a challenge.', [
            { text: 'OK', onPress: () => router.replace('/') },
          ]);
        } else {
          Alert.alert(
            'Could Not Send',
            error.response?.data?.message || error.message || 'Something went wrong while sending the challenge.'
          );
        }
      });
  };

  return (
    <SafeAreaView className="flex-1 bg-[#fff8f7] dark:bg-[#0F0608]" edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={isDark ? "#0F0608" : "#fff8f7"} />
      
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 pt-5 pb-3 bg-[#fff8f7] dark:bg-[#0F0608] z-10">
        <TouchableOpacity onPress={openSidebar}>
          <Ionicons name="menu-outline" size={30} color={isDark ? "#fff" : "#9f1239"} />
        </TouchableOpacity>
        <View className="flex-row items-center gap-1.5">
          <Ionicons name="infinite" size={28} color={isDark ? "#fda4af" : "#be123c"} style={{ transform: [{ rotate: '-15deg' }] }} />
          <Text className="text-[#a12338] dark:text-rose-400 font-black text-xl tracking-tight">SoulShuffle</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/profile')}>
          <Image 
            source={{ uri: userAvatar }} 
            className="w-8 h-8 rounded-full border border-rose-200 dark:border-rose-950/30"
          />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center bg-[#fff8f7] dark:bg-[#0F0608]">
          <ActivityIndicator size="large" color="#f43f5e" />
          <Text className="text-[#a12338] dark:text-rose-400 font-semibold text-sm mt-3">Loading dares...</Text>
        </View>
      ) : room && room.status === 'ACTIVE' ? (

        <ScrollView 
          showsVerticalScrollIndicator={false} 
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#e11d48']} tintColor={isDark ? '#fff' : '#e11d48'} />
          }
          contentContainerStyle={{ paddingBottom: 100 }}
        >
          {/* Header Title */}
          <View className="px-6 pt-2 pb-4">
            <Text className="text-4xl font-black text-slate-900 dark:text-white mb-1 tracking-tight">Dares</Text>
            <Text className="text-slate-500 dark:text-slate-400 text-[15px] font-medium">Step out, connect, and make memories 💖</Text>
          </View>

          {/* Carousel */}
          <View className="mt-2 mb-6">
            <DareCarousel data={dares} isDark={isDark} onSelectDare={setSelectedDare} />
          </View>

          {/* Explore Categories */}
          <View className="px-6 mt-4">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-xl font-bold text-slate-900 dark:text-white">Explore Categories</Text>
              <TouchableOpacity>
                <Text className="text-[#ff1b6b] font-bold text-sm">See all</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -24 }} contentContainerStyle={{ paddingHorizontal: 24 }}>
              {[
                { id: 'romance', label: 'Romance', image: require('@/assets/images/bundle_romantic.jpg'), color: 'text-[#ff1b6b]' },
                { id: 'fun', label: 'Fun', image: require('@/assets/images/bundle_cozy.jpg'), color: 'text-purple-500' },
                { id: 'deep', label: 'Deep', image: require('@/assets/images/sunset_picnic.jpeg'), color: 'text-blue-600 dark:text-blue-400' },
                { id: 'spicy', label: 'Spicy', image: require('@/assets/images/bundle_spicy.jpg'), color: 'text-[#ff1b6b]' }
              ].map((cat: any) => (
                <TouchableOpacity key={cat.id} activeOpacity={0.9} className="w-[100px] h-[120px] bg-white dark:bg-[#1C1215] rounded-3xl overflow-hidden mr-3 items-center shadow-sm border border-slate-50 dark:border-rose-950/20">
                  <View className="w-full h-[65%]">
                    <Image source={cat.image} className="w-full h-full" resizeMode="cover" />
                  </View>
                  <View className="flex-1 justify-center items-center w-full">
                    <Text className={`text-[11px] font-bold ${cat.color}`}>{cat.label}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </ScrollView>

      ) : (
        <ScrollView 
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#e11d48']} tintColor={isDark ? '#fff' : '#e11d48'} />
          }
        >
          {renderDisconnectedState()}
        </ScrollView>
      )}

      <Modal
        visible={!!selectedDare}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedDare(null)}
      >
        <View className="flex-1 justify-end bg-black/40 dark:bg-black/60">
          <TouchableOpacity className="flex-1" activeOpacity={1} onPress={() => setSelectedDare(null)} />
          {selectedDare && (
            <View className="bg-[#fff8f7] dark:bg-[#180D10] rounded-t-[34px] overflow-hidden">
              <View className="w-full h-72 bg-slate-100 dark:bg-[#0f0608] pt-4">
                <Image 
                  source={typeof selectedDare.image === 'string' ? { uri: selectedDare.image } : selectedDare.image} 
                  className="w-full h-full" 
                  resizeMode="contain"
                />
              </View>
              <View className="p-6">
                <View className="flex-row items-center justify-end mb-3">
                  <TouchableOpacity
                    className="w-10 h-10 rounded-full bg-white dark:bg-[#271318] items-center justify-center"
                    onPress={() => setSelectedDare(null)}
                  >
                    <Ionicons name="close" size={20} color={isDark ? "#fff" : "#334155"} />
                  </TouchableOpacity>
                </View>

                <Text className="text-[11px] font-bold text-[#481639] dark:text-[#D36B93] tracking-widest uppercase mb-2">{selectedDare.category}</Text>
                <Text className="text-3xl font-black text-slate-900 dark:text-white tracking-tight mb-3">{selectedDare.title}</Text>
                <Text className="text-slate-600 dark:text-slate-300 font-medium text-[14px] leading-6 mb-5">{selectedDare.description}</Text>

                <View className="flex-row items-center mb-6">
                  <View className="bg-white dark:bg-[#271318] px-4 py-3 rounded-2xl flex-row items-center mr-3">
                    <Ionicons name="time" size={15} color={isDark ? "#f43f5e" : "#64748b"} />
                    <Text className="text-slate-600 dark:text-white font-bold text-[12px] ml-2">{selectedDare.time}</Text>
                  </View>
                  <View className="bg-white dark:bg-[#271318] px-4 py-3 rounded-2xl flex-row items-center">
                    <Ionicons name={selectedDare.isPaid ? 'lock-closed' : 'heart'} size={15} color={selectedDare.isPaid ? (isDark ? '#f43f5e' : '#ab2f33') : (isDark ? '#2dd4bf' : '#0d6e67')} />
                    <Text className="text-slate-600 dark:text-white font-bold text-[12px] ml-2">{selectedDare.isPaid ? 'Premium' : 'Free'}</Text>
                  </View>
                </View>

                {limits && (
                  <View className="flex-row items-center justify-between bg-white dark:bg-[#271318] px-6 py-4 rounded-[20px] border border-slate-100/50 dark:border-rose-950/20 mb-6">
                    <View className="flex-row items-center">
                      <Ionicons name="calendar-outline" size={18} color={isDark ? "#fda4af" : "#af2c3b"} />
                      <Text className="text-slate-600 dark:text-slate-300 text-xs font-extrabold ml-2">
                        Sends Today: {limits.daily_sent}/{limits.daily_limit}
                      </Text>
                    </View>
                    <View className="h-6 w-[1px] bg-slate-100 dark:bg-rose-950/25" />
                    <View className="flex-row items-center">
                      <Ionicons name="flame-outline" size={18} color={isDark ? "#2dd4bf" : "#0d6e67"} />
                      <Text className="text-slate-600 dark:text-slate-300 text-xs font-extrabold ml-2">
                        Active Dares: {limits.active_count}/{limits.active_limit}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Add note text input */}
                <View className="mb-6">
                  <Text className="text-[11px] font-bold text-slate-400 dark:text-rose-400/60 tracking-wider uppercase mb-2">Add a personal note (optional)</Text>
                  <View className="bg-white dark:bg-[#271318] rounded-2xl border border-slate-100 dark:border-rose-950/20 px-4 py-2">
                    <TextInput
                      placeholder="Type something sweet or playful..."
                      placeholderTextColor={isDark ? "rgba(255, 255, 255, 0.3)" : "#94a3b8"}
                      className="text-slate-800 dark:text-white text-[14px] font-medium min-h-[50px] max-h-[100px]"
                      multiline
                      numberOfLines={3}
                      value={note}
                      onChangeText={setNote}
                      style={{ textAlignVertical: 'top' }}
                    />
                  </View>
                </View>

                {limits && !limits.can_send && (
                  <View className="flex-row items-start bg-rose-50/50 dark:bg-rose-950/10 border border-rose-100 dark:border-rose-950/30 p-4 rounded-2xl mb-6">
                    <Ionicons name="warning" size={18} color={isDark ? "#f43f5e" : "#b91c1c"} style={{ marginTop: 1 }} />
                    <Text className="text-rose-700 dark:text-rose-400 text-xs font-semibold ml-2.5 flex-1 leading-5">
                      {limits.daily_remaining === 0 
                        ? "Daily limit reached. You can only send 2 challenges per day (resets at midnight UTC)." 
                        : "Active limit reached. You can only have 2 active challenges at the same time."}
                    </Text>
                  </View>
                )}

                <TouchableOpacity
                  className={`rounded-full py-[18px] items-center justify-center flex-row ${
                    isSending || (limits !== null && !limits.can_send)
                      ? 'bg-slate-100 dark:bg-rose-950/15 border border-slate-200/45 dark:border-rose-950/20'
                      : 'bg-[#af2c3b] dark:bg-rose-600'
                  }`}
                  activeOpacity={0.85}
                  onPress={handleSendChallenge}
                  disabled={isSending || (limits !== null && !limits.can_send)}
                >
                  {isSending ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Ionicons 
                        name="send" 
                        size={18} 
                        color={limits && !limits.can_send ? (isDark ? '#64748b' : '#94a3b8') : 'white'} 
                      />
                      <Text className={`font-bold text-[15px] ml-2 ${
                        limits && !limits.can_send 
                          ? 'text-slate-400 dark:text-slate-500' 
                          : 'text-white'
                      }`}>
                        {limits && !limits.can_send ? 'Send Limit Reached' : 'Send to Partner'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

