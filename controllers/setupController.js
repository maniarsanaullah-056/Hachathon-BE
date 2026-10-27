import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { signToken } from "../utils/jwt.js";
import { safeEqual } from "../utils/safeEqual.js";
import { env } from "../config/env.js";
import {
  createInitialSetup,
  isSetupComplete,
  createAdminForExistingCompany,
} from "../services/setupService.js";

export const createAdditionalAdmin = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  // The public registration endpoint also bootstraps the first company/admin.
  if (!(await isSetupComplete())) {
    const { companyName, setupKey } = req.body;

    if (!companyName) {
      throw new ApiError(400, "Company name is required for the first registration");
    }

    // Keep the optional setup-key protection when it is configured.
    if (env.setupKey && !safeEqual(setupKey || "", env.setupKey)) {
      throw new ApiError(403, "Invalid setup key");
    }

    const { company, admin } = await createInitialSetup(
      {
        companyName,
        adminName: name,
        adminEmail: email,
        adminPassword: password,
      },
      { req },
    );

    sendSuccess(
      res,
      {
        token: signToken(admin),
        user: admin,
        company: { id: company._id, name: company.name },
      },
      "Admin registered successfully",
      201,
    );
    return;
  }

  const { company, admin } = await createAdminForExistingCompany(
    {
      name,
      email,
      password,
    },
    { req },
  );

  sendSuccess(
    res,
    {
      user: admin,
      company: {
        id: company._id,
        name: company.name,
      },
    },
    "Admin created successfully",
    201,
  );
});

export const getSetupStatus = asyncHandler(async (_req, res) => {
  sendSuccess(res, { isSetupComplete: await isSetupComplete() });
});

export const runSetup = asyncHandler(async (req, res) => {
  const { companyName, adminName, adminEmail, adminPassword, setupKey } =
    req.body;

  // Optional extra protection: deploy ke baad koi aur pehle setup na kar le
  if (env.setupKey && !safeEqual(setupKey || "", env.setupKey)) {
    throw new ApiError(403, "Invalid setup key");
  }

  const { company, admin } = await createInitialSetup(
    { companyName, adminName, adminEmail, adminPassword },
    { req },
  );

  sendSuccess(
    res,
    {
      token: signToken(admin),
      user: admin,
      company: { id: company._id, name: company.name },
    },
    "Setup completed successfully",
    201,
  );
});
