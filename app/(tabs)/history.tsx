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

// Safe Date parser that handles ISO strings, SQL timestamps, and Unix timestamps
const parseDateSafely = (dateStr?: any): Date | null => {
  if (!dateStr) return null;
  if (dateStr instanceof Date) return isNaN(dateStr.getTime()) ? null : dateStr;
  if (typeof dateStr === 'number') {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof dateStr === 'string') {
    const trimmed = dateStr.trim();
    if (!trimmed) return null;
    
    // 1. Direct try
    let d = new Date(trimmed);
    if (!isNaN(d.getTime())) return d;

    // 2. Fix SQL timestamp format "YYYY-MM-DD HH:mm:ss" -> "YYYY-MM-DDTHH:mm:ss"
    const iso = trimmed.replace(' ', 'T');
    d = new Date(iso);
    if (!isNaN(d.getTime())) return d;

    // 3. Append 'Z' if missing timezone offset
    if (!iso.endsWith('Z') && !iso.includes('+') && !/[-+]\d{2}:\d{2}$/.test(iso)) {
      d = new Date(iso + 'Z');
      if (!isNaN(d.getTime())) return d;
    }
  }
  return null;
};

// Format exact time for individual cards in the user's local device timezone
const formatCardTime = (challenge: SentChallenge): string => {
  // 1. Check primary sent_at / created_at timestamps
  const rawDateStr = challenge.sent_at || (challenge as any).created_at;
  const parsedDate = parseDateSafely(rawDateStr);
  if (parsedDate) {
    return parsedDate.toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }

  // 2. If challenge.time was provided
  if (challenge.time && typeof challenge.time === 'string') {
    // Check if challenge.time is a duration string like "30 mins", "15 mins", "1 hour"
    const isDuration = /min|hour|sec/i.test(challenge.time);
    if (!isDuration) {
      const parsedTime = parseDateSafely(challenge.time);
      if (parsedTime) {
        return parsedTime.toLocaleTimeString([], {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });
      }
      return challenge.time;
    }
  }

  return 'Recently';
};

