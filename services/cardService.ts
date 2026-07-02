import api from './api';

export interface CardCategory {
  id: string;
  name: string;
  description: string;
  theme_color: string;
  icon_url: string | null;
}

export interface CardAttributes {
  difficulty?: string;
  time?: string;
  stars?: number;
  description?: string;
}

export interface Card {
  id: string;
  category_id: string;
  name: string;
  power_description: string;
  image_url: string | null;
  attributes: CardAttributes | null;
  card_type: 'ACTION' | 'WILDCARD';
  card_categories: CardCategory | null;
}

/**
 * Fetch the master deck of cards/dares from the backend
 */
export const fetchCards = async (): Promise<Card[]> => {
  const response = await api.get('/cards');
  return response.data.data.cards;
};

/**
 * Fetch the user's available (unused, unexpired) deck for a specific room
 */
export const fetchAvailableDeck = async (roomId: string): Promise<any[]> => {
  const response = await api.get(`/user/deck/available?room_id=${roomId}`);
  return response.data.data.cards;
};

export interface SendLimits {
  daily_sent: number;
  daily_limit: number;
  daily_remaining: number;
  active_count: number;
  active_limit: number;
  active_remaining: number;
  can_send: boolean;
}

/**
 * Fetch daily and active limits for sending cards
 */
export const fetchSendLimits = async (): Promise<SendLimits> => {
  const response = await api.get('/user/deck/sends/limits');
  return response.data.data;
};

