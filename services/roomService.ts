import api from './api';

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
  sender_id?: string;
  status?: string;
  sent_at?: string;
}

// ── CREATE ROOM ──────────────────────────────────────────
export const createRoom = async (expiryType: ExpiryType = '7_DAYS'): Promise<Room> => {
  const response = await api.post('/rooms/create', { expiry_type: expiryType });
  return response.data.data.room;
};

// ── JOIN ROOM ────────────────────────────────────────────
export const joinRoom = async (code: string): Promise<Room> => {
  const response = await api.post('/rooms/join', { code: code.toUpperCase() });
  return response.data.data.room;
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

  const response = await api.post(`/user/deck/${deckCardId}/send`, {
    room_id: room.id,
    receiver_id: room.partner_id,
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

export const rejectCardSend = async (sendId: string) => {
  const response = await api.patch(`/user/deck/sends/${sendId}/deflect`);
  return response.data.data;
};

export const completeCardSend = async (sendId: string) => {
  const response = await api.patch(`/user/deck/sends/${sendId}/complete`);
  return response.data.data;
};
