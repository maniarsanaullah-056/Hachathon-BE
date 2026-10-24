import rateLimit from 'express-rate-limit';

const base = {
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later' },
};

export const apiLimiter = rateLimit({ ...base, windowMs: 15 * 60 * 1000, limit: 300 });

// Login aur setup par brute-force rokne ke liye sakht limit
export const authLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
});
