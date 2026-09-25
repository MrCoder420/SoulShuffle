/**
 * cardSendService.js
 * Handles all card send lifecycle: send, accept, reject, complete, confirm, deflect
 * Each action creates a notification for the other party.
 */
const { supabase } = require('../db/supabase');
const { createNotification } = require('./notificationService');

// ─── Helper: fetch send + card + room info ────────────────────────────────────
const getSendWithDetails = async (sendId) => {
    const { data, error } = await supabase
        .from('room_card_sends')
        .select(`
            id, room_id, sender_id, receiver_id, status, message,
            cards ( id, name, image_url, card_type, card_categories (name) ),
            rooms ( id, code, host_id, partner_id )
        `)
        .eq('id', sendId)
        .single();

    if (error || !data) throw Object.assign(new Error('Card send not found.'), { status: 404 });
    return data;
};

// ─── Helper: fetch user first_name ────────────────────────────────────────────
const getUserName = async (userId) => {
    const { data } = await supabase
        .from('profiles')
        .select('first_name')
        .eq('id', userId)
        .single();
    return data?.first_name || 'Your partner';
};

// ─── 1. Send a card to partner ────────────────────────────────────────────────
const sendCard = async (senderId, deckCardId, roomId, receiverId, message) => {
    // Fetch deck card info
    const { data: deckCard, error: deckErr } = await supabase
        .from('user_card_deck')
        .select('id, card_id, is_used, expired, cards(id, name, image_url, card_type, card_categories(name))')
        .eq('id', deckCardId)
        .eq('room_id', roomId)
        .single();

    if (deckErr || !deckCard) throw Object.assign(new Error('Deck card not found.'), { status: 404 });
    if (deckCard.is_used) throw Object.assign(new Error('Card already used.'), { status: 400 });
    if (deckCard.expired) throw Object.assign(new Error('Card is expired.'), { status: 400 });

    // Mark deck card as used
    await supabase.from('user_card_deck').update({ is_used: true }).eq('id', deckCardId);

    // Create send record
    const { data: send, error: sendErr } = await supabase
        .from('room_card_sends')
        .insert([{
            room_id: roomId,
            sender_id: senderId,
            receiver_id: receiverId,
            card_id: deckCard.card_id,
            deck_card_id: deckCardId,
            status: 'SENT',
            message: message || '',
            sent_at: new Date().toISOString()
        }])
        .select()
        .single();

    if (sendErr) throw Object.assign(new Error(sendErr.message), { status: 500 });

    const senderName = await getUserName(senderId);
    const cardName = deckCard.cards?.name || 'a dare card';

    // Notify receiver
    await createNotification(
        receiverId,
        'CARD_RECEIVED',
        '🃏 New Dare Card!',
        `${senderName} sent you "${cardName}". Check it out!`,
        { send_id: send.id, room_id: roomId, card_id: deckCard.card_id }
    );

    return send;
};

// ─── 2. Accept a card ─────────────────────────────────────────────────────────
const acceptCard = async (userId, sendId) => {
    const send = await getSendWithDetails(sendId);
    if (send.receiver_id !== userId) throw Object.assign(new Error('Not authorized.'), { status: 403 });
    if (send.status !== 'SENT') throw Object.assign(new Error('Card is not in SENT state.'), { status: 400 });

    const { error } = await supabase
        .from('room_card_sends')
        .update({ status: 'IN_PROGRESS', accepted_at: new Date().toISOString() })
        .eq('id', sendId);

    if (error) throw Object.assign(new Error(error.message), { status: 500 });

    const receiverName = await getUserName(userId);
    const cardName = send.cards?.name || 'your dare card';

    await createNotification(
        send.sender_id,
        'CARD_ACCEPTED',
        '✅ Dare Accepted!',
        `${receiverName} accepted "${cardName}" and is working on it!`,
        { send_id: sendId, room_id: send.room_id }
    );

    return { message: 'Card accepted.' };
};

