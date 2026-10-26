import Attendance, { ATTENDANCE_STATUSES } from '../models/Attendance.js';
import Employee from '../models/Employee.js';
import LeaveApplication from '../models/LeaveApplication.js';
import ApiError from '../utils/ApiError.js';
import { formatDateOnly, todayDateOnly } from '../utils/dates.js';
import { getCompanySettings, calculateHaversineDistance, isWeekend, getHolidayDatesSet } from './dateHelperService.js';
import { logAudit } from './auditService.js';

/**
 * Checks in an employee. Server stamps the time.
 */
export async function checkInEmployee(employeeUser, checkInData = {}, req = null) {
  const employee = await Employee.findOne({ user: employeeUser._id });
  if (!employee) {
    throw new ApiError(404, 'Employee profile not found for this account');
  }

  const now = new Date();
  const dateStr = formatDateOnly(now);

  // Check if already checked in today
  const existing = await Attendance.findOne({ employee: employee._id, date: dateStr });
  if (existing && existing.checkInTime) {
    throw new ApiError(409, 'You have already checked in today');
  }

  const settings = await getCompanySettings();
  const source = checkInData.source || 'web';

  // Camera + Geolocation bonus validation
  let distanceMeters = null;
  let faceVerified = false;

  if (source === 'camera') {
    if (checkInData.faceCount !== 1) {
      throw new ApiError(422, 'Attendance rejected: Exactly 1 face must be detected');
    }
    if (checkInData.accuracy !== undefined && checkInData.accuracy > 100) {
      throw new ApiError(422, 'Attendance rejected: GPS accuracy is too low (must be <= 100m)');
    }

    if (
      settings.officeLocation &&
      settings.officeLocation.latitude != null &&
      settings.officeLocation.longitude != null
    ) {
      if (checkInData.lat == null || checkInData.lng == null) {
        throw new ApiError(422, 'Attendance rejected: Geolocation coordinates required for camera check-in');
      }
      distanceMeters = calculateHaversineDistance(
        checkInData.lat,
        checkInData.lng,
        settings.officeLocation.latitude,
        settings.officeLocation.longitude
      );

      const maxRadius = settings.officeLocation.radiusMeters || 150;
      if (distanceMeters > maxRadius) {
        throw new ApiError(
          422,
          `Attendance rejected: You are ${Math.round(distanceMeters)}m away from the office (max allowed ${maxRadius}m)`
        );
      }
    }
    faceVerified = true;
  }

  // Calculate late status
  // e.g. officeStartTime "09:00", grace 15 min -> 09:15
  const [startHour, startMin] = (settings.officeStartTime || '09:00').split(':').map(Number);
  const graceMinutes = settings.graceMinutes != null ? settings.graceMinutes : 15;

  const thresholdTime = new Date(now);
  thresholdTime.setHours(startHour, startMin + graceMinutes, 0, 0);

  const isLate = now > thresholdTime;
  let lateMinutes = 0;
  if (isLate) {
    const scheduledStartTime = new Date(now);
    scheduledStartTime.setHours(startHour, startMin, 0, 0);
    lateMinutes = Math.max(0, Math.round((now - scheduledStartTime) / 60000));
  }

  const status = isLate ? 'late' : 'present';

  let attendanceRecord;
  if (existing) {
    existing.checkInTime = now;
    existing.status = status;
    existing.isLate = isLate;
    existing.lateMinutes = lateMinutes;
    existing.source = source;
    existing.faceVerified = faceVerified;
    if (checkInData.lat != null) {
      existing.location = {
        latitude: checkInData.lat,
        longitude: checkInData.lng,
        accuracy: checkInData.accuracy || null,
        distanceMeters,
      };
    }
    attendanceRecord = await existing.save();
  } else {
    attendanceRecord = await Attendance.create({
      employee: employee._id,
      date: dateStr,
      checkInTime: now,
      status,
      isLate,
      lateMinutes,
      source,
      faceVerified,
      location: {
        latitude: checkInData.lat || null,
        longitude: checkInData.lng || null,
        accuracy: checkInData.accuracy || null,
        distanceMeters,
      },
    });
  }

  if (req) {
    await logAudit({
      actor: employeeUser,
      action: 'ATTENDANCE_CHECK_IN',
      entity: 'Attendance',
      entityId: attendanceRecord._id,
      after: attendanceRecord,
      req,
    });
  }

  return attendanceRecord;
}

/**
 * Checks out an employee. Server stamps the time.
 */
