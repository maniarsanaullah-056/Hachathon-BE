import asyncHandler from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import LeaveApplication from '../models/LeaveApplication.js';
import Employee from '../models/Employee.js';
import { applyForLeave, cancelLeave, reviewLeave, calculateLeaveBalances } from '../services/leaveService.js';
import { ROLES } from '../utils/constants.js';

export const createLeave = asyncHandler(async (req, res) => {
  const application = await applyForLeave(req.user, req.body, req);
  sendSuccess(res, application, 'Leave application submitted successfully', 201);
});

export const getLeaves = asyncHandler(async (req, res) => {
  let filter = {};
  if (req.user.role === ROLES.EMPLOYEE) {
    const employee = await Employee.findOne({ user: req.user._id });
    if (!employee) return sendSuccess(res, []);
    filter.employee = employee._id;
  } else {
    if (req.query.status) filter.status = req.query.status;
    if (req.query.employeeId) filter.employee = req.query.employeeId;
  }

  const leaves = await LeaveApplication.find(filter)
    .populate({
      path: 'employee',
      select: 'fullName employeeCode department designation',
      populate: { path: 'department designation', select: 'name title' },
    })
    .populate('leaveType', 'name code isPaid quota')
    .populate('reviewedBy', 'name email')
    .sort({ createdAt: -1 });

  sendSuccess(res, leaves);
});

export const getBalance = asyncHandler(async (req, res) => {
  let targetEmployeeId;
  if (req.user.role === ROLES.EMPLOYEE) {
    const employee = await Employee.findOne({ user: req.user._id });
    if (!employee) return sendSuccess(res, []);
    targetEmployeeId = employee._id;
  } else {
    targetEmployeeId = req.query.employeeId;
    if (!targetEmployeeId) {
      const own = await Employee.findOne({ user: req.user._id });
      if (own) targetEmployeeId = own._id;
      else return sendSuccess(res, []);
    }
  }

  const balances = await calculateLeaveBalances(targetEmployeeId);
  sendSuccess(res, balances);
});

export const cancelLeaveApplication = asyncHandler(async (req, res) => {
  const cancelled = await cancelLeave(req.params.id, req.user, req);
  sendSuccess(res, cancelled, 'Leave application cancelled successfully');
});

export const approveLeave = asyncHandler(async (req, res) => {
  const { comment } = req.body || {};
  const approved = await reviewLeave(req.params.id, req.user, { status: 'approved', comment }, req);
  sendSuccess(res, approved, 'Leave approved');
});

export const rejectLeave = asyncHandler(async (req, res) => {
  const { comment } = req.body || {};
  const rejected = await reviewLeave(req.params.id, req.user, { status: 'rejected', comment }, req);
  sendSuccess(res, rejected, 'Leave rejected');
});
