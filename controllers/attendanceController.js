import asyncHandler from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import {
  checkInEmployee,
  checkOutEmployee,
  getTodayAttendance,
  getAttendanceBoard,
  getEmployeeAttendanceCalendar,
} from '../services/attendanceService.js';
import { formatDateOnly } from '../utils/dates.js';

export const checkIn = asyncHandler(async (req, res) => {
  const record = await checkInEmployee(req.user, req.body, req);
  sendSuccess(res, record, 'Checked in successfully', 201);
});

export const checkOut = asyncHandler(async (req, res) => {
  const record = await checkOutEmployee(req.user, req.body, req);
  sendSuccess(res, record, 'Checked out successfully');
});

export const getToday = asyncHandler(async (req, res) => {
  const record = await getTodayAttendance(req.user._id);
  sendSuccess(res, record || null);
});

export const getMyAttendance = asyncHandler(async (req, res) => {
  const month = req.query.month || formatDateOnly(new Date()).slice(0, 7);
  const employeeDoc = await (await import('../models/Employee.js')).default.findOne({ user: req.user._id });
  if (!employeeDoc) {
    return sendSuccess(res, { month, calendar: [] });
  }
  const result = await getEmployeeAttendanceCalendar(employeeDoc._id, month);
  sendSuccess(res, result);
});

export const getBoard = asyncHandler(async (req, res) => {
  const { date, departmentId } = req.query;
  const board = await getAttendanceBoard({ date, departmentId });
  sendSuccess(res, board);
});

export const getCalendar = asyncHandler(async (req, res) => {
  const { employeeId } = req.params;
  const month = req.query.month || formatDateOnly(new Date()).slice(0, 7);
  const result = await getEmployeeAttendanceCalendar(employeeId, month);
  sendSuccess(res, result);
});
