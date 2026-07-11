import { Text, View, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Modal } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import React, { useState } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { signUp } from '../services/authService'
import { useRouter } from 'expo-router'
import { useColorScheme } from '@/hooks/use-color-scheme'

const SignupForm = () => {
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const router = useRouter()
    const colorScheme = useColorScheme()
    const isDark = colorScheme === 'dark'

    const [errorModalVisible, setErrorModalVisible] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')

    const showError = (msg: string) => {
        setErrorMessage(msg)
        setErrorModalVisible(true)
    }

    const handleSignUp = async () => {
        if (!name || !email || !password) {
            showError("Please fill in all fields");
            return;
        }
        try {
            setIsLoading(true);
            const data = await signUp(name, email, password);
            console.log('Sign up successful:', data);
            // @ts-ignore
            router.replace('/questionnaire');
        } catch (error: any) {
            console.log('Sign up error:', JSON.stringify(error?.response?.data || error?.message));
            const message = error?.response?.data?.message 
              || error?.message 
              || 'An unexpected error occurred';
            showError(message);
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <View className="flex-1 relative overflow-hidden">
            <View className='absolute w-[500px] h-[500px] bg-pink-200/40 dark:bg-[#271318]/40 rounded-full -top-40 -left-20' />
            <View className='absolute w-[400px] h-[400px] bg-purple-200/40 dark:bg-rose-950/10 rounded-full top-60 -right-40' />

            <SafeAreaView className="flex-1">
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
                    className="flex-1 justify-center px-6"
                >
                    <View className="items-center mb-4 mt-8">
                        <View className="flex-row items-center gap-1.5 mb-2">
                            <Ionicons name="infinite" size={38} color={isDark ? '#fda4af' : '#be123c'} style={{ transform: [{ rotate: '-15deg' }] }} />
                            <Text className="text-red-700 dark:text-rose-400 font-black text-4xl tracking-tight">SoulShuffle</Text>
                        </View>
                        <Text className="text-slate-500 dark:text-slate-400 mt-1.5 text-base font-medium">Join us and start the journey.</Text>
                    </View>

                    <View className="bg-white/90 dark:bg-[#271318]/90 rounded-[32px] p-5 shadow-rose-100 border border-white/60 dark:border-rose-950/20">

                        <View className="mb-4">
                            <Text className="text-slate-700 dark:text-slate-300 font-semibold mb-2 ml-1 text-sm">Full Name</Text>
                            <View className="flex-row items-center border border-slate-100 dark:border-rose-950/40 bg-slate-50/50 dark:bg-[#0F0608] rounded-2xl h-14 px-4 overflow-hidden">
                                <Ionicons name="person-outline" size={20} color={isDark ? "#f43f5e" : "#94a3b8"} />
                                <TextInput
                                    placeholder="Enter your full name"
                                    placeholderTextColor={isDark ? "rgba(255, 255, 255, 0.3)" : "#94a3b8"}
                                    className="flex-1 ml-3 text-slate-800 dark:text-white font-medium"
                                    value={name}
                                    onChangeText={setName}
                                    autoCapitalize="words"
                                />
                            </View>
                        </View>

                        <View className="mb-4">
                            <Text className="text-slate-700 dark:text-slate-300 font-semibold mb-2 ml-1 text-sm">Email  </Text>
                            <View className="flex-row items-center border border-slate-100 dark:border-rose-950/40 bg-slate-50/50 dark:bg-[#0F0608] rounded-2xl h-14 px-4 overflow-hidden">
                                <Ionicons name="mail-outline" size={20} color={isDark ? "#f43f5e" : "#94a3b8"} />
                                <TextInput
                                    placeholder="Enter your email"
                                    placeholderTextColor={isDark ? "rgba(255, 255, 255, 0.3)" : "#94a3b8"}
                                    className="flex-1 ml-3 text-slate-800 dark:text-white font-medium"
                                    value={email}
                                    onChangeText={setEmail}
                                    autoCapitalize="none"
                                />
                            </View>
                        </View>

                        <View className="mb-4">
                            <Text className="text-slate-700 dark:text-slate-300 font-semibold mb-2 ml-1 text-sm">Password</Text>
                            <View className="flex-row items-center border border-slate-100 dark:border-rose-950/40 bg-slate-50/50 dark:bg-[#0F0608] rounded-2xl h-14 px-4 overflow-hidden">
                                <Ionicons name="lock-closed-outline" size={20} color={isDark ? "#f43f5e" : "#94a3b8"} />
                                <TextInput
                                    placeholder="Create a password"
                                    placeholderTextColor={isDark ? "rgba(255, 255, 255, 0.3)" : "#94a3b8"}
                                    className="flex-1 ml-3 text-slate-800 dark:text-white font-medium"
                                    value={password}
                                    onChangeText={setPassword}
                                    secureTextEntry={!showPassword}
                                />
                                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} className="p-1">
                                    <Ionicons name={showPassword ? "eye-outline" : "eye-off-outline"} size={20} color={isDark ? "#f43f5e" : "#94a3b8"} />
                                </TouchableOpacity>
                            </View>
                        </View>

                        <TouchableOpacity
                            className={`bg-rose-500 dark:bg-rose-600 rounded-2xl h-14 items-center justify-center flex-row shadow-rose-300 ${isLoading ? 'opacity-70' : ''}`}
                            activeOpacity={0.8}
                            onPress={handleSignUp}
                            disabled={isLoading}
                        >
                            <Text className="text-white font-bold text-lg">{isLoading ? 'Signing Up...' : 'Sign Up'}</Text>
                            {!isLoading && <Ionicons name="arrow-forward" size={20} color="white" style={{ marginLeft: 8 }} />}
                        </TouchableOpacity>
                    </View>

                    <View className="mt-4 items-center">
                        <Text className="text-slate-500 dark:text-slate-400 font-medium text-sm mb-2">Or sign up with</Text>
                        <View className="flex-row gap-4 w-full">

                            <TouchableOpacity className="flex-1 bg-[#1A1A1A] dark:bg-[#180D10] border border-transparent dark:border-rose-950/20 rounded-2xl h-14 flex-row items-center justify-center" activeOpacity={0.7}>
                                <Ionicons name="logo-apple" size={20} color="#ffffff" />
                                <Text className="text-white font-bold ml-2">Apple</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                </KeyboardAvoidingView>
            </SafeAreaView>

            {/* Custom Error Modal */}
            <Modal
                visible={errorModalVisible}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setErrorModalVisible(false)}
            >
                <View className="flex-1 justify-center items-center bg-black/60 px-6">
                    <View className="bg-white dark:bg-[#1f0f13] w-full rounded-[32px] p-6 items-center">
                        <View className="w-16 h-16 rounded-full bg-rose-100 dark:bg-rose-950/50 items-center justify-center mb-5">
                            <Ionicons name="alert-circle" size={32} color="#e11d48" />
                        </View>
                        <Text className="text-xl font-black text-slate-800 dark:text-white mb-2 text-center">Validation Error</Text>
                        <Text className="text-slate-500 dark:text-slate-400 text-center mb-8 px-4 font-medium leading-5">
                            {errorMessage}
                        </Text>
                        <TouchableOpacity 
                            className="w-full h-14 items-center justify-center rounded-2xl bg-[#af2c3b] dark:bg-rose-600"
                            onPress={() => setErrorModalVisible(false)}
                            activeOpacity={0.7}
                        >
                            <Text className="font-bold text-white">Okay</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    )
}

export default SignupForm

