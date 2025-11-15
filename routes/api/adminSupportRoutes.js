// routes/adminSupportRoutes.js
const express = require('express');
const {
  getAdminTickets,
  assignTicketToAdmin,
  adminSendMessage,
  resolveSupportTicket,
  getSupportStatistics,
  getTicketMessages
} = require('../../controllers/adminSupportController');
const { protect, authorize } = require('../../middleware/auth');
const { uploadMultiple, handleUploadErrors } = require('../../config/multer');

const router = express.Router();

// All routes are protected and admin only
router.use(protect);
router.use(authorize('admin'));

router.get('/support/statistics', getSupportStatistics);
router.get('/support/tickets/:id/messages', getTicketMessages);
router.get('/support/tickets', getAdminTickets);
router.put('/support/tickets/:id/assign', assignTicketToAdmin);
router.put('/support/tickets/:id/resolve', resolveSupportTicket);
router.post(
  '/support/tickets/:id/messages',
  uploadMultiple('attachments', 5),
  handleUploadErrors,
  adminSendMessage
);

module.exports = router;