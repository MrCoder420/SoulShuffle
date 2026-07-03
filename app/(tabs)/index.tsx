import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, SafeAreaView, Platform, StatusBar, TextInput, ActivityIndicator, Alert, AppState, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { createRoom, joinRoom, getActiveRoom, fetchCardSends, acceptCardSend, rejectCardSend, completeCardSend, confirmCardSend, rejectCardSendReal, Room, ExpiryType } from '@/services/roomService';
import GameSocket from '@/services/socketService';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSidebar } from '@/context/SidebarContext';
import { getMyProfile } from '@/services/authService';

import CountdownTimer from '@/components/CountdownTimer';

const coupleCover = require('@/assets/images/couple_cover.jpeg');

// Helper to normalize the card send records from the backend API
const normalizeSendRecord = (send: any) => {
  if (!send) return null;
  if (send.card && !send.cards) return send;

  const cardObj = send.cards || {};
  const rawCat = cardObj.card_categories?.name || 'GENERAL';
  const cleanCategory = rawCat.split('_')[0].toUpperCase();
  
  const difficulty = (cardObj.attributes?.difficulty || 'MEDIUM').toUpperCase();
  const timeRequirement = cardObj.attributes?.time || '30 mins';
  const description = cardObj.power_description || cardObj.attributes?.description || 'No description available.';
  const title = cardObj.name || 'Unnamed Challenge';
  
  let imageUrl = cardObj.image_url || null;
  if (!imageUrl) {
    if (cleanCategory.includes('ROMANCE') || cleanCategory.includes('ROMANTIC')) {
      imageUrl = 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=400&h=300&fit=crop';
    } else {
      imageUrl = 'https://images.unsplash.com/photo-1517263904808-5dc91e3e7044?w=400&h=300&fit=crop';
    }
  }

  return {
    ...send,
    created_at: send.sent_at || send.created_at || new Date().toISOString(),
    card: {
      title,
      category: cleanCategory,
      difficulty,
      time_requirement: timeRequirement,
      description,
      image_url: imageUrl,
    }
  };
};

const calculateStreak = (sends: any[]) => {
  if (!sends || sends.length === 0) return 0;
  
  // Extract unique local YYYY-MM-DD dates for each send
  const dates = Array.from(
    new Set(
      sends
        .map(s => {
          if (!s.created_at) return null;
          const d = new Date(s.created_at);
          if (isNaN(d.getTime())) return null;
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        })
        .filter(Boolean) as string[]
    )
  ).sort((a, b) => b.localeCompare(a)); // Sort descending (latest first)

  if (dates.length === 0) return 0;

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

  // If latest activity is not today and not yesterday, the streak is broken
  if (dates[0] !== todayStr && dates[0] !== yesterdayStr) {
    return 0;
  }

  let streak = 1;
  let currentDate = new Date(dates[0]);

  for (let i = 1; i < dates.length; i++) {
    const expectedPrevDate = new Date(currentDate);
    expectedPrevDate.setDate(expectedPrevDate.getDate() - 1);
    const expectedPrevStr = `${expectedPrevDate.getFullYear()}-${String(expectedPrevDate.getMonth() + 1).padStart(2, '0')}-${String(expectedPrevDate.getDate()).padStart(2, '0')}`;

    if (dates[i] === expectedPrevStr) {
      streak++;
      currentDate = expectedPrevDate;
    } else {
      break; // streak is broken
    }
  }

  return streak;
};