// ─── 3. Reject a card (penalty: transfer one of receiver's cards to sender) ──
const rejectCard = async (userId, sendId, roomId) => {
    const send = await getSendWithDetails(sendId);
    if (send.receiver_id !== userId) throw Object.assign(new Error('Not authorized.'), { status: 403 });
    if (!['SENT', 'IN_PROGRESS'].includes(send.status)) throw Object.assign(new Error('Cannot reject at this stage.'), { status: 400 });

    await supabase
        .from('room_card_sends')
        .update({ status: 'REJECTED' })
        .eq('id', sendId);

    const receiverName = await getUserName(userId);
    const cardName = send.cards?.name || 'the dare card';

    // Notify sender: card was rejected
    await createNotification(
        send.sender_id,
        'CARD_REJECTED',
        '❌ Dare Rejected',
        `${receiverName} rejected "${cardName}". A penalty card is on its way to you!`,
        { send_id: sendId, room_id: send.room_id }
    );

    // Apply penalty: transfer one of receiver's unused cards to sender
    const { data: penaltyCards } = await supabase
        .from('user_card_deck')
        .select('id, card_id, cards(name, image_url)')
        .eq('user_id', userId)
        .eq('room_id', roomId || send.room_id)
        .eq('is_used', false)
        .eq('expired', false)
        .limit(1);

    if (penaltyCards && penaltyCards.length > 0) {
        const penaltyCard = penaltyCards[0];

        // Transfer: mark original as penalty
        await supabase.from('user_card_deck').update({ is_used: true }).eq('id', penaltyCard.id);

        // Give to sender
        const { data: newCard } = await supabase
            .from('user_card_deck')
            .insert([{
                user_id: send.sender_id,
                room_id: send.room_id,
                card_id: penaltyCard.card_id,
                is_used: false,
                expired: false,
                is_penalty_card: true
            }])
            .select()
            .single();

        // Notify receiver: their card was stolen
        await createNotification(
            userId,
            'PENALTY_RECEIVED',
            '⚠️ Penalty Applied',
            `You rejected "${cardName}". One of your cards was transferred to ${await getUserName(send.sender_id)}.`,
            { send_id: sendId, room_id: send.room_id }
        );

        // Notify sender: they got a penalty card
        await createNotification(
            send.sender_id,
            'PENALTY_CARD_STOLEN',
            '🎁 Penalty Card Received!',
            `Your partner rejected your dare! "${penaltyCard.cards?.name || 'A card'}" was transferred to you as a penalty.`,
            { send_id: sendId, room_id: send.room_id, card_id: penaltyCard.card_id, card_name: penaltyCard.cards?.name, image_url: penaltyCard.cards?.image_url }
        );
    }

    return { message: 'Card rejected.' };
};

// ─── 4. Complete a card (receiver marks done) ────────────────────────────────
const completeCard = async (userId, sendId) => {
    const send = await getSendWithDetails(sendId);
    if (send.receiver_id !== userId) throw Object.assign(new Error('Not authorized.'), { status: 403 });
    if (send.status !== 'IN_PROGRESS') throw Object.assign(new Error('Card is not in progress.'), { status: 400 });

    await supabase
        .from('room_card_sends')
        .update({ status: 'COMPLETED_BY_RECEIVER', completed_at: new Date().toISOString() })
        .eq('id', sendId);

    const receiverName = await getUserName(userId);
    const cardName = send.cards?.name || 'the dare card';

    await createNotification(
        send.sender_id,
        'CARD_COMPLETED',
        '🎉 Dare Completed!',
        `${receiverName} completed "${cardName}"! Confirm to close it out.`,
        { send_id: sendId, room_id: send.room_id }
    );

    return { message: 'Card marked as completed.' };
};

// ─── 5. Confirm a card (sender confirms completion) ──────────────────────────
const confirmCard = async (userId, sendId) => {
    const send = await getSendWithDetails(sendId);
    if (send.sender_id !== userId) throw Object.assign(new Error('Not authorized.'), { status: 403 });
    if (send.status !== 'COMPLETED_BY_RECEIVER') throw Object.assign(new Error('Card not ready for confirmation.'), { status: 400 });

    await supabase
        .from('room_card_sends')
        .update({ status: 'CONFIRMED' })
        .eq('id', sendId);

    const senderName = await getUserName(userId);
    const cardName = send.cards?.name || 'the dare card';

    await createNotification(
        send.receiver_id,
        'CARD_CONFIRMED',
        '✨ Dare Confirmed!',
        `${senderName} confirmed your completion of "${cardName}". Well done!`,
        { send_id: sendId, room_id: send.room_id }
    );

    return { message: 'Card confirmed.' };
};

// ─── 6. Deflect a card ────────────────────────────────────────────────────────
const deflectCard = async (userId, sendId, deflectDeckCardId) => {
    const send = await getSendWithDetails(sendId);
    if (send.receiver_id !== userId) throw Object.assign(new Error('Not authorized.'), { status: 403 });
    if (!['SENT', 'IN_PROGRESS'].includes(send.status)) throw Object.assign(new Error('Cannot deflect at this stage.'), { status: 400 });

    // Mark deflect card as used
    const { data: deflectCard } = await supabase
        .from('user_card_deck')
        .select('id, card_id, cards(name)')
        .eq('id', deflectDeckCardId)
        .eq('user_id', userId)
        .single();

    if (!deflectCard) throw Object.assign(new Error('Deflect card not found.'), { status: 404 });

    await supabase.from('user_card_deck').update({ is_used: true }).eq('id', deflectDeckCardId);

    await supabase
        .from('room_card_sends')
        .update({ status: 'DEFLECTED', deflected_at: new Date().toISOString() })
        .eq('id', sendId);

    const receiverName = await getUserName(userId);
    const cardName = send.cards?.name || 'your dare card';

    // Notify sender: card was deflected
    await createNotification(
        send.sender_id,
        'CARD_DEFLECTED',
        '🛡️ Dare Deflected!',
        `${receiverName} used a deflect card on "${cardName}". They sent it back!`,
        { send_id: sendId, room_id: send.room_id }
    );

    // Notify deflector: they earned a deflect card use
    await createNotification(
        userId,
        'DEFLECT_CARD_EARNED',
        '🛡️ Deflect Used!',
        `You successfully deflected "${cardName}" back to your partner!`,
        { send_id: sendId, room_id: send.room_id }
    );

    return { message: 'Card deflected.' };
};

