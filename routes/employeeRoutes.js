import { Router } from 'express';
import {
  listEmployees,
  getEmployee,
  getEmployee360,
  getMyEmployee,
  updateMyProfile,
  createEmployee,
  updateEmployee,
  setEmployeeStatus,
  resetEmployeePassword,
  importEmployees,
  exportEmployees,
  updateSalaryStructure,
} from '../controllers/employeeController.js';
import {
  employeeIdParam,
  employeeBodyRules,
  selfUpdateRules,
  statusRules,
  listQueryRules,
  importRules,
} from '../validators/employeeValidator.js';
import validate from '../middleware/validate.js';
import { protect, authorize } from '../middleware/auth.js';
import { ROLES } from '../utils/constants.js';

const router = Router();
const staff = authorize(ROLES.ADMIN, ROLES.HR);

router.use(protect);

// Employee own profile
router.get('/me', authorize(ROLES.EMPLOYEE), getMyEmployee);
router.patch('/me', authorize(ROLES.EMPLOYEE), selfUpdateRules, validate, updateMyProfile);

// HR/Admin tools
router.get('/export', staff, listQueryRules, validate, exportEmployees);
router.post('/import', staff, importRules, validate, importEmployees);
router.get('/', staff, listQueryRules, validate, listEmployees);
router.post('/', staff, employeeBodyRules(false), validate, createEmployee);

// :id routes
router.get('/:id/360', employeeIdParam, validate, getEmployee360);
router.put('/:id/salary-structure', staff, employeeIdParam, validate, updateSalaryStructure);
router.get('/:id', employeeIdParam, validate, getEmployee);
router.put('/:id', staff, employeeIdParam, employeeBodyRules(true), validate, updateEmployee);
router.patch('/:id', staff, employeeIdParam, employeeBodyRules(true), validate, updateEmployee);
router.patch('/:id/status', staff, employeeIdParam, statusRules, validate, setEmployeeStatus);
router.post('/:id/reset-password', staff, employeeIdParam, validate, resetEmployeePassword);

export default router;
