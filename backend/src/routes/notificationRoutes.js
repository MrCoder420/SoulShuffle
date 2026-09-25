const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/authMiddleware');
const {
    listNotifications,
    unreadCount,
    markRead,
    markAllRead,
    removeNotification,
    registerPushToken,
} = require('../controllers/notificationController');

router.use(authenticate);

router.get('/', listNotifications);
router.get('/unread-count', unreadCount);
router.patch('/read-all', markAllRead);
router.patch('/:id/read', markRead);
router.delete('/:id', removeNotification);
router.post('/register-push-token', registerPushToken);

module.exports = router;
