import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, SafeAreaView, Platform, StatusBar, TextInput, Modal, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getActiveRoom, sendChallenge, ChallengePayload } from '@/services/roomService';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { fetchCards } from '@/services/cardService';
import { useSidebar } from '@/context/SidebarContext';

const sunsetPicnic = require('@/assets/images/sunset_picnic.jpeg');

type Dare = ChallengePayload & {
  id: string | number;
  stars: number;
  isPaid: boolean;
};

// Helper to map card structure from Supabase
const mapCardToDare = (card: any): Dare => {
  const rawCategory = card.card_categories?.name || 'GENERAL';
  const cleanCategory = rawCategory.split('_')[0].toUpperCase();

  const difficulty = (card.attributes?.difficulty || 'MEDIUM').toUpperCase();
  const time = card.attributes?.time || '30 mins';
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
    id: card.id,
    title: card.name,
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
  const router = useRouter();
  const [selectedDare, setSelectedDare] = useState<Dare | null>(null);
  const [isSending, setIsSending] = useState(false);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

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
      attributes: { difficulty: "medium", time: "30 mins", stars: 2 },
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

  const loadDares = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const fetched = await fetchCards();
      const mapped = fetched.map(mapCardToDare);
      setDares(mapped);
    } catch (error) {
      console.log('Failed to fetch dares from backend, loading fallback cards:', error);
      const fallbacks = getFallbackCards().map(mapCardToDare);
      setDares(fallbacks);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDares();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadDares(true);
  };

  const bundles = [
    { id: 101, title: 'Weekend Getaway', count: 5, isPaid: true, image: 'https://images.unsplash.com/photo-1484712401471-05c7215857eb?w=600&h=400&fit=crop', price: 'Premium' },
    { id: 102, title: 'Cozy Winter', count: 8, isPaid: false, image: 'https://images.unsplash.com/photo-1517263904808-5dc91e3e7044?w=600&h=400&fit=crop', price: 'Free' },
    { id: 103, title: 'Spicy Nights', count: 10, isPaid: true, image: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=600&h=400&fit=crop', price: 'Premium' },
  ];

  const handleSendChallenge = async () => {
    if (!selectedDare) return;

    try {
      setIsSending(true);
      const room = await getActiveRoom();

      if (!room) {
        Alert.alert('No Room Found', 'Create or join a room before sending a challenge.');
        return;
      }

      if (room.status !== 'ACTIVE') {
        Alert.alert('Partner Not Connected', 'Your partner needs to join the room before you can send a challenge.');
        return;
      }

      await sendChallenge(selectedDare);
      setSelectedDare(null);
      Alert.alert('Challenge Sent', `${selectedDare.title} was sent to your partner.`);
    } catch (error: any) {
      if (error.response?.status === 401) {
        Alert.alert('Session Expired', 'Please sign in again before sending a challenge.', [
          { text: 'OK', onPress: () => router.replace('/') },
        ]);
        return;
      }

      Alert.alert(
        'Could Not Send',
        error.response?.data?.message || error.message || 'Something went wrong while sending the challenge.'
      );
    } finally {
      setIsSending(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#fff8f7] dark:bg-[#221517]" style={{ paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 }}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={isDark ? "#221517" : "#fff8f7"} />
      
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 py-4 bg-[#fff8f7] dark:bg-[#221517] z-10">
        <TouchableOpacity onPress={openSidebar}>
          <Ionicons name="menu-outline" size={30} color={isDark ? "#fff" : "#9f1239"} />
        </TouchableOpacity>
        <View className="flex-row items-center gap-1.5">
          <Ionicons name="infinite" size={28} color={isDark ? "#fda4af" : "#be123c"} style={{ transform: [{ rotate: '-15deg' }] }} />
          <Text className="text-[#a12338] dark:text-rose-400 font-black text-xl tracking-tight">SoulShuffle</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/profile')}>
          <Image 
            source={{ uri: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop' }} 
            className="w-10 h-10 rounded-full border border-rose-200 dark:border-rose-950/30"
          />
        </TouchableOpacity>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#e11d48']} tintColor={isDark ? '#fff' : '#e11d48'} />
        }
      >
        {/* Search Bar */}
        <View className="px-6 mt-2 mb-6">
          <View className="bg-white dark:bg-[#332225] rounded-2xl h-14 flex-row items-center px-4 shadow-sm shadow-slate-100 dark:shadow-none border border-slate-50 dark:border-rose-950/20">
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
              className={`px-6 py-4 rounded-full shadow-sm mr-2 border ${
                selectedCategory === cat 
                  ? 'bg-rose-500 border-rose-500' 
                  : 'bg-white dark:bg-[#332225] border-slate-50 dark:border-rose-950/20'
              }`}
              onPress={() => setSelectedCategory(cat)}
            >
              <Text className={`font-bold text-sm tracking-wide ${selectedCategory === cat ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                {cat === 'ALL' ? 'All Dares' : cat.charAt(0) + cat.slice(1).toLowerCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Actions Row */}
        <View className="flex-row items-center px-6 mb-8">
          <TouchableOpacity className="bg-white dark:bg-[#332225] px-5 py-3 rounded-2xl flex-row items-center shadow-sm shadow-slate-100 dark:shadow-none border border-slate-50 dark:border-rose-950/20">
            <Ionicons name="dice-outline" size={18} color={isDark ? "#fff" : "#000"} />
            <Text className="text-slate-800 dark:text-white font-bold text-xs ml-2">Shuffle Cards</Text>
          </TouchableOpacity>
        </View>

        {/* Bundles Section */}
        <View className="mb-10">
          <Text className="px-6 text-lg font-extrabold text-slate-900 dark:text-white tracking-tight mb-4">Dare Bundles</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-6" contentContainerStyle={{ paddingRight: 40 }}>
            {bundles.map((bundle) => (
              <TouchableOpacity key={bundle.id} className="w-[280px] h-48 mr-4 rounded-[28px] overflow-hidden relative shadow-sm border border-slate-100 dark:border-rose-950/20 bg-white dark:bg-[#332225]">
                <Image source={typeof bundle.image === 'string' ? { uri: bundle.image } : bundle.image} className="w-full h-[65%] absolute top-0" />
                <View className="absolute inset-0 bg-black/20" />
                
                {/* Bundle Ribbon & Premium Flag */}
                <View className="absolute top-4 left-4 bg-white/90 dark:bg-[#221517]/90 px-3 py-1.5 rounded-full flex-row items-center">
                  <Ionicons name="albums" size={12} color={isDark ? "#f43f5e" : "#ab2f33"} />
                  <Text className="text-[#ab2f33] dark:text-rose-400 font-bold text-[10px] ml-1.5 tracking-wider">{bundle.count} DARES</Text>
                </View>

                {bundle.isPaid && (
                  <View className="absolute top-4 right-4 bg-[#fde047] px-2 py-1.5 rounded-full shadow-sm flex-row items-center">
                    <Ionicons name="lock-closed" size={10} color="#854d0e" />
                    <Text className="text-[#854d0e] font-bold text-[9px] ml-1 tracking-widest uppercase">Premium</Text>
                  </View>
                )}

                <View className="absolute bottom-0 left-0 right-0 h-[45%] bg-white dark:bg-[#332225] p-4 justify-between border-t border-slate-100/50 dark:border-rose-950/20">
                  <Text className="text-lg font-bold text-slate-800 dark:text-white tracking-tight">{bundle.title}</Text>
                  <View className="flex-row items-center justify-between">
                    <Text className="text-slate-500 dark:text-slate-400 font-medium text-[11px]">Unlock full deck</Text>
                    <Text className={`font-bold text-[12px] ${bundle.isPaid ? 'text-[#ab2f33] dark:text-rose-400' : 'text-[#0d6e67] dark:text-teal-400'}`}>
                      {bundle.price}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Single Dares Grid */}
        <View className="px-6 flex-row flex-wrap justify-between gap-y-4">
          <Text className="w-full text-lg font-extrabold text-slate-900 dark:text-white tracking-tight mb-1">Single Actions</Text>
          
          {loading ? (
            <View className="w-full py-10 items-center justify-center">
              <ActivityIndicator size="large" color="#f43f5e" />
              <Text className="text-slate-400 font-semibold text-sm mt-3">Loading dares from database...</Text>
            </View>
          ) : dares.length === 0 ? (
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
                className="w-[48%] bg-white dark:bg-[#332225] rounded-[24px] overflow-hidden shadow-sm border border-slate-50 dark:border-rose-950/20 pb-4"
                activeOpacity={0.85}
                onPress={() => setSelectedDare(dare)}
              >
                <View className="w-full h-40 relative">
                  <Image source={typeof dare.image === 'string' ? { uri: dare.image } : dare.image} className="w-full h-full" />
                  
                  {/* Difficulty & Premium Badges */}
                  <View className="absolute top-3 left-3 bg-white/95 dark:bg-[#221517]/95 px-2.5 py-1 rounded-full flex-row items-center shadow-sm">
                    {Array.from({ length: dare.stars }).map((_, i) => (
                      <Ionicons key={i} name="star" size={10} color="#f59e0b" style={{ marginRight: 2 }} />
                    ))}
                    <Text className="text-slate-800 dark:text-slate-300 font-bold text-[9px] ml-1 tracking-wider uppercase">{dare.difficulty}</Text>
                  </View>

                  {dare.isPaid && (
                    <View className="absolute top-3 right-3 bg-white/95 dark:bg-[#221517]/95 w-6 h-6 rounded-full flex-row items-center justify-center shadow-sm">
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

      <Modal
        visible={!!selectedDare}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedDare(null)}
      >
        <View className="flex-1 justify-end bg-black/40 dark:bg-black/60">
          <TouchableOpacity className="flex-1" activeOpacity={1} onPress={() => setSelectedDare(null)} />
          {selectedDare && (
            <View className="bg-[#fff8f7] dark:bg-[#2A1B1D] rounded-t-[34px] overflow-hidden">
              <Image source={typeof selectedDare.image === 'string' ? { uri: selectedDare.image } : selectedDare.image} className="w-full h-56" />
              <View className="p-6">
                <View className="flex-row items-center justify-between mb-3">
                  <View className="bg-white dark:bg-[#332225] px-3 py-1.5 rounded-full flex-row items-center">
                    {Array.from({ length: selectedDare.stars }).map((_, i) => (
                      <Ionicons key={i} name="star" size={11} color="#f59e0b" style={{ marginRight: 2 }} />
                    ))}
                    <Text className="text-slate-800 dark:text-white font-bold text-[10px] ml-1 tracking-wider uppercase">{selectedDare.difficulty}</Text>
                  </View>
                  <TouchableOpacity
                    className="w-10 h-10 rounded-full bg-white dark:bg-[#332225] items-center justify-center"
                    onPress={() => setSelectedDare(null)}
                  >
                    <Ionicons name="close" size={20} color={isDark ? "#fff" : "#334155"} />
                  </TouchableOpacity>
                </View>

                <Text className="text-[11px] font-bold text-rose-500 dark:text-rose-400 tracking-widest uppercase mb-2">{selectedDare.category}</Text>
                <Text className="text-3xl font-black text-slate-900 dark:text-white tracking-tight mb-3">{selectedDare.title}</Text>
                <Text className="text-slate-600 dark:text-slate-300 font-medium text-[14px] leading-6 mb-5">{selectedDare.description}</Text>

                <View className="flex-row items-center mb-6">
                  <View className="bg-white dark:bg-[#332225] px-4 py-3 rounded-2xl flex-row items-center mr-3">
                    <Ionicons name="time" size={15} color={isDark ? "#f43f5e" : "#64748b"} />
                    <Text className="text-slate-600 dark:text-white font-bold text-[12px] ml-2">{selectedDare.time}</Text>
                  </View>
                  <View className="bg-white dark:bg-[#332225] px-4 py-3 rounded-2xl flex-row items-center">
                    <Ionicons name={selectedDare.isPaid ? 'lock-closed' : 'heart'} size={15} color={selectedDare.isPaid ? (isDark ? '#f43f5e' : '#ab2f33') : (isDark ? '#2dd4bf' : '#0d6e67')} />
                    <Text className="text-slate-600 dark:text-white font-bold text-[12px] ml-2">{selectedDare.isPaid ? 'Premium' : 'Free'}</Text>
                  </View>
                </View>

                <TouchableOpacity
                  className={`rounded-full py-[18px] items-center justify-center flex-row shadow-lg ${isSending ? 'bg-slate-300 dark:bg-rose-950/40 shadow-none' : 'bg-[#af2c3b] dark:bg-rose-600 shadow-red-300/50 dark:shadow-none'}`}
                  activeOpacity={0.85}
                  onPress={handleSendChallenge}
                  disabled={isSending}
                >
                  {isSending ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Ionicons name="send" size={18} color="white" />
                      <Text className="text-white font-bold text-[15px] ml-2">Send to Partner</Text>
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
