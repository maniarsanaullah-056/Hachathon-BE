import { Router } from 'express';
import { designations } from '../controllers/orgController.js';
import { designationRules, idParam } from '../validators/orgValidator.js';
import validate from '../middleware/validate.js';
import { protect, authorize } from '../middleware/auth.js';
import { ROLES } from '../utils/constants.js';

const router = Router();
router.use(protect, authorize(ROLES.ADMIN, ROLES.HR));

router.get('/', designations.list);
router.post('/', designationRules(false), validate, designations.create);
router.patch('/:id', idParam, designationRules(true), validate, designations.update);
router.delete('/:id', idParam, validate, designations.remove);

export default router;
