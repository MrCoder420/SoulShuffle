import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Platform,
  StatusBar,
  Animated,
  Dimensions,
  TextInput,
  KeyboardAvoidingView,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  fetchQuestionnaire,
  submitAnswers as submitAnswersApi,
  Question,
  AnswerPayload,
} from '../services/questionnaireService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Default High-Quality Couple Questions (with Gender) ───
const DEFAULT_QUESTIONS: Question[] = [
  {
    id: 'q_gender',
    text: 'What is your gender?',
    input_type: 'SINGLE_CHOICE',
    order_index: 1,
    question_dependencies: [],
    question_options: [
      { id: 'opt_gender_m', option_text: '👨 Male', order_index: 1 },
      { id: 'opt_gender_f', option_text: '👩 Female', order_index: 2 },
      { id: 'opt_gender_nb', option_text: '✨ Non-binary', order_index: 3 },
      { id: 'opt_gender_pns', option_text: '🤍 Prefer not to say', order_index: 4 },
    ],
  },
  {
    id: 'q_stage',
    text: 'What is your relationship stage?',
    input_type: 'SINGLE_CHOICE',
    order_index: 2,
    question_dependencies: [],
    question_options: [
      { id: 'opt_stage_new', option_text: '💕 Newly Dating (0 - 6 months)', order_index: 1 },
      { id: 'opt_stage_strong', option_text: '🔥 Going Strong (6m - 2 years)', order_index: 2 },
      { id: 'opt_stage_married', option_text: '💍 Engaged / Married (2+ years)', order_index: 3 },
      { id: 'opt_stage_ldr', option_text: '✈️ Long Distance Lovers', order_index: 4 },
    ],
  },
  {
    id: 'q_vibe',
    text: "What's your ideal couple vibe?",
    input_type: 'SINGLE_CHOICE',
    order_index: 3,
    question_dependencies: [],
    question_options: [
      { id: 'opt_vibe_spicy', option_text: '🌶️ Bold, Spicy & Adventurous', order_index: 1 },
      { id: 'opt_vibe_cozy', option_text: '🛋️ Cozy & Romantic Homebodies', order_index: 2 },
      { id: 'opt_vibe_playful', option_text: '🎮 Playful, Fun & Competitive', order_index: 3 },
      { id: 'opt_vibe_deep', option_text: '🍷 Deep Talks & Fine Dining', order_index: 4 },
    ],
  },
  {
    id: 'q_lovelang',
    text: "What's your primary love language?",
    input_type: 'SINGLE_CHOICE',
    order_index: 4,
    question_dependencies: [],
    question_options: [
      { id: 'opt_lang_touch', option_text: '🤗 Physical Touch & Intimacy', order_index: 1 },
      { id: 'opt_lang_time', option_text: '🎁 Quality Time & Surprises', order_index: 2 },
      { id: 'opt_lang_words', option_text: '💬 Words of Affirmation', order_index: 3 },
      { id: 'opt_lang_acts', option_text: '🤝 Acts of Service & Care', order_index: 4 },
    ],
  },
  {
    id: 'q_spiciness',
    text: 'How spicy do you want your game dares?',
    input_type: 'SINGLE_CHOICE',
    order_index: 5,
    question_dependencies: [],
    question_options: [
      { id: 'opt_spice_sweet', option_text: '🍦 Sweet & Playful (Mild)', order_index: 1 },
      { id: 'opt_spice_warm', option_text: '🔥 Warm & Flirty (Medium)', order_index: 2 },
      { id: 'opt_spice_hot', option_text: '🌶️ Extra Spicy & Wild (Hot!)', order_index: 3 },
    ],
  },
  {
    id: 'q_living',
    text: 'Do you live together with your partner?',
    input_type: 'SINGLE_CHOICE',
    order_index: 6,
    question_dependencies: [],
    question_options: [
      { id: 'opt_live_yes', option_text: '🏡 Yes, we share a home', order_index: 1 },
      { id: 'opt_live_no', option_text: '🚗 No, we live separately', order_index: 2 },
    ],
  },
];

