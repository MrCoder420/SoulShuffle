import { Text, View, TouchableOpacity } from 'react-native';
import React, { useState, useEffect } from 'react';
import SigninForm from '@/components/signinForm';
import SignupForm from '@/components/signupForm';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const Index = () => {
  const [mode, setMode] = useState('signin');
  const router = useRouter();

  useEffect(() => {
    const checkToken = async () => {
      const token = await AsyncStorage.getItem('accessToken');
      if (token) {
        router.replace('/(tabs)');
      }
    };
    checkToken();
  }, []);

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
