const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { adminProtect } = require('../middlewares/adminMiddleware');

/**
 * @route GET /api/v1/admin/dashboard/stats
 * @desc Get high-level system stats
 * @access Private (Admin Only)
 */
router.get('/dashboard/stats', adminProtect, adminController.getDashboardStats);

/**
 * @route POST /api/v1/admin/dashboard/questions
 * @desc Create a new question + options
 * @access Private (Admin Only)
 */
router.post('/dashboard/questions', adminProtect, adminController.createNewQuestion);

router.post('/notifications/broadcast', adminProtect, adminController.manualBroadcast);
router.post('/notifications/single', adminProtect, adminController.manualSingle);
router.post('/users/ban', adminProtect, adminController.applySendBan);
router.post('/users/unban', adminProtect, adminController.liftSendBan);
router.post('/store/bundle', adminProtect, adminController.publishNewBundle);

module.exports = router;
