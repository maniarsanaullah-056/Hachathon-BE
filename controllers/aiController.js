import asyncHandler from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { handleAiChat, generateDashboardSummary, parseSmartLeave } from '../services/aiService.js';

export const chat = asyncHandler(async (req, res) => {
  const result = await handleAiChat(req.body, req.user);
  sendSuccess(res, result);
});

export const dashboardSummary = asyncHandler(async (req, res) => {
  const result = await generateDashboardSummary(req.body);
  sendSuccess(res, result);
});

export const smartLeave = asyncHandler(async (req, res) => {
  const { text } = req.body;
  const result = await parseSmartLeave(text || '');
  sendSuccess(res, result);
});
