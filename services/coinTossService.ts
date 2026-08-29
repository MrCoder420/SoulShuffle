import AsyncStorage from '@react-native-async-storage/async-storage';

export type CoinFace = 'HEADS' | 'TAILS';

export interface CoinTossHistoryItem {
  id: string;
  flipperName: string;
  choice: CoinFace;
  result: CoinFace;
  outcome: string;
  reason: string;
  isMeWinner: boolean;
  time: string;
  timestamp?: number;
  roomId?: string;
}

export interface PendingCoinToss {
  eventId: string;
  flipperChoice: CoinFace;
  choice?: CoinFace;
  result: CoinFace;
  flipperId?: string;
  flipperName?: string;
  winnerId?: string;
  reason?: string;
  timestamp: number;
  animated?: boolean;
}

const GLOBAL_HISTORY_KEY = 'coin_toss_history_global';
const LEGACY_HISTORY_KEY = 'coin_toss_history';

let pendingToss: PendingCoinToss | null = null;
let lastAnimatedEventId: string = '';

export const setPendingCoinToss = (toss: PendingCoinToss) => {
  pendingToss = {
    ...toss,
    animated: false
  };
};

export const getPendingCoinToss = (): PendingCoinToss | null => {
  if (!pendingToss) return null;
  // Consider valid for 10 seconds
  if (Date.now() - pendingToss.timestamp > 10000) {
    pendingToss = null;
    return null;
  }
  if (pendingToss.eventId === lastAnimatedEventId || pendingToss.animated) {
    return null;
  }
  return pendingToss;
};

export const markPendingCoinTossAnimated = (eventId?: string) => {
  if (eventId) {
    lastAnimatedEventId = eventId;
  }
  if (pendingToss) {
    pendingToss.animated = true;
  }
};

export const clearPendingCoinToss = () => {
  pendingToss = null;
};

// ── Persistent Local Storage for Coin Toss History ──

export const getCoinTossHistory = async (roomId?: string): Promise<CoinTossHistoryItem[]> => {
  try {
    // 1. Try room-specific key first if roomId is present
    if (roomId) {
      const roomKey = `coin_toss_history_${roomId}`;
      const roomStored = await AsyncStorage.getItem(roomKey);
      if (roomStored) {
        const parsed = JSON.parse(roomStored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    }

    // 2. Try global key
    const globalStored = await AsyncStorage.getItem(GLOBAL_HISTORY_KEY);
    if (globalStored) {
      const parsed = JSON.parse(globalStored);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }

    // 3. Fallback to legacy key
    const legacyStored = await AsyncStorage.getItem(LEGACY_HISTORY_KEY);
    if (legacyStored) {
      const parsed = JSON.parse(legacyStored);
      if (Array.isArray(parsed)) {
        // Migrate to global key
        await AsyncStorage.setItem(GLOBAL_HISTORY_KEY, legacyStored);
        return parsed;
      }
    }
  } catch (error) {
    console.warn('[CoinTossService] Failed to get coin toss history from AsyncStorage:', error);
  }
  return [];
};

export const saveCoinTossItem = async (
  item: CoinTossHistoryItem,
  roomId?: string
): Promise<CoinTossHistoryItem[]> => {
  try {
    const existing = await getCoinTossHistory(roomId);
    // Deduplicate by ID
    const filtered = existing.filter(h => h.id !== item.id);
    const updated = [item, ...filtered].slice(0, 30);
    const serialized = JSON.stringify(updated);

    // Save to global key & legacy key
    await AsyncStorage.setItem(GLOBAL_HISTORY_KEY, serialized);
    await AsyncStorage.setItem(LEGACY_HISTORY_KEY, serialized);

    // Save to room-specific key if roomId is given
    if (roomId) {
      await AsyncStorage.setItem(`coin_toss_history_${roomId}`, serialized);
    }

    return updated;
  } catch (error) {
    console.warn('[CoinTossService] Failed to save coin toss item to AsyncStorage:', error);
    return [item];
  }
};

export const clearCoinTossHistory = async (roomId?: string): Promise<void> => {
  try {
    await Promise.all([
      AsyncStorage.removeItem(GLOBAL_HISTORY_KEY),
      AsyncStorage.removeItem(LEGACY_HISTORY_KEY),
      roomId ? AsyncStorage.removeItem(`coin_toss_history_${roomId}`) : Promise.resolve(),
    ]);
  } catch (error) {
    console.warn('[CoinTossService] Failed to clear coin toss history from AsyncStorage:', error);
  }
};
