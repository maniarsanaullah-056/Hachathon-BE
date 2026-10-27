import { Router } from "express";
import { createAdditionalAdmin } from "../controllers/setupController.js";

import {
  createAdminValidator,
  normalizeAdminRegistrationBody,
} from "../validators/adminValidator.js";
import validate from "../middleware/validate.js";
import { authLimiter } from "../middleware/rateLimiters.js";

const router = Router();

router.post(
  "/admins",
  authLimiter,
  normalizeAdminRegistrationBody,
  createAdminValidator,
  validate,
  createAdditionalAdmin,
);

export default router;
