import { Router } from 'express';
import { getSettings, updateSettings } from '../controllers/settingsController.js';
import { protect, authorize } from '../middleware/auth.js';
import { ROLES } from '../utils/constants.js';

const router = Router();

router.use(protect);

router.get('/', getSettings);
router.put('/', authorize(ROLES.ADMIN), updateSettings);
router.patch('/', authorize(ROLES.ADMIN), updateSettings);

export default router;
