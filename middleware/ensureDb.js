import { connectDB } from '../config/db.js';
import { bootstrapFromEnv } from '../services/setupService.js';
import asyncHandler from '../utils/asyncHandler.js';

// Har request se pehle DB connected hona chahiye (serverless ke liye zaroori)
export default asyncHandler(async (_req, _res, next) => {
  await connectDB();
  await bootstrapFromEnv();
  next();
});
