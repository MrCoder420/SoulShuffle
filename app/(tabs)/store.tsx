import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  StatusBar,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  StyleSheet,
  useWindowDimensions,
  TextInput,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSidebar } from '@/context/SidebarContext';
import {
  fetchStoreBundles,
  fetchPurchaseHistory,
  CardBundle,
  BundlePlan,
  PurchaseRecord,
} from '@/services/storeService';
import { getActiveRoom } from '@/services/roomService';

const getBundleImage = (bundleName: string, defaultUrl?: string | null) => {
  const name = (bundleName || '').toLowerCase();
  if (name.includes('spicy') || name.includes('spark') || name.includes('nights')) {
    return require('../../assets/images/bundle_spicy.png');
  }
  if (name.includes('romantic') || name.includes('getaway') || name.includes('adventure') || name.includes('travel') || name.includes('weekend')) {
    return require('../../assets/images/bundle_romantic.png');
  }
  if (name.includes('cozy') || name.includes('connection') || name.includes('night') || name.includes('indoor') || name.includes('winter')) {
    return require('../../assets/images/bundle_cozy.png');
  }
  
  if (defaultUrl && defaultUrl.trim() !== '') {
    return { uri: defaultUrl };
  }
  
  return require('../../assets/images/bundle_cozy.png');
};

