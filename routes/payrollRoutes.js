import { Router } from 'express';
import {
  createPayrollRun,
  listPayrollRuns,
  getPayrollRun,
  recomputePayrollRun,
  finalizePayroll,
  listPayslips,
  downloadPayslipPdf,
} from '../controllers/payrollController.js';
import { protect, authorize } from '../middleware/auth.js';
import { ROLES } from '../utils/constants.js';

const router = Router();
router.use(protect);

// Runs management
router.post('/runs', authorize(ROLES.ADMIN, ROLES.HR), createPayrollRun);
router.get('/runs', authorize(ROLES.ADMIN, ROLES.HR), listPayrollRuns);
router.get('/runs/:id', authorize(ROLES.ADMIN, ROLES.HR), getPayrollRun);
router.post('/runs/:id/recompute', authorize(ROLES.ADMIN, ROLES.HR), recomputePayrollRun);
router.post('/runs/:id/finalize', authorize(ROLES.ADMIN), finalizePayroll);

export default router;
