const {
    getNotifications,
    getUnreadCount,
    markNotificationRead,
    markAllNotificationsRead,
    deleteNotification,
} = require('../services/notificationService');

// GET /notifications?page=1&limit=20
const listNotifications = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const notifications = await getNotifications(req.user.id, page, limit);
        res.status(200).json({ status: 'success', data: { notifications } });
    } catch (err) { next(err); }
};

// GET /notifications/unread-count
const unreadCount = async (req, res, next) => {
    try {
        const unread_count = await getUnreadCount(req.user.id);
        res.status(200).json({ status: 'success', data: { unread_count } });
    } catch (err) { next(err); }
};

// PATCH /notifications/:id/read
const markRead = async (req, res, next) => {
    try {
        await markNotificationRead(req.user.id, req.params.id);
        res.status(200).json({ status: 'success', message: 'Marked as read.' });
    } catch (err) { next(err); }
};

// PATCH /notifications/read-all
const markAllRead = async (req, res, next) => {
    try {
        await markAllNotificationsRead(req.user.id);
        res.status(200).json({ status: 'success', message: 'All marked as read.' });
    } catch (err) { next(err); }
};

// DELETE /notifications/:id
const removeNotification = async (req, res, next) => {
    try {
        await deleteNotification(req.user.id, req.params.id);
        res.status(200).json({ status: 'success', message: 'Notification deleted.' });
    } catch (err) { next(err); }
};

// POST /notifications/register-push-token
const registerPushToken = async (req, res, next) => {
    try {
        const { pushToken } = req.body;
        if (!pushToken) return res.status(400).json({ status: 'error', message: 'pushToken required.' });

        const { supabase } = require('../db/supabase');
        // Upsert push token for this user
        await supabase
            .from('user_push_tokens')
            .upsert(
                { user_id: req.user.id, push_token: pushToken, updated_at: new Date().toISOString() },
                { onConflict: 'user_id' }
            );

        res.status(200).json({ status: 'success', message: 'Push token registered.' });
    } catch (err) { next(err); }
};

module.exports = { listNotifications, unreadCount, markRead, markAllRead, removeNotification, registerPushToken };

