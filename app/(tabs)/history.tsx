import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, Platform, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getActiveRoom, fetchRoomHistory, SentChallenge } from '@/services/roomService';
import { getMyProfileCached } from '@/services/authService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSidebar } from '@/context/SidebarContext';
import { useUserAvatar } from '@/hooks/use-user-avatar';

type FilterType = 'ALL' | 'THIS_WEEK' | 'LAST_MONTH';

export default function History() {
  const { openSidebar } = useSidebar();
  const userAvatar = useUserAvatar();
  const router = useRouter();
  const [challengeHistory, setChallengeHistory] = useState<SentChallenge[]>([]);
  const [stats, setStats] = useState({ completionRate: 0, currentStreak: 0, daresMastered: 0 });
  const [activeFilter, setActiveFilter] = useState<FilterType>('ALL');
  const [myUserId, setMyUserId] = useState<string | null>(null);

  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  useEffect(() => {
    let isMounted = true;

    const loadHistory = async () => {
      try {
        // Fetch current user ID to distinguish sender vs receiver
        const profile = await getMyProfileCached();
        if (profile?.id && isMounted) {
          setMyUserId(profile.id);
        }

        // 1. Load from Cache for instant UI
        const cached = await AsyncStorage.getItem('cachedRoomHistory');
        if (cached && isMounted) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            setChallengeHistory(parsed);
            calculateStats(parsed);
          }
        }

        // 2. Fetch fresh data in background
        const room = await getActiveRoom();
        if (room) {
          let historyItems: SentChallenge[] = [];
          try {
            const freshHistory = await fetchRoomHistory(room.id);
            if (Array.isArray(freshHistory) && freshHistory.length > 0) {
              historyItems = freshHistory;
            }
          } catch (err) {
            // Fallback to room.game_state
          }

          // If freshHistory wasn't returned from API, assemble from game_state
          if (historyItems.length === 0 && room.game_state) {
            const gameStateHistory = room.game_state.challenge_history || [];
            const activeChallenge = room.game_state.active_challenge;
            if (activeChallenge) {
              const exists = gameStateHistory.some((c: any) => c.id === activeChallenge.id);
              historyItems = exists ? gameStateHistory : [activeChallenge, ...gameStateHistory];
            } else {
              historyItems = gameStateHistory;
            }
          }

          if (isMounted && historyItems.length > 0) {
            setChallengeHistory(historyItems);
            calculateStats(historyItems);
            await AsyncStorage.setItem('cachedRoomHistory', JSON.stringify(historyItems));
          }
        }
      } catch (error) {
        console.log('Failed to load history:', error);
      }
    };

    loadHistory();
    const intervalId = setInterval(loadHistory, 15000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, []);

  const filteredHistory = useMemo(() => {
    const now = new Date();
    if (activeFilter === 'THIS_WEEK') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return challengeHistory.filter(c => c.sent_at ? new Date(c.sent_at) >= weekAgo : false);
    }
    if (activeFilter === 'LAST_MONTH') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return challengeHistory.filter(c => c.sent_at ? new Date(c.sent_at) >= monthAgo : false);
    }
    return challengeHistory;
  }, [challengeHistory, activeFilter]);

  const formatChallengeDate = (value?: string) => {
    if (!value) return 'Recently';
    return new Date(value).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const calculateStats = (history: SentChallenge[]) => {
    const daresMastered = history.filter(
      c => (c.status || '').toUpperCase() === 'COMPLETED' || (c.status || '').toUpperCase() === 'CONFIRMED'
    ).length;
    const completionRate = history.length > 0 ? Math.round((daresMastered / history.length) * 100) : 0;
    
    let currentStreak = 0;
    if (history.length > 0) {
      const dates = history
        .filter(c => c.sent_at)
        .map(c => new Date(c.sent_at!).setHours(0,0,0,0))
        .sort((a, b) => b - a);
      const uniqueDates = [...new Set(dates)];
      const today = new Date().setHours(0,0,0,0);
      const yesterday = today - 86400000;
      
      if (uniqueDates[0] === today || uniqueDates[0] === yesterday) {
        currentStreak = 1;
        for (let i = 0; i < uniqueDates.length - 1; i++) {
          if (uniqueDates[i] - uniqueDates[i+1] === 86400000) {
            currentStreak++;
          } else {
            break;
          }
        }
      }
    }
    
    setStats({ completionRate, currentStreak, daresMastered });
  };

  const getChallengeStatusInfo = (challenge: SentChallenge, userId: string | null, darkScheme: boolean) => {
    const rawStatus = (challenge.status || 'SENT').toUpperCase();
    const isSender = challenge.sender_id ? challenge.sender_id === userId : true;

    if (rawStatus === 'COMPLETED' || rawStatus === 'CONFIRMED') {
      return {
        statusText: 'Completed',
        statusIcon: 'checkmark-circle',
        statusColor: darkScheme ? '#2dd4bf' : '#0d6e67',
        dotColor: '#2dd4bf',
      };
    }

    if (rawStatus === 'ACCEPTED' || rawStatus === 'ACTIVE' || rawStatus === 'IN_PROGRESS' || rawStatus === 'COMPLETED_BY_RECEIVER') {
      return {
        statusText: 'Active',
        statusIcon: 'flame',
        statusColor: darkScheme ? '#f43f5e' : '#e11d48',
        dotColor: '#ff2d55',
      };
    }

    if (rawStatus === 'DEFLECTED') {
      return {
        statusText: 'Deflected',
        statusIcon: 'shield-checkmark',
        statusColor: darkScheme ? '#818cf8' : '#4f46e5',
        dotColor: '#6366f1',
      };
    }

    if (rawStatus === 'REJECTED' || rawStatus === 'DECLINED') {
      return {
        statusText: 'Declined',
        statusIcon: 'close-circle',
        statusColor: darkScheme ? '#f87171' : '#dc2626',
        dotColor: '#ef4444',
      };
    }

    if (rawStatus === 'EXPIRED') {
      return {
        statusText: 'Expired',
        statusIcon: 'time',
        statusColor: darkScheme ? '#94a3b8' : '#857169',
        dotColor: darkScheme ? '#475569' : '#cbd5e1',
      };
    }

    // Default / Pending state
    if (isSender) {
      return {
        statusText: 'Sent',
        statusIcon: 'paper-plane',
        statusColor: darkScheme ? '#38bdf8' : '#0284c7',
        dotColor: '#0284c7',
      };
    } else {
      return {
        statusText: 'Received',
        statusIcon: 'download',
        statusColor: darkScheme ? '#fbbf24' : '#d97706',
        dotColor: '#fbbf24',
      };
    }
  };

  const filterPills: { label: string; value: FilterType }[] = [
    { label: 'All', value: 'ALL' },
    { label: 'This Week', value: 'THIS_WEEK' },
    { label: 'Last Month', value: 'LAST_MONTH' },
  ];

  return (
    <SafeAreaView className="flex-1 bg-[#fffaf9] dark:bg-[#0F0608]" edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={isDark ? "#0F0608" : "#fffaf9"} />
      
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 pt-5 pb-3 bg-[#fffaf9] dark:bg-[#0F0608] z-10">
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

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 160, paddingTop: 10 }}
      >
        {/* Title Section */}
        <View className="mb-8 items-center mt-2">
          <Text className="text-[10px] font-bold text-[#b91c1c] dark:text-rose-400 tracking-[0.25em] uppercase w-full text-center mb-4">
            Timeline & Progress
          </Text>
          <Text className="text-[42px] leading-[48px] font-black w-full text-center text-slate-900 dark:text-white tracking-tight">
            Our <Text className="text-[#b91c1c] dark:text-rose-400 italic">Journey</Text>{'\n'}Together.
          </Text>
        </View>

        {/* Stats Cards */}
        <View className="mb-8">
          {/* Completion Rate Card */}
          <View className="bg-[#f7eceb] dark:bg-[#271318] rounded-[32px] p-6 mb-4 relative overflow-hidden">
            <Ionicons name="heart" size={140} color={isDark ? "#0F0608" : "#e5d5d3"} style={{ position: 'absolute', right: -30, top: 10, opacity: 0.8 }} />
            <Text className="text-[9px] font-bold text-slate-500 dark:text-slate-400 tracking-widest uppercase mb-1">Completion Rate</Text>
            <Text className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter mb-6">{stats.completionRate}%</Text>
            
            <View className="w-[85%] h-2.5 bg-slate-200/60 dark:bg-[#0F0608] rounded-full flex-row z-10">
              <View className="h-full bg-[#0d6e67] dark:bg-teal-400 rounded-full" style={{ width: `${stats.completionRate}%` }}></View>
            </View>
          </View>

          {/* Current Streak Card */}
          <View className="bg-[#f7eceb] dark:bg-[#271318] rounded-[32px] p-6 mb-4">
            <Text className="text-[9px] font-bold text-slate-500 dark:text-slate-400 tracking-widest uppercase mb-1">Current Streak</Text>
            <Text className="text-4xl font-black text-[#b91c1c] dark:text-rose-400 tracking-tighter mb-6">{stats.currentStreak} Days</Text>
            
            <View className="flex-row items-center justify-between w-[90%] gap-2">
              {[...Array(5)].map((_, i) => (
                <View key={i} style={{ flex: 1, height: 6, borderRadius: 999, backgroundColor: i < Math.min(stats.currentStreak, 5) ? (isDark ? '#fecdd3' : '#b91c1c') : (isDark ? 'rgba(15,6,8,0.6)' : '#eebdbd') }}></View>
              ))}
            </View>
          </View>

          {/* Dares Mastered Card */}
          <View className="bg-[#ab2f33] dark:bg-indigo-900 rounded-[32px] p-6">
            <Text className="text-[9px] font-bold text-white/80 tracking-widest uppercase mb-1">Dares Mastered</Text>
            <Text className="text-5xl font-black text-white tracking-tighter mb-6">{stats.daresMastered}</Text>
            <Text className="text-[13px] font-medium text-white/90">You&apos;re doing great!</Text>
          </View>
        </View>

        {/* Filter Pills */}
        <View className="flex-row flex-wrap gap-2 mb-8 justify-center">
          {filterPills.map(pill => {
            const isActive = activeFilter === pill.value;
            return (
              <TouchableOpacity
                key={pill.value}
                onPress={() => setActiveFilter(pill.value)}
                style={{
                  backgroundColor: isActive ? '#ab2f33' : (isDark ? '#271318' : '#ede4e3'),
                  paddingHorizontal: isActive ? 24 : 20,
                  paddingVertical: 8,
                  borderRadius: 999,
                }}
              >
                <Text style={{
                  color: isActive ? '#ffffff' : (isDark ? '#94a3b8' : '#64748b'),
                  fontWeight: '700',
                  fontSize: 10,
                  letterSpacing: 2,
                  textTransform: 'uppercase',
                }}>
                  {pill.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Timeline Section */}
        <View className="relative">
          {/* Vertical Timeline Track */}
          <View className="absolute left-[5px] top-4 bottom-10 w-[1px]" style={{ borderStyle: 'dotted', borderWidth: 1, borderColor: isDark ? '#4c1d24' : '#eec5c5', opacity: 0.6 }} />

          {filteredHistory.map((challenge, index) => {
            const { statusText, statusIcon, statusColor, dotColor } = getChallengeStatusInfo(challenge, myUserId, isDark);
            const isExpired = (challenge.status || '').toUpperCase() === 'EXPIRED';

            return (
              <View key={`${challenge.id}-${challenge.sent_at || index}`} className="mb-6 relative flex-row">
                <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: dotColor, position: 'absolute', left: 0, top: 20 }} />
                <View style={{
                  marginLeft: 24, flex: 1,
                  backgroundColor: isDark ? '#271318' : '#ffffff',
                  borderRadius: 28, overflow: 'hidden',
                  borderWidth: 1, borderColor: isDark ? 'rgba(136,19,55,0.2)' : 'rgba(248,240,240,0.8)',
                  opacity: isExpired ? 0.8 : 1,
                }}>
                  {challenge.image && !isExpired && (
                    <Image 
                      source={typeof challenge.image === 'string' ? { uri: challenge.image } : challenge.image} 
                      className="w-full h-32" 
                    />
                  )}
                  <View className="p-6">
                    <View className="flex-row justify-between items-center mb-3">
                      <Text style={{ color: isDark ? '#94a3b8' : '#94a3b8', fontSize: 9, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase' }}>
                        {formatChallengeDate(challenge.sent_at)}
                      </Text>
                      <View className="flex-row items-center">
                        <Ionicons name={statusIcon as any} size={13} color={statusColor} />
                        <Text style={{ color: statusColor }} className="text-[9px] font-bold tracking-widest uppercase ml-1.5">{statusText}</Text>
                      </View>
                    </View>
                    <Text style={{ color: isDark ? '#ffffff' : '#0f172a' }} className="text-xl font-bold tracking-tight mb-2">{challenge.title}</Text>
                    <Text style={{ color: isDark ? '#cbd5e1' : '#64748b' }} className="text-[13px] leading-5 font-medium mb-5">
                      {challenge.description}
                    </Text>
                    <View className="flex-row justify-between items-center pt-2" style={{ borderTopWidth: 1, borderTopColor: isDark ? 'rgba(136,19,55,0.2)' : 'rgba(248,240,240,0.8)' }}>
                      <View className="flex-row items-center">
                        <Ionicons name="time" size={12} color={isDark ? "#f43f5e" : "#64748b"} />
                        <Text style={{ color: isDark ? '#94a3b8' : '#64748b' }} className="text-[10px] font-bold tracking-widest uppercase ml-1.5">{challenge.time}</Text>
                      </View>
                      <Text style={{ color: isDark ? '#fb7185' : '#ab2f33' }} className="text-[10px] font-bold tracking-widest uppercase">{challenge.category}</Text>
                    </View>
                  </View>
                </View>
              </View>
            );
          })}

          {filteredHistory.length === 0 && (
            <View className="mb-6 relative flex-row">
              <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#eec5c5', position: 'absolute', left: 0, top: 20 }} />
              <View style={{ marginLeft: 24, flex: 1, backgroundColor: isDark ? '#271318' : '#ffffff', borderRadius: 28, padding: 24, borderWidth: 1, borderColor: isDark ? 'rgba(136,19,55,0.2)' : 'rgba(248,240,240,0.8)' }}>
                <Text style={{ color: isDark ? '#ffffff' : '#0f172a' }} className="text-xl font-bold tracking-tight mb-2">
                  {activeFilter === 'ALL' ? 'No History Yet' : `No activity ${activeFilter === 'THIS_WEEK' ? 'this week' : 'last month'}`}
                </Text>
                <Text style={{ color: isDark ? '#94a3b8' : '#64748b' }} className="text-[13px] leading-5 font-medium">
                  {activeFilter === 'ALL' 
                    ? 'Challenges that are active, completed, or expired will appear here.'
                    : 'Try switching to "All" to see your full history.'}
                </Text>
              </View>
            </View>
          )}

        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
