import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { signToken } from '../utils/jwt.js';
import { safeEqual } from '../utils/safeEqual.js';
import { env } from '../config/env.js';
import { createInitialSetup, isSetupComplete } from '../services/setupService.js';

export const getSetupStatus = asyncHandler(async (_req, res) => {
  sendSuccess(res, { isSetupComplete: await isSetupComplete() });
});

export const runSetup = asyncHandler(async (req, res) => {
  const { companyName, adminName, adminEmail, adminPassword, setupKey } = req.body;

  // Optional extra protection: deploy ke baad koi aur pehle setup na kar le
  if (env.setupKey && !safeEqual(setupKey || '', env.setupKey)) {
    throw new ApiError(403, 'Invalid setup key');
  }

  const { company, admin } = await createInitialSetup(
    { companyName, adminName, adminEmail, adminPassword },
    { req }
  );

  sendSuccess(
    res,
    {
      token: signToken(admin),
      user: admin,
      company: { id: company._id, name: company.name },
    },
    'Setup completed successfully',
    201
  );
});
