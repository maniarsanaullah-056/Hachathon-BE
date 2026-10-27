import { Router } from 'express';
import { listPayslips, downloadPayslipPdf } from '../controllers/payrollController.js';
import { protect } from '../middleware/auth.js';

const router = Router();
router.use(protect);

router.get('/', listPayslips);
router.get('/:id/pdf', downloadPayslipPdf);

export default router;
