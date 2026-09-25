const adminService = require('../services/adminService');

/**
 * Get dashboard overview stats
 * Protected by: adminProtect middleware
 */
const getDashboardStats = async (req, res, next) => {
  try {
    const stats = await adminService.getStats();
    
    res.status(200).json({
      status: 'success',
      data: { stats }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Create a new game question
 */
const createNewQuestion = async (req, res, next) => {
  try {
    const { text, input_type, options } = req.body;
    
    if (!text) {
      const err = new Error('Question text is required.');
      err.status = 400;
      throw err;
    }

    const question = await adminService.createQuestion({ text, input_type, options });
    
    res.status(201).json({
      status: 'success',
      message: 'Question created successfully',
      data: { question }
    });
  } catch (error) {
    next(error);
  }
};

const { createNotification } = require('../services/notificationService');

/**
 * Admin: Broadcast a notification to all users
 */
const manualBroadcast = async (req, res, next) => {
  try {
    const { title, body, data } = req.body;
    if (!title || !body) throw Object.assign(new Error('Title and body required.'), { status: 400 });

    const { supabase } = require('../db/supabase');
    const { data: users } = await supabase.from('users').select('id');
    
    for (const user of (users || [])) {
      await createNotification(user.id, 'MANUAL_BROADCAST', title, body, data || {});
    }

    res.status(200).json({ status: 'success', message: `Broadcast sent to ${users?.length} users.` });
  } catch (error) { next(error); }
};

/**
 * Admin: Send notification to single user
 */
const manualSingle = async (req, res, next) => {
  try {
    const { userId, title, body, data } = req.body;
    if (!userId || !title || !body) throw Object.assign(new Error('UserId, title, and body required.'), { status: 400 });

    await createNotification(userId, 'MANUAL_SINGLE', title, body, data || {});
    res.status(200).json({ status: 'success', message: 'Notification sent.' });
  } catch (error) { next(error); }
};

/**
 * Admin: Apply Send Ban
 */
const applySendBan = async (req, res, next) => {
  try {
    const { userId, reason } = req.body;
    // ... logic to apply ban in DB
    await createNotification(userId, 'SEND_BAN_RECEIVED', '🚫 You have been banned', `You cannot send cards. Reason: ${reason}`, {});
    res.status(200).json({ status: 'success', message: 'Ban applied.' });
  } catch (error) { next(error); }
};

/**
 * Admin: Lift Send Ban
 */
const liftSendBan = async (req, res, next) => {
  try {
    const { userId } = req.body;
    // ... logic to lift ban in DB
    await createNotification(userId, 'SEND_BAN_LIFTED', '✅ Ban Lifted', 'Your account has been reinstated. You can send cards again.', {});
    res.status(200).json({ status: 'success', message: 'Ban lifted.' });
  } catch (error) { next(error); }
};

/**
 * Admin: Publish New Bundle
 */
const publishNewBundle = async (req, res, next) => {
  try {
    const { bundleName } = req.body;
    // ... logic to publish
    const { supabase } = require('../db/supabase');
    const { data: users } = await supabase.from('users').select('id');
    for (const user of (users || [])) {
      await createNotification(user.id, 'NEW_BUNDLE_AVAILABLE', '🎁 New Bundle!', `The ${bundleName} bundle is now available in the store!`, { bundleName });
    }
    res.status(200).json({ status: 'success', message: 'Bundle published.' });
  } catch (error) { next(error); }
};

module.exports = {
  getDashboardStats,
  createNewQuestion,
  manualBroadcast,
  manualSingle,
  applySendBan,
  liftSendBan,
  publishNewBundle
};