// ─── 7. Fetch card sends for a room ──────────────────────────────────────────
const fetchSends = async (roomId) => {
    const { data, error } = await supabase
        .from('room_card_sends')
        .select(`
            id, room_id, sender_id, receiver_id, status, message, sent_at,
            accepted_at, completed_at, deflected_at,
            cards ( id, name, power_description, image_url, card_type, card_categories (name, theme_color) )
        `)
        .eq('room_id', roomId)
        .order('sent_at', { ascending: false });

    if (error) throw Object.assign(new Error(error.message), { status: 500 });
    return data || [];
};

// ─── 8. Fetch deflect cards for a user ────────────────────────────────────────
const fetchDeflectCards = async (userId, roomId) => {
    const { data, error } = await supabase
        .from('user_card_deck')
        .select('id, card_id, cards(id, name, image_url, card_type)')
        .eq('user_id', userId)
        .eq('room_id', roomId)
        .eq('is_used', false)
        .eq('expired', false)
        .eq('cards.card_type', 'DEFLECT');

    if (error) throw Object.assign(new Error(error.message), { status: 500 });
    return data || [];
};

// ─── 9. Request a Hint ────────────────────────────────────────────────────────
const requestHint = async (userId, sendId) => {
    const send = await getSendWithDetails(sendId);
    if (send.receiver_id !== userId) throw Object.assign(new Error('Not authorized.'), { status: 403 });
    if (send.status !== 'IN_PROGRESS') throw Object.assign(new Error('Card is not in progress.'), { status: 400 });

    const receiverName = await getUserName(userId);
    const cardName = send.cards?.name || 'the dare card';

    // Notify sender
    await createNotification(
        send.sender_id,
        'PARTNER_REQUESTED_HINT',
        '💡 Hint Requested!',
        `${receiverName} is stuck on "${cardName}" and requested a hint.`,
        { send_id: sendId, room_id: send.room_id }
    );

    return { message: 'Hint requested.' };
};

// ─── 10. Abandon a Card ──────────────────────────────────────────────────────
const abandonCard = async (userId, sendId) => {
    const send = await getSendWithDetails(sendId);
    if (send.receiver_id !== userId) throw Object.assign(new Error('Not authorized.'), { status: 403 });
    if (send.status !== 'IN_PROGRESS') throw Object.assign(new Error('Card is not in progress.'), { status: 400 });

    // Mark as abandoned (using REJECTED status or a new one, here we map to REJECTED with penalty)
    await supabase
        .from('room_card_sends')
        .update({ status: 'REJECTED' })
        .eq('id', sendId);

    const receiverName = await getUserName(userId);
    const cardName = send.cards?.name || 'the dare card';

    // Notify sender
    await createNotification(
        send.sender_id,
        'DARE_ABANDONED',
        '🏳️ Dare Abandoned',
        `${receiverName} gave up and abandoned "${cardName}".`,
        { send_id: sendId, room_id: send.room_id }
    );

    // Apply penalty logic identical to reject
    const { data: penaltyCards } = await supabase
        .from('user_card_deck')
        .select('id, card_id, cards(name, image_url)')
        .eq('user_id', userId)
        .eq('room_id', send.room_id)
        .eq('is_used', false)
        .eq('expired', false)
        .limit(1);

    if (penaltyCards && penaltyCards.length > 0) {
        const penaltyCard = penaltyCards[0];
        await supabase.from('user_card_deck').update({ is_used: true }).eq('id', penaltyCard.id);
        await supabase
            .from('user_card_deck')
            .insert([{
                user_id: send.sender_id,
                room_id: send.room_id,
                card_id: penaltyCard.card_id,
                is_used: false,
                expired: false,
                is_penalty_card: true
            }]);

        await createNotification(
            userId,
            'PENALTY_RECEIVED',
            '⚠️ Penalty Applied',
            `You abandoned "${cardName}". One of your cards was transferred as a penalty.`,
            { send_id: sendId, room_id: send.room_id }
        );

        await createNotification(
            send.sender_id,
            'PENALTY_CARD_STOLEN',
            '🎁 Penalty Card Received!',
            `Your partner abandoned a dare! "${penaltyCard.cards?.name || 'A card'}" was transferred to you.`,
            { send_id: sendId, room_id: send.room_id, card_id: penaltyCard.card_id }
        );
    }

    return { message: 'Card abandoned and penalty applied.' };
};

module.exports = {
    sendCard,
    acceptCard,
    rejectCard,
    completeCard,
    confirmCard,
    deflectCard,
    fetchSends,
    fetchDeflectCards,
    requestHint,
    abandonCard,
};

