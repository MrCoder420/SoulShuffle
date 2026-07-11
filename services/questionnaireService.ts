import api from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Types ───────────────────────────────────────────────

export interface QuestionOption {
  id: string;
  option_text: string;
  order_index: number;
}

export interface QuestionDependency {
  parent_question_id: string;
  required_option_id: string;
}

export interface Question {
  id: string;
  text: string;
  input_type: string; // 'SINGLE_CHOICE' | 'MULTI_CHOICE' | 'TEXT' | 'SLIDER'
  order_index: number;
  question_options: QuestionOption[];
  question_dependencies: QuestionDependency[];
}

export interface AnswerPayload {
  question_id: string;
  selected_option_id?: string | null;
  text_value?: string | null;
}

const CACHE_KEY = 'questionnaire_cache';
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

// ─── FETCH QUESTIONNAIRE ─────────────────────────────────
export const fetchQuestionnaire = async (): Promise<Question[]> => {
  try {
    const cachedData = await AsyncStorage.getItem(CACHE_KEY);
    if (cachedData) {
      const { timestamp, data } = JSON.parse(cachedData);
      if (Date.now() - timestamp < CACHE_TTL) {
        return data;
      }
    }
  } catch (e) {
    // Ignore cache read errors
  }

  const response = await api.get('/questionnaire');
  const questions = response.data.data.questions || [];
  
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data: questions }));
  } catch (e) {
    // Ignore cache write errors
  }
  
  return questions;
};

// ─── SUBMIT ANSWERS ──────────────────────────────────────
export const submitAnswers = async (answers: AnswerPayload[]) => {
  const response = await api.post('/questionnaire/answers', { answers });
  return response.data.data.answers;
};

// ─── GET MY ANSWERS ──────────────────────────────────────
export const getMyAnswers = async () => {
  const response = await api.get('/questionnaire/my-answers');
  return response.data.data.answers;
};
