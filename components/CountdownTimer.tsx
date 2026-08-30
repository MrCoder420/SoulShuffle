import React, { useState, useEffect } from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function CountdownTimer({ targetDate }: { targetDate: string }) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    if (!targetDate) return;

    const updateTimer = () => {
      const now = new Date().getTime();
      const target = new Date(targetDate).getTime();
      if (isNaN(target)) {
        setTimeLeft('--');
        return;
      }
      const difference = target - now;

      if (difference <= 0) {
        setTimeLeft('Expired');
        return;
      }

      const hours = Math.floor(difference / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  if (!timeLeft) return null;

  return (
    <View className="flex-row items-center bg-rose-100/80 dark:bg-rose-950/40 px-2 py-1 rounded-md">
      <Ionicons name="timer-outline" size={14} color="#e11d48" />
      <Text className="text-rose-600 dark:text-rose-400 font-bold text-[11px] ml-1 tracking-wider">{timeLeft}</Text>
    </View>
  );
}

