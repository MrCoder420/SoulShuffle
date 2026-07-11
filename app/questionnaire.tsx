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
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  fetchQuestionnaire,
  getMyAnswers,
  submitAnswers as submitAnswersApi,
  Question,
  AnswerPayload,
} from '../services/questionnaireService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Emoji mapping for known question types ───────────────
const QUESTION_EMOJIS: Record<number, string> = {
  0: '💕',
  1: '⏳',
  2: '🎯',
  3: '❤️‍🔥',
  4: '✨',
  5: '🌶️',
};

const DEFAULT_EMOJI = '💬';

export default function Questionnaire() {
  const router = useRouter();

  // ─── State ─────────────────────────
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isMaintenance, setIsMaintenance] = useState(false);

  const [history, setHistory] = useState<number[]>([0]);
  const currentStep = history[history.length - 1] ?? 0;
  // answers keyed by question_id → selected_option_id (string) or array of option_ids or text_value
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

  // ─── Fetch questions from the backend on mount ──────────
  useEffect(() => {
    loadQuestions();
  }, []);

  const loadQuestions = async () => {
    try {
      setIsLoadingQuestions(true);
      setLoadError(null);

      try {
        const existingAnswers = await getMyAnswers();
        if (existingAnswers?.length > 0) {
          // @ts-ignore
          router.replace('/');
          return;
        }
      } catch (answerError: any) {
        console.warn('Could not check existing questionnaire answers:', answerError?.response?.data || answerError?.message);
      }

      const data = await fetchQuestionnaire();

      if (!data || data.length === 0) {
        setIsMaintenance(true);
        return;
      }

      // Sort options within each question by order_index
      const sorted = data.map(q => ({
        ...q,
        question_options: (q.question_options || []).sort(
          (a, b) => a.order_index - b.order_index
        ),
      }));

      setQuestions(sorted);

      // Initialize option animations for each question
      optionAnimsRef.current = sorted.map(q =>
        Array(Math.max(q.question_options.length, 1))
          .fill(0)
          .map(() => new Animated.Value(0))
      );

      // Start entrance animations
      Animated.timing(headerFadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }).start();

      // Animate first question's options
      setTimeout(() => animateOptionsIn(0, sorted), 200);
    } catch (error: any) {
      console.error('Failed to load questionnaire:', error);
      setLoadError(error.response?.data?.message || error.message || 'Failed to load questions');
    } finally {
      setIsLoadingQuestions(false);
    }
  };

  useEffect(() => {
    if (questions.length === 0) return;
    // Update progress bar
    Animated.spring(progressAnim, {
      toValue: progress,
      tension: 40,
      friction: 10,
      useNativeDriver: false,
    }).start();

    // Safely trigger options animation for the new step
    animateOptionsIn(currentStep);
  }, [currentStep, questions.length]);

  const animateOptionsIn = (stepIndex: number) => {
    const anims = optionAnimsRef.current[stepIndex];
    if (!anims) return;

    anims.forEach(anim => anim.setValue(0));

    const optionCount = questions[stepIndex]?.question_options?.length || 1;
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
      callback(); // This triggers the useEffect for currentStep

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

  // ─── Determine input type (normalize casing) ────────────
  const getInputType = (q: Question): 'single_select' | 'multi_select' | 'text' | 'slider' | 'date_picker' => {
    const type = q.input_type?.toUpperCase() || 'SINGLE_CHOICE';
    if (type === 'MULTI_CHOICE') return 'multi_select';
    if (type === 'TEXT') return 'text';
    if (type === 'SLIDER') return 'slider';
    if (type === 'DATE_PICKER') return 'date_picker';
    return 'single_select'; // SINGLE_CHOICE
  };

  const findNextQuestionIndex = (startIndex: number, currentAnswers: Record<string, string | string[]> = answers) => {
    for (let i = startIndex + 1; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question_dependencies || q.question_dependencies.length === 0) {
        return i;
      }
      const meetsDependencies = q.question_dependencies.every(dep => {
        const answer = currentAnswers[dep.parent_question_id];
        if (!answer) return false;
        if (Array.isArray(answer)) {
          return answer.includes(dep.required_option_id);
        }
        return answer === dep.required_option_id;
      });
      if (meetsDependencies) return i;
    }
    return -1;
  };

  const handleSelectOption = (optionId: string) => {
    if (!currentQuestion) return;
    const inputType = getInputType(currentQuestion);

    if (inputType === 'multi_select') {
      const current = (answers[currentQuestion.id] as string[]) || [];
      if (current.includes(optionId)) {
        setAnswers({ ...answers, [currentQuestion.id]: current.filter(id => id !== optionId) });
      } else {
        setAnswers({ ...answers, [currentQuestion.id]: [...current, optionId] });
      }
    } else {
      const newAnswers = { ...answers, [currentQuestion.id]: optionId };
      setAnswers(newAnswers);
      // Auto-advance for single select after a brief delay
      setTimeout(() => {
        handleNext(newAnswers);
      }, 400);
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
       } catch (e) {
         // fallback if invalid date string
       }
    }

    if (inputType === 'text' || inputType === 'slider' || inputType === 'date_picker') {
      currentAnswers[currentQuestion.id] = finalAnswer;
      setAnswers({ ...currentAnswers });
    }

    const nextIndex = findNextQuestionIndex(currentStep, currentAnswers);

    if (nextIndex !== -1) {
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
      // @ts-ignore
      router.replace('/');
      return;
    }

    // Save text answer for last question
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

    // Build the payload matching the backend's expected format
    const payload: AnswerPayload[] = [];
    for (const q of questions) {
      const answer = finalAnswers[q.id];
      if (!answer) continue;

      const qInputType = getInputType(q);

      if (qInputType === 'multi_select' && Array.isArray(answer)) {
        // For multi-select, submit one answer per selected option
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
        // single_select
        payload.push({
          question_id: q.id,
          selected_option_id: answer as string,
          text_value: null,
        });
      }
    }

    if (payload.length > 0) {
      // Fire and forget: submit to AWS in the background
      submitAnswersApi(payload).catch((error: any) => {
        console.error('Background submission failed:', error);
      });
    }

    // Instantly transition to the tabs screen without blocking the UI
    // @ts-ignore
    router.replace('/');
  };

  const handleSkip = () => {
    // @ts-ignore
    router.replace('/');
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
        className="flex-1 bg-rose-50 items-center justify-center"
        style={{ paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 }}
      >
        <StatusBar barStyle="dark-content" backgroundColor="#fff1f2" />
        <View className="bg-white/60 w-20 h-20 rounded-[28px] items-center justify-center mb-6 border border-white/40">
          <Text className="text-4xl">💕</Text>
        </View>
        <ActivityIndicator size="large" color="#f43f5e" />
        <Text className="text-slate-500 font-semibold text-base mt-4">
          Preparing your questions...
        </Text>
      </SafeAreaView>
    );
  }

  // ─── Error State ───────────────────────────────────────
  if (loadError) {
    return (
      <SafeAreaView
        className="flex-1 bg-rose-50 items-center justify-center px-8"
        style={{ paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 }}
      >
        <StatusBar barStyle="dark-content" backgroundColor="#fff1f2" />
        <View className="bg-white/60 w-20 h-20 rounded-[28px] items-center justify-center mb-6 border border-white/40">
          <Ionicons name="alert-circle-outline" size={40} color="#f43f5e" />
        </View>
        <Text className="text-slate-800 font-bold text-lg text-center mb-2">
          Could not load questions
        </Text>
        <Text className="text-slate-500 font-medium text-sm text-center mb-8">
          {loadError}
        </Text>
        <TouchableOpacity
          onPress={loadQuestions}
          className="bg-rose-500 rounded-2xl px-8 py-4 mb-4"
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

  // ─── Maintenance State ─────────────────────────────────────
  if (isMaintenance) {
    return (
      <SafeAreaView
        className="flex-1 bg-rose-50 items-center justify-center px-8"
        style={{ paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 }}
      >
        <StatusBar barStyle="dark-content" backgroundColor="#fff1f2" />
        <View className="bg-white/60 w-20 h-20 rounded-[28px] items-center justify-center mb-6 border border-white/40">
          <Ionicons name="construct-outline" size={40} color="#f43f5e" />
        </View>
        <Text className="text-slate-800 font-bold text-xl text-center mb-2">
          Maintenance Mode
        </Text>
        <Text className="text-slate-500 font-medium text-sm text-center mb-8">
          The questionnaire is currently unavailable. Please try again later.
        </Text>
        <TouchableOpacity onPress={handleSkip} className="bg-rose-500 rounded-2xl px-8 py-4">
          <Text className="text-white font-bold text-base">Go to Dashboard</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ─── No questions / empty state (shouldn't reach here, but guard) ───
  if (!currentQuestion) {
    // @ts-ignore
    router.replace('/');
    return null;
  }

  const inputType = getInputType(currentQuestion);

  return (
    <SafeAreaView
      className="flex-1 bg-rose-50"
      style={{ paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 }}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#fff1f2" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        {/* Background Decorations */}
        <View className="absolute w-[600px] h-[600px] bg-pink-100/30 rounded-full -top-60 -right-40" />
        <View className="absolute w-[400px] h-[400px] bg-purple-100/20 rounded-full bottom-20 -left-40" />
        <View className="absolute w-[200px] h-[200px] bg-rose-200/15 rounded-full top-40 left-20" />

        {/* Header */}
        <Animated.View style={{ opacity: headerFadeAnim }} className="px-6 pt-4">
          {/* Top Bar */}
          <View className="flex-row items-center justify-between mb-6">
            <TouchableOpacity
              onPress={handleBack}
              className="w-11 h-11 bg-white/70 rounded-full items-center justify-center border border-white/50"
              style={{ opacity: history.length > 1 ? 1 : 0.3 }}
              disabled={history.length <= 1}
            >
              <Ionicons name="chevron-back" size={22} color="#9f1239" />
            </TouchableOpacity>
            <View className="items-center">
              <Text className="text-xs font-bold text-rose-400 tracking-widest uppercase">
                Step {currentStep + 1} of {questions.length}
              </Text>
            </View>
            <TouchableOpacity onPress={handleSkip} className="px-4 py-2">
              <Text className="text-rose-400 font-bold text-sm">Skip</Text>
            </TouchableOpacity>
          </View>

          {/* Progress Bar */}
          <View className="h-[6px] bg-rose-100 rounded-full overflow-hidden mb-2">
            <Animated.View
              className="h-full bg-rose-500 rounded-full"
              style={{
                width: progressBarWidth,
              }}
            />
          </View>
        </Animated.View>

        {/* Question Content */}
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
            {/* Emoji Header */}
            <View className="items-center mb-2">
              <View className="bg-white/60 w-20 h-20 rounded-[28px] items-center justify-center mb-5 border border-white/40">
                <Text className="text-4xl">
                  {QUESTION_EMOJIS[currentStep] ?? DEFAULT_EMOJI}
                </Text>
              </View>
              <Text className="text-[28px] font-black text-slate-800 text-center leading-9 tracking-tight px-2">
                {currentQuestion.text}
              </Text>
              <Text className="text-slate-400 font-semibold text-sm mt-3 text-center">
                {inputType === 'multi_select'
                  ? 'Select all that apply'
                  : inputType === 'text'
                  ? 'Type your answer below'
                  : 'Choose one option'}
              </Text>
            </View>

            {/* Options */}
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
                  <View className="bg-white/90 rounded-[28px] p-2 border border-white/60">
                    <TextInput
                      placeholder={
                        inputType === 'slider' ? 'Enter a number...' : inputType === 'date_picker' ? 'YYYY-MM-DD' : 'Type here...'
                      }
                      placeholderTextColor="#c4b5b3"
                      className="text-slate-800 font-semibold text-lg px-5 py-5"
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
                            ? 'bg-rose-500 border-rose-500'
                            : 'bg-white/90 border-white/40'
                        }`}
                      >
                        <Text
                          className={`text-[16px] font-bold flex-1 ${
                            selected ? 'text-white' : 'text-slate-700'
                          }`}
                        >
                          {option.option_text}
                        </Text>
                        {inputType === 'multi_select' && (
                          <View
                            className={`w-6 h-6 rounded-lg items-center justify-center ${
                              selected
                                ? 'bg-white/30'
                                : 'bg-slate-100 border border-slate-200'
                            }`}
                          >
                            {selected && (
                              <Ionicons name="checkmark" size={16} color="white" />
                            )}
                          </View>
                        )}
                        {inputType === 'single_select' && selected && (
                          <View className="w-6 h-6 rounded-full bg-white/30 items-center justify-center">
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

        {/* Bottom Action */}
        <View className="px-6 pb-6 pt-3">
          {/* Show continue button for multi-select, text, slider, and date_picker types */}
          {['multi_select', 'text', 'slider', 'date_picker'].includes(inputType) && (
            <TouchableOpacity
              onPress={handleNext}
              disabled={isNextDisabled() || isSubmitting}
              activeOpacity={0.8}
              className={`rounded-[20px] h-[60px] items-center justify-center flex-row ${
                isNextDisabled() || isSubmitting
                  ? 'bg-slate-200 shadow-transparent'
                  : 'bg-rose-500'
              }`}
            >
              {isSubmitting && currentStep === questions.length - 1 ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <>
                  <Text
                    className={`font-bold text-[17px] mr-2 ${
                      isNextDisabled() || isSubmitting ? 'text-slate-400' : 'text-white'
                    }`}
                  >
                    {currentStep === questions.length - 1 ? "Let's Go!" : 'Continue'}
                  </Text>
                  <Ionicons
                    name={currentStep === questions.length - 1 ? 'heart' : 'arrow-forward'}
                    size={20}
                    color={isNextDisabled() || isSubmitting ? '#94a3b8' : 'white'}
                  />
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Show continue button for single-select only when answered */}
          {inputType === 'single_select' && answers[currentQuestion.id] && (
            <TouchableOpacity
              onPress={handleNext}
              activeOpacity={0.8}
              disabled={isSubmitting}
              className={`rounded-[20px] h-[60px] items-center justify-center flex-row ${
                isSubmitting ? 'bg-rose-400' : 'bg-rose-500'
              }`}
            >
              {isSubmitting && currentStep === questions.length - 1 ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <>
                  <Text className="text-white font-bold text-[17px] mr-2">
                    {currentStep === questions.length - 1 ? "Let's Go!" : 'Continue'}
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

