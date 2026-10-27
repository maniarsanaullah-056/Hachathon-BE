import { Router } from 'express';
import { chat, dashboardSummary, smartLeave } from '../controllers/aiController.js';
import { protect, authorize } from '../middleware/auth.js';
import { ROLES } from '../utils/constants.js';
import rateLimit from 'express-rate-limit';

const router = Router();
router.use(protect);

// 20 requests per user per hour
const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  keyGenerator: (req) => req.user?._id?.toString() || req.ip,
  message: {
    success: false,
    message: 'Too many AI requests. Please try again in an hour.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/chat', aiLimiter, chat);
router.post('/dashboard-summary', aiLimiter, authorize(ROLES.ADMIN, ROLES.HR), dashboardSummary);
router.post('/smart-leave', aiLimiter, smartLeave);

export default router;
