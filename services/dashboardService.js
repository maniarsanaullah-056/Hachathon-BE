import mongoose from 'mongoose';
import Employee from '../models/Employee.js';
import Attendance from '../models/Attendance.js';
import AttendanceCorrection from '../models/AttendanceCorrection.js';
import LeaveApplication from '../models/LeaveApplication.js';
import PayrollRun from '../models/PayrollRun.js';
import Payslip from '../models/Payslip.js';
import AuditLog from '../models/AuditLog.js';
import Announcement from '../models/Announcement.js';
import { getWorkingDaysBetween } from './dateHelperService.js';
import { calculateLeaveBalances } from './leaveService.js';

/* ------------------------------------------------------------------ */
/* Local date helpers: always return 'YYYY-MM-DD' strings (local time) */
/* ------------------------------------------------------------------ */
const pad = (n) => String(n).padStart(2, '0');

function toDateStr(d = new Date()) {
  const date = d instanceof Date ? d : new Date(d);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function getToday() {
  return toDateStr(new Date());
}

/* ------------------------------------------------------------------ */
/* Admin dashboard                                                     */
/* ------------------------------------------------------------------ */
export async function getAdminDashboard({ from, to, departmentId } = {}) {
  const today = getToday();
  const startDateStr = from || `${today.slice(0, 7)}-01`;
  const endDateStr = to || today;

  const empFilter = { employmentStatus: 'active' };
  if (departmentId) {
    empFilter.department = new mongoose.Types.ObjectId(departmentId);
  }

  // Active employees
  const totalEmployees = await Employee.countDocuments(empFilter);

  // Exits in period
  const exitFilter = {
    employmentStatus: 'terminated',
    exitDate: {
      $gte: new Date(startDateStr),
      $lte: new Date(`${endDateStr}T23:59:59.999Z`),
    },
  };
  if (departmentId) exitFilter.department = empFilter.department;
  const exitsInPeriod = await Employee.countDocuments(exitFilter);

  // Attrition = exits in period / headcount * 100
  const avgHeadcount = totalEmployees > 0 ? totalEmployees : 1;
  const attritionYTD = Math.round((exitsInPeriod / avgHeadcount) * 100 * 10) / 10;

  // Payroll cost & avg salary (latest run)
  const latestRun = await PayrollRun.findOne().sort({ month: -1 });
  let payrollCost = 0;
  let avgSalary = 0;

  if (latestRun) {
    const payslips = await Payslip.find({ payrollRun: latestRun._id });
    payrollCost = payslips.reduce((s, p) => s + (p.grossSalary || 0), 0);
    avgSalary = payslips.length > 0 ? Math.round(payrollCost / payslips.length) : 0;
  }

  // Headcount by department
  const headcountByDept = await Employee.aggregate([
    { $match: empFilter },
    { $group: { _id: '$department', count: { $sum: 1 } } },
    { $lookup: { from: 'departments', localField: '_id', foreignField: '_id', as: 'dept' } },
    { $unwind: '$dept' },
    { $project: { departmentName: '$dept.name', count: 1 } },
  ]);

  // Gender breakdown
  const genderBreakdown = await Employee.aggregate([
    { $match: empFilter },
    { $group: { _id: '$gender', count: { $sum: 1 } } },
  ]);

  // Tenure buckets
  const activeEmps = await Employee.find(empFilter).select('joiningDate');
  const tenureBuckets = { '<1 year': 0, '1-3 years': 0, '3-5 years': 0, '5+ years': 0 };
  const now = new Date();

  activeEmps.forEach((e) => {
    if (!e.joiningDate) return;
    const years = (now - new Date(e.joiningDate)) / (1000 * 60 * 60 * 24 * 365.25);
    if (years < 1) tenureBuckets['<1 year'] += 1;
    else if (years <= 3) tenureBuckets['1-3 years'] += 1;
    else if (years <= 5) tenureBuckets['3-5 years'] += 1;
    else tenureBuckets['5+ years'] += 1;
  });

  // Audit feed (latest 10)
  const auditFeed = await AuditLog.find()
    .sort({ createdAt: -1 })
    .limit(10)
    .populate('actor', 'name email role');

  return {
    headcount: totalEmployees,
    attritionYTD,
    payrollCost,
    avgSalary,
    headcountByDept,
    genderBreakdown,
    tenureBuckets,
    auditFeed,
    dateRange: { from: startDateStr, to: endDateStr },
  };
}

/* ------------------------------------------------------------------ */
/* HR dashboard                                                        */
/* ------------------------------------------------------------------ */
export async function getHrDashboard({ from, to, departmentId } = {}) {
  const today = getToday();
  const startDateStr = from || `${today.slice(0, 7)}-01`;
  const endDateStr = to || today;

  const empFilter = { employmentStatus: 'active' };
  if (departmentId) empFilter.department = departmentId;

  const activeEmployees = await Employee.find(empFilter).select('_id fullName department');
  const totalHeadcount = activeEmployees.length;
  const activeEmpIds = activeEmployees.map((e) => e._id);

  // Today's attendance
  const todayAttendances = await Attendance.find({
    employee: { $in: activeEmpIds },
    date: today,
  });

  const presentToday = todayAttendances.filter((a) =>
    ['present', 'late', 'half_day'].includes(a.status)
  ).length;
  const lateToday = todayAttendances.filter((a) => a.isLate).length;
  const onLeaveToday = todayAttendances.filter((a) => a.status === 'on_leave').length;

  // Pending approvals
  const [pendingLeaves, pendingCorrections] = await Promise.all([
    LeaveApplication.countDocuments({ status: 'pending' }),
    AttendanceCorrection.countDocuments({ status: 'pending' }),
  ]);

  // Top 5 late-comers in date range
  const topLateAgg = await Attendance.aggregate([
    {
      $match: {
        employee: { $in: activeEmpIds },
        date: { $gte: startDateStr, $lte: endDateStr },
        isLate: true,
      },
    },
    {
      $group: {
        _id: '$employee',
        lateCount: { $sum: 1 },
        totalLateMinutes: { $sum: '$lateMinutes' },
      },
    },
    { $sort: { lateCount: -1 } },
    { $limit: 5 },
    { $lookup: { from: 'employees', localField: '_id', foreignField: '_id', as: 'employee' } },
    { $unwind: '$employee' },
    {
      $project: {
        employeeId: '$_id',
        employeeName: '$employee.fullName',
        employeeCode: '$employee.employeeCode',
        lateCount: 1,
        totalLateMinutes: 1,
      },
    },
  ]);

  // Working days for rate & absenteeism
  const workingDays = await getWorkingDaysBetween(startDateStr, endDateStr);
  const totalExpectedRecords = activeEmpIds.length * workingDays.length;

  const periodAttendances = await Attendance.find({
    employee: { $in: activeEmpIds },
    date: { $in: workingDays },
  });

  const presentCount = periodAttendances.filter((a) => a.status === 'present').length;
  const lateCount = periodAttendances.filter((a) => a.status === 'late').length;
  const halfDayCount = periodAttendances.filter((a) => a.status === 'half_day').length;
  const onLeaveCount = periodAttendances.filter((a) => a.status === 'on_leave').length;
  const missingCheckoutCount = periodAttendances.filter(
    (a) => a.status === 'missing_checkout'
  ).length;

  const nonLeaveExpected = Math.max(1, totalExpectedRecords - onLeaveCount);
  const attendanceRate =
    Math.round(
      ((presentCount + lateCount + missingCheckoutCount + 0.5 * halfDayCount) /
        nonLeaveExpected) *
        100 *
        10
    ) / 10;

  const totalLateOrPresent = presentCount + lateCount;
  const latePercentage =
    totalLateOrPresent > 0 ? Math.round((lateCount / totalLateOrPresent) * 100 * 10) / 10 : 0;

  // Absent days in period
  const recordedAttCount = periodAttendances.length;
  const absentDays = Math.max(0, totalExpectedRecords - onLeaveCount - recordedAttCount);
  const absenteeismRate =
    totalExpectedRecords > 0 ? Math.round((absentDays / totalExpectedRecords) * 100 * 10) / 10 : 0;

  // Leave by type
  const leaveByType = await LeaveApplication.aggregate([
    {
      $match: {
        employee: { $in: activeEmpIds },
        status: 'approved',
        startDate: { $lte: endDateStr },
        endDate: { $gte: startDateStr },
      },
    },
    { $group: { _id: '$leaveType', count: { $sum: 1 }, totalDays: { $sum: '$daysCount' } } },
    { $lookup: { from: 'leavetypes', localField: '_id', foreignField: '_id', as: 'type' } },
    { $unwind: '$type' },
    { $project: { leaveTypeName: '$type.name', count: 1, totalDays: 1 } },
  ]);

  // Anomaly flags: employees with >= 3 lates
  const anomalyFlags = topLateAgg
    .filter((e) => e.lateCount >= 3)
    .map((e) => ({
      employeeName: e.employeeName,
      reason: `High tardiness: ${e.lateCount} late arrivals this period`,
      severity: e.lateCount >= 5 ? 'high' : 'medium',
    }));

  return {
    headcount: totalHeadcount,
    presentToday,
    lateToday,
    onLeaveToday,
    pendingApprovals: {
      leaves: pendingLeaves,
      corrections: pendingCorrections,
    },
    attendanceRate,
    latePercentage,
    absenteeismRate,
    topLateComers: topLateAgg,
    leaveByType,
    anomalyFlags,
    dateRange: { from: startDateStr, to: endDateStr },
  };
}

/* ------------------------------------------------------------------ */
/* Employee dashboard                                                  */
/* ------------------------------------------------------------------ */
export async function getEmployeeDashboard(userId) {
  const employee = await Employee.findOne({ user: userId });
  if (!employee) return null;

  const today = new Date();
  const todayStr = toDateStr(today);

  // Monday of the current week (without mutating `today`)
  const day = today.getDay();
  const diffToMonday = today.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(today);
  monday.setDate(diffToMonday);
  const mondayStr = toDateStr(monday);

  const weekAttendances = await Attendance.find({
    employee: employee._id,
    date: { $gte: mondayStr, $lte: todayStr },
  });

  const hoursWorkedThisWeek =
    Math.round(weekAttendances.reduce((s, a) => s + (a.workedHours || 0), 0) * 10) / 10;

  // Lates this month
  const monthPrefix = todayStr.slice(0, 7);
  const lateCountThisMonth = await Attendance.countDocuments({
    employee: employee._id,
    date: { $regex: `^${monthPrefix}` },
    isLate: true,
  });

  // Leave balances
  const leaveBalances = await calculateLeaveBalances(employee._id);

  // Last payslip
  const lastPayslip = await Payslip.findOne({
    employee: employee._id,
    status: 'finalized',
  }).sort({ month: -1 });

  // Active announcements (newest 5)
  const announcements = await Announcement.find({ isActive: true })
    .sort({ createdAt: -1 })
    .limit(5)
    .populate('author', 'name');

  return {
    hoursThisWeek: { worked: hoursWorkedThisWeek, target: 40 },
    lateCountThisMonth,
    leaveBalances,
    lastPayslip: lastPayslip
      ? {
          _id: lastPayslip._id,
          month: lastPayslip.month,
          grossSalary: lastPayslip.grossSalary,
          netSalary: lastPayslip.netSalary,
        }
      : null,
    announcements,
  };
}