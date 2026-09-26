import Animated, { useSharedValue, useAnimatedScrollHandler, useAnimatedStyle, interpolate, Extrapolation, interpolateColor } from 'react-native-reanimated';
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






const { width: WINDOW_WIDTH } = Dimensions.get('window');
const SCREEN_WIDTH = Math.min(WINDOW_WIDTH, 450); // Cap width for web
const ITEM_WIDTH = SCREEN_WIDTH * 0.78;
const ITEM_HEIGHT = ITEM_WIDTH * 1.45;

const getCatColor = (cat: string) => {
  const c = (cat || '').toLowerCase();
  if(c.includes('romance')) return '#FF296D';
  if(c.includes('fun')) return '#9D4EDD';
  if(c.includes('spicy')) return '#D90429';
  return '#3A86FF';
};

const CarouselItemUI = ({ item, isDark, onSelectDare }: any) => {
  const categoryColor = getCatColor(item.category);
  return (
    <TouchableOpacity
      activeOpacity={0.95}
      onPress={() => onSelectDare(item)}
      className="w-full h-full rounded-[28px] overflow-hidden shadow-2xl"
      style={{ 
        backgroundColor: isDark ? '#1C1721' : '#FFFFFF',
        borderWidth: 1,
        borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
        shadowColor: isDark ? '#000' : '#FF296D', 
        shadowOffset: { width: 0, height: 10 }, 
        shadowOpacity: isDark ? 0.6 : 0.1, 
        shadowRadius: 20 
      }}
    >
      <Image source={typeof item.image === 'string' ? { uri: item.image } : item.image} style={{ width: '100%', height: '100%', position: 'absolute' }} resizeMode="cover" />
      
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '70%', backgroundColor: 'rgba(0,0,0,0.5)' }} />

      <View className="absolute top-5 left-5 right-5 flex-row justify-between items-start">
        {item.category ? (
          <View className="px-3 py-1.5 rounded-full" style={{ backgroundColor: categoryColor }}>
             <Text className="text-white text-[11px] font-black tracking-widest uppercase">{item.category}</Text>
          </View>
        ) : <View />}
        <TouchableOpacity className="w-10 h-10 rounded-full items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.25)' }}>
           <Ionicons name="heart-outline" size={20} color="white" />
        </TouchableOpacity>
      </View>

      <View className="absolute bottom-6 left-5 right-5">
         <Text className="text-white text-[26px] font-black mb-1 tracking-tight leading-8">{item.title}</Text>
         <Text className="text-white/90 text-[14px] leading-5 mb-5" numberOfLines={2}>{item.description}</Text>
         
         <View className="flex-row justify-between items-center mt-1">
           <View className="flex-row items-center">
             <Ionicons name="people" size={16} color="white" />
             <Text className="text-white font-semibold text-[13px] ml-1.5">2+ People</Text>
           </View>
           <TouchableOpacity onPress={() => onSelectDare(item)} className="w-12 h-12 rounded-full items-center justify-center bg-[#FF296D] shadow-lg">
             <Ionicons name="arrow-forward" size={22} color="white" />
           </TouchableOpacity>
         </View>
      </View>
    </TouchableOpacity>
  );
};