// Format date helper for WhatsApp-like date pills
const getDateLabel = (dateStr?: string) => {
  const date = parseDateSafely(dateStr);
  if (!date) return 'Recent';

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

const [activeRoomInfo, setActiveRoomInfo] = useState<{ id: string; code: string; partnerName: string; partnerAvatar: string | null; status: string } | null>(null);

const calculateStats = (currentRoomHistory: SentChallenge[]) => {
  const daresMastered = currentRoomHistory.filter(
    c => (c.status || '').toUpperCase() === 'COMPLETED' || (c.status || '').toUpperCase() === 'CONFIRMED'
  ).length;
  const total = currentRoomHistory.length;
  const completionRate = total > 0 ? Math.round((daresMastered / total) * 100) : 0;

  let currentStreak = 0;
  if (currentRoomHistory.length > 0) {
    const dates = currentRoomHistory
      .map(c => parseDateSafely(c.sent_at || (c as any).created_at))
      .filter((d): d is Date => d !== null)
      .map(d => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime())
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

      // 2. Resolve Active Room ID first (network -> cached)
      let activeRoom: any = null;
      try {
        activeRoom = await getActiveRoom();
      } catch (e) {
        // network error or 404
      }

      if (!activeRoom) {
        try {
          const cachedRoomRaw = await AsyncStorage.getItem('cachedActiveRoom');
          if (cachedRoomRaw) {
            activeRoom = JSON.parse(cachedRoomRaw);
          }
        } catch (e) {}
      }

      const activeRoomId = activeRoom?.id || null;

      // If user is not currently in any room, clear history
      if (!activeRoomId) {
        setChallengeHistory([]);
        setActiveRoomInfo(null);
        setStats({ completionRate: 0, currentStreak: 0, daresMastered: 0, totalCards: 0 });
        setLoading(false);
        if (showRefreshing) setRefreshing(false);
        return;
      }

      const isHost = activeRoom.host_id === currentUserId;
      const partnerName = isHost 
        ? (activeRoom.partner_name || activeRoom.partner?.first_name || activeRoom.partner?.full_name || 'Partner')
        : (activeRoom.host_name || activeRoom.host?.first_name || activeRoom.host?.full_name || 'Partner');
      const partnerAvatar = isHost
        ? (activeRoom.partner_avatar || activeRoom.partner?.avatar_url)
        : (activeRoom.host_avatar || activeRoom.host?.avatar_url);

      const storedPartnerName = await AsyncStorage.getItem(`partnerName_${activeRoomId}`);
      const resolvedPartnerName = storedPartnerName || partnerName || 'Partner';

      const currentRoomData = {
        id: activeRoomId,
        code: activeRoom.code || 'GAME',
        partnerName: resolvedPartnerName,
        partnerAvatar: partnerAvatar || null,
        status: activeRoom.status || 'ACTIVE'
      };

      setActiveRoomInfo(currentRoomData);

      const cacheKey = `cached_active_room_history_${activeRoomId}`;

      // Helper: Enrich an item with current room info
      const enrichItem = (item: SentChallenge): SentChallenge => {
        return {
          ...item,
          room_id: activeRoomId,
          room_code: (!item.room_code || item.room_code === 'GAME' || item.room_code === 'ROOM') 
            ? currentRoomData.code 
            : item.room_code,
          partner_name: (!item.partner_name || item.partner_name === 'Partner') 
            ? currentRoomData.partnerName 
            : item.partner_name,
          partner_avatar: (!item.partner_avatar) 
            ? currentRoomData.partnerAvatar 
            : item.partner_avatar,
          room_status: currentRoomData.status,
        };
      };

      // 3. Read instant cache for current room if not refreshing
      if (!showRefreshing) {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed)) {
              const enriched = parsed.map(enrichItem);
              setChallengeHistory(enriched);
              calculateStats(enriched);
            }
          } catch (e) {
            console.log('Cache parse error:', e);
          }
        }
      }

      // 4. Fetch history specifically for active room ID
      let freshHistory: SentChallenge[] = [];
      try {
        freshHistory = await fetchRoomHistory(activeRoomId);
      } catch (err) {
        console.log('Fetch room history API error:', err);
      }

      // 5. Fallback to activeRoom.game_state.challenge_history if empty
      if (!Array.isArray(freshHistory) || freshHistory.length === 0) {
        if (activeRoom?.game_state?.challenge_history) {
          freshHistory = activeRoom.game_state.challenge_history.map((item: SentChallenge) => ({
            ...item,
            room_id: activeRoomId,
            room_code: currentRoomData.code,
            room_status: currentRoomData.status,
            partner_name: currentRoomData.partnerName,
            partner_avatar: currentRoomData.partnerAvatar,
          }));
        }
      }

      // 6. Filter strictly to current active room only
      const currentRoomOnly = Array.isArray(freshHistory)
        ? freshHistory.filter(item => !item.room_id || item.room_id === activeRoomId)
        : [];

      const enriched = currentRoomOnly.map(enrichItem);
      setChallengeHistory(enriched);
      calculateStats(enriched);

      if (enriched.length > 0) {
        await AsyncStorage.setItem(cacheKey, JSON.stringify(enriched));
      }
    } catch (error) {
      console.log('Failed to load history for active room:', error);
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

  interface ChallengeStatusDetail {
    statusText: string;
    statusIcon: keyof typeof Ionicons.glyphMap;
    statusColor: string;
    statusBg: string;
    bannerBg: string;
    bannerBorderColor: string;
    accentColor: string;
    headline: string;
    subtext: string;
    actionLabel?: string;
    isCompleted: boolean;
    isIncomplete: boolean;
  }

  const getChallengeStatusDetail = (
    challenge: SentChallenge,
    userId: string | null,
    darkScheme: boolean,
    partnerName: string = 'Partner'
  ): ChallengeStatusDetail => {
    const rawStatus = (challenge.status || 'SENT').toUpperCase();
    const isSender = challenge.is_sent_by_me ?? (challenge.sender_id ? challenge.sender_id === userId : true);

    // Case 1: Fully Completed & Confirmed
    if (rawStatus === 'COMPLETED' || rawStatus === 'CONFIRMED') {
      return {
        headline: isSender
          ? 'Card Completed • Dare Mastered 🎉'
          : 'Card Completed • You Mastered This Dare! 🎉',
        subtext: isSender
          ? `${partnerName} finished this dare and it was confirmed.`
          : `You completed this dare and ${partnerName} confirmed it.`,
        statusText: isSender ? 'Completed' : 'Mastered',
        actionLabel: isSender ? 'Dare Mastered' : 'Dare Won',
        statusIcon: 'checkmark-circle',
        statusColor: darkScheme ? '#2dd4bf' : '#0d6e67',
        statusBg: darkScheme ? 'rgba(45,212,191,0.18)' : '#e6f7f5',
        bannerBg: darkScheme ? 'rgba(45,212,191,0.09)' : '#f0fdf9',
        bannerBorderColor: darkScheme ? 'rgba(45,212,191,0.25)' : '#ccfbf1',
        accentColor: '#10b981',
        isCompleted: true,
        isIncomplete: false,
      };
    }

    // Case 2: Completed by Receiver, awaiting Sender's Confirmation
    if (rawStatus === 'COMPLETED_BY_RECEIVER') {
      return {
        headline: isSender
          ? 'Card is sent • Completed by partner, awaiting your confirmation'
          : "Card is done • You finished, awaiting partner's confirmation",
        subtext: isSender
          ? `${partnerName} finished this dare. Please confirm it in your active game session.`
          : `You completed this dare. Waiting for ${partnerName} to review & confirm.`,
        statusText: isSender ? 'Needs Confirm' : 'Under Review',
        actionLabel: isSender ? 'Action Required' : 'Awaiting Review',
        statusIcon: 'checkbox',
        statusColor: darkScheme ? '#c084fc' : '#7e22ce',
        statusBg: darkScheme ? 'rgba(192,132,252,0.18)' : '#f3e8ff',
        bannerBg: darkScheme ? 'rgba(192,132,252,0.09)' : '#faf5ff',
        bannerBorderColor: darkScheme ? 'rgba(192,132,252,0.25)' : '#e9d5ff',
        accentColor: '#a855f7',
        isCompleted: false,
        isIncomplete: true,
      };
    }

    // Case 3: Accepted and In Progress (Active dare)
    if (rawStatus === 'ACCEPTED' || rawStatus === 'ACTIVE' || rawStatus === 'IN_PROGRESS') {
      return {
        headline: isSender
          ? 'Card is sent • Accepted by partner, not complete yet'
          : 'Card received • You accepted, not complete yet',
        subtext: isSender
          ? `${partnerName} accepted your dare and is currently completing the challenge.`
          : `You accepted this dare from ${partnerName}. Complete it in the dashboard to finish!`,
        statusText: 'In Progress',
        actionLabel: isSender ? 'Partner in Action' : 'Your Turn to Play',
        statusIcon: 'flame',
        statusColor: darkScheme ? '#fb7185' : '#e11d48',
        statusBg: darkScheme ? 'rgba(251,113,133,0.18)' : '#ffe4e6',
        bannerBg: darkScheme ? 'rgba(251,113,133,0.09)' : '#fff1f2',
        bannerBorderColor: darkScheme ? 'rgba(251,113,133,0.25)' : '#fecdd3',
        accentColor: '#f43f5e',
        isCompleted: false,
        isIncomplete: true,
      };
    }

    // Case 4: Deflected with Shield
    if (rawStatus === 'DEFLECTED') {
      return {
        headline: isSender
          ? 'Card is sent • Deflected by partner (Not completed)'
          : 'Card received • Deflected with your Shield card',
        subtext: isSender
          ? `${partnerName} used a Deflect Shield card to safely skip this dare.`
          : 'You blocked this dare using a Deflect Shield card.',
        statusText: 'Deflected',
        actionLabel: isSender ? 'Shield Used' : 'Shielded',
        statusIcon: 'shield-checkmark',
        statusColor: darkScheme ? '#818cf8' : '#4f46e5',
        statusBg: darkScheme ? 'rgba(129,140,248,0.18)' : '#e0e7ff',
        bannerBg: darkScheme ? 'rgba(129,140,248,0.09)' : '#eef2ff',
        bannerBorderColor: darkScheme ? 'rgba(129,140,248,0.25)' : '#c7d2fe',
        accentColor: '#6366f1',
        isCompleted: false,
        isIncomplete: false,
      };
    }

    // Case 5: Rejected / Declined
    if (rawStatus === 'REJECTED' || rawStatus === 'DECLINED') {
      return {
        headline: isSender
          ? 'Card is sent • Declined by partner (Not completed)'
          : 'Card received • You declined this dare',
        subtext: isSender
          ? `${partnerName} chose not to accept this dare.`
          : `You chose to decline this dare from ${partnerName}.`,
        statusText: 'Declined',
        actionLabel: isSender ? 'Passed' : 'Declined by You',
        statusIcon: 'close-circle',
        statusColor: darkScheme ? '#f87171' : '#dc2626',
        statusBg: darkScheme ? 'rgba(248,113,113,0.18)' : '#fee2e2',
        bannerBg: darkScheme ? 'rgba(248,113,113,0.09)' : '#fef2f2',
        bannerBorderColor: darkScheme ? 'rgba(248,113,113,0.25)' : '#fecaca',
        accentColor: '#ef4444',
        isCompleted: false,
        isIncomplete: false,
      };
    }

    // Case 6: Expired / Penalty
    if (rawStatus === 'EXPIRED' || rawStatus === 'PENALTY') {
      return {
        headline: isSender
          ? 'Card is sent • Expired before completion'
          : 'Card received • Expired before completion',
        subtext: isSender
          ? 'The time window or session ended before this dare was fulfilled.'
          : 'Time limit passed before this dare was completed.',
        statusText: 'Expired',
        actionLabel: 'Time Expired',
        statusIcon: 'time-outline',
        statusColor: darkScheme ? '#94a3b8' : '#64748b',
        statusBg: darkScheme ? 'rgba(148,163,184,0.18)' : '#f1f5f9',
        bannerBg: darkScheme ? 'rgba(148,163,184,0.09)' : '#f8fafc',
        bannerBorderColor: darkScheme ? 'rgba(148,163,184,0.25)' : '#e2e8f0',
        accentColor: '#94a3b8',
        isCompleted: false,
        isIncomplete: false,
      };
    }

    // Case 7: Default / Sent / Waiting for Acceptance (Pending state)
    return {
      headline: isSender
        ? 'Card is sent • Not complete yet (Awaiting acceptance)'
        : 'New Card received • Not complete yet (Awaiting your action)',
      subtext: isSender
        ? `You sent this dare to ${partnerName}. Waiting for them to accept the challenge.`
        : `${partnerName} challenged you! Head to Dashboard to accept and play.`,
      statusText: isSender ? 'Sent (Pending)' : 'Action Required',
      actionLabel: isSender ? 'Awaiting Partner' : 'Awaiting You',
      statusIcon: isSender ? 'paper-plane' : 'alert-circle',
      statusColor: isSender ? (darkScheme ? '#38bdf8' : '#0284c7') : (darkScheme ? '#fbbf24' : '#d97706'),
      statusBg: isSender
        ? (darkScheme ? 'rgba(56,189,248,0.18)' : '#e0f2fe')
        : (darkScheme ? 'rgba(251,191,36,0.18)' : '#fef3c7'),
      bannerBg: isSender
        ? (darkScheme ? 'rgba(56,189,248,0.09)' : '#f0f9ff')
        : (darkScheme ? 'rgba(251,191,36,0.09)' : '#fffbeb'),
      bannerBorderColor: isSender
        ? (darkScheme ? 'rgba(56,189,248,0.25)' : '#bae6fd')
        : (darkScheme ? 'rgba(251,191,36,0.25)' : '#fde68a'),
      accentColor: isSender ? '#0284c7' : '#f59e0b',
      isCompleted: false,
      isIncomplete: true,
    };
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
        <TouchableOpacity onPress={() => router.push('/profile')} activeOpacity={0.7} className="w-8 h-8 rounded-full bg-rose-500/10 dark:bg-rose-950/40 items-center justify-center border border-rose-200 dark:border-rose-950/30 p-0.5">
          <Image
            source={{ uri: userAvatar }}
            className="w-6 h-6"
            resizeMode="contain"
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
            Current Game Stats
          </Text>
          <Text className="text-[32px] leading-[38px] font-black w-full text-center text-slate-900 dark:text-white tracking-tight">
            Our <Text className="text-[#b91c1c] dark:text-rose-400 italic">Moments</Text> & Dares
          </Text>
          <Text className="text-xs text-slate-500 dark:text-slate-400 mt-1 text-center font-medium">
            Stats for your currently active room session
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
              Fetching active room history
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
                    const statusDetail = getChallengeStatusDetail(challenge, myUserId, isDark, roomGroup.partnerName);
                    const isExpired = (challenge.status || '').toUpperCase() === 'EXPIRED';

                    return (
                      <View
                        key={`${challenge.id}-${idx}`}
                        className="mb-4 rounded-2xl overflow-hidden border"
                        style={{
                          backgroundColor: isDark ? '#220e14' : '#ffffff',
                          borderColor: isDark ? 'rgba(136,19,55,0.3)' : 'rgba(244,228,228,0.9)',
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: isDark ? 0.35 : 0.06,
                          shadowRadius: 5,
                          elevation: 3,
                          opacity: isExpired ? 0.8 : 1,
                        }}
                      >
                        {/* ── TOP INDICATION BANNER (All Conditions Indicated) ── */}
                        <View
                          style={{
                            backgroundColor: statusDetail.bannerBg,
                            borderBottomWidth: 1,
                            borderBottomColor: statusDetail.bannerBorderColor,
                            borderLeftWidth: 4,
                            borderLeftColor: statusDetail.accentColor,
                            paddingHorizontal: 14,
                            paddingVertical: 10,
                          }}
                        >
                          {/* Row: Icon badge + Bold headline + Status Pill */}
                          <View className="flex-row items-center justify-between">
                            <View className="flex-row items-center gap-2 flex-1 mr-2">
                              <View
                                style={{
                                  width: 24,
                                  height: 24,
                                  borderRadius: 12,
                                  backgroundColor: statusDetail.statusBg,
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <Ionicons name={statusDetail.statusIcon} size={13} color={statusDetail.statusColor} />
                              </View>
                              <Text
                                style={{
                                  color: isDark ? '#ffffff' : '#0f172a',
                                  fontWeight: '800',
                                  fontSize: 12.5,
                                  letterSpacing: -0.2,
                                  flexShrink: 1,
                                }}
                                numberOfLines={1}
                              >
                                {statusDetail.headline}
                              </Text>
                            </View>

                            {/* Status Badge */}
                            <View
                              className="flex-row items-center gap-1 px-2.5 py-0.5 rounded-full"
                              style={{ backgroundColor: statusDetail.statusBg }}
                            >
                              <Text
                                className="text-[9px] font-black uppercase tracking-wider"
                                style={{ color: statusDetail.statusColor }}
                              >
                                {statusDetail.statusText}
                              </Text>
                            </View>
                          </View>

                          {/* Contextual description explaining the state */}
                          <Text
                            style={{
                              color: isDark ? '#cbd5e1' : '#475569',
                              fontSize: 11,
                              fontWeight: '500',
                              lineHeight: 16,
                              marginTop: 4,
                              marginLeft: 32,
                            }}
                          >
                            {statusDetail.subtext}
                          </Text>
                        </View>

                        {/* Direction & Action Attribution Sub-bar */}
                        <View
                          className="px-4 py-1.5 flex-row items-center justify-between"
                          style={{
                            backgroundColor: isSentByMe
                              ? (isDark ? 'rgba(225,29,72,0.06)' : '#fff8f8')
                              : (isDark ? 'rgba(14,165,233,0.06)' : '#f8fafc'),
                            borderBottomWidth: 1,
                            borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                          }}
                        >
                          <View className="flex-row items-center gap-1.5">
                            <Ionicons
                              name={isSentByMe ? 'paper-plane' : 'arrow-down-circle'}
                              size={12}
                              color={isSentByMe ? (isDark ? '#fb7185' : '#e11d48') : (isDark ? '#38bdf8' : '#0284c7')}
                            />
                            <Text
                              className="text-[10px] font-bold"
                              style={{
                                color: isSentByMe ? (isDark ? '#fb7185' : '#be123c') : (isDark ? '#38bdf8' : '#0369a1'),
                              }}
                            >
                              {isSentByMe
                                ? `Sent by You ➔ ${roomGroup.partnerName}`
                                : `Received from ${roomGroup.partnerName}`}
                            </Text>
                          </View>

                          {statusDetail.actionLabel ? (
                            <View
                              style={{
                                paddingHorizontal: 6,
                                paddingVertical: 1.5,
                                borderRadius: 4,
                                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 9,
                                  fontWeight: '700',
                                  color: isDark ? '#94a3b8' : '#64748b',
                                  textTransform: 'uppercase',
                                  letterSpacing: 0.3,
                                }}
                              >
                                {statusDetail.actionLabel}
                              </Text>
                            </View>
                          ) : null}
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
                                {formatCardTime(challenge)}
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
              <Ionicons name="game-controller-outline" size={32} color={isDark ? "#fda4af" : "#be123c"} />
            </View>
            <Text className="text-lg font-black text-slate-900 dark:text-white mb-2 text-center">
              {!activeRoomInfo
                ? 'No Active Room'
                : activeFilter === 'ALL'
                  ? `No Dares Yet in Room #${activeRoomInfo.code}`
                  : `No ${activeFilter.toLowerCase().replace('_', ' ')} dares`}
            </Text>
            <Text className="text-xs leading-5 text-slate-500 dark:text-slate-400 text-center font-medium max-w-[270px]">
              {!activeRoomInfo
                ? 'Join or create a room with your partner to start sending dares and track your live game journey!'
                : activeFilter === 'ALL'
                  ? `Send a dare card to ${activeRoomInfo.partnerName} to begin building your moments in this room! 💕`
                  : 'Try switching to "All Dares" to view all challenges in this room session.'}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
