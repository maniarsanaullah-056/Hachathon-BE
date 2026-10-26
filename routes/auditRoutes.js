import { Router } from 'express';
import { listAuditLogs } from '../controllers/commsController.js';
import { protect, authorize } from '../middleware/auth.js';
import { ROLES } from '../utils/constants.js';

const router = Router();
router.use(protect, authorize(ROLES.ADMIN));

router.get('/', listAuditLogs);

export default router;
