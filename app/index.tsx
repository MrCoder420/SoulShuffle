import { Text, View, TouchableOpacity } from 'react-native'
import React, { useState } from 'react'
import SigninForm from '@/components/signinForm'
import SignupForm from '@/components/signupForm'

const Index = () => {
  const [mode, setMode] = useState('signin')

  return (
    <View className='flex-1 bg-rose-50 dark:bg-[#221517]'>
      {mode === 'signin' ? <SigninForm /> : <SignupForm />}
      <View className="flex-row justify-center mt-auto mb-6">
        <Text className="text-slate-500 dark:text-slate-400 font-medium">{mode === 'signin' ? "Don't have an account? " : "Already have an account? "}</Text>
        <TouchableOpacity onPress={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
          <Text className="text-rose-500 dark:text-rose-400 font-extrabold">{mode === 'signin' ? "Sign Up" : "Sign In"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

export default Index
