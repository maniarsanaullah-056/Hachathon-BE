import asyncHandler from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import AttendanceCorrection from '../models/AttendanceCorrection.js';
import Employee from '../models/Employee.js';
import { requestCorrection, reviewCorrection } from '../services/correctionService.js';
import { ROLES } from '../utils/constants.js';

export const createCorrection = asyncHandler(async (req, res) => {
  const correction = await requestCorrection(req.user, req.body, req);
  sendSuccess(res, correction, 'Correction request submitted', 201);
});

export const getCorrections = asyncHandler(async (req, res) => {
  let filter = {};
  if (req.user.role === ROLES.EMPLOYEE) {
    const employee = await Employee.findOne({ user: req.user._id });
    if (!employee) return sendSuccess(res, []);
    filter.employee = employee._id;
  } else {
    // HR/Admin view: optional status filter (defaults to all or pending)
    if (req.query.status) {
      filter.status = req.query.status;
    }
  }

  const corrections = await AttendanceCorrection.find(filter)
    .populate({
      path: 'employee',
      select: 'fullName employeeCode department designation',
      populate: { path: 'department designation', select: 'name title' },
    })
    .populate('reviewedBy', 'name email')
    .sort({ createdAt: -1 });

  sendSuccess(res, corrections);
});

export const approveCorrection = asyncHandler(async (req, res) => {
  const { comment } = req.body || {};
  const correction = await reviewCorrection(req.params.id, req.user, { status: 'approved', comment }, req);
  sendSuccess(res, correction, 'Correction approved and attendance updated');
});

export const rejectCorrection = asyncHandler(async (req, res) => {
  const { comment } = req.body || {};
  const correction = await reviewCorrection(req.params.id, req.user, { status: 'rejected', comment }, req);
  sendSuccess(res, correction, 'Correction rejected');
});
