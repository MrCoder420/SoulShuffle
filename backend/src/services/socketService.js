const socketIo = require('socket.io');
const { verifyAccessToken } = require('../utils/jwt');
const { env } = require('../config/env');

let io;

// Map userId → Set of socket IDs (user can have multiple tabs open)
const userSocketMap = new Map();

const initSocket = (server) => {
    io = socketIo(server, {
        cors: {
            origin: env.CLIENT_URL === '*' ? '*' : env.CLIENT_URL,
            credentials: true
        }
    });

    // Authentication Middleware
    io.use((socket, next) => {
        try {
            const token = socket.handshake.auth.token || socket.handshake.headers['authorization']?.split(' ')[1];
            if (!token) throw new Error('Authentication error');
            const decoded = verifyAccessToken(token);
            socket.user = decoded;
            next();
        } catch (err) {
            next(new Error('Authentication error'));
        }
    });

    io.on('connection', (socket) => {
        const userId = socket.user.id;
        console.log(`🔌 User connected: ${userId} (Socket ID: ${socket.id})`);

        // Register user socket
        if (!userSocketMap.has(userId)) userSocketMap.set(userId, new Set());
        userSocketMap.get(userId).add(socket.id);

        let currentRoomCode = null;

        // Join a specific room channel
        socket.on('join_room', (roomCode) => {
            console.log(`User ${userId} joining room ${roomCode}`);
            socket.join(roomCode);
            currentRoomCode = roomCode;

            // Notify others in room that partner is ONLINE
            socket.to(roomCode).emit('partner_joined', {
                userId,
                status: 'online'
            });
        });

        // Generic game event transmitter
        socket.on('game_event', (payload) => {
            const { roomCode, eventType, data } = payload;
            if (!roomCode) return;
            console.log(`Game Event [${eventType}] in room ${roomCode}`);
            socket.to(roomCode).emit('game_event', { eventType, data, senderId: userId });
        });

        socket.on('disconnect', () => {
            console.log(`🔌 User disconnected: ${userId}`);

            // Remove socket from map
            if (userSocketMap.has(userId)) {
                userSocketMap.get(userId).delete(socket.id);
                if (userSocketMap.get(userId).size === 0) userSocketMap.delete(userId);
            }

            if (currentRoomCode) {
                io.to(currentRoomCode).emit('partner_offline', {
                    userId,
                    status: 'offline'
                });
            }
        });
    });
};

const getIo = () => {
    if (!io) throw new Error('Socket.io not initialized!');
    return io;
};

// Emit an event directly to a specific user (by userId)
const emitToUser = (userId, event, data) => {
    if (!io || !userId) return;
    const socketIds = userSocketMap.get(String(userId));
    if (socketIds && socketIds.size > 0) {
        socketIds.forEach((socketId) => {
            io.to(socketId).emit(event, data);
        });
    }
};

module.exports = { initSocket, getIo, emitToUser };

