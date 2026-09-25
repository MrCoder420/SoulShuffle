const { supabase } = require('../db/supabase');

// ─── Create & store a notification, then push it live via socket ─────────────
const createNotification = async (userId, type, title, body, data = {}) => {
    if (!userId) return null;

    try {
        // 1. Save to DB
        const { data: notification, error } = await supabase
            .from('notifications')
            .insert([{ user_id: userId, type, title, body, data, is_read: false }])
            .select()
            .single();

        if (error) {
            console.error('[notificationService] DB insert error:', error.message);
            return null;
        }

        // 2. Push real-time to user via socket (if connected)
        try {
            const { emitToUser } = require('./socketService');
            emitToUser(userId, 'new_notification', notification);
        } catch (socketErr) {
            // User may be offline — notification is still saved in DB
            console.log('[notificationService] Socket emit skipped (user offline?):', socketErr.message);
        }

        return notification;
    } catch (err) {
        console.error('[notificationService] Unexpected error:', err.message);
        return null;
    }
};

// ─── Fetch paginated notifications for a user ────────────────────────────────
const getNotifications = async (userId, page = 1, limit = 20) => {
    const offset = (page - 1) * limit;
    const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (error) throw new Error(error.message);
    return data || [];
};

// ─── Count unread ─────────────────────────────────────────────────────────────
const getUnreadCount = async (userId) => {
    const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false);

    if (error) throw new Error(error.message);
    return count || 0;
};

// ─── Mark single as read ──────────────────────────────────────────────────────
const markNotificationRead = async (userId, notificationId) => {
    const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)
        .eq('user_id', userId);

    if (error) throw new Error(error.message);
};

// ─── Mark all as read ─────────────────────────────────────────────────────────
const markAllNotificationsRead = async (userId) => {
    const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false);

    if (error) throw new Error(error.message);
};

// ─── Delete a notification ────────────────────────────────────────────────────
const deleteNotification = async (userId, notificationId) => {
    const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)
        .eq('user_id', userId);

    if (error) throw new Error(error.message);
};

module.exports = {
    createNotification,
    getNotifications,
    getUnreadCount,
    markNotificationRead,
    markAllNotificationsRead,
    deleteNotification,
};
