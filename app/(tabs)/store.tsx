import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Platform,
  StatusBar,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  useWindowDimensions,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  bypassStorePurchase,
} from '@/services/storeService';
import { getActiveRoom } from '@/services/roomService';

const getBundleImage = (bundleName: string, defaultUrl?: string | null) => {
  const name = (bundleName || '').toLowerCase();
  if (name.includes('spicy') || name.includes('spark') || name.includes('nights')) {
    return require('../../assets/images/bundle_spicy.jpg');
  }
  if (name.includes('romantic') || name.includes('getaway') || name.includes('adventure') || name.includes('travel') || name.includes('weekend')) {
    return require('../../assets/images/bundle_romantic.jpg');
  }
  if (name.includes('cozy') || name.includes('connection') || name.includes('night') || name.includes('indoor') || name.includes('winter')) {
    return require('../../assets/images/bundle_cozy.jpg');
  }
  
  if (defaultUrl && defaultUrl.trim() !== '') {
    return { uri: defaultUrl };
  }
  
  return require('../../assets/images/bundle_cozy.jpg');
};

export default function StoreScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const buyBundleId = params.buyBundleId as string | undefined;
  const { openSidebar } = useSidebar();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const textInputStyle = {
    backgroundColor: isDark ? 'rgba(39,19,24,0.4)' : '#f8fafc',
    borderColor: isDark ? 'rgba(76,5,25,0.2)' : '#e2e8f0',
    borderWidth: 1,
    color: isDark ? '#fff' : '#0f172a',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 14,
    fontWeight: '600' as const,
  };

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

  // Bypass Payment State
  const [paymentStep, setPaymentStep] = useState<'details' | 'processing'>('details');
  const [processingStatus, setProcessingStatus] = useState('Unlocking bundle...');

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
      setPurchases(fetchedPurchases);
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
    const plans = bundle.bundle_plans || bundle.plans || [];
    if (plans && plans.length > 0) {
      setSelectedPlan(plans[0]);
    } else {
      setSelectedPlan({
        id: 'mock-plan-id',
        bundle_id: bundle.id,
        price: 99,
        card_count: 10
      });
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

  const handleBypassPayment = async () => {
    if (!selectedBundle || !selectedPlan) {
      Alert.alert('Error', 'Please select a valid bundle and plan before unlocking.');
      setPaymentStep('details');
      return;
    }

    setBuying(true);
    setPaymentStep('processing');
    setProcessingStatus('Bypassing payment and unlocking bundle...');
    
    try {
      // Call the backend API to securely mock the purchase and assign cards
      const result = await bypassStorePurchase(selectedBundle.id, selectedPlan.id);
      
      setPurchaseSuccess(true);
      
      // Automatically close success screen after 2.5s and reload data
      setTimeout(() => {
        setCheckoutVisible(false);
        setPaymentStep('details');
        loadData();
      }, 2500);
    } catch (e) {
      console.log('Failed to save mock purchase:', e);
      Alert.alert('Transaction Failed', 'We could not complete your mock transaction. Please try again.');
      setPaymentStep('details');
    } finally {
      setBuying(false);
    }
  };

  const renderBundles = () => {
    return (
      <View className="flex-row flex-wrap justify-between px-6 mt-4">
        {bundles.map((bundle) => {
          const plans = bundle.bundle_plans || bundle.plans || [];
          const startingPrice = plans.length > 0
            ? Math.min(...plans.map(p => p.price))
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
                    {plans?.[0]?.card_count || 10} Cards
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


  return (
    <View
      style={{ flex: 1, backgroundColor: isDark ? '#0F0608' : '#fdfaf9', paddingTop: insets.top }}
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


        {loading ? (
          <View className="py-20 justify-center items-center">
            <ActivityIndicator size="large" color="#af2c3b" />
            <Text className="text-slate-400 dark:text-slate-400 font-semibold text-xs mt-3">
              Loading store details...
            </Text>
          </View>
        ) : (
          renderBundles()
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
                      {paymentStep === 'details' && 'Unlock Bundle'}
                      {paymentStep === 'processing' && 'Processing...'}
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
                      onPress={handleBypassPayment}
                      disabled={buying}
                    >
                      <Text className="text-white font-extrabold text-[15px]">
                        Unlock Now (Bypass Payment)
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* STEP 2: Processing overlay */}
                {paymentStep === 'processing' && (
                  <View className="items-center py-10 justify-center">
                    <ActivityIndicator size="large" color="#af2c3b" style={{ marginBottom: 24 }} />
                    <Text className="text-[15px] font-black text-slate-800 dark:text-white tracking-tight text-center">
                      Payment Bypass
                    </Text>
                    <Text className="text-slate-400 dark:text-slate-500 text-xs font-semibold mt-2.5 text-center leading-5 max-w-[85%]">
                      {processingStatus}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}
