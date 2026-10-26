import { Router } from 'express';
import {
  createCorrection,
  getCorrections,
  approveCorrection,
  rejectCorrection,
} from '../controllers/correctionController.js';
import { protect, authorize } from '../middleware/auth.js';
import { ROLES } from '../utils/constants.js';

const router = Router();
router.use(protect);

router.post('/', createCorrection);
router.get('/', getCorrections);
router.patch('/:id/approve', authorize(ROLES.ADMIN, ROLES.HR), approveCorrection);
router.patch('/:id/reject', authorize(ROLES.ADMIN, ROLES.HR), rejectCorrection);

export default router;
