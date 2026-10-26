import { Router } from 'express';
import { login, logout, getMe, changePassword, adminPing } from '../controllers/authController.js';
import { loginValidator, changePasswordValidator } from '../validators/authValidator.js';
import validate from '../middleware/validate.js';
import { authLimiter } from '../middleware/rateLimiters.js';
import { protect, protectAllowPasswordChange, authorize } from '../middleware/auth.js';
import { ROLES } from '../utils/constants.js';

const router = Router();

router.post('/login', authLimiter, loginValidator, validate, login);
router.post('/logout', logout);
router.get('/me', protectAllowPasswordChange, getMe);
router.post(
  '/change-password',
  protectAllowPasswordChange,
  changePasswordValidator,
  validate,
  changePassword
);

// Diagnostic route
router.get('/admin-ping', protect, authorize(ROLES.ADMIN), adminPing);

export default router;
