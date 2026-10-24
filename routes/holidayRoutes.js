import { Router } from 'express';
import { holidays } from '../controllers/orgController.js';
import { holidayRules, idParam } from '../validators/orgValidator.js';
import validate from '../middleware/validate.js';
import { protect, authorize } from '../middleware/auth.js';
import { ROLES } from '../utils/constants.js';

const router = Router();
router.use(protect);

router.get('/', holidays.list); // calendar ke liye sab users
router.post('/', authorize(ROLES.ADMIN), holidayRules(false), validate, holidays.create);
router.patch('/:id', authorize(ROLES.ADMIN), idParam, holidayRules(true), validate, holidays.update);
router.delete('/:id', authorize(ROLES.ADMIN), idParam, validate, holidays.remove);

export default router;
