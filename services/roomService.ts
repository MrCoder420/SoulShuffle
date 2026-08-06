import api from './api';
import { getMyProfile } from './authService';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Types ────────────────────────────────────────────────
export type ExpiryType = '7_DAYS' | '30_DAYS' | '1_YEAR';
export type RoomStatus = 'WAITING' | 'ACTIVE' | 'COMPLETED' | 'EXPIRED';

export interface Room {
  id: string;
  code: string;
  host_id: string;
  partner_id: string | null;
  expiry_type: ExpiryType;
  expires_at: string;
  status: RoomStatus;
  game_state?: {
    active_challenge?: SentChallenge;
    challenge_history?: SentChallenge[];
  };
  created_at: string;
  host_name?: string;
  partner_name?: string | null;
  host_avatar?: string | null;
  partner_avatar?: string | null;
}

export interface ChallengePayload {
  id: number | string;
  title: string;
  category: string;
  difficulty: string;
  time: string;
  image: any;
  description?: string;
  message?: string; // Add note / message support
}

export interface SentChallenge extends ChallengePayload {
  room_id?: string;
  room_code?: string;
  room_status?: string;
  partner_name?: string;
  partner_avatar?: string | null;
  sender_id?: string;
  receiver_id?: string;
  sender_name?: string;
  receiver_name?: string;
  sender_avatar?: string | null;
  receiver_avatar?: string | null;
  is_sent_by_me?: boolean;
  card_id?: string;
  theme_color?: string;
  card_type?: string;
  status?: string;
  sent_at?: string;
  accepted_at?: string;
  completed_at?: string;
  deflected_at?: string;
}

// ── CLEAR ROOM CACHE ─────────────────────────────────────
// Call this when a room is left, completed, or expired
export const clearRoomCache = async (roomId: string) => {
  await AsyncStorage.removeItem(`partnerName_${roomId}`);
};

// ── CREATE ROOM ──────────────────────────────────────────
export const createRoom = async (expiryType: ExpiryType = '7_DAYS'): Promise<Room> => {
  const response = await api.post('/rooms/create', { expiry_type: expiryType });
  const room: Room = response.data.data.room;
  // Store room ID so we know which cache to clear later
  await AsyncStorage.setItem('activeRoomId', room.id);
  return room;
};

// ── JOIN ROOM ────────────────────────────────────────────
export const joinRoom = async (code: string): Promise<Room> => {
  const response = await api.post('/rooms/join', { code: code.toUpperCase() });
  const room: Room = response.data.data.room;
  // Cache partner name immediately from the room data
  await AsyncStorage.setItem('activeRoomId', room.id);
  const partnerName = room.host_name || room.partner_name || null;
  if (partnerName) {
    await AsyncStorage.setItem(`partnerName_${room.id}`, partnerName);
  }
  return room;
};

// ── LEAVE ROOM ───────────────────────────────────────────
export const leaveRoom = async (roomId: string): Promise<void> => {
  await api.post('/rooms/leave', { room_id: roomId });
  await clearRoomCache(roomId);
  await AsyncStorage.removeItem('activeRoomId');
};

// ── GET ACTIVE ROOM ──────────────────────────────────────
export const getActiveRoom = async (): Promise<Room | null> => {
  try {
    const response = await api.get('/rooms/active');
    return response.data.data.room;
  } catch (error: any) {
    // 404 means no active room — that's normal, not an error
    if (error.response?.status === 404) {
      return null;
    }
    throw error;
  }
};

// ── SEND CHALLENGE ──────────────────────────────────────
export const sendChallenge = async (deckCardId: string, message?: string) => {
  const room = await getActiveRoom();
  if (!room) {
    throw new Error('No active room found.');
  }

  // Resolve current user ID to determine the correct receiver
  let receiverId = room.partner_id;
  try {
    const profile = await getMyProfile();
    if (profile?.id && profile.id === room.partner_id) {
      receiverId = room.host_id;
    }
  } catch (error) {
    console.error('Failed to resolve profile in sendChallenge:', error);
  }

  const response = await api.post(`/user/deck/${deckCardId}/send`, {
    room_id: room.id,
    receiver_id: receiverId,
    message: message || ''
  });
  return response.data.data;
};

// ── CARD SENDS (PHASE 4 ENGINE) ────────────────────────
export const fetchCardSends = async (roomId: string) => {
  const response = await api.get(`/user/deck/sends?room_id=${roomId}`);
  return response.data.data;
};

export const acceptCardSend = async (sendId: string) => {
  const response = await api.patch(`/user/deck/sends/${sendId}/accept`);
  return response.data.data;
};

export const rejectCardSend = async (sendId: string, roomId: string) => {
  const response = await api.patch(`/user/deck/sends/${sendId}/reject`, { room_id: roomId });
  return response.data.data;
};

export const completeCardSend = async (sendId: string) => {
  const response = await api.patch(`/user/deck/sends/${sendId}/complete`);
  return response.data.data;
};

export const confirmCardSend = async (sendId: string) => {
  const response = await api.patch(`/user/deck/sends/${sendId}/confirm`);
  return response.data.data;
};

export const deflectCardSend = async (sendId: string, deflectDeckCardId: string) => {
  const response = await api.post(`/user/deck/sends/${sendId}/use-deflect`, {
    deflect_deck_card_id: deflectDeckCardId
  });
  return response.data.data;
};

export const fetchDeflectCards = async (roomId: string) => {
  const response = await api.get(`/user/deck/deflect-cards?room_id=${roomId}`);
  return response.data.data;
};

// ── HISTORY ──────────────────────────────────────────────
export const fetchRoomHistory = async (roomId?: string) => {
  const url = roomId ? `/rooms/history?room_id=${roomId}` : '/rooms/history';
  const response = await api.get(url);
  return response.data.data || [];
};
