const {
    sendCard,
    acceptCard,
    rejectCard,
    completeCard,
    confirmCard,
    deflectCard,
    fetchSends,
    fetchDeflectCards,
    } = require('../services/cardSendService');

// POST /user/deck/:deckCardId/send
const sendCardCtrl = async (req, res, next) => {
    try {
        const { room_id, receiver_id, message } = req.body;
        const result = await sendCard(req.user.id, req.params.deckCardId, room_id, receiver_id, message);
        res.status(201).json({ status: 'success', data: result });
    } catch (err) { next(err); }
};

// GET /user/deck/sends?room_id=xxx
const fetchSendsCtrl = async (req, res, next) => {
    try {
        const { room_id } = req.query;
        if (!room_id) return res.status(400).json({ status: 'error', message: 'room_id required' });
        const sends = await fetchSends(room_id);
        res.status(200).json({ status: 'success', data: sends });
    } catch (err) { next(err); }
};

// PATCH /user/deck/sends/:id/accept
const acceptCtrl = async (req, res, next) => {
    try {
        const result = await acceptCard(req.user.id, req.params.id);
        res.status(200).json({ status: 'success', ...result });
    } catch (err) { next(err); }
};

// PATCH /user/deck/sends/:id/reject
const rejectCtrl = async (req, res, next) => {
    try {
        const { room_id } = req.body;
        const result = await rejectCard(req.user.id, req.params.id, room_id);
        res.status(200).json({ status: 'success', ...result });
    } catch (err) { next(err); }
};

// PATCH /user/deck/sends/:id/complete
const completeCtrl = async (req, res, next) => {
    try {
        const result = await completeCard(req.user.id, req.params.id);
        res.status(200).json({ status: 'success', ...result });
    } catch (err) { next(err); }
};

// PATCH /user/deck/sends/:id/confirm
const confirmCtrl = async (req, res, next) => {
    try {
        const result = await confirmCard(req.user.id, req.params.id);
        res.status(200).json({ status: 'success', ...result });
    } catch (err) { next(err); }
};

// POST /user/deck/sends/:id/use-deflect
const deflectCtrl = async (req, res, next) => {
    try {
        const { deflect_deck_card_id } = req.body;
        const result = await deflectCard(req.user.id, req.params.id, deflect_deck_card_id);
        res.status(200).json({ status: 'success', ...result });
    } catch (err) { next(err); }
};

// GET /user/deck/deflect-cards?room_id=xxx
const deflectCardsCtrl = async (req, res, next) => {
    try {
        const { room_id } = req.query;
        if (!room_id) return res.status(400).json({ status: 'error', message: 'room_id required' });
        const cards = await fetchDeflectCards(req.user.id, room_id);
        res.status(200).json({ status: 'success', data: cards });
    } catch (err) { next(err); }
};

module.exports = {
    sendCardCtrl, fetchSendsCtrl, acceptCtrl, rejectCtrl, completeCtrl, confirmCtrl, deflectCtrl, deflectCardsCtrl
};

