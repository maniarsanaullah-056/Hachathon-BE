import LeaveApplication from '../models/LeaveApplication.js';
import LeaveType from '../models/LeaveType.js';
import Employee from '../models/Employee.js';
import Attendance from '../models/Attendance.js';
import ApiError from '../utils/ApiError.js';
import { formatDateOnly, todayDateOnly } from '../utils/dates.js';
import { getWorkingDaysBetween } from './dateHelperService.js';
import { logAudit } from './auditService.js';
import { createNotification } from './notificationService.js';

/**
 * Calculates current leave balance for an employee across all leave types
 */
export async function calculateLeaveBalances(employeeId) {
  const leaveTypes = await LeaveType.find({ isActive: true });
  const approvedLeaves = await LeaveApplication.find({
    employee: employeeId,
    status: 'approved',
  });
  const pendingLeaves = await LeaveApplication.find({
    employee: employeeId,
    status: 'pending',
  });

  const balances = leaveTypes.map((type) => {
    const approvedDays = approvedLeaves
      .filter((l) => String(l.leaveType) === String(type._id))
      .reduce((sum, l) => sum + (l.daysCount || 0), 0);

    const pendingDays = pendingLeaves
      .filter((l) => String(l.leaveType) === String(type._id))
      .reduce((sum, l) => sum + (l.daysCount || 0), 0);

    const quota = type.quota;
    const isUnlimited = quota === null || quota === undefined || quota < 0;
    const remaining = isUnlimited ? null : Math.max(0, quota - approvedDays);

    return {
      leaveTypeId: type._id,
      name: type.name,
      code: type.code,
      quota: isUnlimited ? 'unlimited' : quota,
      approvedDays,
      pendingDays,
      remaining: isUnlimited ? 'unlimited' : remaining,
      isPaid: type.isPaid,
    };
  });

  return balances;
}

/**
 * Apply for leave
 */
export async function applyForLeave(employeeUser, { leaveTypeId, startDate, endDate, reason }, req = null) {
  const employee = await Employee.findOne({ user: employeeUser._id });
  if (!employee) throw new ApiError(404, 'Employee profile not found');

  const leaveType = await LeaveType.findById(leaveTypeId);
  if (!leaveType || !leaveType.isActive) throw new ApiError(404, 'Leave type not found or inactive');

  if (startDate > endDate) {
    throw new ApiError(422, 'Start date cannot be after end date');
  }

  // Calculate working days only (skipping weekends and holidays)
  const workingDates = await getWorkingDaysBetween(startDate, endDate);
  if (workingDates.length === 0) {
    throw new ApiError(422, 'Selected date range contains no working days (all weekends or holidays)');
  }
  const daysCount = workingDates.length;

  // Check overlap with pending or approved leaves
  const overlapping = await LeaveApplication.findOne({
    employee: employee._id,
    status: { $in: ['pending', 'approved'] },
    dates: { $in: workingDates },
  });

  if (overlapping) {
    throw new ApiError(422, 'Leave request overlaps with an existing pending or approved leave');
  }

  // Check balance quota
  if (leaveType.quota !== null && leaveType.quota !== undefined && leaveType.quota >= 0) {
    const balances = await calculateLeaveBalances(employee._id);
    const currBalance = balances.find((b) => String(b.leaveTypeId) === String(leaveTypeId));
    const remaining = currBalance ? currBalance.remaining : 0;

    if (remaining !== 'unlimited' && daysCount > remaining) {
      throw new ApiError(422, `Insufficient leave balance. Requested ${daysCount} days, but only ${remaining} days available.`);
    }
  }

  const application = await LeaveApplication.create({
    employee: employee._id,
    leaveType: leaveType._id,
    startDate,
    endDate,
    daysCount,
    dates: workingDates,
    reason,
    status: 'pending',
  });

  if (req) {
    await logAudit({
      actor: employeeUser,
      action: 'LEAVE_APPLIED',
      entity: 'LeaveApplication',
      entityId: application._id,
      after: application,
      req,
    });
  }

  return application;
}

/**
 * Cancel a leave application
 * Cancel only pending (or approved-in-future)
 */
export async function cancelLeave(applicationId, employeeUser, req = null) {
  const employee = await Employee.findOne({ user: employeeUser._id });
  if (!employee) throw new ApiError(404, 'Employee profile not found');

  const leave = await LeaveApplication.findOne({ _id: applicationId, employee: employee._id });
  if (!leave) throw new ApiError(404, 'Leave application not found');

  if (leave.status === 'cancelled') {
    throw new ApiError(409, 'Leave is already cancelled');
  }

  const today = todayDateOnly();
  if (leave.status === 'approved' && leave.startDate < today) {
    throw new ApiError(422, 'Cannot cancel an approved leave that has already started');
  }

  if (!['pending', 'approved'].includes(leave.status)) {
    throw new ApiError(422, `Cannot cancel leave in ${leave.status} status`);
  }

  const before = leave.toObject();
  leave.status = 'cancelled';
  await leave.save();

  // If it was approved, remove the attendance on_leave status
  if (before.status === 'approved') {
    await Attendance.deleteMany({
      employee: employee._id,
      date: { $in: leave.dates },
      status: 'on_leave',
    });
  }

  if (req) {
    await logAudit({
      actor: employeeUser,
      action: 'LEAVE_CANCELLED',
      entity: 'LeaveApplication',
      entityId: leave._id,
      before,
      after: leave,
      req,
    });
  }

  return leave;
}

/**
 * Review leave (approve / reject with comment)
 */
export async function reviewLeave(applicationId, reviewerUser, { status, comment }, req = null) {
  if (!['approved', 'rejected'].includes(status)) {
    throw new ApiError(400, 'Status must be approved or rejected');
  }

  const leave = await LeaveApplication.findById(applicationId).populate('employee leaveType');
  if (!leave) throw new ApiError(404, 'Leave application not found');

  if (leave.status !== 'pending') {
    throw new ApiError(409, `Leave application is already ${leave.status}`);
  }

  const before = leave.toObject();
  leave.status = status;
  leave.reviewedBy = reviewerUser._id;
  leave.reviewedAt = new Date();
  leave.reviewerComment = comment || '';
  await leave.save();

  // If approved, mark days as on_leave in attendance
  if (status === 'approved') {
    for (const d of leave.dates) {
      await Attendance.findOneAndUpdate(
        { employee: leave.employee._id, date: d },
        {
          $set: {
            employee: leave.employee._id,
            date: d,
            status: 'on_leave',
            approvedLeave: leave._id,
            source: 'web',
            remarks: `Leave: ${leave.leaveType?.name || ''}`,
          },
        },
        { upsert: true, new: true }
      );
    }
  }

  // Send notification to employee
  const employeeDoc = await Employee.findById(leave.employee).populate('user');
  if (employeeDoc && employeeDoc.user) {
    await createNotification({
      recipientId: employeeDoc.user._id,
      title: `Leave Application ${status.toUpperCase()}`,
      message: `Your leave application from ${leave.startDate} to ${leave.endDate} was ${status}. Comment: ${comment || 'None'}`,
      type: 'leave',
      referenceId: leave._id,
    });
  }

  if (req) {
    await logAudit({
      actor: reviewerUser,
      action: `LEAVE_${status.toUpperCase()}`,
      entity: 'LeaveApplication',
      entityId: leave._id,
      before,
      after: leave,
      req,
    });
  }

  return leave;
}
