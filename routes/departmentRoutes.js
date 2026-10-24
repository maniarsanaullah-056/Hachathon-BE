import { Router } from 'express';
import { departments } from '../controllers/orgController.js';
import { departmentRules, idParam } from '../validators/orgValidator.js';
import validate from '../middleware/validate.js';
import { protect, authorize } from '../middleware/auth.js';
import { ROLES } from '../utils/constants.js';

const router = Router();
router.use(protect, authorize(ROLES.ADMIN, ROLES.HR));

router.get('/', departments.list);
router.post('/', departmentRules(false), validate, departments.create);
router.patch('/:id', idParam, departmentRules(true), validate, departments.update);
router.delete('/:id', idParam, validate, departments.remove);

export default router;
