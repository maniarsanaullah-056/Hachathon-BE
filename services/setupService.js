
import Company from '../models/Company.js';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import { env } from '../config/env.js';
import { ROLES, PASSWORD_REGEX } from '../utils/constants.js';
import { ensureDefaultLeaveTypes } from './leaveTypeService.js';
import { logAudit } from './auditService.js';

export async function isSetupComplete() {
  return Boolean(await Company.exists({}));
}

/**
 * Initial setup: create the first company and admin.
 * This must only run when no company exists.
 */
export async function createInitialSetup(
  { companyName, adminName, adminEmail, adminPassword },
  { req = null } = {}
) {
  await Company.init();

  if (await isSetupComplete()) {
    throw new ApiError(409, 'Setup has already been completed');
  }

  let company;

  try {
    company = await Company.create({
      name: companyName,
    });
  } catch (err) {
    if (err.code === 11000) {
      throw new ApiError(409, 'Setup has already been completed');
    }

    throw err;
  }

  try {
    const admin = await User.create({
      name: adminName,
      email: adminEmail.trim().toLowerCase(),
      password: adminPassword,
      role: ROLES.ADMIN,
      company: company._id,
      mustChangePassword: false,
    });

    company.createdBy = admin._id;
    await company.save();

    await ensureDefaultLeaveTypes();

    await logAudit({
      actor: admin,
      action: 'SETUP_COMPLETED',
      entity: 'Company',
      entityId: company._id,
      after: {
        company: company.name,
        adminEmail: admin.email,
      },
      req,
    });

    return { company, admin };
  } catch (err) {
    // Roll back only the company created by this attempt.
    await User.deleteMany({ company: company._id });
    await Company.deleteOne({ _id: company._id });

    throw err;
  }
}

/**
 * Create an additional admin for the existing company.
 */
export async function createAdminForExistingCompany(
  { name, email, password, companyId },
  { req = null } = {}
) {
  if (
    typeof name !== 'string' ||
    !name.trim() ||
    typeof email !== 'string' ||
    !email.trim() ||
    typeof password !== 'string' ||
    !password
  ) {
    throw new ApiError(
      400,
      'Name, email and password are required'
    );
  }

  if (!PASSWORD_REGEX.test(password)) {
    throw new ApiError(
      400,
      'Password does not meet security requirements'
    );
  }

  const normalizedEmail = email.trim().toLowerCase();

  const company = companyId
    ? await Company.findById(companyId)
    : await Company.findOne();

  if (!company) {
    throw new ApiError(404, 'Company not found');
  }

  const existingUser = await User.findOne({
    email: normalizedEmail,
  });

  if (existingUser) {
    throw new ApiError(
      409,
      'A user with this email already exists'
    );
  }

  // The User model's pre-save middleware hashes the password.
  const admin = await User.create({
    name: name.trim(),
    email: normalizedEmail,
    password,
    role: ROLES.ADMIN,
    company: company._id,
    mustChangePassword: false,
  });

  try {
    await logAudit({
      actor: req?.user || null,
      action: 'ADMIN_CREATED',
      entity: 'User',
      entityId: admin._id,
      after: {
        company: company.name,
        adminEmail: admin.email,
      },
      req,
    });
  } catch (err) {
    // Do not delete a successfully created account if audit logging fails.
    console.error(
      '[SETUP] Admin audit logging failed:',
      err.message
    );
  }

  return { company, admin };
}

// Optional bootstrap from environment variables.
let bootstrapPromise = null;

export function bootstrapFromEnv() {
  if (!env.adminEmail || !env.adminPassword) {
    return Promise.resolve();
  }

  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      if (await isSetupComplete()) {
        return;
      }

      if (!PASSWORD_REGEX.test(env.adminPassword)) {
        console.error(
          '[SETUP] ADMIN_PASSWORD is too weak. Bootstrap skipped.'
        );
        return;
      }

      try {
        await createInitialSetup({
          companyName: env.companyName,
          adminName: 'System Admin',
          adminEmail: env.adminEmail,
          adminPassword: env.adminPassword,
        });

        console.log(
          '[SETUP] Initial admin created from environment variables.'
        );
      } catch (err) {
        if (
          err.statusCode === 409 ||
          err.code === 11000
        ) {
          return;
        }

        bootstrapPromise = null;

        console.error(
          '[SETUP] Environment bootstrap failed:',
          err.message
        );
      }
    })();
  }

  return bootstrapPromise;
}
