import AttendanceCorrection from '../models/AttendanceCorrection.js';
import Attendance from '../models/Attendance.js';
import Employee from '../models/Employee.js';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import { logAudit } from './auditService.js';
import { createNotification } from './notificationService.js';
import { getCompanySettings } from './dateHelperService.js';

export async function requestCorrection(employeeUser, { date, proposedCheckIn, proposedCheckOut, reason }, req = null) {
  const employee = await Employee.findOne({ user: employeeUser._id });
  if (!employee) throw new ApiError(404, 'Employee profile not found');

  const existing = await AttendanceCorrection.findOne({
    employee: employee._id,
    date,
    status: 'pending',
  });
  if (existing) {
    throw new ApiError(409, 'A pending correction request already exists for this date');
  }

  const attendance = await Attendance.findOne({ employee: employee._id, date });

  const correction = await AttendanceCorrection.create({
    employee: employee._id,
    attendance: attendance ? attendance._id : null,
    date,
    proposedCheckIn: proposedCheckIn ? new Date(proposedCheckIn) : null,
    proposedCheckOut: proposedCheckOut ? new Date(proposedCheckOut) : null,
    reason,
    status: 'pending',
  });

  if (req) {
    await logAudit({
      actor: employeeUser,
      action: 'CORRECTION_REQUESTED',
      entity: 'AttendanceCorrection',
      entityId: correction._id,
      after: correction,
      req,
    });
  }

  return correction;
}

export async function reviewCorrection(correctionId, reviewerUser, { status, comment }, req = null) {
  if (!['approved', 'rejected'].includes(status)) {
    throw new ApiError(400, 'Status must be approved or rejected');
  }

  const correction = await AttendanceCorrection.findById(correctionId).populate('employee');
  if (!correction) throw new ApiError(404, 'Correction request not found');

  if (correction.status !== 'pending') {
    throw new ApiError(409, `Correction is already ${correction.status}`);
  }

  const before = correction.toObject();
  correction.status = status;
  correction.reviewedBy = reviewerUser._id;
  correction.reviewedAt = new Date();
  correction.reviewerComment = comment || '';
  await correction.save();

  // If approved, update or create Attendance record
  if (status === 'approved') {
    const settings = await getCompanySettings();
    let att = await Attendance.findOne({ employee: correction.employee._id, date: correction.date });

    const checkIn = correction.proposedCheckIn || att?.checkInTime || new Date(`${correction.date}T09:00:00`);
    const checkOut = correction.proposedCheckOut || att?.checkOutTime || null;

    let workedHours = 0;
    if (checkIn && checkOut) {
      workedHours = Math.round(((checkOut - checkIn) / (1000 * 60 * 60)) * 100) / 100;
    }

    const [startHour, startMin] = (settings.officeStartTime || '09:00').split(':').map(Number);
    const graceMinutes = settings.graceMinutes != null ? settings.graceMinutes : 15;
    const thresholdTime = new Date(checkIn);
    thresholdTime.setHours(startHour, startMin + graceMinutes, 0, 0);

    const isLate = checkIn > thresholdTime;
    let lateMinutes = 0;
    if (isLate) {
      const scheduledStartTime = new Date(checkIn);
      scheduledStartTime.setHours(startHour, startMin, 0, 0);
      lateMinutes = Math.max(0, Math.round((checkIn - scheduledStartTime) / 60000));
    }

    const halfDayHours = settings.halfDayThresholdHours != null ? settings.halfDayThresholdHours : 5;
    let computedStatus = 'present';
    if (workedHours > 0 && workedHours < halfDayHours) {
      computedStatus = 'half_day';
    } else if (isLate) {
      computedStatus = 'late';
    }

    if (!att) {
      att = new Attendance({
        employee: correction.employee._id,
        date: correction.date,
      });
    }

    att.checkInTime = checkIn;
    att.checkOutTime = checkOut;
    att.workedHours = workedHours;
    att.isLate = isLate;
    att.lateMinutes = lateMinutes;
    att.status = computedStatus;
    att.source = 'correction';
    att.remarks = `Corrected by ${reviewerUser.name || 'HR'}: ${comment || ''}`;
    await att.save();
  }

  // Notify employee
  const employeeDoc = await Employee.findById(correction.employee).populate('user');
  if (employeeDoc && employeeDoc.user) {
    await createNotification({
      recipientId: employeeDoc.user._id,
      title: `Attendance Correction ${status.toUpperCase()}`,
      message: `Your correction request for ${correction.date} was ${status}. Comment: ${comment || 'None'}`,
      type: 'correction',
      referenceId: correction._id,
    });
  }

  if (req) {
    await logAudit({
      actor: reviewerUser,
      action: `CORRECTION_${status.toUpperCase()}`,
      entity: 'AttendanceCorrection',
      entityId: correction._id,
      before,
      after: correction,
      req,
    });
  }

  return correction;
}
