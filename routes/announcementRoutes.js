import { Router } from 'express';
import { listAnnouncements, createAnnouncement } from '../controllers/commsController.js';
import { protect, authorize } from '../middleware/auth.js';
import { ROLES } from '../utils/constants.js';

const router = Router();
router.use(protect);

router.get('/', listAnnouncements);
router.post('/', authorize(ROLES.ADMIN, ROLES.HR), createAnnouncement);

export default router;
