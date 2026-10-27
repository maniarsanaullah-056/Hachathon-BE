import { Router } from 'express';
import { getAdminMetrics, getHrMetrics, getEmployeeMetrics } from '../controllers/dashboardController.js';
import { protect, authorize } from '../middleware/auth.js';
import { ROLES } from '../utils/constants.js';

const router = Router();
router.use(protect);

router.get('/admin', authorize(ROLES.ADMIN), getAdminMetrics);
router.get('/hr', authorize(ROLES.ADMIN, ROLES.HR), getHrMetrics);
router.get('/employee', getEmployeeMetrics);

export default router;