export default function Dashboard() {
  const { openSidebar } = useSidebar();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { width } = useWindowDimensions();

  // ── Room State ─────────────────────────────────────────
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [roomLoading, setRoomLoading] = useState(true);
  const [localPendingChallenges, setLocalPendingChallenges] = useState<any[]>([]);
  const [roomModalVisible, setRoomModalVisible] = useState(false);
  const [roomModalTab, setRoomModalTab] = useState<'create' | 'join'>('create');
  const [selectedExpiry, setSelectedExpiry] = useState<ExpiryType>('7_DAYS');
  const [joinCode, setJoinCode] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [cardSends, setCardSends] = useState<any[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState('Alex');
  
  // Find pending challenges
  const pendingChallenges = cardSends.filter(c => c.status === 'SENT') || [];
  const activeChallenges = cardSends.filter(c => c.status === 'IN_PROGRESS' || c.status === 'COMPLETED_BY_RECEIVER') || [];
  const activeChallenge = activeChallenges.length > 0 ? activeChallenges[0] : null;
  const completedChallenges = cardSends.filter(c => c.status === 'COMPLETED' || c.status === 'DEFLECTED' || c.status === 'EXPIRED') || [];
  
  const finishedDaresCount = cardSends.filter(c => c.status === 'COMPLETED').length;
  const currentStreak = calculateStreak(cardSends);
  
  // Dummy pending challenge for UI visualization if empty
  const displayPendingChallenges = pendingChallenges.length > 0 ? pendingChallenges : [
    {
      id: 'dummy-1',
      card: {
        title: 'Cook a Romantic Dinner',
        category: 'Acts of Service',
        difficulty: 'Medium',
        time_requirement: '1 hour',
        description: 'Prepare a nice meal with candles and soft music.',
        image_url: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=300&fit=crop'
      },
      status: 'SENT',
      created_at: new Date().toISOString()
    }
  ];

  // ── Fetch Active Room on Mount ─────────────────────────
  const fetchActiveRoom = useCallback(async (silent = false) => {
    try {
      if (!silent) {
        setRoomLoading(true);
      }
      try {
        const profile = await getMyProfile();
        setCurrentUserId(profile?.id || null);
        if (profile?.first_name || profile?.users?.name) {
          setUserName(profile.first_name || profile.users.name.split(' ')[0]);
        }
      } catch (err) {
        console.log('Failed to fetch profile in dashboard:', err);
      }
      const room = await getActiveRoom();
      setActiveRoom(room);
      if (room) {
        try {
          const sends = await fetchCardSends(room.id);
          const rawSends = sends?.sends || sends || [];
          setCardSends(rawSends.map(normalizeSendRecord).filter(Boolean));
        } catch (e) {
          console.log('Failed to fetch card sends:', e);
        }
      } else {
        setCardSends([]);
      }
    } catch (err) {
      console.log('Failed to fetch active room:', err);
    } finally {
      if (!silent) {
        setRoomLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchActiveRoom();
  }, [fetchActiveRoom]);

  // ── Socket Initialization & Lifecycle ───────────────────
  useEffect(() => {
    const setupSocket = async () => {
      if (activeRoom) {
        await GameSocket.initialize();
        GameSocket.joinRoom(activeRoom.code);
      }
    };
    setupSocket();
  }, [activeRoom?.code]);

  useEffect(() => {
    const handlePartnerJoined = (payload: any) => {
      console.log('Partner joined, re-fetching room!', payload);
      fetchActiveRoom(true);
    };

    const handleGameEvent = (payload: any) => {
      console.log('Game event received, re-fetching room!', payload);
      fetchActiveRoom(true);
    };

    GameSocket.on('partner_joined', handlePartnerJoined);
    GameSocket.on('game_event', handleGameEvent);

    return () => {
      GameSocket.off('partner_joined', handlePartnerJoined);
      GameSocket.off('game_event', handleGameEvent);
    };
  }, [fetchActiveRoom]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        fetchActiveRoom(true);
      }
    });

    return () => subscription.remove();
  }, [fetchActiveRoom]);

  // ── Create Room Handler ────────────────────────────────
  const handleCreateRoom = async () => {
    try {
      setActionLoading(true);
      setActionError('');
      const room = await createRoom(selectedExpiry);
      setActiveRoom(room);
      setRoomModalVisible(false);
    } catch (err: any) {
      setActionError(err.response?.data?.message || err.message || 'Failed to create room');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Join Room Handler ──────────────────────────────────
  const handleJoinRoom = async () => {
    if (!joinCode.trim()) {
      setActionError('Please enter a room code');
      return;
    }
    try {
      setActionLoading(true);
      setActionError('');
      const room = await joinRoom(joinCode.trim());
      setActiveRoom(room);
      if (room) {
        const sends = await fetchCardSends(room.id);
        const rawSends = sends?.sends || sends || [];
        setCardSends(rawSends.map(normalizeSendRecord).filter(Boolean));
      }
      setRoomModalVisible(false);
      setJoinCode('');
    } catch (err: any) {
      setActionError(err.response?.data?.message || err.message || 'Failed to join room');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Card Game Engine Handlers ────────────────────────────
  const handleAcceptCard = async (sendId: string) => {
    try {
      await acceptCardSend(sendId);
      Alert.alert('Card Accepted', 'Get ready to complete this challenge!');
      fetchActiveRoom(true);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to accept card');
    }
  };

  const handleRejectCard = async (sendId: string, roomId: string) => {
    Alert.alert(
      'Reject Challenge?',
      'Rejecting this challenge will trigger Penalty 3, transferring 1 card from your deck to your partner\'s deck as a penalty. Are you sure you want to proceed?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Reject', 
          style: 'destructive',
          onPress: async () => {
            try {
              await rejectCardSendReal(sendId, roomId);
              Alert.alert('Challenge Rejected', 'The challenge has been rejected and 1 card was transferred to your partner.');
              fetchActiveRoom(true);
            } catch (e: any) {
              Alert.alert('Error', e.response?.data?.message || 'Failed to reject card');
            }
          }
        }
      ]
    );
  };

  const handleCompleteCard = async (sendId: string) => {
    try {
      await completeCardSend(sendId);
      Alert.alert('Challenge Completed!', 'Well done! You have completed this dare.');
      fetchActiveRoom(true);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to complete card');
    }
  };

  const handleConfirmCompleteCard = async (sendId: string) => {
    try {
      await confirmCardSend(sendId);
      Alert.alert('Challenge Confirmed!', 'Thank you! You have confirmed the challenge completion.');
      fetchActiveRoom(true);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to confirm challenge');
    }
  };



  // ── Copy Code to Clipboard ─────────────────────────────
  const handleCopyCode = async (code: string) => {
    try {
      await Clipboard.setStringAsync(code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      Alert.alert('Copied!', `Room code: ${code}`);
    }
  };

  // ── Reset Room (Create New) ────────────────────────────
  const handleNewRoom = () => {
    setActiveRoom(null);
    setRoomModalTab('create');
    setRoomModalVisible(true);
    setActionError('');
  };

  // ── Open Modal ─────────────────────────────────────────
  const openRoomModal = (tab: 'create' | 'join') => {
    setRoomModalTab(tab);
    setActionError('');
    setJoinCode('');
    setRoomModalVisible(true);
  };

  const switchRoomModalTab = (tab: 'create' | 'join') => {
    setRoomModalTab(tab);
    setActionError('');
    setActionLoading(false);
    if (tab === 'create') {
      setJoinCode('');
    }
  };

  const navigateTo = async (path: string) => {
    const { router } = await import('expo-router');
    router.push(path as any);
  };

  // ── Format Join Code Input ─────────────────────────────
  const formatJoinCode = (text: string) => {
    const cleaned = text.toUpperCase().replace(/[^A-Z0-9\-]/g, '');
    setJoinCode(cleaned);
  };

  // ── Expiry Label Helper ────────────────────────────────
  const expiryLabel = (type: ExpiryType) => {
    switch (type) {
      case '7_DAYS': return '7 Days';
      case '30_DAYS': return '30 Days';
      case '1_YEAR': return '1 Year';
    }
  };

  // ── Safe Target Date Parser for older JSC engines ───────
  const getTargetDateStr = (sentAt: string | undefined) => {
    if (!sentAt) return '';
    try {
      const formattedDate = sentAt.replace(' ', 'T');
      const d = new Date(formattedDate);
      const time = d.getTime();
      if (isNaN(time)) return '';
      return new Date(time + 24 * 60 * 60 * 1000).toISOString();
    } catch (e) {
      return '';
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-rose-50 dark:bg-[#0F0608]" style={{ paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 }}>
      {/* Status bar configuration if needed */}
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={isDark ? "#0F0608" : "#fff1f2"} />
      


      {/* ═══════════════════════════════════════════════════════
          ROOM CREATE / JOIN OVERLAY
          ═══════════════════════════════════════════════════════ */}
      {roomModalVisible && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 200, justifyContent: 'flex-end' }}>
          {/* Backdrop */}
          <TouchableOpacity
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            className="bg-black/40 dark:bg-black/60"
            activeOpacity={1}
            onPress={() => setRoomModalVisible(false)}
          />

          {/* Bottom Sheet */}
          <View className="bg-[#fff8f7] dark:bg-[#180D10] rounded-t-[36px] pt-4 pb-10 px-6 border-t border-[#ffeceb] dark:border-rose-950/20" style={{ zIndex: 201 }}>
            {/* Handle Bar */}
            <View className="w-10 h-1 bg-slate-300 dark:bg-slate-700 rounded-full self-center mb-6" />

            <View className="flex-row bg-[#f5eeed] dark:bg-rose-950/40 rounded-2xl p-1.5 mb-7">
              <TouchableOpacity
                className={`flex-1 py-3.5 rounded-xl items-center ${roomModalTab === 'create' ? 'bg-white dark:bg-[#271318] shadow-sm dark:shadow-none' : ''}`}
                onPress={() => switchRoomModalTab('create')}
              >
                <Text className={`font-bold text-[14px] ${roomModalTab === 'create' ? 'text-[#af2c3b] dark:text-white' : 'text-slate-400 dark:text-slate-500'}`}>Create Room</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={`flex-1 py-3.5 rounded-xl items-center ${roomModalTab === 'join' ? 'bg-white dark:bg-[#271318] shadow-sm dark:shadow-none' : ''}`}
                onPress={() => switchRoomModalTab('join')}
              >
                <Text className={`font-bold text-[14px] ${roomModalTab === 'join' ? 'text-[#af2c3b] dark:text-white' : 'text-slate-400 dark:text-slate-500'}`}>Join Room</Text>
              </TouchableOpacity>
            </View>

            {/* ── CREATE TAB ─────────────────────────────── */}
            {roomModalTab === 'create' && (
              <View>
                <Text className="text-xl font-black text-slate-900 dark:text-white tracking-tight mb-2">Create a Love Room</Text>
                <Text className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-6 leading-5">
                  Start a private room and share the code with your partner to connect.
                </Text>

                {/* Expiry Selection */}
                <Text className="text-[10px] font-bold text-slate-400 dark:text-slate-500 tracking-widest uppercase mb-3">Room Duration</Text>
                <View className="flex-row gap-3 mb-8">
                  {(['7_DAYS', '30_DAYS', '1_YEAR'] as ExpiryType[]).map((type) => (
                    <TouchableOpacity
                      key={type}
                      className={`flex-1 py-4 rounded-2xl items-center border-2 ${
                        selectedExpiry === type
                          ? 'bg-[#af2c3b] border-[#af2c3b] dark:bg-rose-500 dark:border-rose-500'
                          : 'bg-white border-slate-100 dark:bg-[#271318] dark:border-rose-950/40'
                      }`}
                      onPress={() => setSelectedExpiry(type)}
                    >
                      <Text className={`font-bold text-[13px] ${selectedExpiry === type ? (isDark ? 'text-white' : 'text-white') : 'text-slate-700 dark:text-slate-100'}`}>
                        {expiryLabel(type)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Error */}
                {actionError ? (
                  <View className="bg-red-50 dark:bg-red-950/20 rounded-2xl p-4 mb-4 flex-row items-center">
                    <Ionicons name="alert-circle" size={18} color="#dc2626" />
                    <Text className="text-red-600 dark:text-red-400 font-semibold text-[13px] ml-2 flex-1">{actionError}</Text>
                  </View>
                ) : null}

                <TouchableOpacity
                  className="bg-[#af2c3b] dark:bg-rose-600 rounded-full py-[18px] items-center shadow-lg dark:shadow-none flex-row justify-center"
                  activeOpacity={0.8}
                  onPress={handleCreateRoom}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Ionicons name="add-circle" size={20} color="white" />
                      <Text className="text-white font-bold text-[15px] ml-2">Create Room</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* ── JOIN TAB ───────────────────────────────── */}
            {roomModalTab === 'join' && (
              <View>
                <Text className="text-xl font-black text-slate-900 dark:text-white tracking-tight mb-2">Join Your Partner</Text>
                <Text className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-6 leading-5">
                  Enter the room code your partner shared with you.
                </Text>

                {/* Code Input */}
                <View className="bg-white dark:bg-[#271318] rounded-2xl border-2 border-slate-100 dark:border-rose-950/40 px-5 py-1 mb-4">
                  <TextInput
                    placeholder="ELV-A9B3C1"
                    placeholderTextColor={isDark ? "rgba(255, 255, 255, 0.2)" : "#cbd5e1"}
                    value={joinCode}
                    onChangeText={formatJoinCode}
                    className="text-center text-2xl font-black text-slate-900 dark:text-white py-4"
                    style={{ letterSpacing: 8 }}
                    maxLength={10}
                    autoCapitalize="characters"
                  />
                </View>

                {/* Error */}
                {actionError ? (
                  <View className="bg-red-50 dark:bg-red-950/20 rounded-2xl p-4 mb-4 flex-row items-center">
                    <Ionicons name="alert-circle" size={18} color="#dc2626" />
                    <Text className="text-red-600 dark:text-red-400 font-semibold text-[13px] ml-2 flex-1">{actionError}</Text>
                  </View>
                ) : null}

                <TouchableOpacity
                  className={`rounded-full py-[18px] items-center shadow-lg flex-row justify-center mt-2 ${
                    joinCode.trim().length >= 5 ? 'bg-[#0d5f5a] dark:bg-teal-600 shadow dark:shadow-none' : 'bg-slate-300 dark:bg-slate-800 shadow-sm dark:shadow-none'
                  }`}
                  activeOpacity={0.8}
                  onPress={handleJoinRoom}
                  disabled={actionLoading || joinCode.trim().length < 5}
                >
                  {actionLoading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Ionicons name="enter" size={20} color="white" />
                      <Text className="text-white font-bold text-[15px] ml-2">Join Room</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* Cancel */}
            <TouchableOpacity
              className="mt-4 py-3 items-center"
              onPress={() => setRoomModalVisible(false)}
            >
              <Text className="text-slate-400 dark:text-slate-500 font-bold text-[14px]">Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-6 py-4">
          <TouchableOpacity onPress={openSidebar}>
            <Ionicons name="menu-outline" size={30} color={isDark ? "#fff" : "#9f1239"} />
          </TouchableOpacity>
          <View className="flex-row items-center gap-1.5">
            <Ionicons name="infinite" size={28} color={isDark ? "#fda4af" : "#be123c"} style={{ transform: [{ rotate: '-15deg' }] }} />
            <Text className="text-red-700 dark:text-rose-400 font-black text-xl tracking-tight">SoulShuffle</Text>
          </View>
          <TouchableOpacity onPress={() => navigateTo('/profile')}>
            <Image 
              source={{ uri: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop' }} 
              className="w-10 h-10 rounded-full border border-rose-200 dark:border-slate-800"
            />
          </TouchableOpacity>
        </View>

        {/* Welcome Section */}
        <View className="px-6 mt-4">
          <Text className="text-[32px] leading-10 font-black text-slate-900 dark:text-white tracking-tight">
            Welcome back, {userName}{activeRoom?.partner_id ? '\n& Partner' : ''} 💕
          </Text>
          <Text className="text-slate-500 dark:text-slate-400 font-semibold text-sm mt-3">
            {activeRoom?.created_at 
              ? `Room Active for ${Math.max(1, Math.ceil(Math.abs(new Date().getTime() - new Date(activeRoom.created_at).getTime()) / (1000 * 60 * 60 * 24)))} days` 
              : 'Happy Together'} • Level 14 Romantic
          </Text>
        </View>

        {/* Couple Image */}
        <View className="px-6 mt-6">
          <Image 
            source={coupleCover} 
            className="w-full h-52 rounded-[36px]"
          />
        </View>

        {/* Stats Section */}
        <View className="flex-row justify-between px-6 mt-5">
          <View className="bg-white dark:bg-[#271318] dark:border dark:border-rose-950/40 rounded-[24px] px-5 py-4 w-[47%] shadow-sm dark:shadow-none">
            <View className="bg-rose-50/80 dark:bg-rose-500/10 w-8 h-8 rounded-full items-center justify-center mb-3">
              <Ionicons name="medal" size={17} color={isDark ? "#f43f5e" : "#e11d48"} />
            </View>
            <Text className="text-[26px] leading-8 font-black text-slate-900 dark:text-rose-400">{finishedDaresCount}</Text>
            <Text className="text-[9px] font-bold text-slate-400 dark:text-slate-400 mt-1 tracking-widest uppercase">Dares Finished</Text>
          </View>
          <View className="bg-white dark:bg-[#122220] dark:border dark:border-teal-950/30 rounded-[24px] px-5 py-4 w-[47%] shadow-sm dark:shadow-none">
            <View className="bg-teal-50/80 dark:bg-teal-500/10 w-8 h-8 rounded-full items-center justify-center mb-3">
              <Ionicons name="flame" size={17} color={isDark ? "#2dd4bf" : "#0d9488"} />
            </View>
            <Text className="text-[26px] leading-8 font-black text-slate-900 dark:text-teal-400">{currentStreak}</Text>
            <Text className="text-[9px] font-bold text-slate-400 dark:text-slate-400 mt-1 tracking-widest uppercase">Day Streak</Text>
          </View>
        </View>

        {/* ═══════════════════════════════════════════════════
            COUPLE ROOM SECTION
            ═══════════════════════════════════════════════════ */}
        <View className="mx-6 mt-6">
          {roomLoading ? (
            /* Loading State */
            <View className="bg-white dark:bg-[#271318] rounded-[36px] p-8 items-center shadow-sm dark:shadow-none">
              <ActivityIndicator size="large" color="#af2c3b" />
              <Text className="text-slate-400 dark:text-slate-400 font-semibold text-sm mt-3">Checking room status...</Text>
            </View>
          ) : activeRoom ? (
            <View className={`bg-white dark:bg-[#271318] dark:border dark:border-rose-950/20 rounded-[28px] overflow-hidden shadow-lg dark:shadow-none ${
              activeRoom.status === 'ACTIVE' ? 'border-l-[5px] border-l-teal-500 dark:border-l-teal-600' : ''
            }`}>
              {/* Room Header Strip Redesigned */}
              <View className="px-5 py-3 flex-row items-center justify-between border-b border-slate-100/50 dark:border-rose-950/20 bg-rose-50/30 dark:bg-[#180D10]/30">
                <View className="flex-row items-center">
                  <View className={`w-2 h-2 rounded-full mr-2 ${activeRoom.status === 'ACTIVE' ? 'bg-teal-500 shadow-sm shadow-teal-500/50' : 'bg-amber-500'}`} />
                  <Text className={`font-bold text-[10px] tracking-widest uppercase ${activeRoom.status === 'ACTIVE' ? 'text-teal-600 dark:text-teal-400' : 'text-amber-600 dark:text-amber-500'}`}>
                    {activeRoom.status === 'ACTIVE' ? 'Room Active' : 'Waiting for Partner'}
                  </Text>
                </View>
                <View className="bg-rose-100/50 dark:bg-rose-950/40 px-2.5 py-0.5 rounded-full">
                  <Text className="text-rose-600 dark:text-rose-400 font-bold text-[9px] tracking-wider uppercase">
                    {expiryLabel(activeRoom.expiry_type)}
                  </Text>
                </View>
              </View>

              <View className="p-5">
                {/* Room Code Display */}
                <Text className="text-[9px] font-bold text-slate-400 dark:text-slate-400 tracking-widest uppercase mb-1.5">Room Code</Text>
                <View className="flex-row items-center justify-between bg-[#f5eeed]/60 dark:bg-[#180D10] dark:border dark:border-rose-950/40 rounded-2xl px-4 py-3 mb-4">
                  <Text className="text-lg font-black text-[#af2c3b] dark:text-rose-400 tracking-widest flex-1 mr-2">{activeRoom.code}</Text>
                  <TouchableOpacity 
                    className={`px-3 py-2 rounded-xl flex-row items-center ${copiedCode ? 'bg-[#0d5f5a]' : 'bg-[#af2c3b] dark:bg-rose-600'}`}
                    onPress={() => handleCopyCode(activeRoom.code)}
                  >
                    <Ionicons name={copiedCode ? "checkmark" : "copy"} size={13} color="white" />
                    <Text className="text-white font-bold text-[10px] ml-1">
                      {copiedCode ? 'Copied!' : 'Copy'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Status Info Redesigned */}
                <View className="bg-[#fcf8f7] dark:bg-[#180D10] dark:border dark:border-rose-950/30 rounded-[20px] p-3.5 mb-4 items-center justify-center">
                  <View className="flex-row items-center justify-center mb-3">
                    {/* User Avatar */}
                    <View className={`w-10 h-10 rounded-full border-2 overflow-hidden shadow-sm ${
                      activeRoom.status === 'ACTIVE' ? 'border-teal-500' : 'border-rose-500'
                    }`}>
                      <Image 
                        source={{ uri: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop' }} 
                        className="w-full h-full"
                      />
                    </View>
                    
                    {/* Connection Line & Heart Indicator */}
                    <View className="flex-row items-center mx-3">
                      <View className={`w-4 h-[2px] ${activeRoom.status === 'ACTIVE' ? 'bg-teal-500/50' : 'bg-rose-200 dark:bg-rose-950/40'}`} />
                      <View className={`w-8 h-8 rounded-full items-center justify-center shadow-sm ${
                        activeRoom.status === 'ACTIVE' ? 'bg-teal-500' : 'bg-amber-500'
                      }`}>
                        <Ionicons 
                          name={activeRoom.status === 'ACTIVE' ? "heart" : "hourglass-outline"} 
                          size={14} 
                          color="white" 
                        />
                      </View>
                      <View className={`w-4 h-[2px] ${activeRoom.status === 'ACTIVE' ? 'bg-teal-500/50' : 'bg-rose-200 dark:bg-rose-950/40'}`} />
                    </View>

                    {/* Partner Avatar / Placeholder */}
                    {activeRoom.status === 'ACTIVE' ? (
                      <View className="w-10 h-10 rounded-full border-2 border-teal-500 overflow-hidden shadow-sm">
                        <Image 
                          source={{ uri: 'https://plus.unsplash.com/premium_photo-1678120616858-54b35e2380f9?w=100&h=100&fit=crop' }} 
                          className="w-full h-full"
                        />
                      </View>
                    ) : (
                      <View className="w-10 h-10 rounded-full border-2 border-dashed border-slate-300 dark:border-rose-950/40 bg-slate-50 dark:bg-[#0F0608] items-center justify-center shadow-sm">
                        <Ionicons name="person-add" size={14} color={isDark ? "#fda4af" : "#94a3b8"} />
                      </View>
                    )}
                  </View>

                  <View className="items-center">
                    {activeRoom.status === 'ACTIVE' ? (
                      <>
                        <Text className="text-slate-800 dark:text-rose-100 font-extrabold text-[13px] text-center mb-0.5">
                          Connected with <Text className="text-teal-600 dark:text-teal-400 font-black">Sam</Text> 💕
                        </Text>
                        <Text className="text-slate-400 dark:text-rose-300/40 font-semibold text-[10px] text-center px-2 leading-3.5">
                          Sam is online and connected! Ready to swap spicy and sweet dares together.
                        </Text>
                      </>
                    ) : (
                      <>
                        <Text className="text-slate-800 dark:text-rose-100 font-extrabold text-[13px] text-center mb-0.5">
                          Waiting for Partner...
                        </Text>
                        <Text className="text-slate-400 dark:text-rose-300/40 font-semibold text-[10px] text-center px-2 leading-3.5">
                          Share the room code above with your partner so they can join your Love Room.
                        </Text>
                      </>
                    )}
                  </View>
                </View>

                {activeRoom.status === 'ACTIVE' && (
                  <TouchableOpacity
                    className="bg-[#af2c3b] dark:bg-rose-600 rounded-full py-[12px] items-center shadow dark:shadow-none flex-row justify-center mb-2"
                    activeOpacity={0.8}
                    onPress={() => navigateTo('/dares')}
                  >
                    <Ionicons name="flash" size={16} color="white" />
                    <Text className="text-white font-bold text-[13px] ml-2">Send Challenge</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  className="py-2 items-center"
                  onPress={handleNewRoom}
                >
                  <Text className="text-slate-400 dark:text-slate-400 font-bold text-[11px] tracking-wide">Create New Room</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            /* ── NO ROOM CARD ────────────────────────────── */
            <View className="bg-white dark:bg-[#271318] dark:border dark:border-rose-950/20 rounded-[28px] p-5 shadow-lg dark:shadow-none relative overflow-hidden">
              {/* Background decorative elements */}
              <View className="absolute top-[-30] right-[-20] w-28 h-28 bg-rose-100/40 dark:bg-rose-500/10 rounded-full" />
              <View className="absolute bottom-[-20] left-[-15] w-20 h-20 bg-teal-100/30 dark:bg-teal-500/10 rounded-full" />

              <View className="flex-row items-center mb-1.5">
                <View className="bg-rose-50/80 dark:bg-rose-500/10 w-8 h-8 rounded-full items-center justify-center mr-2.5">
                  <Ionicons name="people" size={16} color={isDark ? "#f43f5e" : "#af2c3b"} />
                </View>
                <Text className="text-[10px] font-bold text-rose-400 dark:text-rose-400 tracking-widest uppercase">Couple Room</Text>
              </View>

              <Text className="text-xl font-black text-slate-900 dark:text-white tracking-tight mt-1 mb-1 leading-6">
                Connect with{'\n'}Your Partner
              </Text>
              <Text className="text-slate-500 dark:text-slate-400 font-medium text-[12px] leading-5 mb-5 pr-8">
                Create or join a private room to start playing together.
              </Text>

              <View className="flex-row gap-3">
                <TouchableOpacity
                  className="flex-1 bg-[#af2c3b] dark:bg-rose-600 rounded-2xl py-4 items-center shadow-md dark:shadow-none flex-row justify-center"
                  activeOpacity={0.8}
                  onPress={() => openRoomModal('create')}
                >
                  <Ionicons name="add-circle" size={18} color="white" />
                  <Text className="text-white font-bold text-[13px] ml-2">Create</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  className="flex-1 bg-[#0d5f5a] dark:bg-teal-600 rounded-2xl py-4 items-center shadow-md dark:shadow-none flex-row justify-center"
                  activeOpacity={0.8}
                  onPress={() => openRoomModal('join')}
                >
                  <Ionicons name="enter" size={18} color="white" />
                  <Text className="text-white font-bold text-[13px] ml-2">Join</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Active Challenge Section */}
        {activeChallenge && (
          <View className="mx-6 mt-6 bg-white dark:bg-[#271318] rounded-[32px] overflow-hidden shadow-lg dark:shadow-none border border-white dark:border-rose-950/20">
            <View className="h-40 relative">
              <Image source={{ uri: activeChallenge.card.image_url }} className="w-full h-full" />
              <View className="absolute inset-0 bg-black/25" />
              {activeChallenge.status === 'COMPLETED_BY_RECEIVER' ? (
                activeChallenge.sender_id === currentUserId ? (
                  <View className="absolute top-4 left-4 bg-amber-500 dark:bg-amber-600 px-3 py-1.5 rounded-full flex-row items-center shadow-sm">
                    <Ionicons name="alert-circle" size={12} color="white" />
                    <Text className="text-white font-bold text-[10px] tracking-widest uppercase ml-1.5">Needs Confirmation</Text>
                  </View>
                ) : (
                  <View className="absolute top-4 left-4 bg-slate-400 dark:bg-slate-500 px-3 py-1.5 rounded-full flex-row items-center shadow-sm">
                    <Ionicons name="time" size={12} color="white" />
                    <Text className="text-white font-bold text-[10px] tracking-widest uppercase ml-1.5">Waiting for Partner</Text>
                  </View>
                )
              ) : (
                activeChallenge.sender_id === currentUserId ? (
                  <View className="absolute top-4 left-4 bg-teal-500 dark:bg-teal-600 px-3 py-1.5 rounded-full flex-row items-center">
                    <Ionicons name="paper-plane" size={12} color="white" />
                    <Text className="text-white font-bold text-[10px] tracking-widest uppercase ml-1.5">Sent Dare (In Progress)</Text>
                  </View>
                ) : (
                  <View className="absolute top-4 left-4 bg-[#fde047] px-3 py-1.5 rounded-full flex-row items-center shadow-sm">
                    <Ionicons name="flash" size={12} color="#854d0e" />
                    <Text className="text-[#854d0e] font-bold text-[10px] tracking-widest uppercase ml-1.5">My Active Challenge</Text>
                  </View>
                )
              )}
            </View>
            <View className="p-6">
              <Text className="text-[10px] font-bold text-rose-500 dark:text-rose-400 tracking-widest uppercase mb-2">{activeChallenge.card.category}</Text>
              <Text className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mb-3">{activeChallenge.card.title}</Text>
              
              {activeChallenge.sender_id === currentUserId && (
                activeChallenge.status === 'COMPLETED_BY_RECEIVER' ? (
                  <View className="bg-amber-50/50 dark:bg-[#271318]/45 px-4 py-3 rounded-2xl border border-amber-100/30 dark:border-rose-950/20 mb-5 flex-row items-center">
                    <Ionicons name="gift-outline" size={16} color={isDark ? "#fbbf24" : "#d97706"} />
                    <Text className="text-[#b45309] dark:text-amber-400 font-semibold text-[12.5px] leading-5 ml-2.5 flex-1">
                      Your partner marked this dare as completed. Please confirm!
                    </Text>
                  </View>
                ) : (
                  <View className="bg-teal-50/50 dark:bg-[#180D10]/40 px-4 py-3 rounded-2xl border border-teal-100/30 dark:border-rose-950/20 mb-5 flex-row items-center">
                    <Ionicons name="hourglass-outline" size={16} color={isDark ? "#2dd4bf" : "#0d5f5a"} />
                    <Text className="text-[#0d5f5a] dark:text-teal-400 font-semibold text-[12.5px] leading-5 ml-2.5 flex-1">
                      Your partner accepted this dare and is completing it.
                    </Text>
                  </View>
                )
              )}

              <Text className="text-slate-500 dark:text-slate-300 text-[14px] leading-6 font-medium mb-5">{activeChallenge.card.description}</Text>
              
              {activeChallenge.message ? (
                <View className="bg-rose-50/50 dark:bg-rose-950/10 px-4 py-3 rounded-2xl border border-rose-100/30 dark:border-rose-950/25 mb-5">
                  <Text className="text-[#a12338] dark:text-rose-400 font-bold text-[10px] uppercase tracking-wider mb-1">
                    {activeChallenge.sender_id === currentUserId ? "Your note to partner" : "Note from partner"}
                  </Text>
                  <Text className="text-slate-600 dark:text-slate-300 text-[13px] italic font-medium leading-5">
                    "{activeChallenge.message}"
                  </Text>
                </View>
              ) : null}

              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <Ionicons name="time" size={14} color="#64748b" />
                  <Text className="text-slate-500 dark:text-slate-400 font-bold text-[12px] ml-2 mr-2">Time Left:</Text>
                  {activeChallenge.created_at && (
                    <CountdownTimer targetDate={getTargetDateStr(activeChallenge.created_at)} />
                  )}
                </View>

                {activeChallenge.sender_id !== currentUserId ? (
                  activeChallenge.status === 'COMPLETED_BY_RECEIVER' ? (
                    <View className="bg-slate-100 dark:bg-[#271318]/50 px-5 py-3 rounded-full border border-slate-200/45 dark:border-rose-950/10">
                      <Text className="text-slate-400 dark:text-slate-500 font-bold text-[12px]">Waiting for confirmation...</Text>
                    </View>
                  ) : (
                    <TouchableOpacity 
                      className="bg-emerald-500 dark:bg-emerald-600 px-5 py-3 rounded-full flex-row items-center shadow-md dark:shadow-none active:opacity-85"
                      onPress={() => handleCompleteCard(activeChallenge.id)}
                    >
                      <Ionicons name="checkmark-circle" size={14} color="white" />
                      <Text className="text-white font-bold text-[12px] ml-1.5">Complete</Text>
                    </TouchableOpacity>
                  )
                ) : (
                  activeChallenge.status === 'COMPLETED_BY_RECEIVER' ? (
                    <TouchableOpacity 
                      className="bg-emerald-500 dark:bg-emerald-600 px-5 py-3 rounded-full flex-row items-center shadow-md dark:shadow-none active:opacity-85"
                      onPress={() => handleConfirmCompleteCard(activeChallenge.id)}
                    >
                      <Ionicons name="checkmark-circle" size={14} color="white" />
                      <Text className="text-white font-bold text-[12px] ml-1.5">Confirm Completion</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity className="bg-rose-50 dark:bg-slate-800/60 px-5 py-3 rounded-full border border-rose-100 dark:border-slate-700/40" onPress={() => navigateTo('/history')}>
                      <Text className="text-[#b91c1c] dark:text-rose-400 font-bold text-[12px]">View History</Text>
                    </TouchableOpacity>
                  )
                )}
              </View>
            </View>
          </View>
        )}

        {/* Pending Challenges Section */}
        {displayPendingChallenges.length > 0 && (
          <View className="mt-8 mb-2">
            <View className="flex-row items-center justify-between px-6 mb-4">
              <Text className="text-xl font-black text-slate-900 dark:text-rose-100 tracking-tight">Pending Dares</Text>
              <View className="bg-amber-100 dark:bg-amber-500/20 px-2 py-0.5 rounded-full">
                <Text className="text-amber-600 dark:text-amber-400 font-bold text-[10px] uppercase tracking-wider">{displayPendingChallenges.length} waiting</Text>
              </View>
            </View>
            
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, gap: 16 }}>
              {displayPendingChallenges.map((cardSend) => (
                <View key={cardSend.id} style={{ width: width - 48 }} className="bg-white dark:bg-[#271318] rounded-[28px] overflow-hidden shadow-lg dark:shadow-none border border-slate-100 dark:border-rose-950/20">
                  <View className="h-32 relative">
                    <Image source={{ uri: cardSend.card?.image_url }} className="w-full h-full" />
                    <View className="absolute inset-0 bg-black/40" />
                    <View className="absolute top-3 left-3 bg-white/90 dark:bg-black/70 px-2.5 py-1 rounded-full flex-row items-center">
                      <Ionicons 
                        name={cardSend.sender_id === currentUserId ? "paper-plane" : "mail-unread"} 
                        size={12} 
                        color={cardSend.sender_id === currentUserId ? (isDark ? "#2dd4bf" : "#0d5f5a") : (isDark ? "#fda4af" : "#e11d48")} 
                      />
                      <Text className={`font-bold text-[9px] tracking-widest uppercase ml-1.5 ${cardSend.sender_id === currentUserId ? "text-teal-600 dark:text-teal-400" : "text-rose-600 dark:text-rose-400"}`}>
                        {cardSend.sender_id === currentUserId ? "Sent" : "Received"}
                      </Text>
                    </View>
                  </View>
                  <View className="p-5">
                    <Text className="text-[9px] font-bold text-rose-500 dark:text-rose-400 tracking-widest uppercase mb-1">{cardSend.card.category}</Text>
                    <Text className="text-lg font-black text-slate-900 dark:text-white tracking-tight mb-2" numberOfLines={1}>{cardSend.card.title}</Text>
                    
                    <View className="flex-row items-center mb-5 mt-1">
                      {cardSend.created_at && (
                        <CountdownTimer targetDate={getTargetDateStr(cardSend.created_at)} />
                      )}
                    </View>
                    {cardSend.message ? (
                      <View className="bg-rose-50/50 dark:bg-rose-950/10 px-4 py-3 rounded-2xl border border-rose-100/30 dark:border-rose-950/25 mb-4">
                        <Text className="text-[#a12338] dark:text-rose-400 font-bold text-[10px] uppercase tracking-wider mb-1">Note from partner</Text>
                        <Text className="text-slate-600 dark:text-slate-300 text-[13px] italic font-medium leading-5">
                          "{cardSend.message}"
                        </Text>
                      </View>
                    ) : null}

                    {cardSend.sender_id === currentUserId ? (
                      <View className="bg-slate-100 dark:bg-[#180D10]/50 py-3.5 rounded-xl items-center border border-slate-200/50 dark:border-rose-950/20">
                        <Text className="text-slate-500 dark:text-slate-400 font-bold text-[12px] uppercase tracking-wider">
                          Waiting for partner...
                        </Text>
                      </View>
                    ) : (
                      <View className="flex-row gap-2">
                        <TouchableOpacity 
                          className="flex-1 bg-red-500 dark:bg-red-600 py-3 rounded-xl items-center shadow-sm dark:shadow-none"
                          onPress={() => handleRejectCard(cardSend.id, cardSend.room_id || activeRoom?.id || '')}
                        >
                          <Text className="text-white font-bold text-[13px]">Reject</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          className="flex-1 bg-emerald-500 dark:bg-emerald-600 py-3 rounded-xl items-center shadow-md dark:shadow-none"
                          onPress={() => handleAcceptCard(cardSend.id)}
                        >
                          <Text className="text-white font-bold text-[13px]">Accept</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Today's Dare Section */}
        <View className="mx-6 mt-6 bg-white dark:bg-[#271318] dark:border dark:border-rose-950/40 rounded-[36px] p-7 shadow-lg dark:shadow-none relative">
          <View className="absolute top-7 right-7 bg-[#dfb15b] dark:bg-amber-500 w-8 h-8 rounded-full items-center justify-center shadow-sm">
            <Ionicons name="star" size={14} color="white" />
          </View>
          <Text className="text-[11px] font-bold text-rose-500 dark:text-rose-400 tracking-widest uppercase">Today&apos;s Intimacy Dare</Text>
          <Text className="text-2xl font-black text-slate-900 dark:text-white mt-4 pr-12 leading-8">
            Write a 3-sentence love note and hide it.
          </Text>
          <Text className="text-slate-500 dark:text-slate-300 mt-4 leading-6 text-[15px] font-medium">
            Find a place they&apos;ll discover later today—a coffee mug, a laptop, or a coat pocket.
          </Text>
          <TouchableOpacity className="bg-rose-500 dark:bg-rose-600 rounded-full py-[18px] items-center mt-7 flex-row justify-center shadow-md dark:shadow-none" activeOpacity={0.8}>
            <Text className="text-white font-bold text-[15px] mr-2">Start Challenge</Text>
            <Ionicons name="play" size={16} color="white" />
          </TouchableOpacity>
        </View>

        {/* Coin Toss Decision Maker Section */}
        <View className="mx-6 mt-6 bg-white dark:bg-[#271318] dark:border dark:border-rose-950/40 rounded-[36px] p-7 shadow-lg dark:shadow-none relative overflow-hidden">
          {/* Background gold decoration */}
          <View className="absolute top-[-20] right-[-25] w-24 h-24 bg-amber-100/40 dark:bg-amber-500/10 rounded-full" />
          
          <View className="flex-row items-center mb-2">
            <View className="bg-amber-50/80 dark:bg-amber-500/10 w-9 h-9 rounded-full items-center justify-center mr-3">
              <Ionicons name="pricetag" size={16} color={isDark ? "#fbbf24" : "#d97706"} />
            </View>
            <Text className="text-[11px] font-bold text-amber-600 dark:text-amber-500 tracking-widest uppercase">Decision Maker</Text>
          </View>
          
          <Text className="text-2xl font-black text-slate-900 dark:text-white mt-4 pr-12 leading-8">
            Can&apos;t agree on something?
          </Text>
          <Text className="text-slate-500 dark:text-slate-300 mt-4 leading-6 text-[15px] font-medium">
            Toss a virtual coin to decide who washes the dishes, picks the movie, or gets their way today!
          </Text>
          
          <TouchableOpacity 
            className="bg-amber-500 dark:bg-amber-600 rounded-full py-[18px] items-center mt-7 flex-row justify-center shadow-md dark:shadow-none" 
            activeOpacity={0.8}
            onPress={() => navigateTo('/coin-toss')}
          >
            <Text className="text-white font-bold text-[15px] mr-2">Toss a Coin</Text>
            <Ionicons name="reload" size={16} color="white" />
          </TouchableOpacity>
        </View>

        {/* Recent Memories Section */}
        <View className="mt-10 mb-6">
          <View className="flex-row items-center justify-between px-6">
            <Text className="text-xl font-black text-slate-900 dark:text-rose-100 tracking-tight">Recent Memories</Text>
            <TouchableOpacity>
              <Text className="text-[11px] font-bold text-red-700 dark:text-rose-300 uppercase tracking-widest">View Book</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-5 px-6 pb-2" contentContainerStyle={{ paddingRight: 48 }}>
            <View className="w-[260px] h-44 mr-4 rounded-[32px] overflow-hidden relative shadow-sm">
              <Image 
                source={{ uri: 'https://images.unsplash.com/photo-1517263904808-5dc91e3e7044?w=600&h=400&fit=crop' }} 
                className="w-full h-full"
              />
              <View className="absolute inset-0 bg-black/20" />
              <View className="absolute bottom-0 left-0 right-0 p-5 pt-10 bg-gradient-to-t from-black/80 to-transparent">
                <Text className="text-white font-bold text-[13px] tracking-wide">Coffee Date • 2 days ago</Text>
              </View>
            </View>
            <View className="w-[260px] h-44 mr-4 rounded-[32px] overflow-hidden relative shadow-sm">
              <Image 
                source={{ uri: 'https://images.unsplash.com/photo-1531747118685-ca8fa6e08806?w=600&h=400&fit=crop' }} 
                className="w-full h-full"
              />
              <View className="absolute inset-0 bg-black/20" />
              <View className="absolute bottom-0 left-0 right-0 p-5 pt-10 bg-gradient-to-t from-black/80 to-transparent">
                <Text className="text-white font-bold text-[13px] tracking-wide">Moonlight Walk • 5 days ago</Text>
              </View>
            </View>
          </ScrollView>
        </View>
      </ScrollView>


    </SafeAreaView>
  );
}
