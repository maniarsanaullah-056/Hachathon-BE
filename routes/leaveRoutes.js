import { Router } from 'express';
import {
  createLeave,
  getLeaves,
  getBalance,
  cancelLeaveApplication,
  approveLeave,
  rejectLeave,
} from '../controllers/leaveController.js';
import { protect, authorize } from '../middleware/auth.js';
import { ROLES } from '../utils/constants.js';

const router = Router();
router.use(protect);

router.post('/', createLeave);
router.get('/', getLeaves);
router.get('/balance', getBalance);
router.patch('/:id/cancel', cancelLeaveApplication);
router.patch('/:id/approve', authorize(ROLES.ADMIN, ROLES.HR), approveLeave);
router.patch('/:id/reject', authorize(ROLES.ADMIN, ROLES.HR), rejectLeave);

export default router;
