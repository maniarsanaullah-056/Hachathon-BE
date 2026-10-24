import User from '../models/User.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { signToken } from '../utils/jwt.js';
import { logAudit } from '../services/auditService.js';

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+password');

  // Same message dono cases mein: user exist karta hai ya nahi, pata na chale
  if (!user || !(await user.comparePassword(password))) {
    throw new ApiError(401, 'Invalid email or password');
  }
  if (!user.isActive) {
    throw new ApiError(403, 'This account has been deactivated. Contact your administrator.');
  }

  user.lastLoginAt = new Date();
  await user.save();

  sendSuccess(res, {
    token: signToken(user),
    user,
    mustChangePassword: user.mustChangePassword,
  }, 'Login successful');
});

export const getMe = asyncHandler(async (req, res) => {
  await req.user.populate('company', 'name timezone currency');
  sendSuccess(res, { user: req.user });
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

  user.password = newPassword; // pre-save hook hash karega
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

  // Purane tokens invalid ho gaye, is liye naya token
  sendSuccess(res, { token: signToken(user), user }, 'Password changed successfully');
});

// Phase 1 diagnostic: sirf Admin. Role middleware verify karne ke liye
export const adminPing = asyncHandler(async (req, res) => {
  sendSuccess(res, { role: req.user.role }, 'Admin access confirmed');
});
