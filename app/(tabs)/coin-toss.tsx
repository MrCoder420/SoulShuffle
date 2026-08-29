import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StatusBar, ScrollView, StyleSheet, Image, TextInput, DeviceEventEmitter } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSequence, runOnJS } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSidebar } from '@/context/SidebarContext';
import { useUserAvatar } from '@/hooks/use-user-avatar';
import { getActiveRoom, Room, triggerCoinFlipApi } from '@/services/roomService';
import { getMyProfileCached } from '@/services/authService';
import GameSocket from '@/services/socketService';
import { 
  getPendingCoinToss, 
  markPendingCoinTossAnimated, 
  CoinFace, 
  CoinTossHistoryItem,
  getCoinTossHistory,
  saveCoinTossItem,
  clearCoinTossHistory
} from '@/services/coinTossService';

const PRESET_STAKES = [
  { id: 'coffee', label: '☕ Buy Coffee', reason: 'Who buys coffee?' },
  { id: 'dinner', label: '🍕 Pick Dinner', reason: 'Who picks dinner?' },
  { id: 'dishes', label: '🍽️ Do Dishes', reason: 'Who does the dishes?' },
  { id: 'movie',  label: '🎬 Choose Movie', reason: 'Who picks the movie?' },
  { id: 'dare',   label: '🔥 Draw Dare', reason: 'Who draws the next dare?' },
];

