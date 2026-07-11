import { Text, View, TouchableOpacity } from 'react-native';
import React, { useState, useCallback } from 'react';
import SigninForm from '@/components/signinForm';
import SignupForm from '@/components/signupForm';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const Index = () => {
  const [mode, setMode] = useState('signin');

  useFocusEffect(
    useCallback(() => {
      const checkToken = async () => {
        try {
          console.log('[INDEX] useFocusEffect: checking token...');
          const token = await AsyncStorage.getItem('accessToken');
          console.log('[INDEX] Token found:', token ? 'YES (redirecting to tabs)' : 'NO (showing login)');
          if (token) {
            const { router } = await import('expo-router');
            router.replace('/(tabs)');
          }
        } catch (e) {
          console.error('[INDEX] Token check error:', e);
        }
      };

      checkToken();
    }, []) // eslint-disable-line react-hooks/exhaustive-deps
  );

  return (
    <View className='flex-1 bg-rose-50 dark:bg-[#0F0608]'>
      {mode === 'signin' ? <SigninForm /> : <SignupForm />}
      <View className="flex-row justify-center mt-auto mb-16">
        <Text className="text-slate-500 dark:text-slate-400 font-medium">{mode === 'signin' ? "Don't have an account? " : "Already have an account? "}</Text>
        <TouchableOpacity onPress={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
          <Text className="text-rose-500 dark:text-rose-400 font-extrabold">{mode === 'signin' ? "Sign Up" : "Sign In"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

export default Index


