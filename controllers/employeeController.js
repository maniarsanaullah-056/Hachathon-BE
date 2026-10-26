import Employee, { GENDERS } from '../models/Employee.js';
import User from '../models/User.js';
import Attendance from '../models/Attendance.js';
import LeaveApplication from '../models/LeaveApplication.js';
import Payslip from '../models/Payslip.js';
import AuditLog from '../models/AuditLog.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { ROLES } from '../utils/constants.js';
import { pick } from '../utils/pick.js';
import { escapeRegex } from '../utils/escapeRegex.js';
import { parsePagination, paginationMeta } from '../utils/pagination.js';
import { toDateOnly, todayDateOnly, formatDateOnly } from '../utils/dates.js';
import { toCsv } from '../utils/csv.js';
import { assertReferences, createEmployeeWithLogin, rollbackCreated } from '../services/employeeService.js';
import { resetUserPassword } from '../services/userService.js';
import { analyzeCsv } from '../services/csvImportService.js';
import { logAudit } from '../services/auditService.js';
import { calculateLeaveBalances } from '../services/leaveService.js';

const POPULATE = [
  { path: 'department', select: 'name' },
  { path: 'designation', select: 'title' },
];
const CREATE_FIELDS = ['employeeCode', 'fullName', 'email', 'department', 'designation', 'joiningDate', 'basicSalary', 'phone', 'address', 'gender'];
const UPDATE_FIELDS = CREATE_FIELDS;

const canSeeSalary = (req) => [ROLES.ADMIN, ROLES.HR].includes(req.user.role);

function buildFilter(query) {
  const filter = {};
  if (query.status) filter.employmentStatus = query.status;
  if (query.department) filter.department = query.department;
  if (query.designation) filter.designation = query.designation;
  if (query.q && query.q.trim()) {
    const rx = new RegExp(escapeRegex(query.q.trim()), 'i');
    filter.$or = [{ fullName: rx }, { email: rx }, { employeeCode: rx }];
  }
  return filter;
}

async function findEmployeeOrFail(id, { withSalary = false } = {}) {
  let query = Employee.findById(id);
  if (withSalary) {
    query = query.select('+basicSalary +hraAllowance +medicalAllowance +otherAllowance +isCustomSalaryStructure');
  }
  const employee = await query;
  if (!employee) throw new ApiError(404, 'Employee not found');
  return employee;
}

// ---------- Directory ----------
export const listEmployees = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = buildFilter(req.query);
  const order = req.query.order || (req.query.sortBy ? 'asc' : 'desc');
  const sort = { [req.query.sortBy || 'createdAt']: order === 'asc' ? 1 : -1 };

  const [items, total] = await Promise.all([
    Employee.find(filter).collation({ locale: 'en' }).sort(sort).skip(skip).limit(limit).populate(POPULATE),
    Employee.countDocuments(filter),
  ]);

  sendSuccess(res, { items, pagination: paginationMeta(page, limit, total) });
});

// ---------- Employee Details & 360 ----------
export const getEmployee = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (req.user.role === ROLES.EMPLOYEE) {
    const own = await Employee.findOne({ user: req.user._id }).select('_id');
    if (!own || String(own._id) !== id) {
      throw new ApiError(403, 'You can only view your own profile');
    }
  }

  const employee = await findEmployeeOrFail(id, { withSalary: canSeeSalary(req) });
  await employee.populate(POPULATE);

  let account = null;
  if (canSeeSalary(req)) {
    account = await User.findById(employee.user).select('isActive lastLoginAt mustChangePassword');
  }
  sendSuccess(res, { employee, account });
});

export const getEmployee360 = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (req.user.role === ROLES.EMPLOYEE) {
    const own = await Employee.findOne({ user: req.user._id }).select('_id');
    if (!own || String(own._id) !== id) {
      throw new ApiError(403, 'You can only view your own 360 profile');
    }
  }

  const showSalary = canSeeSalary(req);
  const employee = await findEmployeeOrFail(id, { withSalary: showSalary });
  await employee.populate(POPULATE);

  // 1. Attendance Summary (last 30 days)
  const recentAttendances = await Attendance.find({ employee: employee._id })
    .sort({ date: -1 })
    .limit(30);

  const presentCount = recentAttendances.filter((a) => a.status === 'present').length;
  const lateCount = recentAttendances.filter((a) => a.status === 'late' || a.isLate).length;
  const halfDayCount = recentAttendances.filter((a) => a.status === 'half_day').length;

  // 2. Leave Balances
  const leaveBalances = await calculateLeaveBalances(employee._id);

  // 3. Payslips
  const payslipQuery = { employee: employee._id };
  if (!showSalary) {
    payslipQuery.status = 'finalized';
  }
  const payslips = await Payslip.find(payslipQuery).sort({ month: -1 }).limit(12);

  // 4. Audit History for this employee
  let auditHistory = [];
  if (req.user.role === ROLES.ADMIN) {
    auditHistory = await AuditLog.find({ entityId: employee._id })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('actor', 'name email role');
  }

  // Account details
  let account = null;
  if (showSalary) {
    account = await User.findById(employee.user).select('isActive lastLoginAt mustChangePassword');
  }

  sendSuccess(res, {
    employee,
    account,
    attendanceSummary: {
      recentRecords: recentAttendances.slice(0, 7),
      last30Days: { present: presentCount, late: lateCount, halfDay: halfDayCount },
    },
    leaveBalances,
    payslips: showSalary ? payslips : payslips.map((p) => ({ _id: p._id, month: p.month, netSalary: p.netSalary })),
    history: auditHistory,
  });
});

