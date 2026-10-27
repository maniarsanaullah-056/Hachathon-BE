import { Router } from 'express';
import {
  listHrUsers,
  createHr,
  setHrStatus,
  resetHrPassword,
  deactivateHr,
  activateHr,
} from '../controllers/userController.js';
import { createHrRules, userIdParam, userStatusRules } from '../validators/userValidator.js';
import validate from '../middleware/validate.js';
import { protect, authorize } from '../middleware/auth.js';
import { ROLES } from '../utils/constants.js';

const router = Router();
// Entire users module is Admin only
router.use(protect, authorize(ROLES.ADMIN));

router.get('/', listHrUsers);
router.post('/', createHrRules, validate, createHr);
router.patch('/:id/status', userIdParam, userStatusRules, validate, setHrStatus);
router.patch('/:id/deactivate', userIdParam, validate, deactivateHr);
router.patch('/:id/activate', userIdParam, validate, activateHr);
router.post('/:id/reset-password', userIdParam, validate, resetHrPassword);

export default router;
