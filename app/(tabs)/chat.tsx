import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, SafeAreaView, Platform, StatusBar, TextInput, KeyboardAvoidingView, Alert, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getActiveRoom, SentChallenge } from '@/services/roomService';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSidebar } from '@/context/SidebarContext';

export default function Chat() {
  const { openSidebar } = useSidebar();
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [activeChallenge, setActiveChallenge] = useState<SentChallenge | null>(null);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setIsKeyboardVisible(true)
    );
    const hideSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setIsKeyboardVisible(false)
    );

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadActiveChallenge = async () => {
      try {
        const room = await getActiveRoom();
        if (isMounted) {
          setActiveChallenge(room?.game_state?.active_challenge || null);
        }
      } catch (error) {
        console.log('Failed to load active challenge:', error);
      }
    };

    loadActiveChallenge();
    const intervalId = setInterval(loadActiveChallenge, 20000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-[#fff6f5] dark:bg-[#0F0608]" style={{ paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 }}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={isDark ? "#0F0608" : "#fff6f5"} />
      
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 py-4 bg-[#fff6f5] dark:bg-[#0F0608] z-10">
        <TouchableOpacity onPress={openSidebar}>
          <Ionicons name="menu-outline" size={30} color={isDark ? "#fff" : "#9f1239"} />
        </TouchableOpacity>
        <View className="flex-row items-center gap-1.5">
          <Ionicons name="infinite" size={28} color={isDark ? "#fda4af" : "#be123c"} style={{ transform: [{ rotate: '-15deg' }] }} />
          <Text className="text-red-700 dark:text-rose-400 font-black text-xl tracking-tight">SoulShuffle</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/profile')}>
          <Image 
            source={{ uri: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop' }} 
            className="w-10 h-10 rounded-full border border-rose-200 dark:border-rose-950/30"
          />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        className="flex-1"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView 
          showsVerticalScrollIndicator={false} 
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 150, paddingTop: 10 }}
        >
          {/* Date Badge */}
          <View className="items-center mb-8">
            <View className="bg-rose-100/60 dark:bg-rose-950/20 px-4 py-1.5 rounded-full">
              <Text className="text-[10px] font-bold text-slate-500 dark:text-slate-400 tracking-widest uppercase">Today</Text>
            </View>
          </View>

          {/* Partner Message (Text) */}
          <View className="flex-row mb-6 items-end relative">
            <Image 
              source={{ uri: 'https://plus.unsplash.com/premium_photo-1678120616858-54b35e2380f9?w=100&h=100&fit=crop' }} 
              className="w-8 h-8 rounded-full mr-3 mb-1"
            />
            <View className="bg-[#e4dad6]/20 dark:bg-[#271318] rounded-2xl rounded-bl-sm p-4 w-[75%] shadow-sm shadow-slate-100 dark:shadow-none border border-white/50 dark:border-rose-950/20 relative">
              <Text className="text-[#3c3a3a] dark:text-slate-200 text-[15px] leading-6 font-medium">
                Hey! I just finished the &quot;Morning Coffee&quot; dare. It made me think of you all morning. ❤️
              </Text>
              
              {/* Heart Reaction Badge */}
              <View className="absolute -bottom-3 -right-2 bg-white dark:bg-[#180D10] px-2 py-0.5 rounded-full flex-row items-center shadow-sm shadow-slate-200 dark:shadow-none border border-slate-50 dark:border-rose-950/20">
                <Text className="text-[10px]">❤️</Text>
                <Text className="text-[10px] font-bold text-slate-500 dark:text-slate-400 ml-1">1</Text>
              </View>
            </View>
          </View>

          {/* User Message (Text) */}
          <View className="mb-6 items-end">
            <View className="bg-[#e24e5d] dark:bg-rose-700 rounded-2xl rounded-br-sm p-4 w-[80%] shadow-md shadow-red-200 dark:shadow-none">
              <Text className="text-white text-[15px] leading-6 font-medium">
                That&apos;s so sweet! Are you ready for the next one? I&apos;m feeling adventurous today.
              </Text>
            </View>
            <View className="flex-row items-center mt-1 mr-1">
              <Text className="text-[10px] font-bold text-slate-400 dark:text-slate-400/60 tracking-wide uppercase mr-1">Read 11:42 AM</Text>
              <Ionicons name="checkmark-done" size={14} color={isDark ? "#f43f5e" : "#e24e5d"} />
            </View>
          </View>

          {/* System/Dare Message Context Card */}
          <View className="w-[90%] self-center bg-white dark:bg-[#271318] rounded-[32px] overflow-hidden shadow-lg dark:shadow-none border border-white dark:border-rose-950/20 mb-6">
            <View className="relative h-40 bg-rose-300">
              <Image 
                source={activeChallenge?.image ? (typeof activeChallenge.image === 'string' ? { uri: activeChallenge.image } : activeChallenge.image) : require('@/assets/images/couple_cover.jpeg')} 
                className="w-full h-full opacity-60"
              />
              <View className="absolute inset-0 bg-[#8a2f3d]/30 dark:bg-[#0F0608]/50 items-center justify-center">
                <Text className="text-white text-[10px] font-bold tracking-[0.2em] mb-2 uppercase">Dare</Text>
                <Text className="text-white/80 text-[8px] tracking-[0.3em] uppercase opacity-60">Love Challenge</Text>
              </View>
              {/* New Dare Alert Badge */}
              <View className="absolute bottom-4 left-4 bg-[#fde047] px-3 py-1 rounded-full shadow-sm">
                <Text className="text-[#854d0e] font-bold text-[10px] tracking-widest uppercase">New Dare Alert</Text>
              </View>
            </View>
            
            <View className="p-6">
              <Text className="text-xl font-bold text-[#b91c1c] dark:text-rose-400 tracking-tight mb-2">
                {activeChallenge?.title || 'No Active Challenge Yet'}
              </Text>
              <Text className="text-slate-500 dark:text-slate-400 text-[14px] leading-5 font-medium mb-6">
                {activeChallenge?.description || 'When your partner sends a dare, it will appear here.'}
              </Text>
              <TouchableOpacity
                className="bg-rose-50 dark:bg-[#0F0608] rounded-full py-4 items-center justify-center border border-rose-100 dark:border-rose-950/40 shadow-sm active:opacity-80"
                onPress={() => {
                  if (!activeChallenge) {
                    Alert.alert('No Challenge', 'There is no active challenge to accept yet.');
                    return;
                  }
                  Alert.alert('Dare Accepted', `${activeChallenge.title} is now active.`);
                }}
              >
                <Text className="text-[#b91c1c] dark:text-rose-400 font-bold text-[15px]">Accept Dare</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Voice Message & Floating Reactions */}
          <View className="flex-row items-end mb-10 relative">
            <View className="w-8 h-8 rounded-full mr-3 mb-1 overflow-hidden" />
            
            <View className="flex-1">
              {/* Voice Message Bubble */}
              <View className="bg-[#7de5d4] dark:bg-teal-950/20 rounded-full p-2 pl-3 pr-4 shadow-sm w-[75%] flex-row items-center border border-teal-200/50 dark:border-teal-900/40">
                <TouchableOpacity className="bg-white dark:bg-[#271318] w-10 h-10 rounded-full items-center justify-center shadow-sm">
                  <Ionicons name="play" size={18} color={isDark ? "#2dd4bf" : "#0d5f5a"} style={{ marginLeft: 2 }} />
                </TouchableOpacity>
                
                {/* Simulated Waveform using styling */}
                <View className="flex-1 flex-row items-center justify-between px-3 h-8">
                  <View className="w-1 bg-[#0d5f5a]/40 dark:bg-teal-400/20 h-[20%] rounded-full"></View>
                  <View className="w-1 bg-[#0d5f5a]/60 dark:bg-teal-400/40 h-[40%] rounded-full"></View>
                  <View className="w-1 bg-[#0d5f5a]/80 dark:bg-teal-400/60 h-[80%] rounded-full"></View>
                  <View className="w-1 bg-[#0d5f5a] dark:bg-teal-400 h-[100%] rounded-full"></View>
                  <View className="w-1 bg-[#0d5f5a]/80 dark:bg-teal-400/60 h-[60%] rounded-full"></View>
                  <View className="w-1 bg-[#0d5f5a]/60 dark:bg-teal-400/40 h-[30%] rounded-full"></View>
                  <View className="w-1 bg-[#0d5f5a]/40 dark:bg-teal-400/20 h-[20%] rounded-full"></View>
                  <View className="w-1 bg-[#0d5f5a]/30 dark:bg-teal-400/10 h-[10%] rounded-full"></View>
                </View>

                <Text className="text-[#0d5f5a] dark:text-teal-400 font-bold text-[11px] ml-1">0:14</Text>
              </View>

              {/* Floating Reaction Pill */}
              <View className="absolute -bottom-8 -left-4 bg-white dark:bg-[#271318] rounded-full px-4 py-2 flex-row items-center gap-2 shadow-xl shadow-slate-300 dark:shadow-none z-20 border border-slate-50 dark:border-rose-950/20">
                <TouchableOpacity><Text className="text-xl">❤️</Text></TouchableOpacity>
                <TouchableOpacity><Text className="text-xl">🔥</Text></TouchableOpacity>
                <TouchableOpacity><Text className="text-xl">✨</Text></TouchableOpacity>
                <TouchableOpacity><Text className="text-xl">🫂</Text></TouchableOpacity>
                <TouchableOpacity><Text className="text-xl">🌹</Text></TouchableOpacity>
                <TouchableOpacity><Text className="text-xl">🥂</Text></TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
        
        {/* Chat Input Bar */}
        <View 
          className="bg-white dark:bg-[#0F0608] px-4 py-3 flex-row items-center border-t border-slate-100 dark:border-rose-950/20 shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.05)] dark:shadow-none pb-safe"
          style={{ marginBottom: isKeyboardVisible ? 0 : (Platform.OS === 'ios' ? 100 : 92) }}
        >
          <TouchableOpacity className="bg-slate-100 dark:bg-[#271318] w-10 h-10 rounded-full items-center justify-center mr-3">
            <Ionicons name="add" size={24} color={isDark ? "#fff" : "#64748b"} />
          </TouchableOpacity>
          
          <View className="flex-1 bg-slate-100 dark:bg-[#271318] rounded-full h-11 flex-row items-center px-4 mr-3">
            <TextInput 
              placeholder="Message..."
              placeholderTextColor={isDark ? "rgba(255, 255, 255, 0.3)" : "#94a3b8"}
              className="flex-1 text-[15px] font-medium text-slate-800 dark:text-white"
              value={message}
              onChangeText={setMessage}
            />
            <TouchableOpacity>
              <Ionicons name="happy-outline" size={22} color={isDark ? "#fff" : "#94a3b8"} />
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity className={message.trim() ? "bg-[#e24e5d] dark:bg-rose-600 w-11 h-11 rounded-full items-center justify-center shadow-md shadow-red-200 dark:shadow-none" : "bg-[#e24e5d] dark:bg-rose-600 w-11 h-11 rounded-full items-center justify-center shadow-md shadow-red-200 dark:shadow-none"}>
            <Ionicons name={message.trim() ? "send" : "mic"} size={message.trim() ? 16 : 20} color="white" style={message.trim() ? { transform: [{ rotate: '-45deg' }], marginLeft: 2, marginBottom: 2 } : {}} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
