import Employee from '../models/Employee.js';
import Department from '../models/Department.js';
import Designation from '../models/Designation.js';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import { parseCsv } from '../utils/csv.js';
import { isValidIsoDate } from '../utils/dates.js';
import { GENDERS } from '../models/Employee.js';

export const MAX_IMPORT_ROWS = 50;

const COLUMNS = {
  employeecode: 'employeeCode',
  fullname: 'fullName',
  email: 'email',
  department: 'department',
  designation: 'designation',
  joiningdate: 'joiningDate',
  basicsalary: 'basicSalary',
  phone: 'phone',
  gender: 'gender',
  address: 'address',
};
const REQUIRED = ['employeeCode', 'fullName', 'email', 'department', 'designation', 'joiningDate', 'basicSalary'];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_RE = /^[A-Za-z0-9_-]{2,20}$/;
const PHONE_RE = /^[0-9+\-\s()]{7,20}$/;
const SALARY_RE = /^\d+(\.\d{1,2})?$/;

/**
 * CSV ko parse + validate karta hai (DB mein kuch likhe baghair).
 * Row number = CSV ka record number; header row 1 hai, pehla data row 2.
 * Har error: { row, field, reason }
 */
export async function analyzeCsv(csvText) {
  let table;
  try {
    table = parseCsv(csvText);
  } catch (err) {
    throw new ApiError(422, err.message);
  }
  if (table.length === 0) throw new ApiError(422, 'The CSV file is empty');

  const headerIndex = {};
  table[0].forEach((h, i) => {
    const key = COLUMNS[String(h).trim().toLowerCase()];
    if (key && headerIndex[key] === undefined) headerIndex[key] = i;
  });

  const errors = [];
  REQUIRED.forEach((col) => {
    if (headerIndex[col] === undefined) {
      errors.push({ row: 1, field: col, reason: 'Required column is missing from the header' });
    }
  });
  if (errors.length) return { totalRows: 0, validRows: 0, invalidRows: 0, errors, records: [] };

  const dataRows = table
    .map((cells, idx) => ({ row: idx + 1, cells }))
    .slice(1)
    .filter((r) => r.cells.some((c) => String(c).trim() !== ''));

  if (dataRows.length === 0) throw new ApiError(422, 'The CSV file has no data rows');
  if (dataRows.length > MAX_IMPORT_ROWS) {
    throw new ApiError(422, `A maximum of ${MAX_IMPORT_ROWS} rows can be imported at once`);
  }

  const get = (cells, key) =>
    headerIndex[key] === undefined ? '' : String(cells[headerIndex[key]] ?? '').trim();

  // Lookup data ek hi baar load hota hai
  const [departments, designations] = await Promise.all([
    Department.find().select('name'),
    Designation.find().select('title'),
  ]);
  const deptMap = new Map(departments.map((d) => [d.name.toLowerCase(), d._id]));
  const desigMap = new Map(designations.map((d) => [d.title.toLowerCase(), d._id]));

  const codes = dataRows.map((r) => get(r.cells, 'employeeCode').toUpperCase()).filter(Boolean);
  const emails = dataRows.map((r) => get(r.cells, 'email').toLowerCase()).filter(Boolean);
  const [existingEmployees, existingUsers] = await Promise.all([
    Employee.find({ $or: [{ employeeCode: { $in: codes } }, { email: { $in: emails } }] }).select(
      'employeeCode email'
    ),
    User.find({ email: { $in: emails } }).select('email'),
  ]);
  const takenCodes = new Set(existingEmployees.map((e) => e.employeeCode));
  const takenEmails = new Set([...existingEmployees.map((e) => e.email), ...existingUsers.map((u) => u.email)]);

  const seenCodes = new Map();
  const seenEmails = new Map();
  const records = [];

  for (const { row, cells } of dataRows) {
    const rowErrors = [];
    const fail = (field, reason) => rowErrors.push({ row, field, reason });

    const employeeCode = get(cells, 'employeeCode').toUpperCase();
    const fullName = get(cells, 'fullName');
    const email = get(cells, 'email').toLowerCase();
    const deptName = get(cells, 'department');
    const desigTitle = get(cells, 'designation');
    const joiningDate = get(cells, 'joiningDate');
    const salaryRaw = get(cells, 'basicSalary');
    const phone = get(cells, 'phone');
    const gender = get(cells, 'gender').toLowerCase();
    const address = get(cells, 'address');

    if (!employeeCode) fail('employeeCode', 'Employee code is required');
    else if (!CODE_RE.test(employeeCode)) fail('employeeCode', 'Use 2-20 letters, numbers, - or _');
    else if (takenCodes.has(employeeCode)) fail('employeeCode', 'Employee code already exists');
    else if (seenCodes.has(employeeCode)) fail('employeeCode', `Duplicate employee code (also on row ${seenCodes.get(employeeCode)})`);

    if (!fullName) fail('fullName', 'Full name is required');
    else if (fullName.length < 2 || fullName.length > 100) fail('fullName', 'Name must be 2-100 characters');

    if (!email) fail('email', 'Email is required');
    else if (!EMAIL_RE.test(email)) fail('email', 'Invalid email format');
    else if (takenEmails.has(email)) fail('email', 'Email already exists');
    else if (seenEmails.has(email)) fail('email', `Duplicate email (also on row ${seenEmails.get(email)})`);

    const departmentId = deptMap.get(deptName.toLowerCase());
    if (!deptName) fail('department', 'Department is required');
    else if (!departmentId) fail('department', `Unknown department "${deptName}"`);

    const designationId = desigMap.get(desigTitle.toLowerCase());
    if (!desigTitle) fail('designation', 'Designation is required');
    else if (!designationId) fail('designation', `Unknown designation "${desigTitle}"`);

    if (!joiningDate) fail('joiningDate', 'Joining date is required');
    else if (!isValidIsoDate(joiningDate)) fail('joiningDate', 'Use a valid ISO date (YYYY-MM-DD)');

    let basicSalary = null;
    if (!salaryRaw) fail('basicSalary', 'Basic salary is required');
    else if (!SALARY_RE.test(salaryRaw) || Number(salaryRaw) <= 0) fail('basicSalary', 'Salary must be a number greater than 0');
    else basicSalary = Number(salaryRaw);

    if (phone && !PHONE_RE.test(phone)) fail('phone', 'Invalid phone number');
    if (gender && !GENDERS.includes(gender)) fail('gender', `Gender must be one of: ${GENDERS.join(', ')}`);
    if (address.length > 300) fail('address', 'Address must be 300 characters or fewer');

    if (employeeCode && !seenCodes.has(employeeCode)) seenCodes.set(employeeCode, row);
    if (email && !seenEmails.has(email)) seenEmails.set(email, row);

    if (rowErrors.length) {
      errors.push(...rowErrors);
    } else {
      records.push({
        row,
        employeeCode,
        fullName,
        email,
        department: departmentId,
        designation: designationId,
        joiningDate,
        basicSalary,
        phone,
        gender: gender || null,
        address,
      });
    }
  }

  return {
    totalRows: dataRows.length,
    validRows: records.length,
    invalidRows: dataRows.length - records.length,
    errors,
    records,
  };
}
