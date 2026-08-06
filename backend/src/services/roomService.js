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

    try {
        const { data: profiles, error: profileError } = await supabase
            .from('profiles')
            .select('id, first_name, avatar_url')
            .in('id', idsToFetch);

        if (!profileError && profiles) {
            const hostProfile = profiles.find(p => p.id === hostId);
            const partnerProfile = partnerId ? profiles.find(p => p.id === partnerId) : null;
            
            room.host_name = hostProfile ? hostProfile.first_name : 'Host';
            room.partner_name = partnerProfile ? partnerProfile.first_name : null;
            room.host_avatar = hostProfile ? hostProfile.avatar_url : null;
            room.partner_avatar = partnerProfile ? partnerProfile.avatar_url : null;
        } else {
            room.host_name = 'Host';
            room.partner_name = partnerId ? 'Partner' : null;
            room.host_avatar = null;
            room.partner_avatar = null;
        }
    } catch (e) {
        room.host_name = 'Host';
        room.partner_name = partnerId ? 'Partner' : null;
        room.host_avatar = null;
        room.partner_avatar = null;
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
    const rawCode = (code || '').toUpperCase().trim();
    const codeVariants = [rawCode];
    if (rawCode.startsWith('SSF-')) {
        codeVariants.push(rawCode.replace(/^SSF-/, 'ELV-'));
    } else if (rawCode.startsWith('ELV-')) {
        codeVariants.push(rawCode.replace(/^ELV-/, 'SSF-'));
    }

    console.log('[joinRoom] Looking for code variants:', codeVariants);

    // 1. Find room — only look for WAITING or ACTIVE rooms (not COMPLETED/EXPIRED)
    const { data: rooms, error: findError } = await supabase
        .from('rooms')
        .select('*')
        .in('code', codeVariants)
        .in('status', ['WAITING', 'ACTIVE'])
        .order('created_at', { ascending: false })
        .limit(1);

    const room = (rooms && rooms.length > 0) ? rooms[0] : null;

    if (findError) {
        console.error('[joinRoom] DB error finding room:', findError.message);
        const err = new Error('Server error looking up room.');
        err.status = 500;
        throw err;
    }

    if (!room) {
        // Check if the code exists but is expired/completed — give a better error
        const { data: anyRoom } = await supabase
            .from('rooms')
            .select('status')
            .in('code', codeVariants)
            .order('created_at', { ascending: false })
            .limit(1);
        
        const pastRoom = anyRoom && anyRoom[0];
        if (pastRoom?.status === 'COMPLETED' || pastRoom?.status === 'EXPIRED') {
            const err = new Error('This room has already ended or expired.');
            err.status = 400;
            throw err;
        }
        console.log('[joinRoom] No room found for codes:', codeVariants);
        const err = new Error('Invalid room code. Make sure you typed it correctly.');
        err.status = 404;
        throw err;
    }

    console.log('[joinRoom] Found room:', room.id, 'status:', room.status);

    // 2. Check if host is joining their own room (just return it)
    if (room.host_id === partnerId) {
        return await populateRoomNames(room);
    }

    // 3. Check if room is full (someone else already joined)
    if (room.partner_id && room.partner_id !== partnerId) {
        const err = new Error('Room is already full. Someone else has joined.');
        err.status = 400;
        throw err;
    }

    // 4. Check expiry
    if (new Date(room.expires_at) < new Date()) {
        // Auto-mark as expired
        await supabase.from('rooms').update({ status: 'EXPIRED' }).eq('id', room.id);
        const err = new Error('Room has expired.');
        err.status = 400;
        throw err;
    }

    // 5. Archive any existing WAITING rooms for the partner (they're joining a new room)
    await supabase
        .from('rooms')
        .update({ status: 'COMPLETED' })
        .eq('host_id', partnerId)
        .in('status', ['WAITING'])
        .neq('id', room.id);

    // 6. Update room to ACTIVE with partner
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
