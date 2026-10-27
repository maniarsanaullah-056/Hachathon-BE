import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { verifyToken } from '../utils/jwt.js';

const buildProtect = ({ allowMustChange }) =>
  asyncHandler(async (req, _res, next) => {
    const [scheme, token] = (req.headers.authorization || '').split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new ApiError(401, 'Authentication required');
    }

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch {
      throw new ApiError(401, 'Invalid or expired token');
    }

    // Role aur status hamesha DB se, token se nahi
    const user = await User.findById(decoded.sub);
    if (!user || !user.isActive) {
      throw new ApiError(401, 'Account not found or deactivated');
    }

    // Password change ke baad purane tokens invalid
    if (
      user.passwordChangedAt &&
      Math.floor(user.passwordChangedAt.getTime() / 1000) > decoded.iat
    ) {
      throw new ApiError(401, 'Session expired, please log in again');
    }

    if (user.mustChangePassword && !allowMustChange) {
      throw new ApiError(403, 'You must change your password first. Call POST /api/auth/change-password, then retry this request with the new token.', {
        code: 'PASSWORD_CHANGE_REQUIRED',
      });
    }

    req.user = user;
    next();
  });

// Aam protected routes: temporary password wale user ko rok deta hai
export const protect = buildProtect({ allowMustChange: false });

// Sirf /me aur /change-password ke liye
export const protectAllowPasswordChange = buildProtect({ allowMustChange: true });

// Role check server par hota hai, frontend par nahi
export const authorize =
  (...roles) =>
  (req, _res, next) => {
    if (!req.user) return next(new ApiError(401, 'Authentication required'));
    if (!roles.includes(req.user.role)) {
      return next(new ApiError(403, 'You do not have permission to perform this action'));
    }
    next();
  };
