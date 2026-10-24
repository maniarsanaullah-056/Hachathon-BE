import Company from '../models/Company.js';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import { env } from '../config/env.js';
import { ROLES, PASSWORD_REGEX } from '../utils/constants.js';
import LeaveType from '../models/LeaveType.js';
import { ensureDefaultLeaveTypes } from './leaveTypeService.js';
import { logAudit } from './auditService.js';

export async function isSetupComplete() {
  return Boolean(await Company.exists({}));
}

/**
 * Company aur pehla Admin banata hai.
 * Atomic safety: Company.singletonKey unique hai, is liye do requests ek saath
 * aayen to sirf ek hi company ban sakti hai. Admin create fail ho to company
 * wapas delete ho jati hai (compensating logic, replica set zaroori nahi).
 */
export async function createInitialSetup(
  { companyName, adminName, adminEmail, adminPassword },
  { req = null } = {}
) {
  // Unique index maujood hona confirm karte hain
  await Company.init();

  if (await isSetupComplete()) {
    throw new ApiError(409, 'Setup has already been completed');
  }

  let company;
  try {
    company = await Company.create({ name: companyName });
  } catch (err) {
    if (err.code === 11000) {
      throw new ApiError(409, 'Setup has already been completed');
    }
    throw err;
  }

  try {
    const admin = await User.create({
      name: adminName,
      email: adminEmail,
      password: adminPassword,
      role: ROLES.ADMIN,
      company: company._id,
      mustChangePassword: false,
    });

    company.createdBy = admin._id;
    await company.save();

    // Policy defaults (settings, business data nahi): annual 14, sick 8, casual 10, unpaid unlimited
    await ensureDefaultLeaveTypes();

    await logAudit({
      actor: admin,
      action: 'SETUP_COMPLETED',
      entity: 'Company',
      entityId: company._id,
      after: { company: company.name, adminEmail: admin.email },
      req,
    });

    return { company, admin };
  } catch (err) {
    await LeaveType.deleteMany({}); // rollback (setup se pehle koi leave type ho hi nahi sakta)
    await Company.deleteOne({ _id: company._id }); // rollback
    throw err;
  }
}

// Optional: ADMIN_EMAIL aur ADMIN_PASSWORD se pehla Admin
let bootstrapPromise = null;

export function bootstrapFromEnv() {
  if (!env.adminEmail || !env.adminPassword) return Promise.resolve();

  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      if (await isSetupComplete()) return;

      if (!PASSWORD_REGEX.test(env.adminPassword)) {
        console.error('[SETUP] ADMIN_PASSWORD is too weak. Env bootstrap skipped.');
        return;
      }

      try {
        await createInitialSetup({
          companyName: env.companyName,
          adminName: 'System Admin',
          adminEmail: env.adminEmail,
          adminPassword: env.adminPassword,
        });
        console.log('[SETUP] Initial Admin created from environment variables.');
      } catch (err) {
        if (err.statusCode === 409) return; // kisi aur instance ne bana diya
        bootstrapPromise = null; // agli request par dobara try
        console.error('[SETUP] Env bootstrap failed:', err.message);
      }
    })();
  }

  return bootstrapPromise;
}
