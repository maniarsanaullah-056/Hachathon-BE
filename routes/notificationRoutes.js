import { Router } from 'express';
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../controllers/commsController.js';
import { protect } from '../middleware/auth.js';

const router = Router();
router.use(protect);

router.get('/', listNotifications);
router.patch('/read-all', markAllNotificationsRead);
router.patch('/:id/read', markNotificationRead);

export default router;
