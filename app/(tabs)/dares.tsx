import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, Platform, StatusBar, TextInput, Modal, ActivityIndicator, Alert, RefreshControl, DeviceEventEmitter } from 'react-native';
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
    } catch (error) {
      console.log('Failed to fetch dares from backend, loading fallback cards:', error);
      const fallbacks = getFallbackCards().map(mapCardToDare);
      setDares(fallbacks);
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
        <View className="bg-white dark:bg-[#271318] rounded-[32px] p-8 items-center shadow-rose-100/50 border border-rose-100/50 dark:border-rose-950/20 w-full max-w-sm">
          <View className="w-20 h-20 bg-rose-50 dark:bg-rose-950/30 rounded-full items-center justify-center mb-6">
            <Ionicons name="heart-dislike-outline" size={42} color={isDark ? "#f43f5e" : "#e11d48"} />
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

    // 2. BACKGROUND API CALL (Non-blocking execution)
    sendChallenge(targetDare.id.toString(), currentNote, activeRoom)
      .then(() => {
        // Emit real-time event to partner
        GameSocket.sendGameEvent(activeRoom.code, 'CHALLENGE_SENT', { 
          challenge: { ...targetDare, message: currentNote }
        });
      })
      .catch((error: any) => {
        // Revert optimistic update on failure
        setDares(backupDares);
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
          contentContainerStyle={{ paddingBottom: 160 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#e11d48']} tintColor={isDark ? '#fff' : '#e11d48'} />
          }
        >
          {/* Search Bar */}
          <View className="px-6 mt-2 mb-6">
            <View className="bg-white dark:bg-[#271318] rounded-2xl h-14 flex-row items-center px-4 shadow-slate-100 border border-slate-50 dark:border-rose-950/20">
              <Ionicons name="search" size={20} color={isDark ? "#fff" : "#000"} />
              <TextInput 
                placeholder="Search for a dare..."
                placeholderTextColor={isDark ? "rgba(255, 255, 255, 0.3)" : "#9ca3af"}
                className="flex-1 ml-3 text-slate-800 dark:text-white text-[15px] font-medium"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
          </View>

          {/* Filter Pills */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-6 mb-8" contentContainerStyle={{ paddingRight: 40, alignItems: 'center' }}>
            {['ALL', ...Array.from(new Set(dares.map(d => d.category)))].map(cat => (
              <TouchableOpacity 
                key={cat}
                className={`px-6 py-4 rounded-full mr-2 border ${
                  selectedCategory === cat 
                    ? 'bg-rose-500 border-rose-500' 
                    : 'bg-white dark:bg-[#271318] border-slate-50 dark:border-rose-950/20'
                }`}
                onPress={() => setSelectedCategory(cat)}
              >
                <Text className={`font-bold text-sm tracking-wide ${selectedCategory === cat ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                  {cat === 'ALL' ? 'All Dares' : cat.charAt(0) + cat.slice(1).toLowerCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* SoulStore Showcase Section */}
          <View className="mb-10 px-6">
            {/* Header with Title and Visit Store Pill */}
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-row items-center">
                <View className="bg-rose-100 dark:bg-rose-900/30 w-8 h-8 rounded-full items-center justify-center mr-2.5">
                  <Ionicons name="cart" size={16} color={isDark ? "#f43f5e" : "#e11d48"} />
                </View>
                <Text className="text-xl font-black text-slate-900 dark:text-rose-100 tracking-tight">
                  SoulStore
                </Text>
              </View>
              <TouchableOpacity 
                activeOpacity={0.8}
                onPress={() => router.push('/store')}
                className="flex-row items-center bg-rose-500 dark:bg-rose-600 px-3.5 py-1.5 rounded-full shadow-sm"
              >
                <Text className="text-[11px] font-extrabold text-white uppercase tracking-wider mr-1">
                  Visit Store
                </Text>
                <Ionicons name="arrow-forward" size={12} color="white" />
              </TouchableOpacity>
            </View>

            {/* Store Hero Banner */}
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => router.push('/store')}
              style={{ backgroundColor: isDark ? '#34121a' : '#e11d48' }}
              className="rounded-[28px] p-5 mb-5 overflow-hidden relative shadow-lg border border-rose-400/30 dark:border-rose-900/40"
            >
              <View className="flex-row items-center justify-between z-10">
                <View className="flex-1 pr-3">
                  <View className="bg-white/20 dark:bg-rose-500/30 self-start px-2.5 py-1 rounded-full mb-2 flex-row items-center">
                    <Ionicons name="sparkles" size={11} color="white" />
                    <Text className="text-white font-extrabold text-[10px] uppercase tracking-widest ml-1">
                      Exclusive Passes & Decks
                    </Text>
                  </View>
                  <Text className="text-white font-black text-lg tracking-tight leading-6 mb-1">
                    Unlock Premium Decks 🛍️
                  </Text>
                  <Text className="text-white/90 dark:text-rose-200/90 text-xs font-medium leading-4">
                    Tap to explore spicy decks and intimate packs in our store.
                  </Text>
                </View>
                
                <View className="bg-white/20 dark:bg-rose-500/30 p-3.5 rounded-2xl items-center justify-center">
                  <Ionicons name="bag-handle" size={26} color="white" />
                </View>
              </View>
            </TouchableOpacity>

            {/* Store Highlights Horizontal Carousel */}
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false} 
              className="-mx-6 px-6" 
              contentContainerStyle={{ paddingRight: 48, gap: 14 }}
            >
              {realStoreBundles.map((bundle) => {
                const plans = bundle.bundle_plans || bundle.plans || [];
                const minPrice = plans.length > 0 ? Math.min(...plans.map(p => p.price)) : null;
                const priceText = minPrice ? `₹${minPrice}` : 'Store Deck';
                
                const cardCount = plans.length > 0 && plans[0].card_count ? `${plans[0].card_count} Dares` : 'Premium Deck';
                const imageSource = getBundleImage(bundle.name, bundle.image_url);

                return (
                  <TouchableOpacity
                    key={bundle.id}
                    activeOpacity={0.88}
                    className="w-[260px] h-52 bg-white dark:bg-[#271318] rounded-[28px] overflow-hidden relative shadow-md border border-slate-100 dark:border-rose-950/30"
                    onPress={() => handleOpenStoreItem(bundle.id)}
                  >
                    <Image 
                      source={typeof imageSource === 'string' ? { uri: imageSource } : imageSource} 
                      className="w-full h-full absolute inset-0" 
                      resizeMode="cover" 
                    />
                    <View className="absolute inset-0 bg-black/45" />
                    
                    {/* Top Badge */}
                    <View className="absolute top-3 left-3 flex-row items-center gap-1.5">
                      <View className="bg-rose-500/90 backdrop-blur-sm px-2.5 py-1 rounded-full flex-row items-center shadow-sm">
                        <Ionicons name="albums" size={11} color="white" />
                        <Text className="text-white font-black text-[9px] uppercase tracking-wider ml-1">
                          {cardCount}
                        </Text>
                      </View>
                    </View>

                    <View className="absolute top-3 right-3 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/20">
                      <Text className="text-white font-extrabold text-[10px]">{priceText}</Text>
                    </View>

                    {/* Card Bottom Info */}
                    <View className="absolute bottom-0 left-0 right-0 p-4 justify-end bg-black/40">
                      <Text className="text-white text-base font-black tracking-tight mb-0.5" numberOfLines={1}>
                        {bundle.name}
                      </Text>
                      <Text className="text-white/80 text-[11px] font-medium leading-4 mb-2.5" numberOfLines={1}>
                        {bundle.description || 'Unlock exclusive dares in store'}
                      </Text>

                      <View className="bg-rose-500 px-3 py-1.5 rounded-full flex-row items-center justify-between">
                        <Text className="text-white font-bold text-[11px]">Unlock in Store</Text>
                        <Ionicons name="bag-check" size={13} color="white" />
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Single Dares Grid */}
          <View className="px-6 flex-row flex-wrap justify-between gap-y-4">
            <Text className="w-full text-lg font-extrabold text-slate-900 dark:text-white tracking-tight mb-1">Single Actions</Text>
            
            {dares.length === 0 ? (
              <View className="w-full py-10 items-center justify-center">
                <Ionicons name="albums-outline" size={48} color="#cbd5e1" />
                <Text className="text-slate-400 font-semibold text-sm mt-3">No dares found in database</Text>
              </View>
            ) : (
              dares.filter(dare => {
                const matchesCategory = selectedCategory === 'ALL' || dare.category.toUpperCase() === selectedCategory.toUpperCase();
                const matchesSearch = dare.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                      (dare.description && dare.description.toLowerCase().includes(searchQuery.toLowerCase()));
                return matchesCategory && matchesSearch;
              }).map((dare) => (
                <TouchableOpacity
                  key={dare.id}
                  className="w-[48%] bg-white dark:bg-[#271318] rounded-[24px] overflow-hidden border border-slate-50 dark:border-rose-950/20 pb-4"
                  activeOpacity={0.85}
                  onPress={() => setSelectedDare(dare)}
                >
                  <View className="w-full h-40 relative">
                    <Image source={typeof dare.image === 'string' ? { uri: dare.image } : dare.image} className="w-full h-full" />
                    
                    {dare.isPaid && (
                      <View className="absolute top-3 right-3 bg-white/95 dark:bg-[#0F0608]/95 w-6 h-6 rounded-full flex-row items-center justify-center">
                        <Ionicons name="lock-closed" size={10} color={isDark ? "#f43f5e" : "#ab2f33"} />
                      </View>
                    )}
                  </View>

                  <View className="px-4 pt-4">
                    <Text className="text-[9px] font-bold text-slate-500 dark:text-rose-400 tracking-wider uppercase mb-1">{dare.category}</Text>
                    <Text className="text-[17px] font-bold text-slate-800 dark:text-white tracking-tight leading-5 mb-3">{dare.title}</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
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

                <Text className="text-[11px] font-bold text-rose-500 dark:text-rose-400 tracking-widest uppercase mb-2">{selectedDare.category}</Text>
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
                        ? "Daily limit reached. You can only send 3 challenges per day (resets at midnight UTC)." 
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

