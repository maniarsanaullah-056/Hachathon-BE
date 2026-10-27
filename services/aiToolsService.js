import Employee from '../models/Employee.js';
import Attendance from '../models/Attendance.js';
import LeaveApplication from '../models/LeaveApplication.js';
import PayrollRun from '../models/PayrollRun.js';
import Payslip from '../models/Payslip.js';
import Department from '../models/Department.js';
import { calculateLeaveBalances } from './leaveService.js';
import { getAdminDashboard, getHrDashboard } from './dashboardService.js';
import { formatDateOnly, todayDateOnly } from '../utils/dates.js';
import { ROLES } from '../utils/constants.js';

export const AI_TOOLS_DEFINITIONS = [
  {
    name: 'get_headcount',
    description: 'Get current headcount total and breakdown by department',
    parameters: { type: 'object', properties: { departmentId: { type: 'string' } } },
  },
  {
    name: 'get_attendance_summary',
    description: 'Get attendance rate, present count, late count, and absenteeism',
    parameters: {
      type: 'object',
      properties: { from: { type: 'string' }, to: { type: 'string' }, departmentId: { type: 'string' } },
    },
  },
  {
    name: 'get_late_comers',
    description: 'Get top employees who arrived late in the period',
    parameters: {
      type: 'object',
      properties: { from: { type: 'string' }, to: { type: 'string' } },
    },
  },
  {
    name: 'get_leave_summary',
    description: 'Get summary of leave utilization by type',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'get_my_leave_balance',
    description: 'Get personal remaining leave balance by category for the logged in user',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'get_payroll_summary',
    description: 'Get total payroll gross, net, and average salary for latest month',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'search_employees',
    description: 'Search employees by name, department, or status',
    parameters: {
      type: 'object',
      properties: { q: { type: 'string' }, departmentName: { type: 'string' } },
    },
  },
];

/**
 * Execute tool with user role/scope guard
 */
export async function executeAiTool(toolName, args = {}, callerUser) {
  const isEmployee = callerUser.role === ROLES.EMPLOYEE;
  const isStaff = [ROLES.ADMIN, ROLES.HR].includes(callerUser.role);

  switch (toolName) {
    case 'get_headcount': {
      if (!isStaff) return { error: 'Access denied: Employees cannot view company-wide headcount.' };
      const hrData = await getHrDashboard({ departmentId: args.departmentId });
      return { headcount: hrData.headcount, dateRange: hrData.dateRange };
    }

    case 'get_attendance_summary': {
      if (!isStaff) return { error: 'Access denied: Employees cannot view company attendance metrics.' };
      const hrData = await getHrDashboard(args);
      return {
        attendanceRate: `${hrData.attendanceRate}%`,
        presentToday: hrData.presentToday,
        lateToday: hrData.lateToday,
        absenteeismRate: `${hrData.absenteeismRate}%`,
      };
    }

    case 'get_late_comers': {
      if (!isStaff) return { error: 'Access denied: Employees cannot inspect colleagues tardiness records.' };
      const hrData = await getHrDashboard(args);
      return { topLateComers: hrData.topLateComers };
    }

    case 'get_leave_summary': {
      if (!isStaff) return { error: 'Access denied: Leave utilization is restricted to HR and Admin.' };
      const hrData = await getHrDashboard();
      return { leaveByType: hrData.leaveByType };
    }

    case 'get_my_leave_balance': {
      const emp = await Employee.findOne({ user: callerUser._id });
      if (!emp) return { error: 'Employee profile not found for your account.' };
      const balances = await calculateLeaveBalances(emp._id);
      return { employeeName: emp.fullName, balances };
    }

    case 'get_payroll_summary': {
      if (!isStaff) return { error: 'Access denied: Employees cannot view organizational payroll totals.' };
      const adminData = await getAdminDashboard();
      return {
        totalGrossCost: adminData.payrollCost,
        averageGrossSalary: adminData.avgSalary,
      };
    }

    case 'search_employees': {
      if (isEmployee) {
        // Employee can only see basic public info, never salary or private details
        const query = {};
        if (args.q) {
          query.$or = [{ fullName: new RegExp(args.q, 'i') }, { email: new RegExp(args.q, 'i') }];
        }
        const emps = await Employee.find(query)
          .select('fullName email employeeCode department designation')
          .populate('department designation')
          .limit(10);
        return {
          employees: emps.map((e) => ({
            name: e.fullName,
            email: e.email,
            department: e.department?.name,
            designation: e.designation?.title,
          })),
        };
      } else {
        const query = {};
        if (args.q) {
          query.$or = [{ fullName: new RegExp(args.q, 'i') }, { email: new RegExp(args.q, 'i') }];
        }
        const emps = await Employee.find(query).populate('department designation').limit(10);
        return {
          employees: emps.map((e) => ({
            id: e._id,
            name: e.fullName,
            email: e.email,
            code: e.employeeCode,
            department: e.department?.name,
            designation: e.designation?.title,
            status: e.employmentStatus,
          })),
        };
      }
    }

    default:
      return { error: `Tool ${toolName} not found` };
  }
}
