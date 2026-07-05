import { useSidebar } from '@/context/SidebarContext';
import { useThemeToggle } from '@/hooks/use-color-scheme';
import { Ionicons } from '@expo/vector-icons';
import React, { useState, useEffect } from 'react';
import { Image, Platform, ScrollView, StatusBar, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getMyProfile } from '@/services/authService';
import { getActiveRoom } from '@/services/roomService';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Profile() {
  const { openSidebar } = useSidebar();
  const { colorScheme, toggleTheme } = useThemeToggle();
  const isDark = colorScheme === 'dark';

  const [userName, setUserName] = useState('User');
  const [partnerName, setPartnerName] = useState('Partner');
  const [activeRoom, setActiveRoom] = useState<any>(null);
  const [daysCount, setDaysCount] = useState<number | null>(null);

  useEffect(() => {
    const loadProfileAndRoom = async () => {
      try {
        const profile = await getMyProfile();
        if (profile?.first_name || profile?.users?.name) {
          setUserName(profile.first_name || profile.users.name.split(' ')[0]);
        }
      } catch (err) {
        console.log('Profile fetch failed in profile.tsx:', err);
      }

      try {
        const room = await getActiveRoom();
        setActiveRoom(room);
        if (room) {
          // Resolve partner name from AsyncStorage or room properties
          const cachedPartner = await AsyncStorage.getItem(`partnerName_${room.id}`);
          if (cachedPartner) {
            setPartnerName(cachedPartner);
          } else {
            const resolved = room.partner_name || 'Partner';
            setPartnerName(resolved);
          }

          // Calculate connection duration in days
          if (room.created_at) {
            const created = new Date(room.created_at);
            const now = new Date();
            const diffTime = Math.abs(now.getTime() - created.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            setDaysCount(diffDays);
          }
        }
      } catch (err) {
        console.log('Active room fetch failed in profile.tsx:', err);
      }
    };
    loadProfileAndRoom();
  }, []);

  // ── Suggestion form state ───────────────────────────────
  const CATEGORIES = ['Romantic 💕', 'Adventure 🏕️', 'Cozy 🕯️', 'Spicy 🔥', 'Creative 🎨'];
  const [suggestionText, setSuggestionText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);

  const handleSubmitSuggestion = () => {
    if (!suggestionText.trim()) return;
    setSubmitted(true);
    setSuggestionText('');
    setSelectedCategory('');
    setTimeout(() => setSubmitted(false), 3500);
  };

  return (
    <SafeAreaView className="flex-1 bg-[#fdfaf9] dark:bg-[#0F0608]" edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={isDark ? "#0F0608" : "#fdfaf9"} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 160 }}>

        {/* Header */}
        <View className="flex-row items-center justify-between px-6 pt-5 pb-3">
          <TouchableOpacity onPress={openSidebar}>
            <Ionicons name="menu-outline" size={30} color={isDark ? "#fff" : "#9f1239"} />
          </TouchableOpacity>
          <View className="flex-row items-center gap-1.5">
            <Ionicons name="infinite" size={28} color={isDark ? "#fda4af" : "#be123c"} style={{ transform: [{ rotate: '-15deg' }] }} />
            <Text className="text-red-700 dark:text-rose-400 font-black text-xl tracking-tight">SoulShuffle</Text>
          </View>
          <TouchableOpacity>
            <Image
              source={{ uri: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop' }}
              className="w-8 h-8 rounded-full border border-rose-200 dark:border-rose-950/30"
            />
          </TouchableOpacity>
        </View>

        {/* Profile Avatars Section */}
        <View className="items-center mt-4">
          <View className="flex-row justify-center relative w-full h-40">
            {/* Left Image (Alex) */}
            <View className="absolute right-1/2 mr-[-10px] bg-slate-800 rounded-t-[40px] rounded-br-[40px] rounded-bl-[10px] overflow-hidden w-40 h-40 shadow-lg z-10">
              <Image
                source={{ uri: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&h=200&fit=crop' }}
                className="w-full h-full"
              />
            </View>

            {/* Right Image (Sam) */}
            <View className="absolute left-1/2 ml-[-20px] bg-[#669894] rounded-t-[40px] rounded-bl-[40px] rounded-br-[10px] overflow-hidden w-40 h-40 shadow-lg">
              <Image
                source={{ uri: 'https://plus.unsplash.com/premium_photo-1678120616858-54b35e2380f9?w=200&h=200&fit=crop' }}
                className="w-full h-full"
              />
            </View>

            {/* Shared Badge */}
            <View className="absolute bottom-[-16px] z-20 bg-[#0d5f5a] dark:bg-teal-600 px-4 py-2 rounded-full flex-row items-center justify-center shadow-lg">
              <Ionicons name="heart" size={12} color="white" />
              <Text className="text-white font-bold text-[10px] ml-1 tracking-widest uppercase">Happy Together</Text>
            </View>
          </View>

          <Text className="text-3xl font-black text-[#af2c3b] dark:text-white mt-8 tracking-tight">
            {activeRoom ? `${userName} & ${partnerName}` : userName}
          </Text>
          <Text className="text-slate-500 dark:text-slate-400 font-medium text-sm mt-1">
            {daysCount !== null ? `Together for ${daysCount} ${daysCount === 1 ? 'day' : 'days'}` : 'Happy Together'}
          </Text>
        </View>

        {/* Top Cards Info */}
        <View className="px-6 mt-8">
          <View className="bg-white dark:bg-[#271318] rounded-[24px] p-5 shadow-sm mb-4 border border-slate-100/50 dark:border-rose-950/20">
            <Ionicons name="book" size={18} color={isDark ? "#f43f5e" : "#af2c3b"} className="mb-2" />
            <Text className="text-lg font-bold text-slate-800 dark:text-white tracking-tight mt-1">Memory Book</Text>
            <Text className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">124 moments captured since 2021</Text>
          </View>

          <View className="bg-[#fc6062] dark:bg-indigo-900/80 rounded-[24px] p-5 shadow-lg mb-4 flex-col justify-center">
            <Ionicons name="trophy" size={18} color={isDark ? "#fff" : "#3c0c11"} className="mb-2" />
            <Text className="text-lg font-black text-slate-900 dark:text-white tracking-tight mt-1">Level 14</Text>
            <Text className="text-[10px] font-bold text-slate-900/60 dark:text-slate-200/60 mt-1 tracking-widest uppercase">Romantic Strategists</Text>
          </View>

          <View className="bg-[#e4dad6]/30 dark:bg-[#271318]/80 rounded-[24px] p-6 shadow-sm border border-slate-100 dark:border-rose-950/30 overflow-hidden relative">
            <Text className="text-base font-bold text-slate-800 dark:text-white tracking-tight mb-3">Favorite Memory</Text>
            <Text className="text-sm font-medium italic text-slate-600 dark:text-slate-300 leading-6 pr-6">
              &quot;That rainy afternoon in Kyoto when we got lost in the bamboo forest and ended up in that tiny tea house.&quot;
            </Text>
            <TouchableOpacity className="mt-4 flex-row items-center">
              <Text className="text-xs font-bold text-[#af2c3b] dark:text-rose-400 tracking-wide uppercase">View All Memories</Text>
              <Ionicons name="arrow-forward" size={12} color={isDark ? "#f43f5e" : "#af2c3b"} className="ml-1" />
            </TouchableOpacity>
            <Ionicons name="images" size={80} color={isDark ? "#1e293b" : "#e5e5e5"} style={{ position: 'absolute', bottom: -20, right: -10, opacity: 0.8 }} />
          </View>
        </View>

        {/* Couple Goals Section */}
        <View className="mt-8 px-6">
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-row items-center">
              <View className="bg-[#5ce1e6]/40 dark:bg-teal-950/60 w-8 h-8 rounded-full items-center justify-center mr-3">
                <Ionicons name="flag" size={14} color={isDark ? "#2dd4bf" : "#000"} />
              </View>
              <Text className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">Couple Goals</Text>
            </View>
            <TouchableOpacity>
              <Text className="text-[10px] font-bold text-[#af2c3b] dark:text-rose-400 tracking-widest uppercase">Set New Goal</Text>
            </TouchableOpacity>
          </View>

          <View className="bg-[#f5eeed]/60 dark:bg-[#271318]/50 rounded-[32px] p-6 shadow-sm shadow-slate-100 dark:shadow-none">
            <Text className="text-[10px] font-bold text-slate-400 dark:text-slate-400 tracking-widest uppercase mb-1">Current Milestone</Text>
            <View className="flex-row items-end justify-between">
              <Text className="text-lg font-bold text-slate-800 dark:text-white leading-6 max-w-[70%]">First International Trip Together</Text>
              <Text className="text-xl font-black text-[#0d5f5a] dark:text-teal-400">75%</Text>
            </View>

            <View className="w-full h-3 bg-slate-200/80 dark:bg-[#0F0608]/80 rounded-full mt-4 flex-row">
              <View className="w-[75%] h-full bg-[#0d5f5a] dark:bg-teal-500 rounded-full"></View>
            </View>

            <Text className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-3 mb-6">
              Only 4 more dares to unlock the &quot;Traveler&quot; badge!
            </Text>

            <View className="flex-col gap-4">
              <View className="flex-row">
                <Ionicons name="checkmark-circle" size={22} color={isDark ? "#2dd4bf" : "#0d5f5a"} />
                <View className="ml-3">
                  <Text className="text-sm font-bold text-slate-800 dark:text-white">30 Dares Done</Text>
                  <Text className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">Level 1 Complete</Text>
                </View>
              </View>

              <View className="flex-row">
                <Ionicons name="ellipse-outline" size={22} color={isDark ? "#334155" : "#94a3b8"} />
                <View className="ml-3">
                  <Text className="text-sm font-bold text-slate-800 dark:text-white">6-Month Streak</Text>
                  <Text className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">4 months current</Text>
                </View>
              </View>

              <View className="flex-row">
                <Ionicons name="checkmark-circle" size={22} color={isDark ? "#2dd4bf" : "#0d5f5a"} />
                <View className="ml-3">
                  <Text className="text-sm font-bold text-slate-800 dark:text-white">Photo Journal</Text>
                  <Text className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">100+ photos added</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Dare Preferences Section */}
        <View className="mt-8 px-6">
          <Text className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight mb-4">Dare Preferences</Text>

          <View className="bg-white dark:bg-[#271318] rounded-[32px] p-6 shadow-sm border border-slate-50/50 dark:border-rose-950/20">
            <View className="flex-row items-center justify-between mb-6">
              <View className="flex-row items-center">
                <Ionicons name="restaurant" size={18} color={isDark ? "#f43f5e" : "#af2c3b"} />
                <Text className="text-[15px] font-semibold text-slate-800 dark:text-white ml-4">Food & Dining</Text>
              </View>
              <Switch value={true} trackColor={{ false: "#e2e8f0", true: "#0d5f5a" }} thumbColor="#fff" />
            </View>

            <View className="flex-row items-center justify-between mb-6">
              <View className="flex-row items-center">
                <Ionicons name="compass" size={18} color={isDark ? "#f43f5e" : "#af2c3b"} />
                <Text className="text-[15px] font-semibold text-slate-800 dark:text-white ml-4">Outdoor Adventures</Text>
              </View>
              <Switch value={true} trackColor={{ false: "#e2e8f0", true: "#0d5f5a" }} thumbColor="#fff" />
            </View>

            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center">
                <Ionicons name="home" size={18} color={isDark ? "#c084fc" : "#857169"} />
                <Text className="text-[15px] font-semibold text-slate-800 dark:text-white ml-4">Cozy Nights In</Text>
              </View>
              <Switch value={false} trackColor={{ false: "#e2e8f0", true: "#0d5f5a" }} thumbColor="#fff" />
            </View>
          </View>
        </View>


        {/* ── Suggest a Card ───────────────────────────── */}
        <View className="px-6 mt-8">
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-row items-center">
              <View className="bg-violet-100 dark:bg-violet-950/60 w-8 h-8 rounded-full items-center justify-center mr-3">
                <Ionicons name="sparkles" size={14} color={isDark ? '#a78bfa' : '#7c3aed'} />
              </View>
              <Text className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">Suggest a Card</Text>
            </View>
            <View className="bg-violet-100 dark:bg-violet-900/40 px-2.5 py-1 rounded-full">
              <Text className="text-[10px] font-bold text-violet-600 dark:text-violet-300 tracking-widest uppercase">For Admins</Text>
            </View>
          </View>

          <View style={{
            backgroundColor: isDark ? '#7c2d12' : '#ff6b35',
            borderRadius: 28,
            padding: 20,
            transform: [{ translateY: -6 }],
            shadowColor: '#ea580c',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: isDark ? 0.5 : 0.45,
            shadowRadius: 18,
            elevation: 10,
            borderWidth: 1,
            borderColor: isDark ? '#c2410c' : '#fb923c',
          }}>

            {submitted ? (
              /* ── Success State ── */
              <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                  <Ionicons name="checkmark-circle" size={34} color="#fff" />
                </View>
                <Text style={{ fontSize: 16, fontWeight: '900', color: '#fff', letterSpacing: -0.5 }}>Thanks for the idea! ✨</Text>
                <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: '500', marginTop: 6, textAlign: 'center', paddingHorizontal: 16, lineHeight: 18 }}>
                  Our team will review your suggestion and may add it to the deck.
                </Text>
              </View>
            ) : (
              /* ── Input State ── */
              <View>
                <Text style={{ fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.75)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>Pick a category</Text>

                {/* Category pills */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
                  {CATEGORIES.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      onPress={() => setSelectedCategory(selectedCategory === cat ? '' : cat)}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 50,
                        borderWidth: 1.5,
                        borderColor: selectedCategory === cat ? '#fff' : 'rgba(255,255,255,0.45)',
                        backgroundColor: selectedCategory === cat ? '#fff' : 'rgba(255,255,255,0.15)',
                      }}
                    >
                      <Text style={{
                        fontSize: 12,
                        fontWeight: '700',
                        color: selectedCategory === cat ? '#ea580c' : '#fff',
                      }}>
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={{ fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.75)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>Your card idea</Text>

                {/* Text input */}
                <View style={{
                  borderWidth: inputFocused ? 2 : 1.5,
                  borderColor: inputFocused ? '#fff' : 'rgba(255,255,255,0.5)',
                  borderRadius: 16,
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  padding: 14,
                  marginBottom: 14,
                }}>
                  <TextInput
                    value={suggestionText}
                    onChangeText={setSuggestionText}
                    onFocus={() => setInputFocused(true)}
                    onBlur={() => setInputFocused(false)}
                    placeholder="e.g. Write a love letter to each other and read them aloud..."
                    placeholderTextColor="rgba(255,255,255,0.55)"
                    multiline
                    numberOfLines={3}
                    maxLength={300}
                    style={{
                      color: '#fff',
                      fontSize: 13,
                      fontWeight: '500',
                      lineHeight: 20,
                      minHeight: 72,
                      textAlignVertical: 'top',
                    }}
                  />
                </View>

                {/* Char counter + Submit */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: '500' }}>
                    {suggestionText.length}/300
                  </Text>
                  <TouchableOpacity
                    onPress={handleSubmitSuggestion}
                    disabled={!suggestionText.trim()}
                    style={{
                      backgroundColor: suggestionText.trim() ? '#fff' : 'rgba(255,255,255,0.25)',
                      paddingHorizontal: 20,
                      paddingVertical: 10,
                      borderRadius: 50,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 3 },
                      shadowOpacity: suggestionText.trim() ? 0.15 : 0,
                      shadowRadius: 6,
                      elevation: suggestionText.trim() ? 4 : 0,
                    }}
                  >
                    <Ionicons
                      name="send"
                      size={14}
                      color={suggestionText.trim() ? '#ea580c' : 'rgba(255,255,255,0.5)'}
                    />
                    <Text style={{
                      color: suggestionText.trim() ? '#ea580c' : 'rgba(255,255,255,0.5)',
                      fontSize: 13,
                      fontWeight: '800',
                    }}>
                      Submit Idea
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Settings */}
        <View className="mt-8 px-6 mb-4">
          <Text className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight mb-4">Settings</Text>

          <View className="bg-white dark:bg-[#271318] rounded-[32px] p-6 py-2 shadow-sm border border-slate-50/50 dark:border-rose-950/20">
            {/* Dark Mode Switch Toggle */}
            <View className="flex-row items-center justify-between py-5 border-b border-slate-100 dark:border-rose-950/20">
              <View className="flex-row items-center flex-1">
                <Ionicons name="moon" size={18} color={isDark ? "#fff" : "#857169"} />
                <View className="ml-4 flex-1">
                  <Text className="text-sm font-bold text-slate-800 dark:text-white">Dark Mode</Text>
                  <Text className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-1 pr-4 leading-4">Switch to premium dark mode theme</Text>
                </View>
              </View>
              <Switch
                value={isDark}
                onValueChange={toggleTheme}
                trackColor={{ false: isDark ? "#1e293b" : "#cbd5e1", true: isDark ? "#0d9488" : "#fda4af" }}
                thumbColor={isDark ? "#2dd4bf" : "#f1f5f9"}
              />
            </View>

            <TouchableOpacity className="flex-row items-center justify-between py-5 border-b border-slate-100 dark:border-rose-950/20">
              <View className="flex-row items-center flex-1">
                <Ionicons name="lock-closed" size={18} color={isDark ? "#fff" : "#857169"} />
                <View className="ml-4 flex-1">
                  <Text className="text-sm font-bold text-slate-800 dark:text-white">Privacy & Data</Text>
                  <Text className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-1 pr-4 leading-4">Manage what your partner and friends see</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
            </TouchableOpacity>

            <TouchableOpacity className="flex-row items-center justify-between py-5 border-b border-slate-100 dark:border-rose-950/20">
              <View className="flex-row items-center flex-1">
                <Ionicons name="notifications" size={18} color={isDark ? "#fff" : "#857169"} />
                <View className="ml-4 flex-1">
                  <Text className="text-sm font-bold text-slate-800 dark:text-white">Notifications</Text>
                  <Text className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-1 pr-4 leading-4">Daily reminders and dare alerts</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
            </TouchableOpacity>

            <TouchableOpacity className="flex-row items-center justify-between py-5">
              <View className="flex-row items-center flex-1">
                <Ionicons name="people" size={18} color={isDark ? "#fff" : "#857169"} />
                <View className="ml-4 flex-1">
                  <Text className="text-sm font-bold text-slate-800 dark:text-white">Invite Partner</Text>
                  <Text className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-1 pr-4 leading-4">Resend invite or change partner email</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
            </TouchableOpacity>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
