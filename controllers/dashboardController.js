import asyncHandler from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { getAdminDashboard, getHrDashboard, getEmployeeDashboard } from '../services/dashboardService.js';

export const getAdminMetrics = asyncHandler(async (req, res) => {
  const { from, to, departmentId } = req.query;
  const metrics = await getAdminDashboard({ from, to, departmentId });
  sendSuccess(res, metrics);
});

export const getHrMetrics = asyncHandler(async (req, res) => {
  const { from, to, departmentId } = req.query;
  const metrics = await getHrDashboard({ from, to, departmentId });
  sendSuccess(res, metrics);
});

export const getEmployeeMetrics = asyncHandler(async (req, res) => {
  const metrics = await getEmployeeDashboard(req.user._id);
  sendSuccess(res, metrics || {});
});
