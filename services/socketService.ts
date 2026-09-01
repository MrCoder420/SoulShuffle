import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL, getMemoryToken } from './api';

class GameSocket {
  static socket: Socket | null = null;
  static currentRoomCode: string | null = null;
  static callbacks: { [event: string]: Function[] } = {};
  static isInitializing = false;

  static async initialize(): Promise<Socket | null> {
    if (this.socket && this.socket.connected) {
      return this.socket; // Already initialized and active
    }

    let token = getMemoryToken();
    if (!token) {
      token = await AsyncStorage.getItem('accessToken');
    }
    if (!token) {
      return null;
    }

    let socketUrl = BASE_URL;
    if (socketUrl.endsWith('/api/v1')) {
      socketUrl = socketUrl.replace('/api/v1', '');
    }

    if (!this.socket) {
      this.socket = io(socketUrl, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
        autoConnect: true,
      });

      this.socket.on('connect', () => {
        if (this.currentRoomCode) {
          this.socket?.emit('join_room', this.currentRoomCode);
        }
      });

      this.socket.on('connect_error', async (err) => {
        if (err.message.toLowerCase().includes('auth') || err.message.toLowerCase().includes('token')) {
          const freshToken = getMemoryToken() || await AsyncStorage.getItem('accessToken');
          if (freshToken && this.socket) {
            this.socket.auth = { token: freshToken };
          }
        }
      });

      this.socket.on('disconnect', () => {
        // Disconnected
      });

      // ── Universal Game Event Listener ──
      this.socket.on('game_event', (payload) => {
        const cbs = this.callbacks['game_event'] || [];
        cbs.forEach(cb => cb(payload));
      });

      // ── Coin Flip Result Listener (from backend /rooms/coin-flip endpoint) ──
      this.socket.on('coin_flip_result', (payload) => {
        const specificCbs = this.callbacks['coin_flip_result'] || [];
        specificCbs.forEach(cb => cb(payload));
        const cbs = this.callbacks['game_event'] || [];
        cbs.forEach(cb => cb({ eventType: 'COIN_FLIP_RESULT', data: payload }));
      });

      // ── Partner Joined Listener ──
      this.socket.on('partner_joined', (payload) => {
        const cbs = this.callbacks['partner_joined'] || [];
        cbs.forEach(cb => cb(payload));
      });

      // ── Room Updated Listener ──
      this.socket.on('room_updated', (payload) => {
        const cbs = this.callbacks['room_updated'] || [];
        cbs.forEach(cb => cb(payload));
        const partnerCbs = this.callbacks['partner_joined'] || [];
        partnerCbs.forEach(cb => cb(payload));
      });

      // ── Room Left & Partner Left Listeners ──
      this.socket.on('room_left', (payload) => {
        const cbs = this.callbacks['room_left'] || [];
        cbs.forEach(cb => cb(payload));
        const partnerCbs = this.callbacks['partner_left'] || [];
        partnerCbs.forEach(cb => cb(payload));
      });

      this.socket.on('partner_left', (payload) => {
        const cbs = this.callbacks['partner_left'] || [];
        cbs.forEach(cb => cb(payload));
        const roomCbs = this.callbacks['room_left'] || [];
        roomCbs.forEach(cb => cb(payload));
      });

      // ── Partner Avatar Updated Listener ──
      this.socket.on('partner_avatar_updated', (payload) => {
        const cbs = this.callbacks['partner_avatar_updated'] || [];
        cbs.forEach(cb => cb(payload));
      });

      // ── Remote Card Engine Event Listeners ──
      const cardEvents = [
        'card_received',
        'card_seen',
        'card_accepted',
        'card_deflected',
        'card_completed_by_receiver',
        'card_confirmed',
        'card_rejected',
        'card_reminder',
        'deflect_card_used',
        'card_reversed',
        'card_timeout_extended'
      ];

      cardEvents.forEach(evt => {
        this.socket?.on(evt, (payload) => {
          const cbs = this.callbacks['game_event'] || [];
          cbs.forEach(cb => cb({ eventType: evt.toUpperCase(), data: payload }));
        });
      });
    } else if (!this.socket.connected) {
      this.socket.connect();
    }

    return this.socket;
  }

  static updateToken(token: string) {
    if (this.socket) {
      this.socket.auth = { token };
      if (!this.socket.connected) {
        this.socket.connect();
      }
    }
  }

  static async joinRoom(roomCode: string) {
    if (!roomCode) return;
    this.currentRoomCode = roomCode;

    if (this.socket && this.socket.connected) {
      this.socket.emit('join_room', roomCode);
      return;
    }

    await this.initialize();

    if (this.socket) {
      if (this.socket.connected) {
        this.socket.emit('join_room', roomCode);
      } else {
        this.socket.once('connect', () => {
          this.socket?.emit('join_room', roomCode);
        });
      }
    }
  }

  static leaveRoom(roomCode?: string) {
    const codeToLeave = roomCode || this.currentRoomCode;
    if (codeToLeave && this.socket && this.socket.connected) {
      this.socket.emit('leave_room', codeToLeave);
    }
    this.currentRoomCode = null;
  }

  static async sendGameEvent(roomCode: string, eventType: string, data: any) {
    if (!roomCode) return;
    this.currentRoomCode = roomCode;
    const payload = { roomCode, eventType, data };

    if (this.socket && this.socket.connected) {
      this.socket.emit('game_event', payload);
      return;
    }

    await this.initialize();

    if (this.socket) {
      if (this.socket.connected) {
        this.socket.emit('game_event', payload);
      } else {
        this.socket.once('connect', () => {
          this.socket?.emit('game_event', payload);
        });
      }
    }
  }

  static on(event: string, callback: Function) {
    if (!this.callbacks[event]) {
      this.callbacks[event] = [];
    }
    this.callbacks[event].push(callback);
  }

  static off(event: string, callback: Function) {
    if (!this.callbacks[event]) return;
    this.callbacks[event] = this.callbacks[event].filter(cb => cb !== callback);
  }

  static disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.currentRoomCode = null;
    }
  }
}

export default GameSocket;

