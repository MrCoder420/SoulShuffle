const { supabase } = require('../db/supabase');
const { generateRoomCode } = require('../utils/codeGenerator');

const calculateExpiry = (expiryType) => {
    const date = new Date();
    if (expiryType === '7_DAYS') date.setDate(date.getDate() + 7);
    else if (expiryType === '30_DAYS') date.setDate(date.getDate() + 30);
    else if (expiryType === '1_YEAR') date.setFullYear(date.getFullYear() + 1);
    else date.setDate(date.getDate() + 7); // Default
    return date.toISOString();
};

const populateRoomNames = async (room) => {
    if (!room) return null;
    const hostId = room.host_id;
    const partnerId = room.partner_id;

    const idsToFetch = [hostId];
    if (partnerId) idsToFetch.push(partnerId);

    const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, first_name')
        .in('id', idsToFetch);

    if (!profileError && profiles) {
        const hostProfile = profiles.find(p => p.id === hostId);
        const partnerProfile = partnerId ? profiles.find(p => p.id === partnerId) : null;
        
        room.host_name = hostProfile ? hostProfile.first_name : 'Host';
        room.partner_name = partnerProfile ? partnerProfile.first_name : null;
    } else {
        room.host_name = 'Host';
        room.partner_name = partnerId ? 'Partner' : null;
    }
    return room;
};

const createRoom = async (hostId, expiryType = '7_DAYS') => {
    // Archive existing rooms for this host
    await supabase
        .from('rooms')
        .update({ status: 'COMPLETED' })
        .eq('host_id', hostId)
        .in('status', ['WAITING', 'ACTIVE']);

    const code = generateRoomCode();
    const expiresAt = calculateExpiry(expiryType);

    const { data, error } = await supabase
        .from('rooms')
        .insert([{
            code,
            host_id: hostId,
            expiry_type: expiryType,
            expires_at: expiresAt,
            status: 'WAITING'
        }])
        .select()
        .single();

    if (error) {
        const err = new Error(error.message);
        err.status = 400;
        throw err;
    }
    return await populateRoomNames(data);
};

const joinRoom = async (partnerId, code) => {
    // 1. Find room
    const { data: room, error: findError } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', code.toUpperCase())
        .single();

    if (findError || !room) {
        const err = new Error('Invalid room code.');
        err.status = 404;
        throw err;
    }

    // 2. Check if host is joining their own room (just return it)
    if (room.host_id === partnerId) {
        return await populateRoomNames(room);
    }

    // 3. Check if room is full
    if (room.partner_id && room.partner_id !== partnerId) {
        const err = new Error('Room is already full.');
        err.status = 400;
        throw err;
    }

    // 4. Check expiry
    if (new Date(room.expires_at) < new Date() || room.status === 'EXPIRED') {
        const err = new Error('Room has expired.');
        err.status = 400;
        throw err;
    }

    // 5. Update room to ACTIVE
    const { data: updatedRoom, error: updateError } = await supabase
        .from('rooms')
        .update({ partner_id: partnerId, status: 'ACTIVE' })
        .eq('id', room.id)
        .select()
        .single();

    if (updateError) {
        const err = new Error(updateError.message);
        err.status = 400;
        throw err;
    }

    return await populateRoomNames(updatedRoom);
};

const getActiveRoom = async (userId) => {
    const { data: rooms, error } = await supabase
        .from('rooms')
        .select('*')
        .or(`host_id.eq.${userId},partner_id.eq.${userId}`)
        .in('status', ['WAITING', 'ACTIVE'])
        .order('created_at', { ascending: false })
        .limit(1);

    if (error) {
        const err = new Error(error.message);
        err.status = 400;
        throw err;
    }

    if (!rooms || rooms.length === 0) {
        return null;
    }

    const room = rooms[0];
    if (new Date(room.expires_at) < new Date()) {
        // Auto-expire
        await supabase.from('rooms').update({ status: 'EXPIRED' }).eq('id', room.id);
        return null;
    }

    return await populateRoomNames(room);
};

const sendChallenge = async (userId, challenge) => {
    const room = await getActiveRoom(userId);

    if (!room) {
        const err = new Error('No active room found. Create or join a room first.');
        err.status = 404;
        throw err;
    }

    if (room.status !== 'ACTIVE' || !room.partner_id) {
        const err = new Error('Your partner has not joined the room yet.');
        err.status = 400;
        throw err;
    }

    const sentChallenge = {
        id: challenge.id,
        title: challenge.title,
        category: challenge.category,
        difficulty: challenge.difficulty,
        time: challenge.time,
        image: challenge.image,
        description: challenge.description || null,
        sender_id: userId,
        status: 'SENT',
        sent_at: new Date().toISOString()
    };

    const currentGameState = room.game_state || {};
    const challengeHistory = Array.isArray(currentGameState.challenge_history)
        ? currentGameState.challenge_history
        : [];

    const nextGameState = {
        ...currentGameState,
        active_challenge: sentChallenge,
        challenge_history: [sentChallenge, ...challengeHistory].slice(0, 50)
    };

    const { data, error } = await supabase
        .from('rooms')
        .update({ game_state: nextGameState })
        .eq('id', room.id)
        .select()
        .single();

    if (error) {
        const err = new Error(error.message);
        err.status = 400;
        throw err;
    }

    try {
        const { getIo } = require('./socketService');
        getIo().to(room.code).emit('challenge_sent', {
            roomCode: room.code,
            challenge: sentChallenge
        });
    } catch (socketError) {
        console.log('Challenge saved, socket emit skipped:', socketError.message);
    }

    return { room: data, challenge: sentChallenge };
};

module.exports = {
    createRoom,
    joinRoom,
    getActiveRoom,
    sendChallenge
};