export default function StoreScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const buyBundleId = params.buyBundleId as string | undefined;
  const { openSidebar } = useSidebar();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { width } = useWindowDimensions();

  // Tab State: 'browse' | 'history'
  const [activeTab, setActiveTab] = useState<'browse' | 'history'>('browse');

  // Loading & Data States
  const [loading, setLoading] = useState(true);
  const [bundles, setBundles] = useState<CardBundle[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [isInRoom, setIsInRoom] = useState(false);

  // Purchase Modal State
  const [selectedBundle, setSelectedBundle] = useState<CardBundle | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<BundlePlan | null>(null);
  const [checkoutVisible, setCheckoutVisible] = useState(false);
  const [buying, setBuying] = useState(false);
  const [purchaseSuccess, setPurchaseSuccess] = useState(false);
  const [hasAutoOpened, setHasAutoOpened] = useState(false);

  // Payment multi-step flow state
  const [paymentStep, setPaymentStep] = useState<'details' | 'select_method' | 'card_form' | 'upi_form' | 'net_banking_form' | 'processing' | 'otp'>('details');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCVV, setCardCVV] = useState('');
  const [cardName, setCardName] = useState('');
  const [upiId, setUpiId] = useState('');
  const [selectedBank, setSelectedBank] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [processingStatus, setProcessingStatus] = useState('Securing connection to bank...');
  const [otpResendSeconds, setOtpResendSeconds] = useState(30);

  // Fallback Dummy Bundles for Sandbox Preview
  const DUMMY_BUNDLES: CardBundle[] = [
    {
      id: 'dummy-spicy',
      name: 'Spicy Spark 🔥',
      description: 'Ignite passion with bold, intimate, and adventurous dares designed to bring you closer.',
      image_url: 'https://images.unsplash.com/photo-1543599538-a6c4f6cc5c05?w=500&h=400&fit=crop',
      is_active: true,
      bundle_plans: [
        { id: 'plan-spicy-1', bundle_id: 'dummy-spicy', card_count: 10, price: 99 },
        { id: 'plan-spicy-2', bundle_id: 'dummy-spicy', card_count: 25, price: 199 },
      ],
    },
    {
      id: 'dummy-romance',
      name: 'Romantic Getaway ✈️',
      description: 'Create unforgettable memories with outdoor dates, cute surprise tasks, and playful challenges.',
      image_url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=500&h=400&fit=crop',
      is_active: true,
      bundle_plans: [
        { id: 'plan-romance-1', bundle_id: 'dummy-romance', card_count: 15, price: 149 },
      ],
    },
    {
      id: 'dummy-cozy',
      name: 'Cozy Connection 🕯️',
      description: 'Warm, relaxing inside-the-house cards to connect deeply on lazy Sunday mornings or rainy evenings.',
      image_url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=500&h=400&fit=crop',
      is_active: true,
      bundle_plans: [
        { id: 'plan-cozy-1', bundle_id: 'dummy-cozy', card_count: 20, price: 99 },
      ],
    },
  ];

  const loadData = async () => {
    try {
      setLoading(true);
      // Check room status
      const room = await getActiveRoom();
      setIsInRoom(!!room);

      // Load bundles
      const fetchedBundles = await fetchStoreBundles();
      if (fetchedBundles && fetchedBundles.length > 0) {
        setBundles(fetchedBundles);
      } else {
        setBundles(DUMMY_BUNDLES);
      }

      // Load purchase history
      const fetchedPurchases = await fetchPurchaseHistory();

      // Load local mock purchases from AsyncStorage to merge
      const localMockPurchasesStr = await AsyncStorage.getItem('local_mock_purchases');
      const localMockPurchases = localMockPurchasesStr ? JSON.parse(localMockPurchasesStr) : [];
      
      setPurchases([...localMockPurchases, ...fetchedPurchases]);
    } catch (e) {
      console.log('Failed to load store data:', e);
      setBundles(DUMMY_BUNDLES);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!loading && bundles.length > 0 && buyBundleId && !hasAutoOpened) {
      const bundleToOpen = bundles.find(b => b.id === buyBundleId);
      if (bundleToOpen) {
        handleSelectBundle(bundleToOpen);
        setHasAutoOpened(true);
      }
    }
  }, [loading, bundles, buyBundleId, hasAutoOpened]);

  const handleSelectBundle = (bundle: CardBundle) => {
    if (!isInRoom) {
      Alert.alert(
        'Room Required',
        'You must create or join an active room with your partner before purchasing card bundles.',
        [{ text: 'Go Home', onPress: () => router.push('/') }, { text: 'OK' }]
      );
      return;
    }
    setSelectedBundle(bundle);
    if (bundle.bundle_plans && bundle.bundle_plans.length > 0) {
      setSelectedPlan(bundle.bundle_plans[0]);
    } else {
      setSelectedPlan(null);
    }
    setCheckoutVisible(true);
    setPurchaseSuccess(false);
    setPaymentStep('details');
  };

  const handleOpenCheckout = (bundle: CardBundle, plan: BundlePlan) => {
    if (!isInRoom) {
      Alert.alert(
        'Room Required',
        'You must create or join an active room with your partner before purchasing card bundles.',
        [{ text: 'Go Home', onPress: () => router.push('/') }, { text: 'OK' }]
      );
      return;
    }
    setSelectedBundle(bundle);
    setSelectedPlan(plan);
    setCheckoutVisible(true);
    setPurchaseSuccess(false);
    setPaymentStep('details');
  };

  // Helper formatting functions
  const formatCardNumber = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    const match = cleaned.match(/.{1,4}/g);
    return match ? match.join(' ').substring(0, 19) : cleaned;
  };

  const formatExpiry = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    if (cleaned.length >= 3) {
      return `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}`.substring(0, 5);
    }
    return cleaned.substring(0, 5);
  };

  const startPaymentProcessing = async () => {
    setBuying(true);
    setPaymentStep('processing');
    
    // Simulate payment gateway loading phases
    setProcessingStatus('Securing connection to banking server...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    setProcessingStatus('Authorizing amount with card issuer...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    setProcessingStatus('Awaiting secure verification code (OTP)...');
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Open OTP screen
    setPaymentStep('otp');
    setOtpCode('');
    setOtpResendSeconds(30);
    setBuying(false);
  };

  // OTP resend timer effect
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (paymentStep === 'otp' && otpResendSeconds > 0) {
      timer = setTimeout(() => {
        setOtpResendSeconds(prev => prev - 1);
      }, 1000);
    }
    return () => clearTimeout(timer);
  }, [paymentStep, otpResendSeconds]);

  const handleConfirmOTP = async () => {
    if (otpCode.length < 6) {
      Alert.alert('Invalid Security Code', 'Please enter a valid 6-digit OTP code.');
      return;
    }

    setBuying(true);
    // Simulate verifying code
    await new Promise(resolve => setTimeout(resolve, 1200));

    try {
      // Create a mock purchase record to persist in AsyncStorage
      const newPurchase: PurchaseRecord = {
        id: `mock-purchase-${Date.now()}`,
        user_id: 'current-user',
        bundle_id: selectedBundle!.id,
        plan_id: selectedPlan!.id,
        transaction_id: `TXN${Math.floor(100000000000 + Math.random() * 900000000000)}`,
        amount_paid: selectedPlan!.price,
        currency: 'INR',
        status: 'SUCCESS',
        created_at: new Date().toISOString(),
        store_product_id: selectedBundle!.id,
        card_bundle: {
          name: selectedBundle!.name
        }
      };

      const localMockPurchasesStr = await AsyncStorage.getItem('local_mock_purchases');
      const localMockPurchases = localMockPurchasesStr ? JSON.parse(localMockPurchasesStr) : [];
      localMockPurchases.unshift(newPurchase);
      await AsyncStorage.setItem('local_mock_purchases', JSON.stringify(localMockPurchases));

      setPurchaseSuccess(true);
      
      // Automatically close success screen after 2.5s and reload data
      setTimeout(() => {
        setCheckoutVisible(false);
        setPaymentStep('details');
        setCardNumber('');
        setCardExpiry('');
        setCardCVV('');
        setCardName('');
        setUpiId('');
        setSelectedBank('');
        setOtpCode('');
        loadData();
      }, 2500);
    } catch (e) {
      console.log('Failed to save mock purchase:', e);
      Alert.alert('Transaction Failed', 'We could not complete your mock transaction. Please try again.');
      setPaymentStep('select_method');
    } finally {
      setBuying(false);
    }
  };

  const renderBundles = () => {
    return (
      <View className="flex-row flex-wrap justify-between px-6 mt-4">
        {bundles.map((bundle) => {
          const startingPrice = bundle.bundle_plans && bundle.bundle_plans.length > 0
            ? Math.min(...bundle.bundle_plans.map(p => p.price))
            : 99;

          return (
            <TouchableOpacity
              key={bundle.id}
              className="bg-white dark:bg-[#271318] rounded-[24px] border border-slate-100 dark:border-rose-950/20 shadow-sm dark:shadow-none overflow-hidden mb-5 w-[48%] active:opacity-90"
              onPress={() => handleSelectBundle(bundle)}
            >
              {/* Banner Image */}
              <View className="h-28 w-full relative">
                <Image
                  source={getBundleImage(bundle.name, bundle.image_url)}
                  className="w-full h-full object-cover"
                />
                {/* Cards badge */}
                <View className="absolute top-2 right-2 bg-black/60 dark:bg-rose-950/70 px-2 py-0.5 rounded-full">
                  <Text className="text-white text-[8px] font-black uppercase tracking-wider">
                    {bundle.bundle_plans?.[0]?.card_count || 10} Cards
                  </Text>
                </View>
              </View>

              {/* Info Section */}
              <View className="p-3">
                <Text className="text-sm font-black text-slate-900 dark:text-white tracking-tight" numberOfLines={1}>
                  {bundle.name}
                </Text>
                <Text className="text-slate-500 dark:text-slate-400 text-[10px] font-semibold mt-1 leading-4 h-8" numberOfLines={2}>
                  {bundle.description}
                </Text>

                <View className="flex-row items-center justify-between mt-3 pt-2 border-t border-slate-100 dark:border-rose-950/10">
                  <Text className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                    Price
                  </Text>
                  <Text className="text-[#e11d48] dark:text-rose-400 font-extrabold text-[12px]">
                    ₹{startingPrice}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const renderHistory = () => {
    if (purchases.length === 0) {
      return (
        <View className="items-center justify-center py-20 px-6">
          <View className="bg-rose-50 dark:bg-rose-950/10 p-6 rounded-full mb-4">
            <Ionicons name="receipt-outline" size={48} color={isDark ? "#f43f5e" : "#af2c3b"} />
          </View>
          <Text className="text-lg font-bold text-slate-800 dark:text-white">
            No Purchases Yet
          </Text>
          <Text className="text-slate-400 dark:text-slate-400 text-xs font-semibold mt-2 text-center max-w-[80%] leading-5">
            Your unlocked card bundles will appear here once purchased.
          </Text>
        </View>
      );
    }

    return (
      <View className="px-6 mt-4">
        {purchases.map((purchase) => (
          <View
            key={purchase.id}
            className="bg-white dark:bg-[#271318] rounded-2xl border border-slate-100 dark:border-rose-950/20 p-5 mb-4 shadow-sm dark:shadow-none flex-row items-center justify-between"
          >
            <View className="flex-1 mr-4">
              <Text className="text-sm font-black text-slate-900 dark:text-white">
                {purchase.card_bundle?.name || 'Card Bundle'}
              </Text>
              <Text className="text-slate-400 dark:text-slate-500 text-[10px] font-bold mt-1 uppercase tracking-wider">
                ID: {purchase.transaction_id.slice(0, 12)}...
              </Text>
              <Text className="text-slate-500 dark:text-slate-400 text-xs font-medium mt-2">
                {new Date(purchase.created_at).toLocaleDateString()}
              </Text>
            </View>
            <View className="items-end">
              <Text className="text-slate-900 dark:text-white font-extrabold text-[15px]">
                ₹{purchase.amount_paid}
              </Text>
              <View className="bg-emerald-100 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full mt-1.5">
                <Text className="text-emerald-700 dark:text-emerald-400 text-[9px] font-bold uppercase tracking-wider">
                  {purchase.status}
                </Text>
              </View>
            </View>
          </View>
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView
      className="flex-1 bg-[#fdfaf9] dark:bg-[#0F0608]"
      style={{ paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 }}
    >
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={isDark ? '#0F0608' : '#fdfaf9'}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 110 }}
      >
        {/* Header bar */}
        <View className="flex-row items-center justify-between px-6 py-4">
          <TouchableOpacity onPress={openSidebar}>
            <Ionicons name="menu-outline" size={30} color={isDark ? '#fff' : '#9f1239'} />
          </TouchableOpacity>
          <View className="flex-row items-center gap-1.5">
            <Ionicons
              name="infinite"
              size={28}
              color={isDark ? '#fda4af' : '#be123c'}
              style={{ transform: [{ rotate: '-15deg' }] }}
            />
            <Text className="text-red-700 dark:text-rose-400 font-black text-xl tracking-tight">
              SoulShuffle
            </Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/profile')}>
            <Image
              source={{
                uri: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop',
              }}
              className="w-10 h-10 rounded-full border border-rose-200 dark:border-rose-950/30"
            />
          </TouchableOpacity>
        </View>

        {/* Title area */}
        <View className="px-6 mt-4">
          <Text className="text-[32px] leading-10 font-black text-slate-900 dark:text-white tracking-tight">
            Card Store 🛒
          </Text>
          <Text className="text-slate-500 dark:text-slate-400 font-semibold text-sm mt-3">
            Unlock premium themed cards to play together.
          </Text>
        </View>

        {/* Segmented control */}
        <View className="flex-row bg-slate-100 dark:bg-[#271318]/50 p-1.5 rounded-2xl mx-6 mt-6 border border-slate-200/20 dark:border-rose-950/20">
          <TouchableOpacity
            className={`flex-1 py-3 rounded-xl items-center ${
              activeTab === 'browse' ? 'bg-white dark:bg-rose-950/60 shadow-sm' : ''
            }`}
            onPress={() => setActiveTab('browse')}
          >
            <Text
              className={`font-black text-xs ${
                activeTab === 'browse'
                  ? 'text-[#af2c3b] dark:text-white'
                  : 'text-slate-400 dark:text-slate-500'
              }`}
            >
              Browse Bundles
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className={`flex-1 py-3 rounded-xl items-center ${
              activeTab === 'history' ? 'bg-white dark:bg-rose-950/60 shadow-sm' : ''
            }`}
            onPress={() => setActiveTab('history')}
          >
            <Text
              className={`font-black text-xs ${
                activeTab === 'history'
                  ? 'text-[#af2c3b] dark:text-white'
                  : 'text-slate-400 dark:text-slate-500'
              }`}
            >
              Unlocked Items
            </Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View className="py-20 justify-center items-center">
            <ActivityIndicator size="large" color="#af2c3b" />
            <Text className="text-slate-400 dark:text-slate-400 font-semibold text-xs mt-3">
              Loading store details...
            </Text>
          </View>
        ) : activeTab === 'browse' ? (
          renderBundles()
        ) : (
          renderHistory()
        )}
      </ScrollView>

      {/* Checkout Modal */}
      <Modal
        visible={checkoutVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setCheckoutVisible(false);
          setPaymentStep('details');
        }}
      >
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-white dark:bg-[#18080b] rounded-t-[40px] px-6 pt-8 pb-10 shadow-2xl">
            {purchaseSuccess ? (
              /* Success view */
              <View className="items-center py-10">
                <View className="w-20 h-20 bg-emerald-100 dark:bg-emerald-950/40 rounded-full items-center justify-center mb-6">
                  <Ionicons name="checkmark-circle" size={54} color="#10b981" />
                </View>
                <Text className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  Purchase Successful!
                </Text>
                <Text className="text-slate-500 dark:text-slate-400 text-xs font-semibold mt-2.5 text-center leading-5 max-w-[80%]">
                  {selectedPlan?.card_count} new cards have been added to your playable deck. Go play them!
                </Text>
              </View>
            ) : (
              /* Payment Multi-Step Flow */
              <View>
                {/* Modal Header */}
                <View className="flex-row items-center justify-between mb-6">
                  <View className="flex-row items-center gap-3">
                    {paymentStep !== 'details' && paymentStep !== 'processing' && (
                      <TouchableOpacity 
                        onPress={() => {
                          if (paymentStep === 'select_method') setPaymentStep('details');
                          else if (paymentStep === 'card_form' || paymentStep === 'upi_form' || paymentStep === 'net_banking_form') setPaymentStep('select_method');
                          else if (paymentStep === 'otp') setPaymentStep('select_method');
                        }}
                        className="w-8 h-8 rounded-full bg-slate-100 dark:bg-[#271318] items-center justify-center"
                      >
                        <Ionicons name="arrow-back" size={16} color={isDark ? "#fff" : "#1e293b"} />
                      </TouchableOpacity>
                    )}
                    <Text className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                      {paymentStep === 'details' && 'Confirm Purchase'}
                      {paymentStep === 'select_method' && 'Choose Payment Method'}
                      {paymentStep === 'card_form' && 'Enter Card Details'}
                      {paymentStep === 'upi_form' && 'Pay via UPI'}
                      {paymentStep === 'net_banking_form' && 'Select Bank'}
                      {paymentStep === 'processing' && 'Processing...'}
                      {paymentStep === 'otp' && 'Enter Secure OTP'}
                    </Text>
                  </View>
                  {paymentStep !== 'processing' && (
                    <TouchableOpacity onPress={() => {
                      setCheckoutVisible(false);
                      setPaymentStep('details');
                    }}>
                      <Ionicons name="close-circle" size={26} color={isDark ? "#fff" : "#94a3b8"} />
                    </TouchableOpacity>
                  )}
                </View>

                {/* STEP 1: Details view */}
                {paymentStep === 'details' && (
                  <View>
                    {/* Details card */}
                    <View className="bg-slate-50 dark:bg-[#271318]/50 border border-slate-100 dark:border-rose-950/20 rounded-2xl p-5 flex-row items-center mb-6">
                      <View className="w-14 h-14 rounded-xl overflow-hidden mr-4">
                        <Image
                          source={getBundleImage(selectedBundle?.name || '', selectedBundle?.image_url)}
                          className="w-full h-full object-cover"
                        />
                      </View>
                      <View className="flex-1">
                        <Text className="text-base font-black text-slate-900 dark:text-white">
                          {selectedBundle?.name}
                        </Text>
                        <Text className="text-slate-400 dark:text-slate-500 font-bold text-[11px] uppercase tracking-wider mt-0.5">
                          {selectedPlan?.card_count} Premium Cards
                        </Text>
                      </View>
                      <Text className="text-lg font-black text-[#e11d48] dark:text-rose-400">
                        ₹{selectedPlan?.price}
                      </Text>
                    </View>

                    {/* Plan Pack Toggles */}
                    <Text className="text-slate-400 dark:text-slate-500 text-[10px] font-extrabold uppercase tracking-widest mb-3">
                      Choose Card Pack Size
                    </Text>
                    <View className="flex-row gap-2.5 mb-6">
                      {selectedBundle?.bundle_plans?.map((plan) => {
                        const isSelected = selectedPlan?.id === plan.id;
                        return (
                          <TouchableOpacity
                            key={plan.id}
                            className={`flex-1 flex-row items-center border rounded-2xl px-4 py-3 active:opacity-85 ${
                              isSelected
                                ? 'bg-[#ffe4e6] dark:bg-rose-950/40 border-[#e11d48] dark:border-rose-500'
                                : 'bg-slate-50 dark:bg-[#271318]/30 border-slate-100 dark:border-rose-950/20'
                            }`}
                            onPress={() => setSelectedPlan(plan)}
                          >
                            <View className={`mr-2 w-4 h-4 rounded-full items-center justify-center ${
                              isSelected ? 'bg-[#e11d48]' : 'bg-slate-300 dark:bg-[#4A232A]'
                            }`}>
                              <Ionicons name="checkmark" size={10} color="white" />
                            </View>
                            <View>
                              <Text className="text-slate-900 dark:text-white font-bold text-[11px]">
                                {plan.card_count} Cards
                              </Text>
                              <Text className="text-[#e11d48] dark:text-rose-400 font-extrabold text-[10px] mt-0.5">
                                ₹{plan.price}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    <Text className="text-slate-500 dark:text-slate-400 text-xs font-semibold leading-5 mb-8">
                      By unlocking, new cards will be mixed into your deck immediately using our fair 80/20 distribution logic (guaranteeing at least 80% new cards).
                    </Text>

                    <TouchableOpacity
                      className="bg-[#af2c3b] dark:bg-rose-600 rounded-2xl py-4 items-center shadow-lg dark:shadow-none"
                      onPress={() => setPaymentStep('select_method')}
                    >
                      <Text className="text-white font-extrabold text-[15px]">
                        Proceed to Payment (₹{selectedPlan?.price})
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* STEP 2: Choose Payment Method */}
                {paymentStep === 'select_method' && (
                  <View className="gap-3.5 mb-2">
                    <TouchableOpacity
                      className="bg-slate-50 dark:bg-[#271318]/50 border border-slate-100 dark:border-rose-950/20 rounded-2xl p-4 flex-row items-center justify-between active:opacity-80"
                      onPress={() => setPaymentStep('card_form')}
                    >
                      <View className="flex-row items-center">
                        <View className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/30 items-center justify-center mr-4">
                          <Ionicons name="card-outline" size={22} color="#e11d48" />
                        </View>
                        <View>
                          <Text className="text-[15px] font-black text-slate-800 dark:text-white">Credit / Debit Card</Text>
                          <Text className="text-[11px] text-slate-400 dark:text-slate-500 font-semibold mt-0.5">Visa, Mastercard, RuPay, Maestro</Text>
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
                    </TouchableOpacity>

                    <TouchableOpacity
                      className="bg-slate-50 dark:bg-[#271318]/50 border border-slate-100 dark:border-rose-950/20 rounded-2xl p-4 flex-row items-center justify-between active:opacity-80"
                      onPress={() => setPaymentStep('upi_form')}
                    >
                      <View className="flex-row items-center">
                        <View className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/30 items-center justify-center mr-4">
                          <Ionicons name="phone-portrait-outline" size={22} color="#0d6e67" />
                        </View>
                        <View>
                          <Text className="text-[15px] font-black text-slate-800 dark:text-white">UPI Payment</Text>
                          <Text className="text-[11px] text-slate-400 dark:text-slate-500 font-semibold mt-0.5">Google Pay, PhonePe, Paytm, BHIM</Text>
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
                    </TouchableOpacity>

                    <TouchableOpacity
                      className="bg-slate-50 dark:bg-[#271318]/50 border border-slate-100 dark:border-rose-950/20 rounded-2xl p-4 flex-row items-center justify-between active:opacity-80"
                      onPress={() => setPaymentStep('net_banking_form')}
                    >
                      <View className="flex-row items-center">
                        <View className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/30 items-center justify-center mr-4">
                          <Ionicons name="business-outline" size={22} color="#0284c7" />
                        </View>
                        <View>
                          <Text className="text-[15px] font-black text-slate-800 dark:text-white">Net Banking</Text>
                          <Text className="text-[11px] text-slate-400 dark:text-slate-500 font-semibold mt-0.5">All major Indian retail banks</Text>
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
                    </TouchableOpacity>
                  </View>
                )}

                {/* STEP 3: Card Details Form */}
                {paymentStep === 'card_form' && (
                  <View>
                    <View className="mb-4">
                      <Text className="text-slate-400 dark:text-slate-500 text-[10px] font-extrabold uppercase tracking-widest mb-1.5">Cardholder Name</Text>
                      <TextInput
                        placeholder="e.g. John Doe"
                        placeholderTextColor={isDark ? "rgba(255,255,255,0.2)" : "#94a3b8"}
                        className="bg-slate-50 dark:bg-[#271318]/40 border border-slate-150 dark:border-rose-950/20 text-slate-900 dark:text-white rounded-2xl px-4 py-3.5 text-[14px] font-semibold"
                        value={cardName}
                        onChangeText={setCardName}
                        autoCapitalize="words"
                      />
                    </View>

                    <View className="mb-4">
                      <Text className="text-slate-400 dark:text-slate-500 text-[10px] font-extrabold uppercase tracking-widest mb-1.5">Card Number</Text>
                      <View className="relative">
                        <TextInput
                          placeholder="0000 0000 0000 0000"
                          placeholderTextColor={isDark ? "rgba(255,255,255,0.2)" : "#94a3b8"}
                          keyboardType="numeric"
                          maxLength={19}
                          className="bg-slate-50 dark:bg-[#271318]/40 border border-slate-150 dark:border-rose-950/20 text-slate-900 dark:text-white rounded-2xl pl-4 pr-12 py-3.5 text-[14px] font-semibold tracking-wider"
                          value={cardNumber}
                          onChangeText={(t) => setCardNumber(formatCardNumber(t))}
                        />
                        <View className="absolute right-4 top-3.5">
                          <Ionicons name="card" size={22} color={isDark ? "#fda4af" : "#94a3b8"} />
                        </View>
                      </View>
                    </View>

                    <View className="flex-row gap-4 mb-8">
                      <View className="flex-1">
                        <Text className="text-slate-400 dark:text-slate-500 text-[10px] font-extrabold uppercase tracking-widest mb-1.5">Expiry Date</Text>
                        <TextInput
                          placeholder="MM/YY"
                          placeholderTextColor={isDark ? "rgba(255,255,255,0.2)" : "#94a3b8"}
                          keyboardType="numeric"
                          maxLength={5}
                          className="bg-slate-50 dark:bg-[#271318]/40 border border-slate-150 dark:border-rose-950/20 text-slate-900 dark:text-white rounded-2xl px-4 py-3.5 text-[14px] font-semibold text-center"
                          value={cardExpiry}
                          onChangeText={(t) => setCardExpiry(formatExpiry(t))}
                        />
                      </View>
                      <View className="flex-1">
                        <Text className="text-slate-400 dark:text-slate-500 text-[10px] font-extrabold uppercase tracking-widest mb-1.5">CVV Code</Text>
                        <TextInput
                          placeholder="***"
                          placeholderTextColor={isDark ? "rgba(255,255,255,0.2)" : "#94a3b8"}
                          keyboardType="numeric"
                          secureTextEntry
                          maxLength={3}
                          className="bg-slate-50 dark:bg-[#271318]/40 border border-slate-150 dark:border-rose-950/20 text-slate-900 dark:text-white rounded-2xl px-4 py-3.5 text-[14px] font-semibold text-center"
                          value={cardCVV}
                          onChangeText={(t) => setCardCVV(t.replace(/\D/g, ''))}
                        />
                      </View>
                    </View>

                    <TouchableOpacity
                      className="bg-[#af2c3b] dark:bg-rose-600 rounded-2xl py-4 items-center shadow-lg dark:shadow-none"
                      onPress={() => {
                        if (!cardName.trim() || cardNumber.length < 19 || cardExpiry.length < 5 || cardCVV.length < 3) {
                          Alert.alert('Incomplete Details', 'Please enter valid credit card details.');
                          return;
                        }
                        startPaymentProcessing();
                      }}
                      disabled={buying}
                    >
                      <Text className="text-white font-extrabold text-[15px]">
                        Pay Securely ₹{selectedPlan?.price}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* STEP 4: UPI Form */}
                {paymentStep === 'upi_form' && (
                  <View>
                    {/* Quick Launch Apps */}
                    <Text className="text-slate-400 dark:text-slate-500 text-[10px] font-extrabold uppercase tracking-widest mb-3">Quick Pay using UPI Apps</Text>
                    <View className="flex-row justify-between gap-3 mb-6">
                      {[
                        { name: 'Google Pay', icon: 'logo-google', bg: 'bg-[#e8f0fe] dark:bg-sky-950/30', color: '#1a73e8' },
                        { name: 'PhonePe', icon: 'wallet', bg: 'bg-[#f3e8ff] dark:bg-purple-950/30', color: '#5f259f' },
                        { name: 'Paytm', icon: 'send', bg: 'bg-[#e0f2fe] dark:bg-[#1e152a]', color: '#002e6e' }
                      ].map((app) => (
                        <TouchableOpacity
                          key={app.name}
                          className="flex-1 items-center justify-center py-3.5 rounded-2xl border border-slate-100 dark:border-rose-950/20 bg-slate-50 dark:bg-[#271318]/20 active:opacity-80"
                          onPress={() => {
                            setUpiId(`couple.${app.name.toLowerCase().replace(' ', '')}@upi`);
                          }}
                        >
                          <View className={`w-8 h-8 rounded-full ${app.bg} items-center justify-center mb-1.5`}>
                            <Ionicons name={app.icon as any} size={15} color={app.color} />
                          </View>
                          <Text className="text-[10px] font-bold text-slate-700 dark:text-slate-300">{app.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <View className="mb-8">
                      <Text className="text-slate-400 dark:text-slate-500 text-[10px] font-extrabold uppercase tracking-widest mb-1.5">Or Enter Custom UPI ID</Text>
                      <TextInput
                        placeholder="e.g. username@upi"
                        placeholderTextColor={isDark ? "rgba(255,255,255,0.2)" : "#94a3b8"}
                        className="bg-slate-50 dark:bg-[#271318]/40 border border-slate-150 dark:border-rose-950/20 text-slate-900 dark:text-white rounded-2xl px-4 py-3.5 text-[14px] font-semibold"
                        value={upiId}
                        onChangeText={setUpiId}
                        autoCapitalize="none"
                      />
                    </View>

                    <TouchableOpacity
                      className="bg-[#af2c3b] dark:bg-rose-600 rounded-2xl py-4 items-center shadow-lg dark:shadow-none"
                      onPress={() => {
                        if (!upiId.trim() || !upiId.includes('@')) {
                          Alert.alert('Invalid UPI ID', 'Please enter a valid UPI address (e.g. name@bank).');
                          return;
                        }
                        startPaymentProcessing();
                      }}
                      disabled={buying}
                    >
                      <Text className="text-white font-extrabold text-[15px]">
                        Verify and Pay ₹{selectedPlan?.price}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* STEP 5: Net Banking Selection */}
                {paymentStep === 'net_banking_form' && (
                  <View>
                    <Text className="text-slate-400 dark:text-slate-500 text-[10px] font-extrabold uppercase tracking-widest mb-3">Popular Retail Banks</Text>
                    <View className="flex-row flex-wrap justify-between gap-y-3.5 mb-8">
                      {[
                        { name: 'SBI', label: 'State Bank of India', code: 'sbi' },
                        { name: 'HDFC', label: 'HDFC Bank', code: 'hdfc' },
                        { name: 'ICICI', label: 'ICICI Bank', code: 'icici' },
                        { name: 'AXIS', label: 'Axis Bank', code: 'axis' }
                      ].map((bank) => {
                        const isSelected = selectedBank === bank.label;
                        return (
                          <TouchableOpacity
                            key={bank.code}
                            className={`w-[48%] py-3 px-4 border rounded-2xl flex-row items-center active:opacity-85 ${
                              isSelected
                                ? 'bg-[#ffe4e6] dark:bg-rose-950/40 border-[#e11d48] dark:border-rose-500'
                                : 'bg-slate-50 dark:bg-[#271318]/30 border-slate-100 dark:border-rose-950/20'
                            }`}
                            onPress={() => setSelectedBank(bank.label)}
                          >
                            <View className={`w-4 h-4 rounded-full items-center justify-center mr-2.5 ${
                              isSelected ? 'bg-[#e11d48]' : 'bg-slate-300 dark:bg-[#4A232A]'
                            }`}>
                              <Ionicons name="checkmark" size={10} color="white" />
                            </View>
                            <View>
                              <Text className="text-slate-900 dark:text-white font-extrabold text-[12px]">{bank.name}</Text>
                              <Text className="text-slate-400 dark:text-slate-500 text-[8px] font-bold mt-0.5">{bank.label}</Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    <TouchableOpacity
                      className="bg-[#af2c3b] dark:bg-rose-600 rounded-2xl py-4 items-center shadow-lg dark:shadow-none"
                      onPress={() => {
                        if (!selectedBank) {
                          Alert.alert('Select a Bank', 'Please select a retail bank to continue.');
                          return;
                        }
                        startPaymentProcessing();
                      }}
                      disabled={buying}
                    >
                      <Text className="text-white font-extrabold text-[15px]">
                        Pay via Net Banking ({selectedBank ? selectedBank.split(' ')[0] : ''})
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* STEP 6: Secure Processing overlay */}
                {paymentStep === 'processing' && (
                  <View className="items-center py-10 justify-center">
                    <ActivityIndicator size="large" color="#af2c3b" className="mb-6" />
                    <Text className="text-[15px] font-black text-slate-800 dark:text-white tracking-tight text-center">
                      Payment Verification
                    </Text>
                    <Text className="text-slate-400 dark:text-slate-500 text-xs font-semibold mt-2.5 text-center leading-5 max-w-[85%]">
                      {processingStatus}
                    </Text>
                  </View>
                )}

                {/* STEP 7: Security OTP Verification Screen */}
                {paymentStep === 'otp' && (
                  <View>
                    <View className="items-center mb-6">
                      <View className="w-12 h-12 bg-rose-50 dark:bg-rose-950/20 rounded-full items-center justify-center mb-3">
                        <Ionicons name="shield-checkmark" size={24} color="#e11d48" />
                      </View>
                      <Text className="text-[15px] font-black text-slate-900 dark:text-white tracking-tight">
                        3D Secure Verification
                      </Text>
                      <Text className="text-slate-400 dark:text-slate-500 text-[11px] font-semibold text-center mt-1.5 leading-4 max-w-[80%]">
                        We sent a 6-digit OTP code to your registered mobile number for this payment of ₹{selectedPlan?.price}.
                      </Text>
                    </View>

                    <View className="mb-6">
                      <Text className="text-slate-400 dark:text-slate-500 text-[10px] font-extrabold uppercase tracking-widest mb-2 text-center">Enter 6-Digit OTP Code</Text>
                      <TextInput
                        placeholder="0 0 0 0 0 0"
                        placeholderTextColor={isDark ? "rgba(255,255,255,0.2)" : "#94a3b8"}
                        keyboardType="numeric"
                        maxLength={6}
                        className="bg-slate-50 dark:bg-[#271318]/40 border border-slate-150 dark:border-rose-950/20 text-slate-900 dark:text-white rounded-2xl px-4 py-4 text-[18px] font-black text-center tracking-[12px]"
                        value={otpCode}
                        onChangeText={(t) => setOtpCode(t.replace(/\D/g, ''))}
                      />
                    </View>

                    <View className="flex-row items-center justify-between mb-8">
                      {otpResendSeconds > 0 ? (
                        <Text className="text-slate-400 dark:text-slate-500 text-xs font-semibold">
                          Resend OTP in <Text className="font-extrabold text-[#e11d48]">{otpResendSeconds}s</Text>
                        </Text>
                      ) : (
                        <TouchableOpacity
                          onPress={() => {
                            setOtpResendSeconds(30);
                            Alert.alert('OTP Sent', 'A new mock security code has been sent to your phone.');
                          }}
                        >
                          <Text className="text-[#e11d48] dark:text-rose-400 text-xs font-extrabold uppercase tracking-wider">Resend OTP Code</Text>
                        </TouchableOpacity>
                      )}
                      <Text className="text-slate-300 dark:text-slate-600 text-xs font-semibold">Test Code: Any 6 digits</Text>
                    </View>

                    <TouchableOpacity
                      className="bg-[#af2c3b] dark:bg-rose-600 rounded-2xl py-4 items-center shadow-lg dark:shadow-none"
                      onPress={handleConfirmOTP}
                      disabled={buying}
                    >
                      {buying ? (
                        <ActivityIndicator size="small" color="white" />
                      ) : (
                        <Text className="text-white font-extrabold text-[15px]">
                          Submit OTP Code
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
