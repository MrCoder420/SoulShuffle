import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from './api';

class GameSocket {
  static socket: Socket | null = null;
  static currentRoomCode: string | null = null;
  static callbacks: { [event: string]: Function[] } = {};

  static async initialize() {
    if (this.socket && this.socket.connected) {
      return; // Already initialized and active
    }

    const token = await AsyncStorage.getItem('accessToken');
    if (!token) {
      console.warn('SocketInit: No access token found');
      return;
    }

    let socketUrl = BASE_URL;
    if (socketUrl.endsWith('/api/v1')) {
      socketUrl = socketUrl.replace('/api/v1', '');
    }

    if (!this.socket) {
      this.socket = io(socketUrl, {
        auth: async (cb: (data: { token: string | null }) => void) => {
          const freshToken = await AsyncStorage.getItem('accessToken');
          cb({ token: freshToken || token });
        },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
      });

      this.socket.on('connect', () => {
        console.log('Socket connected! ID:', this.socket?.id);
        // Automatically re-join current room if connection dropped and restored
        if (this.currentRoomCode) {
          console.log('Auto-rejoining room on reconnect:', this.currentRoomCode);
          this.socket?.emit('join_room', this.currentRoomCode);
        }
      });

      this.socket.on('connect_error', async (err) => {
        console.error('Socket connect_error:', err.message);
        if (err.message.toLowerCase().includes('auth') || err.message.toLowerCase().includes('token')) {
          console.warn('Socket Auth Failed. Refreshing auth token...');
          const freshToken = await AsyncStorage.getItem('accessToken');
          if (freshToken && this.socket) {
            this.socket.auth = { token: freshToken };
          }
        }
      });

      this.socket.on('disconnect', (reason) => {
        console.log('Socket disconnected. Reason:', reason);
      });

      // ── Universal Game Event Listener ──
      this.socket.on('game_event', (payload) => {
        console.log('Received game_event payload:', payload);
        const cbs = this.callbacks['game_event'] || [];
        cbs.forEach(cb => cb(payload));
      });

      // ── Partner Joined Listener ──
      this.socket.on('partner_joined', (payload) => {
        console.log('Partner joined!', payload);
        const cbs = this.callbacks['partner_joined'] || [];
        cbs.forEach(cb => cb(payload));
      });

      // ── Room Updated Listener ──
      this.socket.on('room_updated', (payload) => {
        console.log('Room updated!', payload);
        const cbs = this.callbacks['room_updated'] || [];
        cbs.forEach(cb => cb(payload));
        const partnerCbs = this.callbacks['partner_joined'] || [];
        partnerCbs.forEach(cb => cb(payload));
      });

      // ── Room Left & Partner Left Listeners ──
      this.socket.on('room_left', (payload) => {
        console.log('Room left event received:', payload);
        const cbs = this.callbacks['room_left'] || [];
        cbs.forEach(cb => cb(payload));
        const partnerCbs = this.callbacks['partner_left'] || [];
        partnerCbs.forEach(cb => cb(payload));
      });

      this.socket.on('partner_left', (payload) => {
        console.log('Partner left event received:', payload);
        const cbs = this.callbacks['partner_left'] || [];
        cbs.forEach(cb => cb(payload));
        const roomCbs = this.callbacks['room_left'] || [];
        roomCbs.forEach(cb => cb(payload));
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
          console.log(`Received remote socket event [${evt}] with payload:`, payload);
          const cbs = this.callbacks['game_event'] || [];
          cbs.forEach(cb => cb({ eventType: evt.toUpperCase(), data: payload }));
        });
      });
    } else if (!this.socket.connected) {
      this.socket.connect();
    }
  }

  static updateToken(token: string) {
    if (this.socket) {
      this.socket.auth = { token };
      if (!this.socket.connected) {
        this.socket.connect();
      }
    }
  }

  static joinRoom(roomCode: string) {
    this.currentRoomCode = roomCode;
    if (this.socket && this.socket.connected) {
      console.log('Emitting join_room with code:', roomCode);
      this.socket.emit('join_room', roomCode);
    } else {
      console.warn('joinRoom called, queuing emit until socket connects.');
      this.initialize().then(() => {
        if (this.socket) {
          this.socket.once('connect', () => {
            console.log('Socket connected, emitting join_room with code:', roomCode);
            this.socket?.emit('join_room', roomCode);
          });
        }
      });
    }
  }

  static leaveRoom(roomCode?: string) {
    const codeToLeave = roomCode || this.currentRoomCode;
    if (codeToLeave && this.socket && this.socket.connected) {
      console.log('Emitting leave_room with code:', codeToLeave);
      this.socket.emit('leave_room', codeToLeave);
    }
    this.currentRoomCode = null;
  }

  static sendGameEvent(roomCode: string, eventType: string, data: any) {
    this.currentRoomCode = roomCode;
    if (this.socket && this.socket.connected) {
      const payload = { roomCode, eventType, data };
      console.log('Emitting game_event:', payload);
      this.socket.emit('game_event', payload);
    } else {
      console.warn('Cannot send game_event immediately, ensuring socket connection...');
      this.initialize().then(() => {
        if (this.socket && this.socket.connected) {
          const payload = { roomCode, eventType, data };
          console.log('Emitting game_event after reconnect:', payload);
          this.socket.emit('game_event', payload);
        } else if (this.socket) {
          this.socket.once('connect', () => {
            const payload = { roomCode, eventType, data };
            console.log('Socket connected, emitting queued game_event:', payload);
            this.socket?.emit('game_event', payload);
          });
        }
      });
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