// ─── Emoji mapping for known question steps ───────────────
const QUESTION_EMOJIS: Record<number, string> = {
  0: '👤',
  1: '💕',
  2: '✨',
  3: '❤️‍🔥',
  4: '🌶️',
  5: '🏡',
};

const DEFAULT_EMOJI = '💬';

export default function Questionnaire() {
  // ─── State ─────────────────────────
  const [questions, setQuestions] = useState<Question[]>(DEFAULT_QUESTIONS);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [history, setHistory] = useState<number[]>([0]);
  const currentStep = history[history.length - 1] ?? 0;
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [textValue, setTextValue] = useState('');

  // Animations
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const headerFadeAnim = useRef(new Animated.Value(0)).current;
  const optionAnimsRef = useRef<Animated.Value[][]>([]);

  const currentQuestion: Question | undefined = questions[currentStep];
  const progress = questions.length > 0 ? (currentStep + 1) / questions.length : 0;

  const navigateToTabs = () => {
    setTimeout(() => {
      try {
        router.replace('/(tabs)');
      } catch (err) {
        console.warn('Navigation error:', err);
      }
    }, 100);
  };

  // ─── Load questions on mount ──────────
  useEffect(() => {
    loadQuestions();
  }, []);

  const loadQuestions = async () => {
    try {
      setIsLoadingQuestions(true);
      setLoadError(null);

      let loadedQuestions: Question[] = [];
      try {
        const data = await fetchQuestionnaire();
        if (data && Array.isArray(data) && data.length >= 3) {
          const validBackend = data.filter(
            q =>
              q.text &&
              q.text.trim().length > 5 &&
              !/^[a-z]+$/i.test(q.text.trim()) &&
              q.question_options &&
              q.question_options.length > 1
          );

          if (validBackend.length >= 3) {
            loadedQuestions = validBackend;
          }
        }
      } catch (e) {
        console.warn('Backend fetch questionnaire failed, using curated default questions:', e);
      }

      if (loadedQuestions.length === 0) {
        loadedQuestions = DEFAULT_QUESTIONS;
      } else {
        const hasGender = loadedQuestions.some(q => q.text.toLowerCase().includes('gender'));
        if (!hasGender) {
          loadedQuestions = [DEFAULT_QUESTIONS[0], ...loadedQuestions];
        }
      }

      const sorted = loadedQuestions.map(q => ({
        ...q,
        question_options: (q.question_options || []).sort(
          (a, b) => a.order_index - b.order_index
        ),
      }));

      setQuestions(sorted);

      optionAnimsRef.current = sorted.map(q =>
        Array(Math.max(q.question_options.length, 1))
          .fill(0)
          .map(() => new Animated.Value(0))
      );

      Animated.timing(headerFadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }).start();

      setTimeout(() => animateOptionsIn(0, sorted), 200);
    } catch (error: any) {
      console.error('Failed to load questionnaire:', error);
      setQuestions(DEFAULT_QUESTIONS);
    } finally {
      setIsLoadingQuestions(false);
    }
  };

  useEffect(() => {
    if (questions.length === 0) return;
    Animated.spring(progressAnim, {
      toValue: progress,
      tension: 40,
      friction: 10,
      useNativeDriver: false,
    }).start();

    animateOptionsIn(currentStep, questions);
  }, [currentStep, questions.length]);

  const animateOptionsIn = (stepIndex: number, currentQuestionsList = questions) => {
    if (!currentQuestionsList || currentQuestionsList.length === 0) return;
    const anims = optionAnimsRef.current[stepIndex];
    if (!anims) return;

    anims.forEach(anim => anim.setValue(0));

    const optionCount = currentQuestionsList[stepIndex]?.question_options?.length || 1;
    const animations = anims.slice(0, optionCount).map((anim, index) =>
      Animated.spring(anim, {
        toValue: 1,
        tension: 60,
        friction: 9,
        delay: index * 80,
        useNativeDriver: true,
      })
    );
    Animated.stagger(80, animations).start();
  };

  const animateTransition = (direction: 'next' | 'back', callback: () => void) => {
    const toValue = direction === 'next' ? -SCREEN_WIDTH : SCREEN_WIDTH;

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: toValue * 0.3,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      slideAnim.setValue(direction === 'next' ? SCREEN_WIDTH * 0.3 : -SCREEN_WIDTH * 0.3);
      callback();

      Animated.parallel([
        Animated.spring(fadeAnim, {
          toValue: 1,
          tension: 50,
          friction: 10,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 50,
          friction: 10,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 10,
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  const getInputType = (q: Question): 'single_select' | 'multi_select' | 'text' | 'slider' | 'date_picker' => {
    const type = q.input_type?.toUpperCase() || 'SINGLE_CHOICE';
    if (type === 'MULTI_CHOICE') return 'multi_select';
    if (type === 'TEXT') return 'text';
    if (type === 'SLIDER') return 'slider';
    if (type === 'DATE_PICKER') return 'date_picker';
    return 'single_select';
  };

  const handleSelectOption = (optionId: string) => {
    if (!currentQuestion) return;
    const inputType = getInputType(currentQuestion);

    if (inputType === 'multi_select') {
      const current = (answers[currentQuestion.id] as string[]) || [];
      if (current.includes(optionId)) {
        setAnswers(prev => ({ ...prev, [currentQuestion.id]: current.filter(id => id !== optionId) }));
      } else {
        setAnswers(prev => ({ ...prev, [currentQuestion.id]: [...current, optionId] }));
      }
    } else {
      const newAnswers = { ...answers, [currentQuestion.id]: optionId };
      setAnswers(newAnswers);
      setTimeout(() => {
        handleNext(newAnswers);
      }, 250);
    }
  };

  const handleNext = (overrideAnswers?: Record<string, string | string[]>) => {
    if (!currentQuestion) return;
    const inputType = getInputType(currentQuestion);
    const currentAnswers = overrideAnswers || answers;

    let finalAnswer = textValue;
    if (inputType === 'date_picker' && textValue) {
       try {
         finalAnswer = new Date(textValue).toISOString();
       } catch (e) {}
    }

    if (inputType === 'text' || inputType === 'slider' || inputType === 'date_picker') {
      currentAnswers[currentQuestion.id] = finalAnswer;
      setAnswers({ ...currentAnswers });
    }

    const nextIndex = currentStep + 1;

    if (nextIndex < questions.length) {
      animateTransition('next', () => {
        setHistory(prev => [...prev, nextIndex]);
        setTextValue('');
        const nextQ = questions[nextIndex];
        if (nextQ && ['text', 'slider', 'date_picker'].includes(getInputType(nextQ))) {
          setTextValue((currentAnswers[nextQ.id] as string) || '');
        }
      });
    } else {
      handleFinish(currentAnswers);
    }
  };

  const handleBack = () => {
    if (history.length > 1) {
      animateTransition('back', () => {
        const newHistory = [...history];
        newHistory.pop();
        setHistory(newHistory);
        const prevIndex = newHistory[newHistory.length - 1];
        const prevQ = questions[prevIndex];
        const prevInputType = getInputType(prevQ);
        if (['text', 'slider', 'date_picker'].includes(prevInputType)) {
          setTextValue((answers[prevQ.id] as string) || '');
        }
      });
    }
  };

  const handleFinish = async (finalAnswersParam?: Record<string, string | string[]>) => {
    if (!currentQuestion) {
      navigateToTabs();
      return;
    }

    setIsSubmitting(true);
    const inputType = getInputType(currentQuestion);
    let finalAnswers = { ...(finalAnswersParam || answers) };
    if (inputType === 'text' || inputType === 'slider' || inputType === 'date_picker') {
      let finalAnswer = textValue;
      if (inputType === 'date_picker' && textValue) {
         try {
           finalAnswer = new Date(textValue).toISOString();
         } catch (e) { }
      }
      finalAnswers[currentQuestion.id] = finalAnswer;
    }

    const payload: AnswerPayload[] = [];
    for (const q of questions) {
      const answer = finalAnswers[q.id];
      if (!answer) continue;

      const qInputType = getInputType(q);

      if (qInputType === 'multi_select' && Array.isArray(answer)) {
        for (const optId of answer) {
          payload.push({
            question_id: q.id,
            selected_option_id: optId,
            text_value: null,
          });
        }
      } else if (['text', 'slider', 'date_picker'].includes(qInputType)) {
        payload.push({
          question_id: q.id,
          selected_option_id: null,
          text_value: answer as string,
        });
      } else {
        payload.push({
          question_id: q.id,
          selected_option_id: answer as string,
          text_value: null,
        });
      }
    }

    if (payload.length > 0) {
      submitAnswersApi(payload).catch((error: any) => {
        console.warn('Onboarding answers submission:', error?.message || error);
      });
    }

    navigateToTabs();
  };

  const handleSkip = () => {
    navigateToTabs();
  };

  const isNextDisabled = () => {
    if (!currentQuestion) return true;
    const inputType = getInputType(currentQuestion);
    const answer = answers[currentQuestion.id];

    if (['text', 'slider', 'date_picker'].includes(inputType)) {
      return !textValue.trim();
    }
    if (inputType === 'multi_select') {
      return !answer || (answer as string[]).length === 0;
    }
    return !answer;
  };

  const isOptionSelected = (optionId: string) => {
    if (!currentQuestion) return false;
    const inputType = getInputType(currentQuestion);
    const answer = answers[currentQuestion.id];

    if (inputType === 'multi_select') {
      return ((answer as string[]) || []).includes(optionId);
    }
    return answer === optionId;
  };

  const progressBarWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  // ─── Loading State ─────────────────────────────────────
  if (isLoadingQuestions) {
    return (
      <SafeAreaView
        className="flex-1 bg-[#0B0508] items-center justify-center"
        style={{ paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 }}
      >
        <StatusBar barStyle="light-content" backgroundColor="#0B0508" />
        <View className="bg-[#1A0B13] w-20 h-20 rounded-[28px] items-center justify-center mb-6 border border-rose-500/20 shadow-lg shadow-rose-950/50">
          <Text className="text-4xl">💕</Text>
        </View>
        <ActivityIndicator size="large" color="#FF2D55" />
        <Text className="text-slate-400 font-semibold text-base mt-4">
          Preparing your onboarding...
        </Text>
      </SafeAreaView>
    );
  }

  // ─── Error State ───────────────────────────────────────
  if (loadError) {
    return (
      <SafeAreaView
        className="flex-1 bg-[#0B0508] items-center justify-center px-8"
        style={{ paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 }}
      >
        <StatusBar barStyle="light-content" backgroundColor="#0B0508" />
        <View className="bg-[#1A0B13] w-20 h-20 rounded-[28px] items-center justify-center mb-6 border border-rose-500/20 shadow-lg shadow-rose-950/50">
          <Ionicons name="alert-circle-outline" size={40} color="#FF2D55" />
        </View>
        <Text className="text-white font-bold text-lg text-center mb-2">
          Could not load questions
        </Text>
        <Text className="text-slate-400 font-medium text-sm text-center mb-8">
          {loadError}
        </Text>
        <TouchableOpacity
          onPress={loadQuestions}
          className="bg-[#FF2D55] rounded-2xl px-8 py-4 mb-4"
          activeOpacity={0.8}
        >
          <Text className="text-white font-bold text-base">Try Again</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleSkip}>
          <Text className="text-rose-400 font-bold text-sm">Skip for now</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (!currentQuestion) {
    navigateToTabs();
    return null;
  }

  const inputType = getInputType(currentQuestion);

  return (
    <SafeAreaView
      className="flex-1 bg-[#0B0508]"
      style={{ paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 }}
    >
      <StatusBar barStyle="light-content" backgroundColor="#0B0508" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        {/* Dark Decorative Atmosphere Glows */}
        <View className="absolute w-[600px] h-[600px] bg-rose-900/10 rounded-full -top-60 -right-40" />
        <View className="absolute w-[400px] h-[400px] bg-pink-950/20 rounded-full bottom-20 -left-40" />
        <View className="absolute w-[200px] h-[200px] bg-rose-600/10 rounded-full top-40 left-20" />

        {/* Header */}
        <Animated.View style={{ opacity: headerFadeAnim }} className="px-6 pt-4">
          {/* Top Navigation Bar */}
          <View className="flex-row items-center justify-between mb-6">
            <TouchableOpacity
              onPress={handleBack}
              className="w-11 h-11 bg-white/10 rounded-full items-center justify-center border border-white/15"
              style={{ opacity: history.length > 1 ? 1 : 0.3 }}
              disabled={history.length <= 1}
            >
              <Ionicons name="chevron-back" size={22} color="#ffffff" />
            </TouchableOpacity>

            <View className="items-center">
              <Text className="text-xs font-bold text-[#FF5C80] tracking-widest uppercase">
                Step {currentStep + 1} of {questions.length}
              </Text>
            </View>

            <TouchableOpacity onPress={handleSkip} className="px-3 py-2">
              <Text className="text-slate-400 font-semibold text-sm">Skip</Text>
            </TouchableOpacity>
          </View>

          {/* Glowing Progress Bar */}
          <View className="h-[6px] bg-white/10 rounded-full overflow-hidden mb-2">
            <Animated.View
              className="h-full bg-[#FF2D55] rounded-full"
              style={{
                width: progressBarWidth,
              }}
            />
          </View>
        </Animated.View>

        {/* Question Body */}
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View
            style={{
              opacity: fadeAnim,
              transform: [{ translateX: slideAnim }, { scale: scaleAnim }],
            }}
            className="px-6 pt-6"
          >
            {/* Emoji & Question Header */}
            <View className="items-center mb-2">
              <View className="bg-[#1A0B13] w-20 h-20 rounded-[28px] items-center justify-center mb-5 border border-rose-500/20 shadow-lg shadow-rose-950/50">
                <Text className="text-4xl">
                  {QUESTION_EMOJIS[currentStep] ?? DEFAULT_EMOJI}
                </Text>
              </View>

              <Text className="text-[26px] font-black text-white text-center leading-9 tracking-tight px-2">
                {currentQuestion.text}
              </Text>

              <Text className="text-rose-300/70 font-semibold text-sm mt-3 text-center">
                {inputType === 'multi_select'
                  ? 'Select all that apply'
                  : inputType === 'text'
                  ? 'Type your answer below'
                  : 'Choose one option'}
              </Text>
            </View>

            {/* Options List */}
            <View className="mt-8">
              {['text', 'slider', 'date_picker'].includes(inputType) ? (
                <Animated.View
                  style={{
                    opacity: optionAnimsRef.current[currentStep]?.[0] || new Animated.Value(1),
                    transform: [
                      {
                        translateY: (
                          optionAnimsRef.current[currentStep]?.[0] || new Animated.Value(1)
                        ).interpolate({
                          inputRange: [0, 1],
                          outputRange: [30, 0],
                        }),
                      },
                    ],
                  }}
                >
                  <View className="bg-[#1A0B13] rounded-[28px] p-2 border border-rose-500/30">
                    <TextInput
                      placeholder={
                        inputType === 'slider' ? 'Enter a number...' : inputType === 'date_picker' ? 'YYYY-MM-DD' : 'Type here...'
                      }
                      placeholderTextColor="#64748b"
                      className="text-white font-semibold text-lg px-5 py-5"
                      value={textValue}
                      onChangeText={setTextValue}
                      autoFocus
                      returnKeyType="done"
                      keyboardType={inputType === 'slider' ? 'numeric' : 'default'}
                      onSubmitEditing={() => !isNextDisabled() && handleNext()}
                    />
                  </View>
                </Animated.View>
              ) : (
                currentQuestion.question_options.map((option, index) => {
                  const selected = isOptionSelected(option.id);
                  const animValue =
                    optionAnimsRef.current[currentStep]?.[index] || new Animated.Value(1);

                  return (
                    <Animated.View
                      key={option.id}
                      style={{
                        opacity: animValue,
                        transform: [
                          {
                            translateY: animValue.interpolate({
                              inputRange: [0, 1],
                              outputRange: [40, 0],
                            }),
                          },
                        ],
                      }}
                    >
                      <TouchableOpacity
                        onPress={() => handleSelectOption(option.id)}
                        activeOpacity={0.7}
                        className={`flex-row items-center mb-3 rounded-[22px] px-5 py-[18px] border-2 ${
                          selected
                            ? 'bg-[#FF2D55] border-[#FF5C80] shadow-lg shadow-rose-900/60'
                            : 'bg-[#1A0B13] border-white/10'
                        }`}
                      >
                        <Text
                          className={`text-[16px] font-bold flex-1 ${
                            selected ? 'text-white' : 'text-slate-200'
                          }`}
                        >
                          {option.option_text}
                        </Text>

                        {inputType === 'multi_select' && (
                          <View
                            className={`w-6 h-6 rounded-lg items-center justify-center ${
                              selected
                                ? 'bg-white/30'
                                : 'bg-white/5 border border-white/20'
                            }`}
                          >
                            {selected && (
                              <Ionicons name="checkmark" size={16} color="white" />
                            )}
                          </View>
                        )}

                        {inputType === 'single_select' && selected && (
                          <View className="w-6 h-6 rounded-full bg-white/20 items-center justify-center">
                            <View className="w-3 h-3 rounded-full bg-white" />
                          </View>
                        )}
                      </TouchableOpacity>
                    </Animated.View>
                  );
                })
              )}
            </View>
          </Animated.View>
        </ScrollView>

        {/* Bottom Action Footer */}
        <View className="px-6 pb-6 pt-3">
          {['multi_select', 'text', 'slider', 'date_picker'].includes(inputType) && (
            <TouchableOpacity
              onPress={() => handleNext()}
              disabled={isNextDisabled() || isSubmitting}
              activeOpacity={0.8}
              className={`rounded-[20px] h-[60px] items-center justify-center flex-row ${
                isNextDisabled() || isSubmitting
                  ? 'bg-slate-800/60'
                  : 'bg-[#FF2D55] shadow-lg shadow-rose-950/80'
              }`}
            >
              {isSubmitting && currentStep === questions.length - 1 ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <>
                  <Text
                    className={`font-bold text-[17px] mr-2 ${
                      isNextDisabled() || isSubmitting ? 'text-slate-500' : 'text-white'
                    }`}
                  >
                    {currentStep === questions.length - 1 ? "Let's Play!" : 'Continue'}
                  </Text>
                  <Ionicons
                    name={currentStep === questions.length - 1 ? 'heart' : 'arrow-forward'}
                    size={20}
                    color={isNextDisabled() || isSubmitting ? '#64748b' : 'white'}
                  />
                </>
              )}
            </TouchableOpacity>
          )}

          {inputType === 'single_select' && answers[currentQuestion.id] && (
            <TouchableOpacity
              onPress={() => handleNext()}
              activeOpacity={0.8}
              disabled={isSubmitting}
              className={`rounded-[20px] h-[60px] items-center justify-center flex-row ${
                isSubmitting ? 'bg-rose-800' : 'bg-[#FF2D55] shadow-lg shadow-rose-950/80'
              }`}
            >
              {isSubmitting && currentStep === questions.length - 1 ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <>
                  <Text className="text-white font-bold text-[17px] mr-2">
                    {currentStep === questions.length - 1 ? "Let's Play!" : 'Continue'}
                  </Text>
                  <Ionicons
                    name={currentStep === questions.length - 1 ? 'heart' : 'arrow-forward'}
                    size={20}
                    color="white"
                  />
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
