import { Text, View, ScrollView, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, Modal, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import React, { useState } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { signIn, forgotPassword, resetPassword, googleLogin, appleLogin } from '../services/authService'
import { useRouter } from 'expo-router'
import { useColorScheme } from '@/hooks/use-color-scheme'
import * as AppleAuthentication from 'expo-apple-authentication'
import Constants from 'expo-constants'

const SigninForm = () => {
        const [email, setEmail] = useState('')
        const [password, setPassword] = useState('')
        const [showPassword, setShowPassword] = useState(false)
        const [isLoading, setIsLoading] = useState(false)
        const [errorMessage, setErrorMessage] = useState('')
        const router = useRouter()
        const colorScheme = useColorScheme()
        const isDark = colorScheme === 'dark'

        const [forgotPasswordModalVisible, setForgotPasswordModalVisible] = useState(false)
        const [forgotPasswordStep, setForgotPasswordStep] = useState(1) // 1 = email, 2 = otp + new password
        const [forgotPasswordEmail, setForgotPasswordEmail] = useState('')
        const [otp, setOtp] = useState('')
        const [newPassword, setNewPassword] = useState('')
        const [isSubmitting, setIsSubmitting] = useState(false)

        const handleGoogleLogin = async () => {
          if (Constants.appOwnership === 'expo') {
            Alert.alert(
              'Notice', 
              'Google Sign-In uses native modules that do not work inside Expo Go. This will work perfectly in your final APK build!'
            );
            return;
          }

          try {
            setIsLoading(true);
            setErrorMessage('');
            
            // Lazily require to prevent crashing Expo Go
            const { GoogleSignin, statusCodes } = require('@react-native-google-signin/google-signin');

            // Configure here instead of top-level
            GoogleSignin.configure({
              webClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '950734388938-qm61e894mghl4dnsi2jb27aglo1eqhbm.apps.googleusercontent.com',
              offlineAccess: false,
            });
            
            // Initiate Native Google Sign-in
            await GoogleSignin.hasPlayServices();
            const userInfo = await GoogleSignin.signIn();
            const idToken = userInfo.data?.idToken;

            if (idToken) {
              await googleLogin(idToken);
              // @ts-ignore
              router.replace('/(tabs)');
            } else {
              throw new Error('Google Sign-In failed: No ID Token returned');
            }
          } catch (error: any) {
            const { statusCodes } = require('@react-native-google-signin/google-signin');
            console.log('Google Sign-In Error:', error);
            if (error.code === statusCodes.SIGN_IN_CANCELLED) {
              // user cancelled the login flow
            } else if (error.code === statusCodes.IN_PROGRESS) {
              // operation (e.g. sign in) is in progress already
            } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
              Alert.alert('Error', 'Google Play Services not available or outdated.');
            } else {
              const message = error?.response?.data?.message || error?.message || "Google Sign-In failed";
              Alert.alert("Login Failed", message);
              setErrorMessage(message);
            }
          } finally {
            setIsLoading(false);
          }
        };

        const handleSignIn = async () => {
            setErrorMessage('');
            if (!email || !password) {
                setErrorMessage("Please enter email and password");
                return;
            }
            try {
                setIsLoading(true);
                const data = await signIn(email, password);
                console.log('Sign in successful:', data);

                // @ts-ignore
                router.replace('/(tabs)');
            } catch (error: any) {
                console.log('Sign in error:', JSON.stringify(error?.response?.data || error?.message));
                const message = error?.response?.data?.message 
                  || error?.message 
                  || 'An unexpected error occurred';
                
                if (Platform.OS === 'web') {
                    setErrorMessage(message);
                } else {
                    Alert.alert("Login Failed", message);
                }
            } finally {
                setIsLoading(false);
            }
        }



        const handleAppleLogin = async () => {
            try {
                setIsLoading(true);
                setErrorMessage('');
                
                if (Platform.OS === 'web') {
                    setErrorMessage("Apple Sign-In is only supported on the mobile app.");
                    setIsLoading(false);
                    return;
                }
                
                const credential = await AppleAuthentication.signInAsync({
                    requestedScopes: [
                        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                        AppleAuthentication.AppleAuthenticationScope.EMAIL,
                    ],
                });
                
                const idToken = credential.identityToken;
                
                if (idToken) {
                    await appleLogin(idToken);
                    // @ts-ignore
                    router.replace('/(tabs)');
                } else {
                    throw new Error("Apple Sign-In failed: No Identity Token returned");
                }
            } catch (error: any) {
                if (error.code === 'ERR_REQUEST_CANCELED') {
                    // User canceled the sign-in flow
                } else {
                    console.log('Apple Sign-In Error:', error);
                    const message = error?.response?.data?.message || error?.message || "Apple Sign-In failed";
                    Alert.alert("Login Failed", message);
                }
            } finally {
                setIsLoading(false);
            }
        }

        const handleForgotPassword = async () => {
            if (!forgotPasswordEmail) {
                Alert.alert("Error", "Please enter your email");
                return;
            }
            try {
                setIsSubmitting(true);
                await forgotPassword(forgotPasswordEmail);
                setForgotPasswordStep(2);
                Alert.alert("Success", "OTP sent to your email");
            } catch (error: any) {
                Alert.alert("Error", error?.response?.data?.message || "Failed to send OTP");
            } finally {
                setIsSubmitting(false);
            }
        }

        const handleResetPassword = async () => {
            if (!otp || !newPassword) {
                Alert.alert("Error", "Please enter OTP and new password");
                return;
            }
            try {
                setIsSubmitting(true);
                await resetPassword(forgotPasswordEmail, otp, newPassword);
                setForgotPasswordModalVisible(false);
                setForgotPasswordStep(1);
                setOtp('');
                setNewPassword('');
                Alert.alert("Success", "Password reset successfully! You can now log in.");
            } catch (error: any) {
                Alert.alert("Error", error?.response?.data?.message || "Failed to reset password");
            } finally {
                setIsSubmitting(false);
            }
        }
        return (
            <View className="flex-1 relative overflow-hidden">
                <View className='absolute w-[500px] h-[500px] bg-pink-200/40 dark:bg-[#271318]/40 rounded-full -top-40 -left-20' />
                <View className='absolute w-[400px] h-[400px] bg-purple-200/40 dark:bg-rose-950/10 rounded-full top-60 -right-40' />

                <SafeAreaView className="flex-1">
                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                        className="flex-1 justify-center px-6"
                    >
                        <View className="items-center mb-6 mt-16">
                            <View className="flex-row items-center gap-1.5 mb-2">
                                <Ionicons name="infinite" size={38} color={isDark ? '#fda4af' : '#be123c'} style={{ transform: [{ rotate: '-15deg' }] }} />
                                <Text className="text-red-700 dark:text-rose-400 font-black text-4xl tracking-tight">SoulShuffle</Text>
                            </View>
                            <Text className="text-slate-500 dark:text-slate-400 mt-2 text-base font-medium">Ignite the spark, play together.</Text>
                        </View>

                        <View className="bg-white/90 dark:bg-[#271318]/90 rounded-[32px] p-6 shadow-rose-100 border border-white/60 dark:border-rose-950/20">

                            <View className="mb-5">
                                <Text className="text-slate-700 dark:text-slate-300 font-semibold mb-2 ml-1 text-sm">Email</Text>
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

                            <View className="mb-6">
                                <Text className="text-slate-700 dark:text-slate-300 font-semibold mb-2 ml-1 text-sm">Password</Text>
                                <View className="flex-row items-center border border-slate-100 dark:border-rose-950/40 bg-slate-50/50 dark:bg-[#0F0608] rounded-2xl h-14 px-4 overflow-hidden">
                                    <Ionicons name="lock-closed-outline" size={20} color={isDark ? "#f43f5e" : "#94a3b8"} />
                                    <TextInput
                                        placeholder="Enter your password"
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
                                <TouchableOpacity className="mt-4 self-end" onPress={() => { setForgotPasswordEmail(email); setForgotPasswordStep(1); setForgotPasswordModalVisible(true); }}>
                                    <Text className="text-rose-500 dark:text-rose-400 font-semibold text-sm">Forgot Password?</Text>
                                </TouchableOpacity>
                            </View>

                            {errorMessage ? (
                                <View className="bg-rose-100 dark:bg-rose-950/60 p-4 rounded-2xl mb-4 border border-rose-200 dark:border-rose-900/50 flex-row items-center">
                                    <Ionicons name="warning" size={20} color="#e11d48" />
                                    <Text className="text-rose-600 dark:text-rose-400 font-bold ml-2 text-[13px] flex-1">{errorMessage}</Text>
                                </View>
                            ) : null}

                            <TouchableOpacity
                                className={`bg-rose-500 dark:bg-rose-600 rounded-2xl h-14 items-center justify-center flex-row shadow-rose-300 ${isLoading ? 'opacity-70' : ''}`}
                                activeOpacity={0.8}
                                onPress={handleSignIn}
                                disabled={isLoading}
                            >
                                <Text className="text-white font-bold text-lg">{isLoading ? 'Signing In...' : 'Sign In'}</Text>
                                {!isLoading && <Ionicons name="arrow-forward" size={20} color="white" style={{ marginLeft: 8 }} />}
                            </TouchableOpacity>
                        </View>

                        <View className="mt-8 items-center">
                            <Text className="text-slate-500 dark:text-slate-400 font-medium text-sm mb-5">Or continue with</Text>
                            <View className="flex-row gap-4 w-full">

                                <TouchableOpacity 
                                    className="flex-1 bg-white dark:bg-[#180D10] border border-slate-200 dark:border-rose-950/20 rounded-2xl h-14 flex-row items-center justify-center shadow-sm" 
                                    activeOpacity={0.7}
                                    onPress={handleGoogleLogin}
                                    disabled={isLoading}
                                >
                                    <Ionicons name="logo-google" size={20} color={isDark ? "#ffffff" : "#DB4437"} />
                                    <Text className="text-slate-700 dark:text-white font-bold ml-2">Google</Text>
                                </TouchableOpacity>

                                <TouchableOpacity 
                                    className="flex-1 bg-[#1A1A1A] dark:bg-[#180D10] border border-transparent dark:border-rose-950/20 rounded-2xl h-14 flex-row items-center justify-center" 
                                    activeOpacity={0.7}
                                    onPress={handleAppleLogin}
                                    disabled={isLoading}
                                >
                                    <Ionicons name="logo-apple" size={20} color="#ffffff" />
                                    <Text className="text-white font-bold ml-2">Apple</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        

                    </KeyboardAvoidingView>
                </SafeAreaView>

                <Modal
                    visible={forgotPasswordModalVisible}
                    animationType="slide"
                    transparent={true}
                    onRequestClose={() => setForgotPasswordModalVisible(false)}
                >
                    <KeyboardAvoidingView 
                        behavior="padding" 
                        className="flex-1 justify-end bg-black/50"
                    >
                        <ScrollView
                            bounces={false}
                            keyboardShouldPersistTaps="handled"
                            contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end' }}
                        >
                        <TouchableOpacity 
                            style={{ flex: 1 }} 
                            activeOpacity={1} 
                            onPress={() => setForgotPasswordModalVisible(false)} 
                        />
                        <View className="bg-white dark:bg-[#1f0f13] rounded-t-[32px] p-6 pb-24">
                            <View className="flex-row justify-between items-center mb-6">
                                <Text className="text-xl font-bold text-slate-800 dark:text-white">
                                    {forgotPasswordStep === 1 ? 'Reset Password' : 'Enter OTP & New Password'}
                                </Text>
                                <TouchableOpacity onPress={() => setForgotPasswordModalVisible(false)} className="p-2 bg-slate-100 dark:bg-rose-950/30 rounded-full">
                                    <Ionicons name="close" size={24} color={isDark ? "#f43f5e" : "#64748b"} />
                                </TouchableOpacity>
                            </View>

                            {forgotPasswordStep === 1 ? (
                                <View>
                                    <Text className="text-slate-500 dark:text-slate-400 mb-4 font-medium text-sm">
                                        Enter your email address and we'll send you an OTP to reset your password.
                                    </Text>
                                    <View className="flex-row items-center border border-slate-200 dark:border-rose-950/60 bg-slate-50 dark:bg-[#0F0608] rounded-2xl h-14 px-4 overflow-hidden mb-6">
                                        <Ionicons name="mail-outline" size={20} color={isDark ? "#f43f5e" : "#94a3b8"} />
                                        <TextInput
                                            placeholder="Enter your email"
                                            placeholderTextColor={isDark ? "rgba(255, 255, 255, 0.3)" : "#94a3b8"}
                                            className="flex-1 ml-3 text-slate-800 dark:text-white font-medium"
                                            value={forgotPasswordEmail}
                                            onChangeText={setForgotPasswordEmail}
                                            autoCapitalize="none"
                                        />
                                    </View>
                                    <TouchableOpacity
                                        className={`bg-rose-500 dark:bg-rose-600 rounded-2xl h-14 items-center justify-center flex-row shadow-rose-300 ${isSubmitting ? 'opacity-70' : ''}`}
                                        onPress={handleForgotPassword}
                                        disabled={isSubmitting}
                                    >
                                        {isSubmitting ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold text-lg">Send OTP</Text>}
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <View>
                                    <Text className="text-slate-500 dark:text-slate-400 mb-4 font-medium text-sm">
                                        Enter the OTP sent to {forgotPasswordEmail} and choose a new password.
                                    </Text>
                                    <View className="flex-row items-center border border-slate-200 dark:border-rose-950/60 bg-slate-50 dark:bg-[#0F0608] rounded-2xl h-14 px-4 overflow-hidden mb-4">
                                        <Ionicons name="keypad-outline" size={20} color={isDark ? "#f43f5e" : "#94a3b8"} />
                                        <TextInput
                                            placeholder="Enter OTP"
                                            placeholderTextColor={isDark ? "rgba(255, 255, 255, 0.3)" : "#94a3b8"}
                                            className="flex-1 ml-3 text-slate-800 dark:text-white font-medium"
                                            value={otp}
                                            onChangeText={setOtp}
                                            keyboardType="number-pad"
                                        />
                                    </View>
                                    <View className="flex-row items-center border border-slate-200 dark:border-rose-950/60 bg-slate-50 dark:bg-[#0F0608] rounded-2xl h-14 px-4 overflow-hidden mb-6">
                                        <Ionicons name="lock-closed-outline" size={20} color={isDark ? "#f43f5e" : "#94a3b8"} />
                                        <TextInput
                                            placeholder="New Password"
                                            placeholderTextColor={isDark ? "rgba(255, 255, 255, 0.3)" : "#94a3b8"}
                                            className="flex-1 ml-3 text-slate-800 dark:text-white font-medium"
                                            value={newPassword}
                                            onChangeText={setNewPassword}
                                            secureTextEntry={true}
                                        />
                                    </View>
                                    <TouchableOpacity
                                        className={`bg-rose-500 dark:bg-rose-600 rounded-2xl h-14 items-center justify-center flex-row shadow-rose-300 ${isSubmitting ? 'opacity-70' : ''}`}
                                        onPress={handleResetPassword}
                                        disabled={isSubmitting}
                                    >
                                        {isSubmitting ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold text-lg">Reset Password</Text>}
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                        </ScrollView>
                    </KeyboardAvoidingView>
                </Modal>
            </View>
        )
}

export default SigninForm

