import PayrollRun from '../models/PayrollRun.js';
import Payslip from '../models/Payslip.js';
import Employee from '../models/Employee.js';
import Attendance from '../models/Attendance.js';
import LeaveApplication from '../models/LeaveApplication.js';
import LeaveType from '../models/LeaveType.js';
import ApiError from '../utils/ApiError.js';
import { formatDateOnly } from '../utils/dates.js';
import { getWorkingDaysBetween, getCompanySettings } from './dateHelperService.js';
import { calculateAnnualTax, calculateMonthlyTax } from '../utils/taxCalculator.js';
import { logAudit } from './auditService.js';
import { broadcastNotification } from './notificationService.js';

/**
 * Computes payroll figures for all active employees for a given month
 */
export async function computePayrollForMonth(monthStr, creatorUser, existingRun = null) {
  const [yearStr, monthNumStr] = monthStr.split('-');
  const year = parseInt(yearStr, 10);
  const monthNum = parseInt(monthNumStr, 10);

  const startDateStr = `${monthStr}-01`;
  const daysInMonth = new Date(year, monthNum, 0).getDate();
  const endDateStr = `${monthStr}-${String(daysInMonth).padStart(2, '0')}`;

  const monthWorkingDays = await getWorkingDaysBetween(startDateStr, endDateStr);
  const totalWorkingDaysInMonth = monthWorkingDays.length;

  if (totalWorkingDaysInMonth === 0) {
    throw new ApiError(400, 'Selected month has 0 working days');
  }

  const settings = await getCompanySettings();
  const latePenalty = settings.latePenaltyRule || { enabled: true, latesThreshold: 3, deductionDays: 0.5 };

  // Fetch employees who were employed during this month
  const employees = await Employee.find({
    joiningDate: { $lte: new Date(endDateStr + 'T23:59:59.999Z') },
    $or: [{ exitDate: null }, { exitDate: { $gte: new Date(startDateStr) } }],
  })
    .select('+basicSalary +hraAllowance +medicalAllowance +otherAllowance +isCustomSalaryStructure')
    .populate('department designation user');

  // Fetch unpaid leave type IDs
  const unpaidLeaveTypes = await LeaveType.find({ isPaid: false }).select('_id');
  const unpaidLeaveTypeIds = new Set(unpaidLeaveTypes.map((t) => String(t._id)));

  let run = existingRun;
  if (!run) {
    run = new PayrollRun({
      month: monthStr,
      year,
      monthNumber: monthNum,
      workingDays: totalWorkingDaysInMonth,
      status: 'draft',
      createdBy: creatorUser._id,
    });
    await run.save();
  }

  // Clear existing draft payslips if recomputing
  await Payslip.deleteMany({ payrollRun: run._id });

  const payslipDocs = [];
  let totalGross = 0;
  let totalDeductions = 0;
  let totalTax = 0;
  let totalNet = 0;

  for (const emp of employees) {
    // 1. Calculate Salary Structure:
    // If custom is not set: Gross = 1.5 * basic, HRA = 40% of basic, Medical = 10% of basic
    const basic = emp.basicSalary || 0;
    let hra = Math.round(basic * 0.4 * 100) / 100;
    let medical = Math.round(basic * 0.1 * 100) / 100;
    let other = 0;
    let gross = Math.round(basic * 1.5 * 100) / 100;

    if (emp.isCustomSalaryStructure) {
      hra = emp.hraAllowance || 0;
      medical = emp.medicalAllowance || 0;
      other = emp.otherAllowance || 0;
      gross = Math.round((basic + hra + medical + other) * 100) / 100;
    }

    const perDayRate = Math.round((gross / totalWorkingDaysInMonth) * 100) / 100;

    // 2. Proration by employed dates within the month:
    const joinDateStr = formatDateOnly(emp.joiningDate);
    const exitDateStr = emp.exitDate ? formatDateOnly(emp.exitDate) : '9999-12-31';

    const employedWorkingDays = monthWorkingDays.filter((d) => d >= joinDateStr && d <= exitDateStr);
    const daysEmployed = employedWorkingDays.length;

    // Prorated Gross if joined or left mid-month
    const isProrated = daysEmployed < totalWorkingDaysInMonth;
    const proratedGross = isProrated
      ? Math.round(perDayRate * daysEmployed * 100) / 100
      : gross;

    // 3. Attendance & Leave Deductions
    // Query attendance records for employee in employedWorkingDays
    const attendances = await Attendance.find({
      employee: emp._id,
      date: { $in: employedWorkingDays },
    });

    const attMap = new Map();
    attendances.forEach((a) => attMap.set(a.date, a));

    let halfDays = 0;
    let lateCount = 0;
    let presentDays = 0;
    let onLeaveDays = 0;
    let absentDays = 0;
    let unpaidLeaveDays = 0;

    for (const d of employedWorkingDays) {
      const att = attMap.get(d);
      if (!att) {
        absentDays += 1;
      } else if (att.status === 'on_leave') {
        onLeaveDays += 1;
        if (att.approvedLeave) {
          const leave = await LeaveApplication.findById(att.approvedLeave);
          if (leave && unpaidLeaveTypeIds.has(String(leave.leaveType))) {
            unpaidLeaveDays += 1;
          }
        }
      } else if (att.status === 'half_day') {
        halfDays += 1;
        if (att.isLate) lateCount += 1;
      } else if (att.status === 'late') {
        lateCount += 1;
        presentDays += 1;
      } else if (att.status === 'absent') {
        absentDays += 1;
      } else {
        presentDays += 1;
      }
    }

    // Deduction formula: (absent days + unpaid leave days + 0.5 * half days) * perDayRate
    const attendanceDeductionUnits = absentDays + unpaidLeaveDays + 0.5 * halfDays;
    let attendanceDeduction = Math.round(attendanceDeductionUnits * perDayRate * 100) / 100;

    // Late penalty rule: e.g. 3 lates = 0.5 day deduction
    let latePenaltyDeduction = 0;
    if (latePenalty.enabled && latePenalty.latesThreshold > 0) {
      const penaltyMultiples = Math.floor(lateCount / latePenalty.latesThreshold);
      if (penaltyMultiples > 0) {
        latePenaltyDeduction = Math.round(penaltyMultiples * latePenalty.deductionDays * perDayRate * 100) / 100;
      }
    }

    const totalEmpDeductions = Math.round((attendanceDeduction + latePenaltyDeduction) * 100) / 100;

    // 4. Tax Calculation on annual gross (gross * 12)
    const annualGross = gross * 12;
    const annualTax = calculateAnnualTax(annualGross);
    const monthlyTax = calculateMonthlyTax(annualGross);

    // 5. Net Salary
    const netSalary = Math.max(0, Math.round((proratedGross - totalEmpDeductions - monthlyTax) * 100) / 100);

    const payslip = {
      payrollRun: run._id,
      employee: emp._id,
      month: monthStr,
      employeeCode: emp.employeeCode,
      employeeName: emp.fullName,
      departmentName: emp.department?.name || '',
      designationTitle: emp.designation?.title || '',
      workingDaysInMonth: totalWorkingDaysInMonth,
      daysWorked: daysEmployed - absentDays - unpaidLeaveDays,
      absentDays,
      unpaidLeaveDays,
      halfDays,
      lateCount,
      basicSalary: basic,
      hra,
      medical,
      otherAllowances: other,
      grossSalary: gross,
      perDayRate,
      proratedGross,
      attendanceDeduction,
      latePenaltyDeduction,
      totalDeductions: totalEmpDeductions,
      taxableGrossAnnual: annualGross,
      annualTax,
      monthlyTax,
      netSalary,
      status: 'draft',
    };

    payslipDocs.push(payslip);

    totalGross += proratedGross;
    totalDeductions += totalEmpDeductions;
    totalTax += monthlyTax;
    totalNet += netSalary;
  }

  await Payslip.insertMany(payslipDocs);

  run.totalEmployees = payslipDocs.length;
  run.totalGross = Math.round(totalGross * 100) / 100;
  run.totalDeductions = Math.round(totalDeductions * 100) / 100;
  run.totalTax = Math.round(totalTax * 100) / 100;
  run.totalNet = Math.round(totalNet * 100) / 100;
  await run.save();

  return run;
}

