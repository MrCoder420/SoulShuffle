import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, StatusBar, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { fetchRoomHistory, getActiveRoom, SentChallenge } from '@/services/roomService';
import { getMyProfileCached } from '@/services/authService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSidebar } from '@/context/SidebarContext';
import { useUserAvatar } from '@/hooks/use-user-avatar';

type FilterType = 'ALL' | 'SENT_BY_ME' | 'RECEIVED' | 'COMPLETED';

interface RoomGroup {
  roomId: string;
  roomCode: string;
  roomStatus: string;
  partnerName: string;
  partnerAvatar?: string | null;
  dateGroups: {
    dateLabel: string;
    items: SentChallenge[];
  }[];
}

export default function History() {
  const { openSidebar } = useSidebar();
  const userAvatar = useUserAvatar();
  const router = useRouter();
  const [challengeHistory, setChallengeHistory] = useState<SentChallenge[]>([]);
  const [stats, setStats] = useState({ completionRate: 0, currentStreak: 0, daresMastered: 0, totalCards: 0 });
  const [activeFilter, setActiveFilter] = useState<FilterType>('ALL');
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Format date helper for WhatsApp-like date pills
  const getDateLabel = (dateStr?: string) => {
    if (!dateStr) return 'Recent';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'Recent';

    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    if (isToday) return 'Today';
    if (isYesterday) return 'Yesterday';

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
    });
  };

  const calculateStats = (history: SentChallenge[]) => {
    const daresMastered = history.filter(
      c => (c.status || '').toUpperCase() === 'COMPLETED' || (c.status || '').toUpperCase() === 'CONFIRMED'
    ).length;
    const total = history.length;
    const completionRate = total > 0 ? Math.round((daresMastered / total) * 100) : 0;

    let currentStreak = 0;
    if (history.length > 0) {
      const dates = history
        .filter(c => c.sent_at)
        .map(c => new Date(c.sent_at!).setHours(0, 0, 0, 0))
        .filter(t => !isNaN(t))
        .sort((a, b) => b - a);

      const uniqueDates = [...new Set(dates)];
      const today = new Date().setHours(0, 0, 0, 0);
      const yesterday = today - 86400000;

      if (uniqueDates.length > 0 && (uniqueDates[0] === today || uniqueDates[0] === yesterday)) {
        currentStreak = 1;
        for (let i = 0; i < uniqueDates.length - 1; i++) {
          if (uniqueDates[i] - uniqueDates[i + 1] === 86400000) {
            currentStreak++;
          } else {
            break;
          }
        }
      }
    }

    setStats({ completionRate, currentStreak, daresMastered, totalCards: total });
  };

  const loadHistory = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    try {
      // 1. Get current user ID
      const profile = await getMyProfileCached();
      const currentUserId = profile?.id || null;
      if (currentUserId) {
        setMyUserId(currentUserId);
      }

      const cacheKey = currentUserId ? `cached_account_history_${currentUserId}` : 'cachedRoomHistory';

      // 2. Build a local room info map from device storage
      // This ensures we always have real room codes and partner names even if the backend returns placeholders
      const localRoomInfoMap = new Map<string, { code: string; partnerName: string; partnerAvatar: string | null; status: string }>();
      try {
        // Load the currently cached active room (if any)
        const cachedRoomRaw = await AsyncStorage.getItem('cachedActiveRoom');
        if (cachedRoomRaw) {
          const cachedRoom = JSON.parse(cachedRoomRaw);
          if (cachedRoom?.id && cachedRoom?.code) {
            const isHost = cachedRoom.host_id === currentUserId;
            const partnerName = isHost ? (cachedRoom.partner_name || cachedRoom.host_name) : (cachedRoom.host_name || cachedRoom.partner_name);
            const partnerAvatar = isHost ? (cachedRoom.partner_avatar || cachedRoom.host_avatar) : (cachedRoom.host_avatar || cachedRoom.partner_avatar);
            // Also check stored partnerName per room
            const storedPartnerName = await AsyncStorage.getItem(`partnerName_${cachedRoom.id}`);
            localRoomInfoMap.set(cachedRoom.id, {
              code: cachedRoom.code,
              partnerName: storedPartnerName || partnerName || 'Partner',
              partnerAvatar: partnerAvatar || null,
              status: cachedRoom.status || 'ACTIVE',
            });
          }
        }
      } catch (e) {
        console.log('[History] Local room info load error:', e);
      }

      // Helper: Enrich a history item using local room data if backend returned placeholder values
      const enrichItem = (item: SentChallenge): SentChallenge => {
        const localRoom = item.room_id ? localRoomInfoMap.get(item.room_id) : null;
        if (!localRoom) return item;

        return {
          ...item,
          room_code: (!item.room_code || item.room_code === 'GAME' || item.room_code === 'ROOM') 
            ? localRoom.code 
            : item.room_code,
          partner_name: (!item.partner_name || item.partner_name === 'Partner') 
            ? localRoom.partnerName 
            : item.partner_name,
          partner_avatar: (!item.partner_avatar) 
            ? localRoom.partnerAvatar 
            : item.partner_avatar,
          room_status: (!item.room_status) ? localRoom.status : item.room_status,
        };
      };

      // 3. Read instant cache if not refreshing
      if (!showRefreshing) {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const enriched = parsed.map(enrichItem);
              setChallengeHistory(enriched);
              calculateStats(enriched);
            }
          } catch (e) {
            console.log('Cache parse error:', e);
          }
        }
      }

      // 4. Fetch from backend
      let freshHistory: SentChallenge[] = [];
      try {
        freshHistory = await fetchRoomHistory();
      } catch (err) {
        console.log('Fetch room history API error:', err);
      }

      // 5. Fallback to active room game_state if backend returned nothing
      if (!Array.isArray(freshHistory) || freshHistory.length === 0) {
        try {
          const activeRoom = await getActiveRoom();
          if (activeRoom?.game_state?.challenge_history) {
            const isHost = activeRoom.host_id === currentUserId;
            const actualPartnerName = isHost ? activeRoom.partner_name : activeRoom.host_name;
            const actualPartnerAvatar = isHost ? activeRoom.partner_avatar : activeRoom.host_avatar;
            freshHistory = activeRoom.game_state.challenge_history.map((item: SentChallenge) => ({
              ...item,
              room_id: activeRoom.id,
              room_code: activeRoom.code,
              room_status: activeRoom.status,
              partner_name: actualPartnerName || 'Partner',
              partner_avatar: actualPartnerAvatar || null,
            }));
          }
        } catch (e) {
          // ignore
        }
      }

      // 6. Enrich all items with local room data to fix any placeholder values from the backend
      if (Array.isArray(freshHistory) && freshHistory.length > 0) {
        const enriched = freshHistory.map(enrichItem);
        setChallengeHistory(enriched);
        calculateStats(enriched);
        // Only cache if we have real data
        await AsyncStorage.setItem(cacheKey, JSON.stringify(enriched));
      }
    } catch (error) {
      console.log('Failed to load history:', error);
    } finally {
      if (showRefreshing) setRefreshing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
    const interval = setInterval(() => loadHistory(false), 20000);
    return () => clearInterval(interval);
  }, [loadHistory]);

  // Filter history
  const filteredHistory = useMemo(() => {
    return challengeHistory.filter(item => {
      const isSentByMe = item.is_sent_by_me ?? (myUserId ? item.sender_id === myUserId : true);
      const rawStatus = (item.status || 'SENT').toUpperCase();

      if (activeFilter === 'SENT_BY_ME') return isSentByMe;
      if (activeFilter === 'RECEIVED') return !isSentByMe;
      if (activeFilter === 'COMPLETED') return rawStatus === 'COMPLETED' || rawStatus === 'CONFIRMED';
      return true; // 'ALL'
    });
  }, [challengeHistory, activeFilter, myUserId]);

  // Group by Room Session, then by Date (WhatsApp style)
  const roomGroups = useMemo<RoomGroup[]>(() => {
    const groupsMap = new Map<string, {
      roomId: string;
      roomCode: string;
      roomStatus: string;
      partnerName: string;
      partnerAvatar?: string | null;
      items: SentChallenge[];
    }>();

    filteredHistory.forEach(item => {
      const roomId = item.room_id || 'active_session';
      const roomCode = item.room_code || 'ROOM';
      const roomStatus = item.room_status || 'ACTIVE';
      const partnerName = item.partner_name || (item.is_sent_by_me ? (item.receiver_name || 'Partner') : (item.sender_name || 'Partner'));
      const partnerAvatar = item.partner_avatar || (item.is_sent_by_me ? item.receiver_avatar : item.sender_avatar) || null;

      if (!groupsMap.has(roomId)) {
        groupsMap.set(roomId, {
          roomId,
          roomCode,
          roomStatus,
          partnerName,
          partnerAvatar,
          items: []
        });
      }

      groupsMap.get(roomId)!.items.push(item);
    });

    const result: RoomGroup[] = [];

    groupsMap.forEach(group => {
      // Group cards in this room by Date
      const dateMap = new Map<string, SentChallenge[]>();
      group.items.forEach(item => {
        const dateKey = getDateLabel(item.sent_at);
        if (!dateMap.has(dateKey)) {
          dateMap.set(dateKey, []);
        }
        dateMap.get(dateKey)!.push(item);
      });

      const dateGroups = Array.from(dateMap.entries()).map(([dateLabel, items]) => ({
        dateLabel,
        items
      }));

      result.push({
        roomId: group.roomId,
        roomCode: group.roomCode,
        roomStatus: group.roomStatus,
        partnerName: group.partnerName,
        partnerAvatar: group.partnerAvatar,
        dateGroups
      });
    });

    return result;
  }, [filteredHistory]);

  const getChallengeStatusInfo = (challenge: SentChallenge, userId: string | null, darkScheme: boolean) => {
    const rawStatus = (challenge.status || 'SENT').toUpperCase();
    const isSender = challenge.is_sent_by_me ?? (challenge.sender_id ? challenge.sender_id === userId : true);

    if (rawStatus === 'COMPLETED' || rawStatus === 'CONFIRMED') {
      return {
        statusText: 'Completed',
        statusIcon: 'checkmark-circle',
        statusColor: darkScheme ? '#2dd4bf' : '#0d6e67',
        statusBg: darkScheme ? 'rgba(45,212,191,0.15)' : '#e6f7f5',
        dotColor: '#2dd4bf',
      };
    }

    if (rawStatus === 'ACCEPTED' || rawStatus === 'ACTIVE' || rawStatus === 'IN_PROGRESS' || rawStatus === 'COMPLETED_BY_RECEIVER') {
      return {
        statusText: 'In Progress',
        statusIcon: 'flame',
        statusColor: darkScheme ? '#f43f5e' : '#e11d48',
        statusBg: darkScheme ? 'rgba(244,63,94,0.15)' : '#ffe4e6',
        dotColor: '#ff2d55',
      };
    }

    if (rawStatus === 'DEFLECTED') {
      return {
        statusText: 'Deflected',
        statusIcon: 'shield-checkmark',
        statusColor: darkScheme ? '#818cf8' : '#4f46e5',
        statusBg: darkScheme ? 'rgba(129,140,248,0.15)' : '#e0e7ff',
        dotColor: '#6366f1',
      };
    }

    if (rawStatus === 'REJECTED' || rawStatus === 'DECLINED') {
      return {
        statusText: 'Declined',
        statusIcon: 'close-circle',
        statusColor: darkScheme ? '#f87171' : '#dc2626',
        statusBg: darkScheme ? 'rgba(248,113,113,0.15)' : '#fee2e2',
        dotColor: '#ef4444',
      };
    }

    if (rawStatus === 'EXPIRED') {
      return {
        statusText: 'Expired',
        statusIcon: 'time',
        statusColor: darkScheme ? '#94a3b8' : '#64748b',
        statusBg: darkScheme ? 'rgba(148,163,184,0.15)' : '#f1f5f9',
        dotColor: darkScheme ? '#475569' : '#cbd5e1',
      };
    }

    // Default / Pending state
    if (isSender) {
      return {
        statusText: 'Sent',
        statusIcon: 'paper-plane',
        statusColor: darkScheme ? '#38bdf8' : '#0284c7',
        statusBg: darkScheme ? 'rgba(56,189,248,0.15)' : '#e0f2fe',
        dotColor: '#0284c7',
      };
    } else {
      return {
        statusText: 'Received',
        statusIcon: 'download',
        statusColor: darkScheme ? '#fbbf24' : '#d97706',
        statusBg: darkScheme ? 'rgba(251,191,36,0.15)' : '#fef3c7',
        dotColor: '#fbbf24',
      };
    }
  };

  const filterPills: { label: string; value: FilterType; icon: any }[] = [
    { label: 'All Dares', value: 'ALL', icon: 'layers-outline' },
    { label: 'Sent by You', value: 'SENT_BY_ME', icon: 'paper-plane-outline' },
    { label: 'Received', value: 'RECEIVED', icon: 'download-outline' },
    { label: 'Completed', value: 'COMPLETED', icon: 'checkmark-done-outline' },
  ];

  return (
    <SafeAreaView className="flex-1 bg-[#fffaf9] dark:bg-[#0F0608]" edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={isDark ? "#0F0608" : "#fffaf9"} />

      {/* Header */}
      <View className="flex-row items-center justify-between px-6 pt-5 pb-3 bg-[#fffaf9] dark:bg-[#0F0608] z-10 border-b border-rose-100/50 dark:border-rose-950/20">
        <TouchableOpacity onPress={openSidebar} activeOpacity={0.7} className="p-1">
          <Ionicons name="menu-outline" size={28} color={isDark ? "#fff" : "#9f1239"} />
        </TouchableOpacity>
        <View className="flex-row items-center gap-1.5">
          <Ionicons name="hourglass" size={24} color={isDark ? "#fda4af" : "#be123c"} />
          <Text className="text-[#a12338] dark:text-rose-400 font-black text-xl tracking-tight">Game Journey</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/profile')} activeOpacity={0.7}>
          <Image
            source={{ uri: userAvatar }}
            className="w-8 h-8 rounded-full border border-rose-200 dark:border-rose-950/30"
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 160, paddingTop: 14 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadHistory(true)}
            tintColor={isDark ? "#fb7185" : "#e11d48"}
            colors={["#e11d48", "#0d6e67"]}
          />
        }
      >
        {/* Title Section */}
        <View className="mb-6 items-center">
          <Text className="text-[10px] font-bold text-[#b91c1c] dark:text-rose-400 tracking-[0.25em] uppercase w-full text-center mb-1.5">
            Complete Game Archive
          </Text>
          <Text className="text-[32px] leading-[38px] font-black w-full text-center text-slate-900 dark:text-white tracking-tight">
            Our <Text className="text-[#b91c1c] dark:text-rose-400 italic">Moments</Text> & Dares
          </Text>
          <Text className="text-xs text-slate-500 dark:text-slate-400 mt-1 text-center font-medium">
            All past & current rooms across your account
          </Text>
        </View>

        {/* Stats Cards Row */}
        <View className="flex-row gap-3 mb-6">
          {/* Completion Rate */}
          <View className="flex-1 bg-[#f7eceb] dark:bg-[#271318] rounded-2xl p-4 relative overflow-hidden border border-rose-200/50 dark:border-rose-950/30">
            <Text className="text-[9px] font-bold text-slate-500 dark:text-slate-400 tracking-wider uppercase mb-1">Completion</Text>
            <Text className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{stats.completionRate}%</Text>
            <View className="w-full h-1.5 bg-slate-200/80 dark:bg-slate-800 rounded-full mt-2 overflow-hidden">
              <View className="h-full bg-teal-600 dark:bg-teal-400 rounded-full" style={{ width: `${stats.completionRate}%` }} />
            </View>
          </View>

          {/* Current Streak */}
          <View className="flex-1 bg-[#f7eceb] dark:bg-[#271318] rounded-2xl p-4 border border-rose-200/50 dark:border-rose-950/30">
            <Text className="text-[9px] font-bold text-slate-500 dark:text-slate-400 tracking-wider uppercase mb-1">Active Streak</Text>
            <Text className="text-2xl font-black text-[#b91c1c] dark:text-rose-400 tracking-tight">{stats.currentStreak} <Text className="text-xs font-semibold text-slate-500">Days</Text></Text>
            <View className="flex-row items-center gap-1 mt-2">
              {[...Array(5)].map((_, i) => (
                <View
                  key={i}
                  style={{
                    flex: 1,
                    height: 4,
                    borderRadius: 999,
                    backgroundColor: i < Math.min(stats.currentStreak, 5) ? (isDark ? '#f43f5e' : '#b91c1c') : (isDark ? '#3b1c24' : '#e5d5d3')
                  }}
                />
              ))}
            </View>
          </View>

          {/* Dares Mastered */}
          <View className="flex-1 bg-[#ab2f33] dark:bg-rose-950 rounded-2xl p-4">
            <Text className="text-[9px] font-bold text-white/80 tracking-wider uppercase mb-1">Mastered</Text>
            <Text className="text-2xl font-black text-white tracking-tight">{stats.daresMastered}</Text>
            <Text className="text-[10px] text-white/70 font-medium mt-1">Dares Won 🎉</Text>
          </View>
        </View>

        {/* Filter Pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-6" contentContainerStyle={{ gap: 8, paddingHorizontal: 2 }}>
          {filterPills.map(pill => {
            const isActive = activeFilter === pill.value;
            return (
              <TouchableOpacity
                key={pill.value}
                onPress={() => setActiveFilter(pill.value)}
                activeOpacity={0.8}
                className="flex-row items-center gap-1.5 px-4 py-2 rounded-full"
                style={{
                  backgroundColor: isActive ? '#ab2f33' : (isDark ? '#271318' : '#ede4e3'),
                }}
              >
                <Ionicons
                  name={pill.icon}
                  size={14}
                  color={isActive ? '#ffffff' : (isDark ? '#94a3b8' : '#64748b')}
                />
                <Text
                  style={{
                    color: isActive ? '#ffffff' : (isDark ? '#94a3b8' : '#64748b'),
                    fontWeight: '700',
                    fontSize: 11,
                    letterSpacing: 0.5,
                  }}
                >
                  {pill.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Room Sessions Timeline (Grouped by Room and Date) */}
        {(loading && challengeHistory.length === 0) ? (
          <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 60 }}>
            <View style={{
              width: 56, height: 56, borderRadius: 28,
              backgroundColor: isDark ? 'rgba(225,29,72,0.15)' : 'rgba(225,29,72,0.08)',
              alignItems: 'center', justifyContent: 'center', marginBottom: 16
            }}>
              <Ionicons name="hourglass-outline" size={26} color={isDark ? '#fda4af' : '#be123c'} />
            </View>
            <Text style={{ color: isDark ? '#fda4af' : '#be123c', fontWeight: '800', fontSize: 15, marginBottom: 6 }}>
              Loading Your Journey...
            </Text>
            <Text style={{ color: isDark ? '#94a3b8' : '#64748b', fontSize: 12, textAlign: 'center' }}>
              Fetching your room history
            </Text>
          </View>
        ) : roomGroups.length === 0 ? (
          <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 60 }}>
            <View style={{
              width: 56, height: 56, borderRadius: 28,
              backgroundColor: isDark ? 'rgba(225,29,72,0.15)' : 'rgba(225,29,72,0.08)',
              alignItems: 'center', justifyContent: 'center', marginBottom: 16
            }}>
              <Ionicons name="game-controller-outline" size={26} color={isDark ? '#fda4af' : '#be123c'} />
            </View>
            <Text style={{ color: isDark ? '#fda4af' : '#be123c', fontWeight: '800', fontSize: 15, marginBottom: 6 }}>
              No History Yet
            </Text>
            <Text style={{ color: isDark ? '#94a3b8' : '#64748b', fontSize: 12, textAlign: 'center' }}>
              Join a room and send your first dare to get started!
            </Text>
          </View>
        ) : null}
        {!loading && roomGroups.map(roomGroup => {
          const isActiveRoom = roomGroup.roomStatus === 'ACTIVE' || roomGroup.roomStatus === 'WAITING';

          return (
            <View key={roomGroup.roomId} className="mb-8">
              {/* WhatsApp-Style Room Header Banner */}
              <View
                className="rounded-2xl p-3.5 mb-4 flex-row items-center justify-between border"
                style={{
                  backgroundColor: isDark ? '#1a0d11' : '#fcedee',
                  borderColor: isDark ? 'rgba(225,29,72,0.2)' : 'rgba(225,29,72,0.15)',
                }}
              >
                <View className="flex-row items-center gap-2.5">
                  <View className="w-8 h-8 rounded-full bg-rose-500/20 items-center justify-center">
                    <Ionicons name="game-controller" size={16} color={isDark ? "#fda4af" : "#be123c"} />
                  </View>
                  <View>
                    <View className="flex-row items-center gap-2">
                      <Text className="text-xs font-black tracking-wider text-slate-900 dark:text-white uppercase">
                        Room #{roomGroup.roomCode}
                      </Text>
                      <View
                        className="px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: isActiveRoom ? 'rgba(16,185,129,0.15)' : 'rgba(100,116,139,0.15)',
                        }}
                      >
                        <Text
                          className="text-[9px] font-bold uppercase tracking-wider"
                          style={{ color: isActiveRoom ? '#10b981' : '#64748b' }}
                        >
                          {isActiveRoom ? '🟢 Active' : '⚪ Session Ended'}
                        </Text>
                      </View>
                    </View>
                    <Text className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                      Partner: <Text className="font-bold text-rose-600 dark:text-rose-400">{roomGroup.partnerName}</Text>
                    </Text>
                  </View>
                </View>

                {roomGroup.partnerAvatar && (
                  <Image
                    source={{ uri: roomGroup.partnerAvatar }}
                    className="w-7 h-7 rounded-full border border-rose-300 dark:border-rose-800"
                  />
                )}
              </View>

              {/* Date Groups inside Room */}
              {roomGroup.dateGroups.map(dateGroup => (
                <View key={dateGroup.dateLabel} className="mb-4">
                  {/* WhatsApp-Style Centered Date Bubble */}
                  <View className="items-center my-2">
                    <View
                      className="px-3.5 py-1 rounded-full border"
                      style={{
                        backgroundColor: isDark ? '#271318' : '#ede4e3',
                        borderColor: isDark ? 'rgba(225,29,72,0.15)' : 'rgba(0,0,0,0.05)',
                      }}
                    >
                      <Text
                        className="text-[10px] font-bold tracking-wider uppercase"
                        style={{ color: isDark ? '#fda4af' : '#7f1d1d' }}
                      >
                        📅 {dateGroup.dateLabel}
                      </Text>
                    </View>
                  </View>

                  {/* Cards for this Date */}
                  {dateGroup.items.map((challenge, idx) => {
                    const isSentByMe = challenge.is_sent_by_me ?? (myUserId ? challenge.sender_id === myUserId : true);
                    const { statusText, statusIcon, statusColor, statusBg } = getChallengeStatusInfo(challenge, myUserId, isDark);
                    const isExpired = (challenge.status || '').toUpperCase() === 'EXPIRED';

                    return (
                      <View
                        key={`${challenge.id}-${idx}`}
                        className="mb-3 rounded-2xl overflow-hidden border"
                        style={{
                          backgroundColor: isDark ? '#220e14' : '#ffffff',
                          borderColor: isDark ? 'rgba(136,19,55,0.25)' : 'rgba(244,228,228,0.9)',
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: isDark ? 0.3 : 0.05,
                          shadowRadius: 4,
                          elevation: 2,
                          opacity: isExpired ? 0.75 : 1,
                        }}
                      >
                        {/* Direction Bar: Sent vs Received */}
                        <View
                          className="px-4 py-2 flex-row items-center justify-between"
                          style={{
                            backgroundColor: isSentByMe
                              ? (isDark ? 'rgba(225,29,72,0.12)' : '#fff1f2')
                              : (isDark ? 'rgba(14,165,233,0.12)' : '#f0f9ff'),
                            borderBottomWidth: 1,
                            borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                          }}
                        >
                          <View className="flex-row items-center gap-1.5">
                            <Ionicons
                              name={isSentByMe ? 'paper-plane' : 'arrow-down-circle'}
                              size={14}
                              color={isSentByMe ? (isDark ? '#fb7185' : '#e11d48') : (isDark ? '#38bdf8' : '#0284c7')}
                            />
                            <Text
                              className="text-[11px] font-bold"
                              style={{
                                color: isSentByMe ? (isDark ? '#fb7185' : '#be123c') : (isDark ? '#38bdf8' : '#0369a1'),
                              }}
                            >
                              {isSentByMe
                                ? `Sent by You ➔ to ${roomGroup.partnerName}`
                                : `Received from ${roomGroup.partnerName}`}
                            </Text>
                          </View>

                          {/* Status Badge */}
                          <View
                            className="flex-row items-center gap-1 px-2.5 py-0.5 rounded-full"
                            style={{ backgroundColor: statusBg }}
                          >
                            <Ionicons name={statusIcon as any} size={11} color={statusColor} />
                            <Text
                              className="text-[9px] font-black uppercase tracking-wider"
                              style={{ color: statusColor }}
                            >
                              {statusText}
                            </Text>
                          </View>
                        </View>

                        {/* Card Image (if any) */}
                        {challenge.image && !isExpired && (
                          <Image
                            source={typeof challenge.image === 'string' ? { uri: challenge.image } : challenge.image}
                            className="w-full h-32"
                            resizeMode="cover"
                          />
                        )}

                        {/* Card Details */}
                        <View className="p-4">
                          <View className="flex-row items-center justify-between mb-1.5">
                            <Text
                              className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md"
                              style={{
                                backgroundColor: isDark ? 'rgba(244,63,94,0.15)' : '#ffe4e6',
                                color: isDark ? '#fb7185' : '#be123c',
                              }}
                            >
                              {challenge.category || 'Dare'}
                            </Text>
                            <View className="flex-row items-center gap-1">
                              <Ionicons name="time-outline" size={12} color={isDark ? '#94a3b8' : '#64748b'} />
                              <Text className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                                {challenge.time || 'Recently'}
                              </Text>
                            </View>
                          </View>

                          <Text className="text-lg font-black tracking-tight text-slate-900 dark:text-white mb-1">
                            {challenge.title}
                          </Text>

                          {challenge.description ? (
                            <Text className="text-xs leading-5 text-slate-600 dark:text-slate-300 font-medium mb-3">
                              {challenge.description}
                            </Text>
                          ) : null}

                          {/* Personal Love Note / Message if attached */}
                          {challenge.message ? (
                            <View
                              className="p-3 rounded-xl flex-row items-start gap-2 mt-1 mb-2 border"
                              style={{
                                backgroundColor: isDark ? '#2d131a' : '#fef2f2',
                                borderColor: isDark ? 'rgba(244,63,94,0.2)' : '#fecdd3',
                              }}
                            >
                              <Ionicons name="heart" size={14} color={isDark ? "#fb7185" : "#e11d48"} style={{ marginTop: 2 }} />
                              <View className="flex-1">
                                <Text className="text-[9px] font-bold uppercase tracking-wider text-rose-500 dark:text-rose-400 mb-0.5">
                                  Note from {isSentByMe ? 'You' : roomGroup.partnerName}:
                                </Text>
                                <Text className="text-xs italic text-slate-700 dark:text-rose-100">
                                  &ldquo;{challenge.message}&rdquo;
                                </Text>
                              </View>
                            </View>
                          ) : null}
                        </View>
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
          );
        })}

        {/* Empty State */}
        {roomGroups.length === 0 && (
          <View
            className="rounded-3xl p-8 items-center border"
            style={{
              backgroundColor: isDark ? '#271318' : '#ffffff',
              borderColor: isDark ? 'rgba(136,19,55,0.2)' : 'rgba(248,240,240,0.8)',
            }}
          >
            <View className="w-16 h-16 rounded-full bg-rose-500/10 items-center justify-center mb-4">
              <Ionicons name="file-tray-outline" size={32} color={isDark ? "#fda4af" : "#be123c"} />
            </View>
            <Text className="text-lg font-black text-slate-900 dark:text-white mb-2 text-center">
              {activeFilter === 'ALL' ? 'No Dare History Yet' : `No ${activeFilter.toLowerCase().replace('_', ' ')} dares`}
            </Text>
            <Text className="text-xs leading-5 text-slate-500 dark:text-slate-400 text-center font-medium max-w-[260px]">
              {activeFilter === 'ALL'
                ? 'Send a dare card to your partner or complete active challenges to build your journey archive! 💕'
                : 'Try switching to "All Dares" to see your full game archive.'}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