const DareCarousel = ({ data, isDark, onSelectDare }: any) => {
  const [currentIndex, setCurrentIndex] = React.useState(0);
  
  const { Animated, PanResponder } = require('react-native');
  const position = React.useRef(new Animated.ValueXY()).current;

  // Reset index when data changes (e.g., category filter)
  React.useEffect(() => {
    setCurrentIndex(0);
    position.setValue({ x: 0, y: 0 });
  }, [data?.length, data?.[0]?.id]);

  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (evt: any, gestureState: any) => {
        position.setValue({ x: gestureState.dx, y: gestureState.dy });
      },
      onPanResponderRelease: (evt: any, gestureState: any) => {
        if (gestureState.dx > 100) {
          // SWIPE RIGHT -> MOVE BACK TO PREVIOUS CARD
          Animated.timing(position, {
            toValue: { x: SCREEN_WIDTH + 100, y: gestureState.dy },
            duration: 200,
            useNativeDriver: false
          }).start(() => {
            setCurrentIndex(prev => (prev > 0 ? prev - 1 : (data ? data.length - 1 : 0)));
            position.setValue({ x: 0, y: 0 });
          });
        } else if (gestureState.dx < -100) {
          // SWIPE LEFT -> MOVE FORWARD TO NEXT CARD
          Animated.timing(position, {
            toValue: { x: -SCREEN_WIDTH - 100, y: gestureState.dy },
            duration: 200,
            useNativeDriver: false
          }).start(() => {
            setCurrentIndex(prev => (data && prev < data.length - 1 ? prev + 1 : 0));
            position.setValue({ x: 0, y: 0 });
          });
        } else {
          // Return to center
          Animated.spring(position, {
            toValue: { x: 0, y: 0 },
            friction: 5,
            useNativeDriver: false
          }).start();
        }
      }
    })
  ).current;

  if (!data || data.length === 0) return null;

  const renderCards = () => {
    const cardsToRender = [];
    const count = Math.min(data.length, 3);
    for (let offset = 0; offset < count; offset++) {
      const idx = (currentIndex + offset) % data.length;
      cardsToRender.push({ item: data[idx], offset, originalIndex: idx });
    }

    return cardsToRender.map(({ item, offset, originalIndex }) => {
      const isFront = offset === 0;
      const isSecond = offset === 1;
      const isThird = offset === 2;

      let animatedStyle: any = {};
      let panHandlers = {};

      if (isFront) {
        const rotate = position.x.interpolate({
          inputRange: [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
          outputRange: ['-8deg', '0deg', '8deg'],
          extrapolate: 'clamp'
        });
        animatedStyle = {
          transform: [
            ...position.getTranslateTransform(),
            { rotate }
          ],
          zIndex: 3,
          elevation: 3
        };
        panHandlers = panResponder.panHandlers;
      } else if (isSecond) {
        const scale = position.x.interpolate({
          inputRange: [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
          outputRange: [1, 0.94, 1],
          extrapolate: 'clamp'
        });
        const rotate = position.x.interpolate({
          inputRange: [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
          outputRange: ['0deg', '-6deg', '0deg'],
          extrapolate: 'clamp'
        });
        const translateX = position.x.interpolate({
          inputRange: [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
          outputRange: [0, -25, 0],
          extrapolate: 'clamp'
        });
        const translateY = position.x.interpolate({
          inputRange: [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
          outputRange: [0, -10, 0],
          extrapolate: 'clamp'
        });
        animatedStyle = {
          transform: [{ translateX }, { translateY }, { scale }, { rotate }],
          zIndex: 2,
          elevation: 2
        };
      } else if (isThird) {
        animatedStyle = {
          transform: [{ translateX: 25 }, { translateY: -5 }, { scale: 0.88 }, { rotate: '6deg' }],
          zIndex: 1,
          elevation: 1
        };
      }

      return (
        <Animated.View
          key={`${item.id}-${originalIndex}-${offset}`}
          style={[
            { position: 'absolute', width: ITEM_WIDTH, height: ITEM_HEIGHT },
            animatedStyle
          ]}
          {...panHandlers}
        >
          <CarouselItemUI item={item} isDark={isDark} onSelectDare={onSelectDare} />
        </Animated.View>
      );
    }).reverse();
  };

  const renderPagination = () => {
    const totalDots = Math.min(data.length, 5);
    if (totalDots <= 1) return null;

    return (
      <View className="flex-row justify-center items-center mt-6 h-4">
        {Array.from({ length: totalDots }).map((_, i) => {
          const activeIndex = currentIndex % totalDots;
          const isActive = activeIndex === i;
          return (
            <TouchableOpacity 
              key={i} 
              activeOpacity={0.7}
              onPress={() => {
                setCurrentIndex(i);
                position.setValue({ x: 0, y: 0 });
              }}
              style={{ 
                height: 8, 
                width: isActive ? 24 : 8, 
                borderRadius: 4, 
                backgroundColor: isActive ? '#FF296D' : (isDark ? '#3D3442' : '#D9D9D9'),
                marginHorizontal: 4,
                opacity: isActive ? 1 : 0.6
              }} 
            />
          );
        })}
      </View>
    );
  };

  return (
    <View style={{ width: '100%', alignItems: 'center' }}>
      <View style={{ width: ITEM_WIDTH, height: ITEM_HEIGHT, justifyContent: 'center', alignItems: 'center' }}>
        {renderCards()}
      </View>
      {renderPagination()}
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
      name: "Candlelight Dinner",
      power_description: "Set up a romantic candlelit dinner at home and talk about your future dreams.",
      image_url: null,
      card_type: "ACTION",
      attributes: { difficulty: "medium", time: "2 hours", stars: 2 },
      card_categories: { id: "c1", name: "Romance_123" }
    }
  ];

  const CACHE_KEY = '@soulshuffle_dares_cache';

  const loadDares = async (silent = false, skipCache = false) => {
    try {
      if (!silent) setLoading(true);
      const appLoadStartTime = performance.now();

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

      const activeRoom = await getActiveRoom();
      setRoom(activeRoom);
      
      if (activeRoom && activeRoom.status === 'ACTIVE') {
        const [fetched, fetchedLimits] = await Promise.all([
          fetchAvailableDeck(activeRoom.id),
          fetchSendLimits(activeRoom.id)
        ]);
        
        const mapped = fetched.map(mapCardToDare);
        setDares(mapped);
        setLimits(fetchedLimits);

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
    } catch (error: any) {
      console.log('Failed to fetch dares from backend:', error?.message);
      setDares((prevDares) => {
        if (prevDares && prevDares.length > 0) return prevDares;
        return [];
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
      loadDares(true);
    };

    const handleRoomLeft = () => {
      setRoom(null);
      setDares([]);
      setLimits(null);
      AsyncStorage.removeItem(CACHE_KEY).catch(() => {});
    };

    const handleGameEvent = (payload: any) => {
      if (payload.eventType === 'CARD_REJECTED') {
        setTimeout(() => loadDares(true, true), 1500);
      } else {
        loadDares(true);
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
        <View className="bg-white dark:bg-[#1C1721] rounded-2xl p-8 items-center shadow-rose-100/50 border border-rose-100/50 dark:border-rose-950/20 w-full max-w-sm">
          <View className="w-20 h-20 bg-rose-50 dark:bg-[#2B1B24] rounded-full items-center justify-center mb-6">
            <Ionicons name="heart-dislike-outline" size={42} color={isDark ? "#FF296D" : "#FF296D"} />
          </View>
          <Text className="text-2xl font-black text-slate-800 dark:text-white text-center mb-3 tracking-tight">
            Connection Required
          </Text>
          <Text className="text-slate-500 dark:text-slate-400 font-medium text-[14px] text-center leading-6 mb-8">
            Please connect to your partner first to play and share dares. Join a room or invite your partner to get started!
          </Text>
          <TouchableOpacity
            className="w-full bg-[#FF296D] rounded-full py-4 items-center justify-center shadow-sm"
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

    const targetDare = selectedDare;
    const currentNote = note;
    const backupDares = [...dares];
    
    setSelectedDare(null);
    setIsSending(false);
    Alert.alert('Challenge Sent', `${targetDare.title} was sent to your partner!`);

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
      
      AsyncStorage.getItem(CACHE_KEY).then(cached => {
        if (cached) {
          const parsed = JSON.parse(cached);
          parsed.cachedLimits = newOptimisticLimits;
          AsyncStorage.setItem(CACHE_KEY, JSON.stringify(parsed));
        }
      }).catch(() => {});
    }

    sendChallenge(targetDare.id.toString(), currentNote, activeRoom)
      .then(async () => {
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
      });
  };

  const bgColor = isDark ? '#120E15' : '#F7F4F6';
  const textColor = isDark ? '#FFFFFF' : '#1A1A1A';
  const subTextColor = isDark ? '#A09CA3' : '#7A7A7A';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bgColor }} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={bgColor} />
      
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 20, paddingBottom: 12, backgroundColor: bgColor, zIndex: 10 }}>
        <TouchableOpacity onPress={openSidebar}>
          <Ionicons name="menu-outline" size={28} color={textColor} />
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', position: 'absolute', left: 0, right: 0, zIndex: -1 }} pointerEvents="none">
          <Ionicons name="infinite" size={24} color="#FF296D" style={{ transform: [{ rotate: '-15deg' }] }} />
          <Text style={{ color: '#FF296D', fontWeight: '900', fontSize: 20, letterSpacing: -0.5, marginLeft: 4 }}>SoulShuffle</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <TouchableOpacity>
             <Ionicons name="notifications-outline" size={24} color={textColor} />
             <View style={{ position: 'absolute', top: 0, right: 2, width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF296D', borderWidth: 1.5, borderColor: bgColor }} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/profile')}>
            <Image 
              source={{ uri: userAvatar }} 
              style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}
            />
          </TouchableOpacity>
        </View>
      </View>

      {loading && dares.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: bgColor }}>
          <ActivityIndicator size="large" color="#FF296D" />
          <Text style={{ color: subTextColor, fontWeight: '600', fontSize: 14, marginTop: 12 }}>Loading dares...</Text>
        </View>
      ) : room && room.status === 'ACTIVE' ? (
        <ScrollView 
          showsVerticalScrollIndicator={false} 
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#FF296D']} tintColor={isDark ? '#fff' : '#FF296D'} />
          }
          contentContainerStyle={{ paddingBottom: 120, flexGrow: 1 }}
        >
          {/* Header Title */}
          <View style={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 16 }}>
            <Text style={{ fontSize: 32, fontWeight: '900', color: textColor, letterSpacing: -0.5, marginBottom: 6 }}>Dares</Text>
            <Text style={{ color: subTextColor, fontSize: 15, fontWeight: '500', letterSpacing: -0.2 }}>Step out, connect, and make memories 💖</Text>
          </View>

          {/* Carousel */}
          <View style={{ marginTop: 8, marginBottom: 30 }}>
              <DareCarousel 
                data={selectedCategory === 'ALL' ? dares : dares.filter((d: any) => d.category.includes(selectedCategory))} 
                isDark={isDark} 
                onSelectDare={setSelectedDare} 
              />
          </View>

          {/* Explore Categories */}
          <View style={{ paddingHorizontal: 24, marginTop: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: textColor }}>Explore Categories</Text>
              <TouchableOpacity onPress={() => setSelectedCategory('ALL')}>
                  <Text style={{ color: '#FF296D', fontWeight: '700', fontSize: 14 }}>See all</Text>
                </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -24 }} contentContainerStyle={{ paddingHorizontal: 24 }}>
              {[
                { id: 'romance', label: 'Romance', image: require('@/assets/images/bundle_romantic.jpg'), color: '#FF296D' },
                { id: 'fun', label: 'Fun', image: require('@/assets/images/bundle_cozy.jpg'), color: '#9D4EDD' },
                { id: 'deep', label: 'Deep', image: require('@/assets/images/sunset_picnic.jpeg'), color: '#3A86FF' },
                { id: 'spicy', label: 'Spicy', image: require('@/assets/images/bundle_spicy.jpg'), color: '#D90429' }
              ].map((cat: any) => (
                <TouchableOpacity 
                  key={cat.id} 
                  activeOpacity={0.9} 
                  onPress={() => setSelectedCategory(cat.id.toUpperCase())} 
                  style={{
                    width: 105,
                    height: 125,
                    backgroundColor: isDark ? '#1C1721' : '#FFFFFF',
                    borderRadius: 24,
                    overflow: 'hidden',
                    marginRight: 14,
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                    shadowColor: isDark ? '#000' : '#000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: isDark ? 0.3 : 0.05,
                    shadowRadius: 10,
                    elevation: 3
                  }}
                >
                  <View style={{ width: '100%', height: '65%' }}>
                    <Image source={cat.image} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  </View>
                  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', width: '100%' }}>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: cat.color }}>{cat.label}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </ScrollView>
      ) : (
        renderDisconnectedState()
      )}

      {/* Send Modal */}
      <Modal visible={!!selectedDare} transparent animationType="slide" onRequestClose={() => setSelectedDare(null)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <View style={{ backgroundColor: isDark ? '#1C1721' : '#FFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ fontSize: 20, fontWeight: '900', color: textColor }}>Send Dare</Text>
              <TouchableOpacity onPress={() => setSelectedDare(null)} style={{ padding: 4, backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', borderRadius: 20 }}>
                <Ionicons name="close" size={22} color={textColor} />
              </TouchableOpacity>
            </View>

            {selectedDare && (
              <View style={{ backgroundColor: isDark ? '#261F2C' : '#F7F4F6', borderRadius: 20, padding: 20, marginBottom: 20 }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: textColor, marginBottom: 8 }}>{selectedDare.title}</Text>
                <Text style={{ color: subTextColor, fontSize: 14, lineHeight: 22 }}>{selectedDare.description}</Text>
              </View>
            )}

            <Text style={{ fontSize: 15, fontWeight: '700', color: textColor, marginBottom: 12 }}>Add a note (optional)</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="E.g. We haven't done this in a while..."
              placeholderTextColor={subTextColor}
              style={{
                backgroundColor: isDark ? '#1C1721' : '#FFFFFF',
                borderWidth: 1,
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                borderRadius: 16,
                padding: 16,
                color: textColor,
                fontSize: 15,
                marginBottom: 24,
                textAlignVertical: 'top'
              }}
              multiline
              numberOfLines={3}
            />

            <TouchableOpacity 
              onPress={handleSendChallenge}
              disabled={isSending || (limits?.can_send === false)}
              style={{
                backgroundColor: limits?.can_send === false ? (isDark ? '#4A3E48' : '#D1C9CD') : '#FF296D',
                borderRadius: 100,
                paddingVertical: 18,
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
                shadowColor: '#FF296D',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.3,
                shadowRadius: 12,
                elevation: 5
              }}
            >
              {isSending ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Text style={{ color: 'white', fontWeight: '800', fontSize: 16, marginRight: 8 }}>
                    {limits?.can_send === false ? 'Send Limit Reached' : 'Send Challenge'}
                  </Text>
                  {limits?.can_send !== false && <Ionicons name="send" size={16} color="white" />}
                </>
              )}
            </TouchableOpacity>

            {limits && (
              <View style={{ alignItems: 'center', marginTop: 12 }}>
                <Text style={{ color: subTextColor, fontSize: 12, fontWeight: '600' }}>
                  {limits.active_remaining} active limits • {limits.daily_remaining} daily remaining
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}