/**
 * Finalizes and locks payroll run (Admin only)
 */
export async function finalizePayrollRun(runId, adminUser, req = null) {
  const run = await PayrollRun.findById(runId);
  if (!run) throw new ApiError(404, 'Payroll run not found');

  if (run.status === 'finalized') {
    throw new ApiError(409, 'Payroll run is already finalized and locked');
  }

  const before = run.toObject();
  run.status = 'finalized';
  run.finalizedBy = adminUser._id;
  run.finalizedAt = new Date();
  await run.save();

  await Payslip.updateMany({ payrollRun: run._id }, { $set: { status: 'finalized' } });

  // Notify all employees that payslips are ready
  const payslips = await Payslip.find({ payrollRun: run._id }).populate({
    path: 'employee',
    populate: { path: 'user' },
  });

  const usersToNotify = payslips
    .map((p) => p.employee?.user)
    .filter(Boolean);

  await broadcastNotification({
    users: usersToNotify,
    title: 'Payslip Available',
    message: `Your payslip for ${run.month} is now available to view and download.`,
    type: 'payroll',
    referenceId: run._id,
  });

  if (req) {
    await logAudit({
      actor: adminUser,
      action: 'PAYROLL_FINALIZED',
      entity: 'PayrollRun',
      entityId: run._id,
      before,
      after: run,
      req,
    });
  }

  return run;
}