export const getMyEmployee = asyncHandler(async (req, res) => {
  const employee = await Employee.findOne({ user: req.user._id }).populate(POPULATE);
  if (!employee) throw new ApiError(404, 'No employee profile is linked to this account');
  sendSuccess(res, { employee });
});

export const updateMyProfile = asyncHandler(async (req, res) => {
  const employee = await Employee.findOne({ user: req.user._id });
  if (!employee) throw new ApiError(404, 'No employee profile is linked to this account');

  const before = pick(employee.toObject(), ['phone', 'address']);
  employee.set(pick(req.body, ['phone', 'address']));
  await employee.save();
  await employee.populate(POPULATE);

  await logAudit({
    actor: req.user,
    action: 'EMPLOYEE_SELF_UPDATED',
    entity: 'Employee',
    entityId: employee._id,
    before,
    after: pick(employee.toObject(), ['phone', 'address']),
    req,
  });
  sendSuccess(res, { employee }, 'Profile updated');
});

// ---------- Create / Update ----------
export const createEmployee = asyncHandler(async (req, res) => {
  const data = pick(req.body, CREATE_FIELDS);
  const { employee, tempPassword } = await createEmployeeWithLogin(data, req.user, req);
  await employee.populate(POPULATE);
  sendSuccess(
    res,
    { employee, tempPassword },
    'Employee created. Share the temporary password securely, it will not be shown again.',
    201
  );
});

export const updateEmployee = asyncHandler(async (req, res) => {
  const employee = await findEmployeeOrFail(req.params.id, { withSalary: true });
  const before = employee.toObject();
  const data = pick(req.body, UPDATE_FIELDS);

  await assertReferences({ department: data.department, designation: data.designation });

  if (data.email && data.email !== employee.email) {
    if (await User.exists({ email: data.email, _id: { $ne: employee.user } })) {
      throw new ApiError(409, 'email already exists');
    }
  }
  if (data.joiningDate) data.joiningDate = toDateOnly(data.joiningDate);
  if (data.gender === '') data.gender = null;

  employee.set(data);
  await employee.save();

  if (data.fullName || data.email) {
    const user = await User.findById(employee.user);
    if (user) {
      if (data.fullName) user.name = data.fullName;
      if (data.email) user.email = data.email;
      await user.save();
    }
  }

  await employee.populate(POPULATE);
  await logAudit({ actor: req.user, action: 'EMPLOYEE_UPDATED', entity: 'Employee', entityId: employee._id, before, after: employee, req });
  sendSuccess(res, { employee }, 'Employee updated');
});

export const updateSalaryStructure = asyncHandler(async (req, res) => {
  const employee = await findEmployeeOrFail(req.params.id, { withSalary: true });
  const before = {
    basicSalary: employee.basicSalary,
    hraAllowance: employee.hraAllowance,
    medicalAllowance: employee.medicalAllowance,
    otherAllowance: employee.otherAllowance,
    isCustomSalaryStructure: employee.isCustomSalaryStructure,
  };

  const { basicSalary, hraAllowance, medicalAllowance, otherAllowance } = req.body;
  if (basicSalary !== undefined) {
    if (Number(basicSalary) <= 0) throw new ApiError(422, 'Basic salary must be greater than 0');
    employee.basicSalary = Number(basicSalary);
  }

  if (hraAllowance !== undefined || medicalAllowance !== undefined || otherAllowance !== undefined) {
    employee.isCustomSalaryStructure = true;
    if (hraAllowance !== undefined) employee.hraAllowance = Number(hraAllowance);
    if (medicalAllowance !== undefined) employee.medicalAllowance = Number(medicalAllowance);
    if (otherAllowance !== undefined) employee.otherAllowance = Number(otherAllowance);
  }

  await employee.save();

  await logAudit({
    actor: req.user,
    action: 'SALARY_STRUCTURE_UPDATED',
    entity: 'Employee',
    entityId: employee._id,
    before,
    after: {
      basicSalary: employee.basicSalary,
      hraAllowance: employee.hraAllowance,
      medicalAllowance: employee.medicalAllowance,
      otherAllowance: employee.otherAllowance,
      isCustomSalaryStructure: employee.isCustomSalaryStructure,
    },
    req,
  });

  sendSuccess(res, employee, 'Salary structure updated successfully');
});

