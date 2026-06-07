import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, SafeAreaView, Platform, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getActiveRoom, SentChallenge } from '@/services/roomService';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSidebar } from '@/context/SidebarContext';

export default function History() {
  const { openSidebar } = useSidebar();
  const router = useRouter();
  const [challengeHistory, setChallengeHistory] = useState<SentChallenge[]>([]);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  useEffect(() => {
    let isMounted = true;

    const loadChallengeHistory = async () => {
      try {
        const room = await getActiveRoom();
        if (isMounted) {
          setChallengeHistory(room?.game_state?.challenge_history || []);
        }
      } catch (error) {
        console.log('Failed to load challenge history:', error);
      }
    };

    loadChallengeHistory();
    const intervalId = setInterval(loadChallengeHistory, 5000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, []);

  const formatChallengeDate = (value?: string) => {
    if (!value) return 'Recently';
    return new Date(value).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-[#fffaf9] dark:bg-[#221517]" style={{ paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 }}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={isDark ? "#221517" : "#fffaf9"} />
      
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 py-4 bg-[#fffaf9] dark:bg-[#221517] z-10">
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
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 120, paddingTop: 10 }}
      >
        {/* Title Section */}
        <View className="mb-8 items-center mt-2">
          <Text className="text-[10px] font-bold text-[#b91c1c] dark:text-rose-400 tracking-[0.25em] uppercase w-full text-center mb-4">
            Timeline & Progress
          </Text>
          <Text className="text-[42px] leading-[48px] font-black w-full text-center text-slate-900 dark:text-white tracking-tight">
            Our <Text className="text-[#b91c1c] dark:text-rose-400 italic">Journey</Text>{'\n'}Together.
          </Text>
          
          <TouchableOpacity className="bg-[#df4b4b] dark:bg-rose-600 rounded-full py-3 px-6 mt-6 flex-row items-center shadow-lg shadow-red-200 dark:shadow-none">
            <Text className="text-white font-bold text-[11px] tracking-widest uppercase mr-2">
              Share Achievements
            </Text>
            <Ionicons name="share-social" size={16} color="white" />
          </TouchableOpacity>
        </View>

        {/* Stats Cards */}
        <View className="mb-8">
          {/* Completion Rate Card */}
          <View className="bg-[#f7eceb] dark:bg-[#332225] rounded-[32px] p-6 mb-4 relative overflow-hidden shadow-sm dark:shadow-none">
            <Ionicons name="heart" size={140} color={isDark ? "#221517" : "#e5d5d3"} style={{ position: 'absolute', right: -30, top: 10, opacity: 0.8 }} />
            <Text className="text-[9px] font-bold text-slate-500 dark:text-slate-400 tracking-widest uppercase mb-1">Completion Rate</Text>
            <Text className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter mb-6">94%</Text>
            
            <View className="w-[85%] h-2.5 bg-slate-200/60 dark:bg-[#221517] rounded-full flex-row z-10">
              <View className="w-[94%] h-full bg-[#0d6e67] dark:bg-teal-400 rounded-full"></View>
            </View>
          </View>

          {/* Current Streak Card */}
          <View className="bg-[#f7eceb] dark:bg-[#332225] rounded-[32px] p-6 mb-4 shadow-sm dark:shadow-none">
            <Text className="text-[9px] font-bold text-slate-500 dark:text-slate-400 tracking-widest uppercase mb-1">Current Streak</Text>
            <Text className="text-4xl font-black text-[#b91c1c] dark:text-rose-400 tracking-tighter mb-6">12 Days</Text>
            
            <View className="flex-row items-center justify-between w-[90%] gap-2">
              <View className="flex-[1] h-1.5 bg-[#b91c1c] dark:bg-rose-50 rounded-full"></View>
              <View className="flex-[1] h-1.5 bg-[#b91c1c] dark:bg-rose-50 rounded-full"></View>
              <View className="flex-[1] h-1.5 bg-[#b91c1c] dark:bg-rose-50 rounded-full"></View>
              <View className="flex-[1] h-1.5 bg-[#eebdbd] dark:bg-[#221517]/60 rounded-full"></View>
              <View className="flex-[1] h-1.5 bg-[#eebdbd] dark:bg-[#221517]/60 rounded-full"></View>
            </View>
          </View>

          {/* Dares Mastered Card */}
          <View className="bg-[#ab2f33] dark:bg-indigo-900 rounded-[32px] p-6 shadow-md shadow-red-900/30 dark:shadow-none">
            <Text className="text-[9px] font-bold text-white/80 tracking-widest uppercase mb-1">Dares Mastered</Text>
            <Text className="text-5xl font-black text-white tracking-tighter mb-6">158</Text>
            <Text className="text-[13px] font-medium text-white/90">You&apos;re in the top 5% of couples!</Text>
          </View>
        </View>

        {/* Filter Pills */}
        <View className="flex-row flex-wrap gap-2 mb-8 justify-center">
          <TouchableOpacity className="bg-[#ab2f33] dark:bg-rose-600 px-6 py-2 rounded-full shadow-sm">
            <Text className="text-white dark:text-white font-bold text-[10px] tracking-widest uppercase">All</Text>
          </TouchableOpacity>
          <TouchableOpacity className="bg-[#ede4e3] dark:bg-[#332225] px-5 py-2 rounded-full">
            <Text className="text-slate-500 dark:text-slate-400 font-bold text-[10px] tracking-widest uppercase">This Week</Text>
          </TouchableOpacity>
          <TouchableOpacity className="bg-[#ede4e3] dark:bg-[#332225] px-5 py-2 rounded-full">
            <Text className="text-slate-500 dark:text-slate-400 font-bold text-[10px] tracking-widest uppercase">Last Month</Text>
          </TouchableOpacity>
          <TouchableOpacity className="bg-[#ede4e3] dark:bg-[#332225] px-5 py-2 rounded-full flex-row items-center justify-center">
            <Ionicons name="heart" size={10} color={isDark ? "#f43f5e" : "#64748b"} style={{ marginRight: 4 }} />
            <Text className="text-slate-500 dark:text-slate-400 font-bold text-[10px] tracking-widest uppercase">Favorites</Text>
          </TouchableOpacity>
        </View>

        {/* Timeline Section */}
        <View className="relative">
          {/* Vertical Timeline Track */}
          <View className="absolute left-[5px] top-4 bottom-10 w-[1px] bg-[#eacaca]" style={{ borderStyle: 'dotted', borderWidth: 1, borderColor: isDark ? '#4c1d24' : '#eec5c5', opacity: 0.6 }} />

          {challengeHistory.map((challenge, index) => (
            <View key={`${challenge.id}-${challenge.sent_at || index}`} className="mb-6 relative flex-row">
              <View className="w-3 h-3 rounded-full bg-[#ab2f33] dark:bg-rose-400 absolute left-0 top-5" />
              <View className="ml-6 flex-1 bg-white dark:bg-[#332225] rounded-[28px] overflow-hidden shadow-sm border border-slate-50 dark:border-rose-950/20">
                <Image source={{ uri: challenge.image }} className="w-full h-32" />
                <View className="p-6">
                  <View className="flex-row justify-between items-center mb-3">
                    <Text className="text-[9px] font-bold text-slate-400 dark:text-slate-400 tracking-widest uppercase">
                      {formatChallengeDate(challenge.sent_at)}
                    </Text>
                    <View className="flex-row items-center">
                      <Ionicons name="paper-plane" size={12} color={isDark ? "#2dd4bf" : "#0d6e67"} />
                      <Text className="text-[9px] font-bold text-[#0d6e67] dark:text-teal-400 tracking-widest uppercase ml-1">Sent</Text>
                    </View>
                  </View>
                  <Text className="text-xl font-bold text-slate-900 dark:text-white tracking-tight mb-2">{challenge.title}</Text>
                  <Text className="text-slate-500 dark:text-slate-300 text-[13px] leading-5 font-medium mb-5">
                    {challenge.description}
                  </Text>
                  <View className="flex-row justify-between items-center pt-2 border-t border-slate-50/50 dark:border-rose-950/20">
                    <View className="flex-row items-center">
                      <Ionicons name="time" size={12} color={isDark ? "#f43f5e" : "#64748b"} />
                      <Text className="text-[10px] font-bold text-slate-500 dark:text-slate-400 tracking-widest uppercase ml-1.5">{challenge.time}</Text>
                    </View>
                    <Text className="text-[10px] font-bold text-[#ab2f33] dark:text-rose-400 tracking-widest uppercase">{challenge.category}</Text>
                  </View>
                </View>
              </View>
            </View>
          ))}

          {challengeHistory.length === 0 && (
            <View className="mb-6 relative flex-row">
              <View className="w-3 h-3 rounded-full bg-[#eec5c5] dark:bg-rose-950/60 absolute left-0 top-5" />
              <View className="ml-6 flex-1 bg-white dark:bg-[#332225] rounded-[28px] p-6 shadow-sm border border-slate-50 dark:border-rose-950/20">
                <Text className="text-xl font-bold text-slate-900 dark:text-white tracking-tight mb-2">No Sent Challenges Yet</Text>
                <Text className="text-slate-500 dark:text-slate-400 text-[13px] leading-5 font-medium">
                  Challenges you send from the Dares page will appear here.
                </Text>
              </View>
            </View>
          )}

          {/* Timeline Item 1 */}
          {challengeHistory.length === 0 && <View className="mb-6 relative flex-row">
            <View className="w-3 h-3 rounded-full bg-[#ab2f33] dark:bg-rose-400 absolute left-0 top-5" />
            <View className="ml-6 flex-1 bg-white dark:bg-[#332225] rounded-[28px] p-6 shadow-sm border border-slate-50 dark:border-rose-950/20">
              <View className="flex-row justify-between items-center mb-3">
                <Text className="text-[9px] font-bold text-slate-400 dark:text-slate-400 tracking-widest uppercase">Oct 14, 2023</Text>
                <View className="flex-row items-center">
                  <Ionicons name="checkmark-circle" size={12} color={isDark ? "#2dd4bf" : "#0d6e67"} />
                  <Text className="text-[9px] font-bold text-[#0d6e67] dark:text-teal-400 tracking-widest uppercase ml-1">Completed</Text>
                </View>
              </View>
              <Text className="text-xl font-bold text-slate-900 dark:text-white tracking-tight mb-2">The Candlelit Picnic</Text>
              <Text className="text-slate-500 dark:text-slate-300 text-[13px] leading-5 font-medium mb-6">
                Assigned by <Text className="font-bold text-slate-800 dark:text-white">Alex</Text>. A cozy indoor picnic with no phones allowed.
              </Text>
              <View className="flex-row justify-between items-center pt-2 border-t border-slate-50/50 dark:border-rose-950/20">
                <TouchableOpacity className="flex-row items-center">
                  <Ionicons name="refresh" size={12} color={isDark ? "#f43f5e" : "#ab2f33"} />
                  <Text className="text-[10px] font-bold text-[#ab2f33] dark:text-rose-400 tracking-widest uppercase ml-1.5">Replay</Text>
                </TouchableOpacity>
                <TouchableOpacity>
                  <Ionicons name="heart" size={16} color={isDark ? "#f43f5e" : "#857169"} />
                </TouchableOpacity>
              </View>
            </View>
          </View>}

          {/* Timeline Item 2 */}
          {challengeHistory.length === 0 && <View className="mb-6 relative flex-row">
            <View className="w-3 h-3 rounded-full bg-[#ab2f33] dark:bg-rose-400 absolute left-0 top-5" />
            <View className="ml-6 flex-1 bg-white dark:bg-[#332225] rounded-[28px] p-6 shadow-sm border border-slate-50 dark:border-rose-950/20">
              <View className="flex-row justify-between items-center mb-3">
                <Text className="text-[9px] font-bold text-slate-400 dark:text-slate-400 tracking-widest uppercase">Oct 22, 2023</Text>
                <View className="flex-row items-center">
                  <Ionicons name="checkmark-circle" size={12} color={isDark ? "#2dd4bf" : "#0d6e67"} />
                  <Text className="text-[9px] font-bold text-[#0d6e67] dark:text-teal-400 tracking-widest uppercase ml-1">Completed</Text>
                </View>
              </View>
              <Text className="text-xl font-bold text-slate-900 dark:text-white tracking-tight mb-2">Love Note Scavenger Hunt</Text>
              <Text className="text-slate-500 dark:text-slate-300 text-[13px] leading-5 font-medium mb-6">
                Assigned by <Text className="font-bold text-slate-800 dark:text-white">Sam</Text>. Hide 5 notes around the house with clues.
              </Text>
              <View className="flex-row justify-between items-center pt-2 border-t border-slate-50/50 dark:border-rose-950/20">
                <TouchableOpacity className="flex-row items-center">
                  <Ionicons name="refresh" size={12} color={isDark ? "#f43f5e" : "#ab2f33"} />
                  <Text className="text-[10px] font-bold text-[#ab2f33] dark:text-rose-400 tracking-widest uppercase ml-1.5">Replay</Text>
                </TouchableOpacity>
                <TouchableOpacity>
                  <Ionicons name="heart" size={16} color={isDark ? "#f43f5e" : "#857169"} />
                </TouchableOpacity>
              </View>
            </View>
          </View>}

          {/* Timeline Item 3 (Expired) */}
          {challengeHistory.length === 0 && <View className="mb-6 relative flex-row">
            <View className="w-3 h-3 rounded-full bg-[#eec5c5] dark:bg-rose-950/60 absolute left-0 top-5" />
            <View className="ml-6 flex-1 bg-white dark:bg-[#332225] rounded-[28px] p-6 shadow-sm border border-[#eec5c5]/40 dark:border-rose-950/20 opacity-90">
              <View className="flex-row justify-between items-center mb-3">
                <Text className="text-[9px] font-bold text-slate-400 dark:text-slate-400 tracking-widest uppercase">Oct 28, 2023</Text>
                <View className="flex-row items-center">
                  <Ionicons name="remove-circle" size={12} color={isDark ? "#94a3b8" : "#857169"} />
                  <Text className="text-[9px] font-bold text-[#857169] dark:text-slate-500 tracking-widest uppercase ml-1">Expired</Text>
                </View>
              </View>
              <Text className="text-xl font-bold text-slate-900 dark:text-white tracking-tight mb-2">The Sunset Drive</Text>
              <Text className="text-slate-500 dark:text-slate-300 text-[13px] leading-5 font-medium mb-6">
                Assigned by <Text className="font-bold text-slate-800 dark:text-white">Alex</Text>. Drive to the highest point in the city for sunset.
              </Text>
              <View className="flex-row justify-between items-center pt-2 border-t border-slate-50/50 dark:border-rose-950/20">
                <TouchableOpacity className="flex-row items-center">
                  <Ionicons name="refresh" size={12} color={isDark ? "#f43f5e" : "#ab2f33"} />
                  <Text className="text-[10px] font-bold text-[#ab2f33] dark:text-rose-400 tracking-widest uppercase ml-1.5">Try Again</Text>
                </TouchableOpacity>
                <TouchableOpacity>
                  <Ionicons name="heart" size={16} color={isDark ? "#64748b" : "#c2b8b4"} />
                </TouchableOpacity>
              </View>
            </View>
          </View>}

        </View>

        {/* Load More Button */}
        <View className="items-center mt-2 mb-8">
          <TouchableOpacity className="bg-[#ede4e3] dark:bg-[#332225] px-8 py-4 rounded-full w-full items-center">
            <Text className="text-[#ab2f33] dark:text-rose-400 font-bold text-[11px] tracking-widest uppercase">Load More History</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
