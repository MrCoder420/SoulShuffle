import api from './api';

export interface SendLimits {
  daily_sent: number;
  daily_limit: number;
  daily_remaining: number;
  active_count: number;
  active_limit: number;
  active_remaining: number;
  can_send: boolean;
}

export const fetchCards = async () => {
  const response = await api.get('/user/deck');
  return response.data.data;
};

export const fetchAvailableDeck = async (roomId: string) => {
  const response = await api.get('/user/deck/available?room_id=' + roomId);
  return response.data.data;
};

export const fetchSendLimits = async (roomId: string): Promise<SendLimits> => {
  const response = await api.get('/user/deck/limits?room_id=' + roomId);
  return response.data.data;
};
