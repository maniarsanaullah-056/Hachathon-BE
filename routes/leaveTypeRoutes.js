import { Router } from 'express';
import { leaveTypes, loadDefaultLeaveTypes } from '../controllers/orgController.js';
import { leaveTypeRules, idParam } from '../validators/orgValidator.js';
import validate from '../middleware/validate.js';
import { protect, authorize } from '../middleware/auth.js';
import { ROLES } from '../utils/constants.js';

const router = Router();
router.use(protect);

router.get('/', leaveTypes.list); // employees ko leave apply karne ke liye chahiye
router.post('/defaults', authorize(ROLES.ADMIN), loadDefaultLeaveTypes);
router.post('/', authorize(ROLES.ADMIN), leaveTypeRules(false), validate, leaveTypes.create);
router.patch('/:id', authorize(ROLES.ADMIN), idParam, leaveTypeRules(true), validate, leaveTypes.update);
router.delete('/:id', authorize(ROLES.ADMIN), idParam, validate, leaveTypes.remove);

export default router;
