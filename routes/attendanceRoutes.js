import { Router } from 'express';
import {
  checkIn,
  checkOut,
  getToday,
  getMyAttendance,
  getBoard,
  getCalendar,
} from '../controllers/attendanceController.js';
import { protect, authorize } from '../middleware/auth.js';
import { ROLES } from '../utils/constants.js';

const router = Router();
router.use(protect);

router.post('/check-in', checkIn);
router.post('/check-out', checkOut);
router.get('/today', getToday);
router.get('/me', getMyAttendance);
router.get('/board', authorize(ROLES.ADMIN, ROLES.HR), getBoard);
router.get('/calendar/:employeeId', getCalendar);

export default router;
