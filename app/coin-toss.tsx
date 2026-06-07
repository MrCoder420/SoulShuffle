import React, { useState } from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, Platform, StatusBar, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSequence, withDelay, runOnJS } from 'react-native-reanimated';
import { useColorScheme } from '@/hooks/use-color-scheme';

type CoinFace = 'HEADS' | 'TAILS';

interface HistoryItem {
  id: string;
  choice: CoinFace;
  result: CoinFace;
  outcome: 'WON' | 'LOST';
  time: string;
}

export default function CoinToss() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Game States
  const [userChoice, setUserChoice] = useState<CoinFace>('HEADS');
  const [result, setResult] = useState<CoinFace | null>(null);
  const [isFlipping, setIsFlipping] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showResultCard, setShowResultCard] = useState(false);

  // Animation Shared Values
  const spinValue = useSharedValue(0);
  const translateYValue = useSharedValue(0);
  const scaleValue = useSharedValue(1);

  // Reanimated style for the 3D-like flip
  const animatedCoinStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { rotateY: `${spinValue.value}deg` },
        { translateY: translateYValue.value },
        { scale: scaleValue.value }
      ]
    };
  });

  const onFlipComplete = (finalResult: CoinFace) => {
    setResult(finalResult);
    setIsFlipping(false);
    setShowResultCard(true);

    const isWinner = userChoice === finalResult;
    const newItem: HistoryItem = {
      id: Date.now().toString(),
      choice: userChoice,
      result: finalResult,
      outcome: isWinner ? 'WON' : 'LOST',
      time: new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };
    setHistory(prev => [newItem, ...prev]);
  };

  const handleFlip = () => {
    if (isFlipping) return;

    setIsFlipping(true);
    setShowResultCard(false);
    setResult(null);

    // Determine random outcome (50/50 chance)
    const outcomes: CoinFace[] = ['HEADS', 'TAILS'];
    const finalOutcome = outcomes[Math.floor(Math.random() * outcomes.length)];

    // Calculate total rotations: land on heads (even 180s) or tails (odd 180s)
    // Heads face: 0, 360, 720, 1080...
    // Tails face: 180, 540, 900, 1260...
    const baseRotations = 1080; // 3 full spins
    const targetDegree = finalOutcome === 'HEADS' 
      ? baseRotations 
      : baseRotations + 180;

    // Reset shared values
    spinValue.value = 0;
    translateYValue.value = 0;
    scaleValue.value = 1;

    // Trigger sequential animations representing physics of a toss
    spinValue.value = withTiming(targetDegree, { duration: 1200 });
    
    // parabolic height arc (goes up and comes down)
    translateYValue.value = withSequence(
      withTiming(-120, { duration: 600 }),
      withTiming(0, { duration: 600 })
    );

    // scale up when close, scale down on land
    scaleValue.value = withSequence(
      withTiming(1.4, { duration: 600 }),
      withTiming(1, { duration: 600 }, (finished) => {
        if (finished) {
          runOnJS(onFlipComplete)(finalOutcome);
        }
      })
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-[#fff8f7] dark:bg-[#221517]" style={{ paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 }}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={isDark ? "#221517" : "#fff8f7"} />

      {/* Header */}
      <View className="flex-row items-center justify-between px-6 py-4 bg-[#fff8f7] dark:bg-[#221517] z-10">
        <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 rounded-full bg-white dark:bg-[#332225] items-center justify-center shadow-sm border border-slate-50 dark:border-rose-950/20">
          <Ionicons name="arrow-back" size={22} color={isDark ? "#fff" : "#9f1239"} />
        </TouchableOpacity>
        <Text className="text-slate-900 dark:text-white font-black text-[17px] tracking-tight">Coin Toss</Text>
        <View className="w-10" /> {/* Spacer */}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        {/* Title Section */}
        <View className="items-center px-6 mt-6">
          <Text className="text-[28px] font-black text-[#af2c3b] dark:text-rose-400 text-center tracking-tight leading-8">
            Can&apos;t agree on something?
          </Text>
          <Text className="text-slate-500 dark:text-slate-400 font-semibold text-center text-sm mt-3 pr-4">
            Pick your side, flip the coin, and let fate decide who wins this round!
          </Text>
        </View>

        {/* Choice Selector */}
        <View className="flex-row justify-center px-6 mt-8 mb-10 gap-4">
          <TouchableOpacity
            className={`flex-1 flex-row items-center justify-center py-4 rounded-2xl border-[2px] ${
              userChoice === 'HEADS'
                ? 'bg-[#af2c3b] border-[#af2c3b] dark:bg-rose-600 dark:border-rose-600'
                : 'bg-white border-slate-100 dark:bg-[#332225] dark:border-rose-950/20'
            }`}
            onPress={() => !isFlipping && setUserChoice('HEADS')}
            disabled={isFlipping}
          >
            <Ionicons name="heart" size={18} color={userChoice === 'HEADS' ? '#fff' : '#e11d48'} />
            <Text className={`font-black text-[14px] ml-2 ${userChoice === 'HEADS' ? 'text-white' : 'text-slate-800 dark:text-slate-200'}`}>
              HEADS (Heart)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className={`flex-1 flex-row items-center justify-center py-4 rounded-2xl border-[2px] ${
              userChoice === 'TAILS'
                ? 'bg-[#af2c3b] border-[#af2c3b] dark:bg-rose-600 dark:border-rose-600'
                : 'bg-white border-slate-100 dark:bg-[#332225] dark:border-rose-950/20'
            }`}
            onPress={() => !isFlipping && setUserChoice('TAILS')}
            disabled={isFlipping}
          >
            <Ionicons name="rose" size={18} color={userChoice === 'TAILS' ? '#fff' : '#f43f5e'} />
            <Text className={`font-black text-[14px] ml-2 ${userChoice === 'TAILS' ? 'text-white' : 'text-slate-800 dark:text-slate-200'}`}>
              TAILS (Rose)
            </Text>
          </TouchableOpacity>
        </View>

        {/* Interactive Flipping Coin Area */}
        <View className="items-center justify-center h-60 relative mb-8">
          <Animated.View 
            style={[styles.coin, animatedCoinStyle]}
            className="shadow-2xl shadow-rose-900/40 dark:shadow-black"
          >
            {/* Outer Gold Ring */}
            <View className="w-full h-full rounded-full border-[8px] border-[#dfb15b] bg-[#f9ebce] dark:bg-[#251711] items-center justify-center relative">
              {/* Gold Inner Circle border */}
              <View className="w-[85%] h-[85%] rounded-full border border-dashed border-[#dfb15b]/60 items-center justify-center bg-[#fdf5e7] dark:bg-[#2b1b13]">
                {/* Dynamic Icon inside Coin depending on landing result or flipping state */}
                {isFlipping ? (
                  <Ionicons name="sparkles" size={48} color="#dfb15b" />
                ) : result === 'TAILS' ? (
                  <Ionicons name="rose" size={54} color="#f43f5e" />
                ) : (
                  <Ionicons name="heart" size={54} color="#e11d48" />
                )}
              </View>
            </View>
          </Animated.View>
        </View>

        {/* Flip Button */}
        <View className="px-6 mb-8">
          <TouchableOpacity
            className={`rounded-full py-5 items-center justify-center flex-row shadow-lg ${
              isFlipping 
                ? 'bg-slate-300 dark:bg-rose-950/40 shadow-none' 
                : 'bg-[#af2c3b] dark:bg-rose-600 shadow-red-300/50 dark:shadow-none'
            }`}
            activeOpacity={0.85}
            onPress={handleFlip}
            disabled={isFlipping}
          >
            <Ionicons name="reload" size={18} color="white" />
            <Text className="text-white font-extrabold text-[16px] ml-2">
              {isFlipping ? 'Tossing Coin...' : 'Toss the Coin'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Result Card */}
        {showResultCard && result && (
          <View className="px-6 mb-8">
            <View className="bg-white dark:bg-[#332225] dark:border dark:border-rose-950/20 rounded-[28px] p-6 items-center shadow-sm shadow-rose-100/50 dark:shadow-none">
              <View className={`w-12 h-12 rounded-full items-center justify-center mb-3 ${
                userChoice === result ? 'bg-teal-100 dark:bg-teal-500/10' : 'bg-rose-100 dark:bg-rose-500/10'
              }`}>
                <Ionicons 
                  name={userChoice === result ? 'checkmark-circle' : 'close-circle'} 
                  size={26} 
                  color={userChoice === result ? '#0d9488' : '#e11d48'} 
                />
              </View>
              <Text className="text-2xl font-black text-slate-800 dark:text-white tracking-tight text-center">
                It landed on {result}!
              </Text>
              <Text className={`font-bold text-[14px] mt-1.5 ${
                userChoice === result ? 'text-teal-600 dark:text-teal-400' : 'text-rose-600 dark:text-rose-400'
              }`}>
                {userChoice === result ? '🎉 You Won! Partner pays up.' : '😢 You Lost! Better luck next time.'}
              </Text>
            </View>
          </View>
        )}

        {/* History Log */}
        <View className="px-6">
          <Text className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight mb-4">Flip History</Text>
          
          {history.length === 0 ? (
            <View className="bg-white dark:bg-[#332225] rounded-3xl p-8 items-center border border-slate-50 dark:border-rose-950/20">
              <Ionicons name="list-outline" size={32} color="#cbd5e1" />
              <Text className="text-slate-400 dark:text-slate-500 font-semibold text-sm mt-2 text-center">
                No flips in this session yet.
              </Text>
            </View>
          ) : (
            <View className="bg-white dark:bg-[#332225] rounded-3xl p-4 border border-slate-50 dark:border-rose-950/20">
              {history.map((item, idx) => (
                <View 
                  key={item.id} 
                  className={`flex-row items-center justify-between py-3.5 px-2 ${
                    idx !== history.length - 1 ? 'border-b border-slate-100 dark:border-rose-950/10' : ''
                  }`}
                >
                  <View className="flex-row items-center">
                    <View className={`w-8 h-8 rounded-full items-center justify-center mr-3 ${
                      item.result === 'HEADS' ? 'bg-rose-50 dark:bg-rose-500/10' : 'bg-rose-100/50 dark:bg-rose-600/10'
                    }`}>
                      <Ionicons 
                        name={item.result === 'HEADS' ? 'heart' : 'rose'} 
                        size={16} 
                        color={item.result === 'HEADS' ? '#e11d48' : '#f43f5e'} 
                      />
                    </View>
                    <View>
                      <Text className="text-slate-800 dark:text-white font-bold text-sm">
                        Landed on {item.result}
                      </Text>
                      <Text className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold mt-0.5">
                        You picked: {item.choice}
                      </Text>
                    </View>
                  </View>

                  <View className="items-end">
                    <View className={`px-2.5 py-1 rounded-full ${
                      item.outcome === 'WON' ? 'bg-teal-50 dark:bg-teal-500/10' : 'bg-rose-50 dark:bg-rose-500/10'
                    }`}>
                      <Text className={`font-black text-[9px] tracking-wider uppercase ${
                        item.outcome === 'WON' ? 'text-teal-600 dark:text-teal-400' : 'text-rose-600 dark:text-rose-400'
                      }`}>
                        {item.outcome}
                      </Text>
                    </View>
                    <Text className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold mt-1">
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
    width: 140,
    height: 140,
    borderRadius: 70,
  }
});