export async function checkOutEmployee(employeeUser, checkOutData = {}, req = null) {
  const employee = await Employee.findOne({ user: employeeUser._id });
  if (!employee) {
    throw new ApiError(404, 'Employee profile not found for this account');
  }

  const now = new Date();
  const dateStr = formatDateOnly(now);

  const attendance = await Attendance.findOne({ employee: employee._id, date: dateStr });
  if (!attendance || !attendance.checkInTime) {
    throw new ApiError(400, 'Cannot check out: You have not checked in today');
  }

  if (attendance.checkOutTime) {
    throw new ApiError(409, 'You have already checked out today');
  }

  attendance.checkOutTime = now;
  const workedMs = attendance.checkOutTime - attendance.checkInTime;
  const workedHours = Math.round((workedMs / (1000 * 60 * 60)) * 100) / 100;
  attendance.workedHours = workedHours;

  const settings = await getCompanySettings();
  const halfDayHours = settings.halfDayThresholdHours != null ? settings.halfDayThresholdHours : 5;

  if (workedHours < halfDayHours) {
    attendance.status = 'half_day';
  } else if (!attendance.isLate) {
    attendance.status = 'present';
  }

  await attendance.save();

  if (req) {
    await logAudit({
      actor: employeeUser,
      action: 'ATTENDANCE_CHECK_OUT',
      entity: 'Attendance',
      entityId: attendance._id,
      after: attendance,
      req,
    });
  }

  return attendance;
}

/**
 * Get today's attendance record for current user
 */
export async function getTodayAttendance(userId) {
  const employee = await Employee.findOne({ user: userId });
  if (!employee) return null;
  const dateStr = formatDateOnly(new Date());
  return await Attendance.findOne({ employee: employee._id, date: dateStr });
}

/**
 * Attendance calendar for an employee in a given month (YYYY-MM)
 */
export async function getEmployeeAttendanceCalendar(employeeId, monthStr) {
  const employee = await Employee.findById(employeeId).populate('department designation');
  if (!employee) throw new ApiError(404, 'Employee not found');

  const [yearStr, monthNumStr] = monthStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthNumStr, 10);

  const startDateStr = `${monthStr}-01`;
  const daysInMonth = new Date(year, month, 0).getDate();
  const endDateStr = `${monthStr}-${String(daysInMonth).padStart(2, '0')}`;

  const records = await Attendance.find({
    employee: employeeId,
    date: { $gte: startDateStr, $lte: endDateStr },
  }).sort({ date: 1 });

  const recordMap = new Map();
  records.forEach((r) => recordMap.set(r.date, r));

  const settings = await getCompanySettings();
  const holidays = await getHolidayDatesSet(startDateStr, endDateStr);
  const weekendDays = settings.weekendDays || [0, 6];

  // Approved leaves in month
  const approvedLeaves = await LeaveApplication.find({
    employee: employeeId,
    status: 'approved',
    dates: { $elemMatch: { $gte: startDateStr, $lte: endDateStr } },
  });
  const leaveDateMap = new Set();
  approvedLeaves.forEach((l) => l.dates.forEach((d) => leaveDateMap.add(d)));

  const calendar = [];
  const todayStr = formatDateOnly(new Date());

  for (let day = 1; day <= daysInMonth; day++) {
    const curDateStr = `${monthStr}-${String(day).padStart(2, '0')}`;
    const dateObj = new Date(`${curDateStr}T00:00:00`);
    const isWk = isWeekend(dateObj, weekendDays);
    const isHol = holidays.has(curDateStr);

    let dayRecord = recordMap.get(curDateStr);

    if (!dayRecord) {
      if (leaveDateMap.has(curDateStr)) {
        dayRecord = { date: curDateStr, status: 'on_leave', workedHours: 0 };
      } else if (isHol) {
        dayRecord = { date: curDateStr, status: 'holiday', workedHours: 0 };
      } else if (isWk) {
        dayRecord = { date: curDateStr, status: 'weekend', workedHours: 0 };
      } else if (curDateStr < todayStr) {
        dayRecord = { date: curDateStr, status: 'absent', workedHours: 0 };
      } else {
        dayRecord = { date: curDateStr, status: 'upcoming', workedHours: 0 };
      }
    }

    calendar.push(dayRecord);
  }

  return { employee, month: monthStr, calendar };
}

/**
 * Attendance daily board for HR/Admin
 */
export async function getAttendanceBoard({ date, departmentId }) {
  const queryDate = date || formatDateOnly(new Date());
  const filter = { employmentStatus: 'active' };
  if (departmentId) filter.department = departmentId;

  const employees = await Employee.find(filter)
    .populate('department', 'name')
    .populate('designation', 'title')
    .sort({ fullName: 1 });

  const employeeIds = employees.map((e) => e._id);
  const attendances = await Attendance.find({
    employee: { $in: employeeIds },
    date: queryDate,
  });

  const attendanceMap = new Map();
  attendances.forEach((a) => attendanceMap.set(String(a.employee), a));

  const board = employees.map((emp) => {
    const att = attendanceMap.get(String(emp._id));
    return {
      employee: {
        _id: emp._id,
        fullName: emp.fullName,
        employeeCode: emp.employeeCode,
        department: emp.department?.name,
        designation: emp.designation?.title,
      },
      date: queryDate,
      status: att ? att.status : 'absent',
      checkInTime: att?.checkInTime || null,
      checkOutTime: att?.checkOutTime || null,
      workedHours: att?.workedHours || 0,
      isLate: att?.isLate || false,
      lateMinutes: att?.lateMinutes || 0,
      source: att?.source || null,
    };
  });

  return { date: queryDate, total: employees.length, board };
}
