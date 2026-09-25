const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/authMiddleware');
const {
    sendCardCtrl,
    fetchSendsCtrl,
    acceptCtrl,
    rejectCtrl,
    completeCtrl,
    confirmCtrl,
    deflectCtrl,
    deflectCardsCtrl,
    
    
} = require('../controllers/cardSendController');

router.use(authenticate);

// Card send lifecycle
router.post('/deck/:deckCardId/send', sendCardCtrl);
router.get('/deck/sends', fetchSendsCtrl);
router.patch('/deck/sends/:id/accept', acceptCtrl);
router.patch('/deck/sends/:id/reject', rejectCtrl);
router.patch('/deck/sends/:id/complete', completeCtrl);
router.patch('/deck/sends/:id/confirm', confirmCtrl);
router.post('/deck/sends/:id/use-deflect', deflectCtrl);


router.get('/deck/deflect-cards', deflectCardsCtrl);

module.exports = router;
