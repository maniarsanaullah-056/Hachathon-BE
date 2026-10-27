import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { ROLES } from '../utils/constants.js';
import { createHrUser, resetUserPassword } from '../services/userService.js';
import { logAudit } from '../services/auditService.js';

async function loadHrUser(id) {
  const target = await User.findById(id);
  if (!target) throw new ApiError(404, 'User not found');
  if (target.role !== ROLES.HR) throw new ApiError(403, 'Only HR accounts can be managed here');
  return target;
}

export const listHrUsers = asyncHandler(async (_req, res) => {
  const items = await User.find({ role: ROLES.HR }).sort({ createdAt: -1 }).limit(200);
  sendSuccess(res, { items });
});

export const createHr = asyncHandler(async (req, res) => {
  const { user, tempPassword } = await createHrUser(
    { name: req.body.name, email: req.body.email },
    req.user,
    req
  );
  sendSuccess(
    res,
    { user, tempPassword },
    'HR account created. Share the temporary password securely, it will not be shown again.',
    201
  );
});

export const setHrStatus = asyncHandler(async (req, res) => {
  const target = await loadHrUser(req.params.id);
  const before = { isActive: target.isActive };
  target.isActive = req.body.isActive;
  await target.save();
  await logAudit({
    actor: req.user,
    action: target.isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
    entity: 'User',
    entityId: target._id,
    before,
    after: { isActive: target.isActive },
    req,
  });
  sendSuccess(res, { user: target }, target.isActive ? 'Account activated' : 'Account deactivated');
});

export const deactivateHr = asyncHandler(async (req, res) => {
  const target = await loadHrUser(req.params.id);
  const before = { isActive: target.isActive };
  target.isActive = false;
  await target.save();
  await logAudit({
    actor: req.user,
    action: 'USER_DEACTIVATED',
    entity: 'User',
    entityId: target._id,
    before,
    after: { isActive: target.isActive },
    req,
  });
  sendSuccess(res, { user: target }, 'Account deactivated');
});

export const activateHr = asyncHandler(async (req, res) => {
  const target = await loadHrUser(req.params.id);
  const before = { isActive: target.isActive };
  target.isActive = true;
  await target.save();
  await logAudit({
    actor: req.user,
    action: 'USER_ACTIVATED',
    entity: 'User',
    entityId: target._id,
    before,
    after: { isActive: target.isActive },
    req,
  });
  sendSuccess(res, { user: target }, 'Account activated');
});

export const resetHrPassword = asyncHandler(async (req, res) => {
  const target = await loadHrUser(req.params.id);
  const tempPassword = await resetUserPassword(target, req.user, req);
  sendSuccess(res, { tempPassword }, 'Password reset. Share the temporary password securely.');
});
