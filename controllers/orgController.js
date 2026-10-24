import Department from '../models/Department.js';
import Designation from '../models/Designation.js';
import LeaveType from '../models/LeaveType.js';
import Holiday from '../models/Holiday.js';
import Employee from '../models/Employee.js';
import asyncHandler from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { createCrudController } from '../utils/crudFactory.js';
import { toDateOnly } from '../utils/dates.js';
import { ensureDefaultLeaveTypes } from '../services/leaveTypeService.js';
import { logAudit } from '../services/auditService.js';

export const departments = createCrudController({
  Model: Department,
  entity: 'Department',
  fields: ['name', 'description'],
  sort: { name: 1 },
  inUse: async (item) => {
    if (await Employee.exists({ department: item._id })) return 'Department has employees assigned and cannot be deleted';
    if (await Designation.exists({ department: item._id })) return 'Department has designations linked to it. Remove or move them first';
    return null;
  },
});

export const designations = createCrudController({
  Model: Designation,
  entity: 'Designation',
  fields: ['title', 'department', 'description'],
  sort: { title: 1 },
  populate: { path: 'department', select: 'name' },
  transform: (body) => ({ ...body, ...(body.department === '' ? { department: null } : {}) }),
  inUse: async (item) =>
    (await Employee.exists({ designation: item._id })) ? 'Designation has employees assigned and cannot be deleted' : null,
});

export const leaveTypes = createCrudController({
  Model: LeaveType,
  entity: 'Leave type',
  fields: ['name', 'code', 'yearlyQuota', 'isUnlimited', 'isPaid', 'isActive', 'description'],
  sort: { name: 1 },
  // Phase 4 mein yahan "leave requests mein use ho raha hai" check add hoga
});

export const holidays = createCrudController({
  Model: Holiday,
  entity: 'Holiday',
  fields: ['name', 'date'],
  sort: { date: 1 },
  transform: (body) => (body.date ? { ...body, date: toDateOnly(body.date) } : body),
  filterFromQuery: (query) => {
    const year = parseInt(query.year, 10);
    if (!year) return {};
    return { date: { $gte: new Date(Date.UTC(year, 0, 1)), $lt: new Date(Date.UTC(year + 1, 0, 1)) } };
  },
});

// Admin ek click se default leave types (14/8/10/unlimited) load kar sakta hai
export const loadDefaultLeaveTypes = asyncHandler(async (req, res) => {
  const result = await ensureDefaultLeaveTypes();
  if (result.created > 0) {
    await logAudit({ actor: req.user, action: 'LEAVE_TYPES_DEFAULTS_LOADED', entity: 'Leave type', after: { created: result.created }, req });
  }
  sendSuccess(
    res,
    { created: result.created },
    result.created ? 'Default leave types created' : 'Leave types already exist, nothing was added',
    result.created ? 201 : 200
  );
});
