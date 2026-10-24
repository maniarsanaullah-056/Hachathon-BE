import { Router } from 'express';
import { getCompany, updateCompany, updatePolicies } from '../controllers/companyController.js';
import { updateCompanyRules, policiesRules } from '../validators/companyValidator.js';
import validate from '../middleware/validate.js';
import { protect, authorize } from '../middleware/auth.js';
import { ROLES } from '../utils/constants.js';

const router = Router();
router.use(protect);

router.get('/', getCompany); // sab logged-in users (timezone, office hours chahiye)
router.patch('/', authorize(ROLES.ADMIN), updateCompanyRules, validate, updateCompany);
router.put('/policies', authorize(ROLES.ADMIN), policiesRules, validate, updatePolicies);

export default router;