export default function CoinToss() {
  const { openSidebar } = useSidebar();
  const userAvatar = useUserAvatar();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Game & User States
  const [room, setRoom] = useState<Room | null>(null);
  const [myProfile, setMyProfile] = useState<{ id: string | null; firstName: string; avatarUrl: string | null }>({
    id: null,
    firstName: 'You',
    avatarUrl: null
  });
  const [partnerName, setPartnerName] = useState<string>('Partner');

  const [userChoice, setUserChoice] = useState<CoinFace>('HEADS');
  const [partnerPickedSide, setPartnerPickedSide] = useState<CoinFace | null>(null);
  const [chooserName, setChooserName] = useState<string>('You');

  const [selectedStake, setSelectedStake] = useState<string>('Who buys coffee?');
  const [customStake, setCustomStake] = useState<string>('');
  const [isCustomStake, setIsCustomStake] = useState(false);

  const [result, setResult] = useState<CoinFace | null>(null);
  const [isFlipping, setIsFlipping] = useState(false);
  const [history, setHistory] = useState<CoinTossHistoryItem[]>([]);
  const [lastFlipContext, setLastFlipContext] = useState<{
    flipperName: string;
    isMeFlipper: boolean;
    choice: CoinFace;
    partnerChoice: CoinFace;
    result: CoinFace;
    isMeWinner: boolean;
    reason: string;
  } | null>(null);
  const [showResultCard, setShowResultCard] = useState(false);

  // Refs for stable callback handling inside socket events
  const userChoiceRef = useRef(userChoice);
  const roomRef = useRef(room);
  const myProfileRef = useRef(myProfile);
  const partnerNameRef = useRef(partnerName);
  const selectedStakeRef = useRef(selectedStake);
  const lastProcessedEventIdRef = useRef<string>('');
  const lastProcessedTimestampRef = useRef<number>(0);

  // Load cached history on mount & on demand
  const loadLocalHistory = useCallback(async (roomId?: string) => {
    try {
      const items = await getCoinTossHistory(roomId || roomRef.current?.id);
      setHistory(items);
    } catch (e) {
      console.log('[CoinToss] Failed to load history:', e);
    }
  }, []);

  useEffect(() => {
    loadLocalHistory();
  }, [loadLocalHistory]);

  const handleClearHistory = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setHistory([]);
    await clearCoinTossHistory(roomRef.current?.id);
  };

  useEffect(() => { userChoiceRef.current = userChoice; }, [userChoice]);
  useEffect(() => { roomRef.current = room; }, [room]);
  useEffect(() => { myProfileRef.current = myProfile; }, [myProfile]);
  useEffect(() => { partnerNameRef.current = partnerName; }, [partnerName]);
  useEffect(() => {
    selectedStakeRef.current = isCustomStake && customStake.trim() ? customStake.trim() : selectedStake;
  }, [selectedStake, customStake, isCustomStake]);

  // Animation Shared Values
  const spinValue = useSharedValue(0);
  const translateYValue = useSharedValue(0);
  const scaleValue = useSharedValue(1);

  const animatedCoinStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { rotateY: `${spinValue.value}deg` },
        { translateY: translateYValue.value },
        { scale: scaleValue.value }
      ]
    };
  });

  // Refs for tracking focus & duplicate processing
  const isScreenFocusedRef = useRef(false);

  // Completion trigger ref
  const onFlipEndCallbackRef = useRef<((finalResult: CoinFace, context?: any) => void) | null>(null);

  const triggerFlipComplete = useCallback((finalResult: CoinFace) => {
    if (onFlipEndCallbackRef.current) {
      onFlipEndCallbackRef.current(finalResult);
    }
  }, []);

  const animateFlip = useCallback((finalOutcome: CoinFace, onComplete?: () => void) => {
    setIsFlipping(true);
    setShowResultCard(false);
    setResult(null);

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Calculate total rotations: land on heads (even 180s) or tails (odd 180s)
    const baseRotations = 1440; // 4 full spins
    const targetDegree = finalOutcome === 'HEADS' 
      ? baseRotations 
      : baseRotations + 180;

    // Reset shared values
    spinValue.value = 0;
    translateYValue.value = 0;
    scaleValue.value = 1;

    // Sequential animations
    spinValue.value = withTiming(targetDegree, { duration: 1200 });
    
    // Parabolic jump arc
    translateYValue.value = withSequence(
      withTiming(-130, { duration: 600 }),
      withTiming(0, { duration: 600 })
    );

    // Scale dynamics
    scaleValue.value = withSequence(
      withTiming(1.35, { duration: 600 }),
      withTiming(1, { duration: 600 }, (finished) => {
        if (finished) {
          runOnJS(triggerFlipComplete)(finalOutcome);
          if (onComplete) {
            runOnJS(onComplete)();
          }
        }
      })
    );
  }, [triggerFlipComplete]);

  // Process incoming coin toss (from live socket or cross-tab redirect)
  const processIncomingCoinToss = useCallback((eventData: any, delayMs: number = 0) => {
    if (!eventData) return;
    if (!eventData.result && !eventData.chosen_side) return;

    const eventId = String(eventData.eventId || eventData.timestamp || Date.now());

    // Deduplicate events
    if (
      (eventId && eventId === lastProcessedEventIdRef.current) ||
      (Date.now() - lastProcessedTimestampRef.current < 2000 && lastProcessedEventIdRef.current !== '')
    ) {
      console.log('[CoinToss] Ignoring duplicate flip event:', eventId);
      return;
    }

    lastProcessedEventIdRef.current = eventId;
    lastProcessedTimestampRef.current = Date.now();
    markPendingCoinTossAnimated(eventId);

    const incomingResult: CoinFace = (eventData.result || eventData.chosen_side || 'HEADS').toUpperCase() as CoinFace;
    const partnerChoice: CoinFace = (eventData.flipperChoice || eventData.choice || eventData.chosen_side || 'HEADS').toUpperCase() as CoinFace;
    const myOppositeChoice: CoinFace = partnerChoice === 'HEADS' ? 'TAILS' : 'HEADS';
    const flipperName = eventData.flipperName || partnerNameRef.current || 'Partner';
    const reason = eventData.reason || 'Coin Toss Decider';

    const isPartnerWinner = partnerChoice === incomingResult;
    const isMeWinner = myOppositeChoice === incomingResult;

    // Auto-sync choice states on screen
    setUserChoice(myOppositeChoice);
    setPartnerPickedSide(partnerChoice);
    setChooserName(flipperName);
    if (reason && reason !== 'Coin Toss Decider') {
      setSelectedStake(reason);
      setIsCustomStake(false);
    }

    onFlipEndCallbackRef.current = (landedResult: CoinFace) => {
      setResult(landedResult);
      setIsFlipping(false);
      setShowResultCard(true);
      Haptics.notificationAsync(
        isMeWinner ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning
      );

      const context = {
        flipperName,
        isMeFlipper: false,
        choice: myOppositeChoice,
        partnerChoice: partnerChoice,
        result: landedResult,
        isMeWinner,
        reason
      };
      setLastFlipContext(context);

      const newItem: CoinTossHistoryItem = {
        id: eventId,
        flipperName,
        choice: partnerChoice,
        result: landedResult,
        outcome: isMeWinner ? 'YOU WON' : `${flipperName.toUpperCase()} WON`,
        reason,
        isMeWinner,
        time: new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
        timestamp: Date.now(),
        roomId: roomRef.current?.id
      };
      saveCoinTossItem(newItem, roomRef.current?.id).then(updated => {
        setHistory(updated);
      });
    };

    if (delayMs > 0) {
      setTimeout(() => {
        animateFlip(incomingResult);
      }, delayMs);
    } else {
      animateFlip(incomingResult);
    }
  }, [animateFlip]);

  // Room & Profile Sync & Pending Toss check on focus
  const syncRoomAndSocket = useCallback(async () => {
    try {
      const [activeRoom, profile] = await Promise.all([
        getActiveRoom(),
        getMyProfileCached()
      ]);
      setRoom(activeRoom);
      if (profile) setMyProfile(profile);

      if (activeRoom) {
        // Resolve Partner's name
        const pName = activeRoom.partner?.first_name || activeRoom.partner?.full_name ||
          (profile.id === activeRoom.host_id ? (activeRoom.partner?.first_name || 'Partner') : (activeRoom.host?.first_name || 'Partner'));
        setPartnerName(pName);

        if (activeRoom.code) {
          await GameSocket.joinRoom(activeRoom.code);
        }
        loadLocalHistory(activeRoom.id);
      } else {
        loadLocalHistory();
      }
    } catch (err) {
      console.warn('[CoinToss] Failed to sync room/socket in CoinToss:', err);
    }
  }, [loadLocalHistory]);

  useFocusEffect(
    useCallback(() => {
      isScreenFocusedRef.current = true;
      syncRoomAndSocket();
      loadLocalHistory();

      // Check if there is a pending coin toss received while user was on another screen
      const pending = getPendingCoinToss();
      if (pending && !isFlipping) {
        console.log('[CoinToss] Found pending coin toss on screen focus:', pending.eventId);
        processIncomingCoinToss(pending, 250);
      }

      return () => {
        isScreenFocusedRef.current = false;
      };
    }, [syncRoomAndSocket, isFlipping, processIncomingCoinToss, loadLocalHistory])
  );

  // Handle User Selecting Choice (and live syncing to partner)
  const handleSelectChoice = (choice: CoinFace) => {
    if (isFlipping) return;

    setUserChoice(choice);
    setPartnerPickedSide(choice === 'HEADS' ? 'TAILS' : 'HEADS');
    setChooserName('You');

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const currentRoom = roomRef.current;
    if (currentRoom && currentRoom.code) {
      GameSocket.sendGameEvent(currentRoom.code, 'COIN_CHOICE_SELECTED', {
        choice,
        chooserId: myProfileRef.current.id,
        chooserName: myProfileRef.current.firstName || 'Partner',
        timestamp: Date.now()
      });
    }
  };

  // Handle User Selecting Stake (and live syncing to partner)
  const handleSelectStake = (stakeText: string, isCustom = false) => {
    setIsCustomStake(isCustom);
    if (!isCustom) {
      setSelectedStake(stakeText);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const currentRoom = roomRef.current;
    if (currentRoom && currentRoom.code && !isCustom) {
      GameSocket.sendGameEvent(currentRoom.code, 'COIN_STAKE_SELECTED', {
        reason: stakeText,
        timestamp: Date.now()
      });
    }
  };

  // Execute Local Flip Action
  const handleFlip = async () => {
    if (isFlipping) return;

    const currentRoom = roomRef.current;
    const currentChoice = userChoiceRef.current;
    const currentStakeText = selectedStakeRef.current;
    const currentMyProfile = myProfileRef.current;
    const currentPartnerChoice: CoinFace = currentChoice === 'HEADS' ? 'TAILS' : 'HEADS';

    // Determine random outcome (50/50 chance)
    const outcomes: CoinFace[] = ['HEADS', 'TAILS'];
    const finalOutcome = outcomes[Math.floor(Math.random() * outcomes.length)];
    const isMeWinner = currentChoice === finalOutcome;
    const eventId = `flip_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // Set callback for when animation ends
    onFlipEndCallbackRef.current = (landedResult: CoinFace) => {
      setResult(landedResult);
      setIsFlipping(false);
      setShowResultCard(true);
      Haptics.notificationAsync(
        isMeWinner ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning
      );

      const context = {
        flipperName: currentMyProfile.firstName || 'You',
        isMeFlipper: true,
        choice: currentChoice,
        partnerChoice: currentPartnerChoice,
        result: landedResult,
        isMeWinner,
        reason: currentStakeText
      };
      setLastFlipContext(context);

      const newItem: CoinTossHistoryItem = {
        id: eventId,
        flipperName: 'You',
        choice: currentChoice,
        result: landedResult,
        outcome: isMeWinner ? 'YOU WON' : 'YOU LOST',
        reason: currentStakeText,
        isMeWinner,
        time: new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
        timestamp: Date.now(),
        roomId: currentRoom?.id
      };
      saveCoinTossItem(newItem, currentRoom?.id).then(updated => {
        setHistory(updated);
      });
    };

    // Animate immediately for high responsiveness
    animateFlip(finalOutcome);

    // Broadcast to partner & trigger backend API asynchronously
    if (currentRoom && currentRoom.code) {
      lastProcessedEventIdRef.current = eventId;
      lastProcessedTimestampRef.current = Date.now();

      // 1. Direct Socket Game Event
      GameSocket.sendGameEvent(currentRoom.code, 'COIN_TOSS', {
        eventId,
        flipperChoice: currentChoice,
        choice: currentChoice,
        result: finalOutcome,
        flipperId: currentMyProfile.id,
        flipperName: currentMyProfile.firstName || 'Partner',
        winnerId: isMeWinner ? currentMyProfile.id : currentRoom.partner_id,
        reason: currentStakeText,
        timestamp: Date.now()
      });

      // 2. Authoritative Backend API endpoint (if applicable)
      triggerCoinFlipApi(currentChoice, currentStakeText).catch(err => {
        console.log('[CoinToss] Backend coin-flip API broadcast completed/logged:', err?.message || 'OK');
      });
    }
  };

  // Socket Listener for incoming partner events
  useEffect(() => {
    const handleIncomingGameEvent = (payload: any) => {
      const eventType = payload.eventType;
      const eventData = payload.data || payload;

      if (!eventData) return;

      // Case A: Partner selected a side → Auto-assign opposite to current user
      if (eventType === 'COIN_CHOICE_SELECTED') {
        const partnerPicked: CoinFace = (eventData.choice || 'HEADS').toUpperCase() as CoinFace;
        const oppositeChoice: CoinFace = partnerPicked === 'HEADS' ? 'TAILS' : 'HEADS';
        
        setUserChoice(oppositeChoice);
        setPartnerPickedSide(partnerPicked);
        setChooserName(eventData.chooserName || partnerNameRef.current || 'Partner');
        
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        return;
      }

      // Case B: Partner selected a stake
      if (eventType === 'COIN_STAKE_SELECTED') {
        if (eventData.reason) {
          setSelectedStake(eventData.reason);
          setIsCustomStake(false);
        }
        return;
      }

      // Case C: Coin Toss occurred
      if (eventType === 'COIN_TOSS' || eventType === 'COIN_FLIP_RESULT') {
        if (isScreenFocusedRef.current) {
          processIncomingCoinToss(eventData, 0);
        }
      }
    };

    const remoteTossSub = DeviceEventEmitter.addListener('coin:remote_toss', (eventData) => {
      if (isScreenFocusedRef.current) {
        processIncomingCoinToss(eventData, 0);
      }
    });

    const onGameEvent = (payload: any) => {
      handleIncomingGameEvent(payload);
    };

    const onCoinFlipResult = (payload: any) => {
      handleIncomingGameEvent({ eventType: 'COIN_FLIP_RESULT', data: payload });
    };

    GameSocket.on('game_event', onGameEvent);
    GameSocket.on('coin_flip_result', onCoinFlipResult);

    return () => {
      remoteTossSub.remove();
      GameSocket.off('game_event', onGameEvent);
      GameSocket.off('coin_flip_result', onCoinFlipResult);
    };
  }, [processIncomingCoinToss]);

  const activeStakeReason = isCustomStake && customStake.trim() ? customStake.trim() : selectedStake;

  return (
    <SafeAreaView className="flex-1 bg-[#fff8f7] dark:bg-[#0F0608]" edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={isDark ? "#0F0608" : "#fff8f7"} />

      {/* Header */}
      <View className="flex-row items-center justify-between px-6 pt-5 pb-3 bg-[#fff8f7] dark:bg-[#0F0608] z-10">
        <TouchableOpacity onPress={openSidebar} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="menu-outline" size={30} color={isDark ? "#fff" : "#9f1239"} />
        </TouchableOpacity>
        <View className="flex-row items-center gap-2">
          <Ionicons name="aperture" size={24} color={isDark ? "#fda4af" : "#be123c"} />
          <Text className="text-slate-900 dark:text-white font-black text-[18px] tracking-tight">Coin Toss</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/profile')}>
          <Image 
            source={{ uri: userAvatar }} 
            className="w-8 h-8 rounded-full border border-rose-200 dark:border-rose-950/30"
          />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 160 }}>
        {/* Title & Sync Status Section */}
        <View className="items-center px-6 mt-4">
          <Text className="text-[26px] font-black text-[#af2c3b] dark:text-rose-400 text-center tracking-tight leading-8">
            Can&apos;t agree on something?
          </Text>
          <Text className="text-slate-500 dark:text-slate-400 font-medium text-center text-xs mt-1.5 mb-3 px-4">
            Pick a side and flip in real-time with your partner!
          </Text>

          {/* Real-time Sync Status Pill */}
          {room && room.status === 'ACTIVE' ? (
            <View className="flex-row items-center bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 px-4 py-1.5 rounded-full">
              <View className="w-2.5 h-2.5 rounded-full bg-emerald-500 mr-2 shadow-sm" />
              <Text className="text-emerald-700 dark:text-emerald-300 font-bold text-xs">
                Live Synced with {partnerName}
              </Text>
            </View>
          ) : (
            <View className="flex-row items-center bg-slate-100 dark:bg-slate-900/50 border border-slate-200/50 dark:border-slate-800/30 px-3.5 py-1.5 rounded-full">
              <View className="w-2 h-2 rounded-full bg-slate-400 mr-2" />
              <Text className="text-slate-600 dark:text-slate-400 font-bold text-xs">
                Solo Mode (Room Inactive)
              </Text>
            </View>
          )}
        </View>

        {/* Choice Selector (Heads vs Tails with live partner lock & opposite auto-assignment) */}
        <View className="px-6 mt-6 mb-8">
          <Text className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3 px-1">
            Choose Your Side
          </Text>

          <View className="flex-row justify-center gap-3">
            {/* HEADS Button */}
            <TouchableOpacity
              className={`flex-1 py-4 px-3 rounded-2xl border-[2px] shadow-sm flex-row items-center justify-center ${
                userChoice === 'HEADS'
                  ? 'bg-[#af2c3b] border-[#af2c3b] dark:bg-rose-600 dark:border-rose-600'
                  : 'bg-white border-slate-200 dark:bg-[#271318] dark:border-rose-950/20'
              }`}
              onPress={() => handleSelectChoice('HEADS')}
              disabled={isFlipping}
              activeOpacity={0.7}
            >
              <Ionicons
                name="heart"
                size={18}
                color={userChoice === 'HEADS' ? '#fff' : '#e11d48'}
              />
              <Text className={`font-black text-[14px] ml-2 ${
                userChoice === 'HEADS' ? 'text-white' : 'text-slate-800 dark:text-slate-200'
              }`}>
                HEADS (Heart)
              </Text>
            </TouchableOpacity>

            {/* TAILS Button */}
            <TouchableOpacity
              className={`flex-1 py-4 px-3 rounded-2xl border-[2px] shadow-sm flex-row items-center justify-center ${
                userChoice === 'TAILS'
                  ? 'bg-[#af2c3b] border-[#af2c3b] dark:bg-rose-600 dark:border-rose-600'
                  : 'bg-white border-slate-200 dark:bg-[#271318] dark:border-rose-950/20'
              }`}
              onPress={() => handleSelectChoice('TAILS')}
              disabled={isFlipping}
              activeOpacity={0.7}
            >
              <Ionicons
                name="rose"
                size={18}
                color={userChoice === 'TAILS' ? '#fff' : '#f43f5e'}
              />
              <Text className={`font-black text-[14px] ml-2 ${
                userChoice === 'TAILS' ? 'text-white' : 'text-slate-800 dark:text-slate-200'
              }`}>
                TAILS (Rose)
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Interactive 3D Flipping Coin Area */}
        <View className="items-center justify-center h-56 relative mb-6">
          <Animated.View 
            style={[styles.coin, animatedCoinStyle]}
            className="shadow-2xl dark:shadow-black"
          >
            {/* Outer Gold Ring */}
            <View className="w-full h-full rounded-full border-[8px] border-[#dfb15b] bg-[#f9ebce] dark:bg-[#251711] items-center justify-center relative shadow-lg">
              {/* Gold Inner Circle border */}
              <View className="w-[85%] h-[85%] rounded-full border border-dashed border-[#dfb15b]/60 items-center justify-center bg-[#fdf5e7] dark:bg-[#2b1b13]">
                {isFlipping ? (
                  <Ionicons name="sparkles" size={48} color="#dfb15b" />
                ) : result === 'TAILS' ? (
                  <Ionicons name="rose" size={56} color="#f43f5e" />
                ) : (
                  <Ionicons name="heart" size={56} color="#e11d48" />
                )}
              </View>
            </View>
          </Animated.View>
        </View>

        {/* Flip Button */}
        <View className="px-6 mb-6">
          <TouchableOpacity
            className={`rounded-full py-4 items-center justify-center flex-row shadow-lg ${
              isFlipping 
                ? 'bg-slate-300 dark:bg-rose-950/40' 
                : 'bg-[#af2c3b] dark:bg-rose-600'
            }`}
            activeOpacity={0.85}
            onPress={handleFlip}
            disabled={isFlipping}
          >
            <Ionicons name="reload" size={18} color="white" />
            <Text className="text-white font-black text-[15px] ml-2">
              {isFlipping ? 'Tossing Coin in Air...' : 'Toss Coin'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Dynamic Synchronized Result Card */}
        {showResultCard && result && lastFlipContext && (
          <View className="px-6 mb-8">
            <View className={`border rounded-[24px] p-5 items-center shadow-sm ${
              lastFlipContext.isMeWinner 
                ? 'bg-teal-50/70 border-teal-200 dark:bg-teal-950/20 dark:border-teal-900/40' 
                : 'bg-rose-50/70 border-rose-200 dark:bg-rose-950/20 dark:border-rose-900/40'
            }`}>
              <View className={`w-12 h-12 rounded-full items-center justify-center mb-2.5 ${
                lastFlipContext.isMeWinner ? 'bg-teal-100 dark:bg-teal-500/20' : 'bg-rose-100 dark:bg-rose-500/20'
              }`}>
                <Ionicons 
                  name={lastFlipContext.isMeWinner ? 'trophy' : 'sad-outline'} 
                  size={24} 
                  color={lastFlipContext.isMeWinner ? '#0d9488' : '#e11d48'} 
                />
              </View>

              <Text className="text-xl font-black text-slate-900 dark:text-white tracking-tight text-center">
                Landed on {result}!
              </Text>

              {/* Winner Status Banner */}
              <View className="mt-3 px-4 py-2.5 rounded-xl bg-white/80 dark:bg-black/40 border border-slate-100 dark:border-white/5 items-center w-full">
                <Text className={`font-black text-sm text-center ${
                  lastFlipContext.isMeWinner ? 'text-teal-700 dark:text-teal-300' : 'text-rose-700 dark:text-rose-300'
                }`}>
                  {lastFlipContext.isMeWinner
                    ? `🎉 You won the toss!`
                    : `👑 ${lastFlipContext.isMeFlipper ? partnerName : lastFlipContext.flipperName} won the toss!`}
                </Text>
                <Text className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-1 text-center">
                  You had <Text className="font-bold text-slate-700 dark:text-slate-200">{lastFlipContext.isMeFlipper ? lastFlipContext.choice : lastFlipContext.partnerChoice}</Text> vs {lastFlipContext.isMeFlipper ? partnerName : lastFlipContext.flipperName} had <Text className="font-bold text-slate-700 dark:text-slate-200">{lastFlipContext.isMeFlipper ? lastFlipContext.partnerChoice : lastFlipContext.choice}</Text>
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* History Log */}
        <View className="px-6">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
              Flip History
            </Text>
            {history.length > 0 && (
              <TouchableOpacity 
                onPress={handleClearHistory}
                hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
                activeOpacity={0.7}
                className="px-3 py-1 bg-rose-50 dark:bg-rose-950/40 rounded-full border border-rose-200/60 dark:border-rose-900/40 flex-row items-center"
              >
                <Ionicons name="trash-outline" size={13} color={isDark ? "#fda4af" : "#e11d48"} style={{ marginRight: 4 }} />
                <Text className="text-xs font-bold text-rose-600 dark:text-rose-400">Clear</Text>
              </TouchableOpacity>
            )}
          </View>
          
          {history.length === 0 ? (
            <View className="bg-white dark:bg-[#271318] rounded-3xl p-6 items-center border border-slate-100 dark:border-rose-950/20">
              <Ionicons name="list-outline" size={28} color="#cbd5e1" />
              <Text className="text-slate-400 dark:text-slate-500 font-semibold text-xs mt-2 text-center">
                No flips in this session yet. Toss the coin to start!
              </Text>
            </View>
          ) : (
            <View className="bg-white dark:bg-[#271318] rounded-2xl p-3 border border-slate-100 dark:border-rose-950/20">
              {history.map((item, idx) => (
                <View 
                  key={item.id} 
                  className={`flex-row items-center justify-between py-3 px-2 ${
                    idx !== history.length - 1 ? 'border-b border-slate-100 dark:border-rose-950/10' : ''
                  }`}
                >
                  <View className="flex-row items-center flex-1 mr-2">
                    <View className={`w-8 h-8 rounded-full items-center justify-center mr-2.5 ${
                      item.result === 'HEADS' ? 'bg-rose-50 dark:bg-rose-500/10' : 'bg-rose-100/50 dark:bg-rose-600/10'
                    }`}>
                      <Ionicons 
                        name={item.result === 'HEADS' ? 'heart' : 'rose'} 
                        size={16} 
                        color={item.result === 'HEADS' ? '#e11d48' : '#f43f5e'} 
                      />
                    </View>
                    <View className="flex-1">
                      <Text className="text-slate-800 dark:text-white font-bold text-xs" numberOfLines={1}>
                        {item.flipperName} picked {item.choice} → {item.result}
                      </Text>
                    </View>
                  </View>

                  <View className="items-end">
                    <View className={`px-2 py-0.5 rounded-full ${
                      item.isMeWinner ? 'bg-teal-50 dark:bg-teal-500/10' : 'bg-rose-50 dark:bg-rose-500/10'
                    }`}>
                      <Text className={`font-black text-[9px] uppercase ${
                        item.isMeWinner ? 'text-teal-600 dark:text-teal-400' : 'text-rose-600 dark:text-rose-400'
                      }`}>
                        {item.outcome}
                      </Text>
                    </View>
                    <Text className="text-[9px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">
                      {item.time}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  coin: {
    width: 130,
    height: 130,
    borderRadius: 65,
  }
});