export const setEmployeeStatus = asyncHandler(async (req, res) => {
  const employee = await findEmployeeOrFail(req.params.id);
  const user = await User.findById(employee.user);
  const before = { employmentStatus: employee.employmentStatus, exitDate: employee.exitDate };
  const { status, exitDate } = req.body;

  employee.employmentStatus = status;
  if (status === 'terminated') {
    const exit = exitDate ? toDateOnly(exitDate) : todayDateOnly();
    if (exit < employee.joiningDate) {
      throw new ApiError(422, 'Validation failed', {
        errors: [{ field: 'exitDate', message: 'Exit date cannot be before the joining date' }],
      });
    }
    employee.exitDate = exit;
  } else {
    employee.exitDate = null;
  }
  await employee.save();

  if (user) {
    user.isActive = status === 'active';
    await user.save();
  }

  await employee.populate(POPULATE);
  await logAudit({
    actor: req.user,
    action: 'EMPLOYEE_STATUS_CHANGED',
    entity: 'Employee',
    entityId: employee._id,
    before,
    after: { employmentStatus: employee.employmentStatus, exitDate: employee.exitDate },
    req,
  });
  sendSuccess(res, { employee }, `Employee marked ${status}`);
});

export const resetEmployeePassword = asyncHandler(async (req, res) => {
  const employee = await findEmployeeOrFail(req.params.id);
  const user = await User.findById(employee.user);
  if (!user) throw new ApiError(404, 'Login account not found for this employee');
  const tempPassword = await resetUserPassword(user, req.user, req);
  sendSuccess(res, { tempPassword }, 'Password reset. Share the temporary password securely.');
});

// ---------- CSV import / export ----------
export const importEmployees = asyncHandler(async (req, res) => {
  const dryRun = req.query.dryRun !== 'false';
  const analysis = await analyzeCsv(req.body.csv);
  const { totalRows, validRows, invalidRows, errors, records } = analysis;

  if (dryRun) {
    return sendSuccess(
      res,
      {
        dryRun: true,
        totalRows,
        validRows,
        invalidRows,
        errors,
        canImport: errors.length === 0 && totalRows > 0,
        preview: records.slice(0, 5).map(({ row, employeeCode, fullName, email, joiningDate }) => ({
          row,
          employeeCode,
          fullName,
          email,
          joiningDate,
        })),
      },
      'Dry run complete. Nothing was saved.'
    );
  }

  if (errors.length > 0) {
    throw new ApiError(422, 'CSV has validation errors. Fix them and try again.', { errors });
  }

  const created = [];
  try {
    for (const record of records) {
      // eslint-disable-next-line no-await-in-loop
      created.push(await createEmployeeWithLogin(record, req.user, req, { audit: false }));
    }
  } catch (err) {
    await rollbackCreated(created);
    throw err;
  }

  await logAudit({ actor: req.user, action: 'EMPLOYEES_IMPORTED', entity: 'Employee', after: { count: created.length }, req });

  sendSuccess(
    res,
    {
      dryRun: false,
      imported: created.length,
      credentials: created.map(({ employee, tempPassword }) => ({
        employeeCode: employee.employeeCode,
        fullName: employee.fullName,
        email: employee.email,
        tempPassword,
      })),
    },
    `${created.length} employees imported. Temporary passwords are shown only once.`,
    201
  );
});

const EXPORT_HEADERS = [
  'employeeCode',
  'fullName',
  'email',
  'department',
  'designation',
  'joiningDate',
  'basicSalary',
  'phone',
  'gender',
  'address',
  'employmentStatus',
];

export const exportEmployees = asyncHandler(async (req, res) => {
  const employees = await Employee.find(buildFilter(req.query))
    .select('+basicSalary')
    .populate(POPULATE)
    .sort({ employeeCode: 1 })
    .limit(5000);

  const rows = employees.map((e) => ({
    employeeCode: e.employeeCode,
    fullName: e.fullName,
    email: e.email,
    department: e.department?.name || '',
    designation: e.designation?.title || '',
    joiningDate: formatDateOnly(e.joiningDate),
    basicSalary: e.basicSalary,
    phone: e.phone,
    gender: e.gender || '',
    address: e.address,
    employmentStatus: e.employmentStatus,
  }));

  await logAudit({ actor: req.user, action: 'EMPLOYEES_EXPORTED', entity: 'Employee', after: { count: rows.length }, req });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="employees-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(`\uFEFF${toCsv(EXPORT_HEADERS, rows)}`);
});

export { GENDERS };
