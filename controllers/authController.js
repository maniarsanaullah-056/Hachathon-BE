import User from '../models/User.js';
import Employee from '../models/Employee.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { signToken } from '../utils/jwt.js';
import { logAudit } from '../services/auditService.js';
import { ROLES } from '../utils/constants.js';

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+password');

  if (!user || !(await user.comparePassword(password))) {
    throw new ApiError(401, 'Invalid email or password');
  }
  if (!user.isActive) {
    throw new ApiError(403, 'This account has been deactivated. Contact your administrator.');
  }

  user.lastLoginAt = new Date();
  await user.save();

  let employee = null;
  if (user.role === ROLES.EMPLOYEE) {
    employee = await Employee.findOne({ user: user._id }).select('_id employeeCode fullName department designation');
  }

  sendSuccess(
    res,
    {
      token: signToken(user),
      user,
      employee,
      mustChangePassword: user.mustChangePassword,
    },
    'Login successful'
  );
});

export const logout = asyncHandler(async (_req, res) => {
  sendSuccess(res, null, 'Logged out successfully');
});

export const getMe = asyncHandler(async (req, res) => {
  await req.user.populate('company', 'name timezone currency');
  let employee = null;
  if (req.user.role === ROLES.EMPLOYEE) {
    employee = await Employee.findOne({ user: req.user._id }).populate('department designation');
  }
  sendSuccess(res, { user: req.user, employee });
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id).select('+password');

  if (!(await user.comparePassword(currentPassword))) {
    throw new ApiError(400, 'Current password is incorrect');
  }
  if (currentPassword === newPassword) {
    throw new ApiError(400, 'New password must be different from the current password');
  }

  user.password = newPassword;
  user.mustChangePassword = false;
  user.passwordChangedAt = new Date();
  await user.save();

  await logAudit({
    actor: user,
    action: 'PASSWORD_CHANGED',
    entity: 'User',
    entityId: user._id,
    req,
  });
 
  sendSuccess(res, { token: signToken(user), user }, 'Password changed successfully');
});

export const adminPing = asyncHandler(async (req, res) => {
  sendSuccess(res, { role: req.user.role }, 'Admin access confirmed');
});
