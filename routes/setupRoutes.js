
import { Router } from 'express';

import {
  getSetupStatus,
  runSetup,
} from '../controllers/setupController.js';

import {
  setupValidator,
} from '../validators/setupValidator.js';

import validate from '../middleware/validate.js';
import { authLimiter } from '../middleware/rateLimiters.js';

const router = Router();

router.get('/status', getSetupStatus);

router.post(
  '/',
  authLimiter,
  setupValidator,
  validate,
  runSetup
);

router.post(
  '/init',
  authLimiter,
  setupValidator,
  validate,
  runSetup
);

export default router;
