import Employee from '../models/Employee.js';
import Department from '../models/Department.js';
import Designation from '../models/Designation.js';
import User from '../models/User.js';
import { nextSequence } from '../models/Counter.js';
import ApiError from '../utils/ApiError.js';
import { ROLES } from '../utils/constants.js';
import { generateTempPassword } from '../utils/password.js';
import { toDateOnly } from '../utils/dates.js';
import { logAudit } from './auditService.js';

// Department/designation ids waqai maujood hain ya nahi
export async function assertReferences({ department, designation }) {
  const errors = [];
  if (department && !(await Department.exists({ _id: department }))) {
    errors.push({ field: 'department', message: 'Department does not exist' });
  }
  if (designation && !(await Designation.exists({ _id: designation }))) {
    errors.push({ field: 'designation', message: 'Designation does not exist' });
  }
  if (errors.length) throw new ApiError(422, 'Validation failed', { errors });
}

export async function generateEmployeeCode() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const n = await nextSequence('employeeCode');
    const code = `EMP-${String(n).padStart(4, '0')}`;
    if (!(await Employee.exists({ employeeCode: code }))) return code;
  }
  throw new ApiError(500, 'Could not generate a unique employee code');
}

/**
 * Employee record + login ek saath banata hai.
 * Transaction ke bajaye compensating logic: Employee fail ho to User delete.
 * Temporary password sirf return hota hai, kahin store nahi hota (sirf hash).
 */
export async function createEmployeeWithLogin(data, actor, req, { audit = true } = {}) {
  await assertReferences(data);

  const employeeCode = data.employeeCode || (await generateEmployeeCode());
  const tempPassword = generateTempPassword();

  const user = await User.create({
    name: data.fullName,
    email: data.email,
    password: tempPassword,
    role: ROLES.EMPLOYEE,
    company: actor.company,
    mustChangePassword: true,
  });

  let employee;
  try {
    employee = await Employee.create({
      user: user._id,
      employeeCode,
      fullName: data.fullName,
      email: data.email,
      department: data.department,
      designation: data.designation,
      joiningDate: toDateOnly(data.joiningDate),
      basicSalary: data.basicSalary,
      phone: data.phone || '',
      address: data.address || '',
      gender: data.gender || null,
      createdBy: actor._id,
    });
  } catch (err) {
    await User.deleteOne({ _id: user._id }); // rollback
    throw err;
  }

  if (audit) {
    await logAudit({
      actor,
      action: 'EMPLOYEE_CREATED',
      entity: 'Employee',
      entityId: employee._id,
      after: employee,
      req,
    });
  }

  return { employee, user, tempPassword };
}

// Import fail hone par ab tak bane records wapas hata deta hai
export async function rollbackCreated(created) {
  for (const { employee, user } of created) {
    await Employee.deleteOne({ _id: employee._id });
    await User.deleteOne({ _id: user._id });
  }
}
