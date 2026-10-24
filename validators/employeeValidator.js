import { body, param, query } from 'express-validator';
import { isValidIsoDate } from '../utils/dates.js';
import { EMPLOYMENT_STATUSES, GENDERS } from '../models/Employee.js';

const PHONE_RE = /^[0-9+\-\s()]{7,20}$/;
const CODE_RE = /^[A-Za-z0-9_-]{2,20}$/;

export const employeeIdParam = [param('id').isMongoId().withMessage('Invalid id')];

const f = (name, partial) => (partial ? body(name).optional() : body(name));

export const employeeBodyRules = (partial = false) => [
  f('fullName', partial).isString().trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
  f('email', partial).isString().trim().toLowerCase().isEmail().withMessage('Enter a valid email address'),
  body('employeeCode').optional({ values: 'falsy' }).isString().trim().matches(CODE_RE).withMessage('Use 2-20 letters, numbers, - or _'),
  f('department', partial).isMongoId().withMessage('Select a valid department'),
  f('designation', partial).isMongoId().withMessage('Select a valid designation'),
  f('joiningDate', partial).custom(isValidIsoDate).withMessage('Joining date must be a valid ISO date (YYYY-MM-DD)'),
  f('basicSalary', partial).isFloat({ gt: 0 }).withMessage('Basic salary must be greater than 0').toFloat(),
  body('phone').optional({ values: 'falsy' }).matches(PHONE_RE).withMessage('Invalid phone number'),
  body('address').optional({ values: 'falsy' }).isString().trim().isLength({ max: 300 }).withMessage('Address must be 300 characters or fewer'),
  body('gender').optional({ values: 'falsy' }).isIn(GENDERS).withMessage(`Gender must be one of: ${GENDERS.join(', ')}`),
];

export const selfUpdateRules = [
  body('phone').optional({ values: 'falsy' }).matches(PHONE_RE).withMessage('Invalid phone number'),
  body('address').optional({ values: 'falsy' }).isString().trim().isLength({ max: 300 }).withMessage('Address must be 300 characters or fewer'),
];

export const statusRules = [
  body('status').isIn(EMPLOYMENT_STATUSES).withMessage(`Status must be one of: ${EMPLOYMENT_STATUSES.join(', ')}`),
  body('exitDate').optional({ values: 'falsy' }).custom(isValidIsoDate).withMessage('Exit date must be a valid ISO date'),
];

export const listQueryRules = [
  query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be 1-100'),
  query('department').optional({ values: 'falsy' }).isMongoId().withMessage('Invalid department filter'),
  query('designation').optional({ values: 'falsy' }).isMongoId().withMessage('Invalid designation filter'),
  query('status').optional({ values: 'falsy' }).isIn(EMPLOYMENT_STATUSES).withMessage('Invalid status filter'),
  query('sortBy').optional({ values: 'falsy' }).isIn(['fullName', 'employeeCode', 'joiningDate', 'createdAt']).withMessage('Invalid sort field'),
  query('order').optional({ values: 'falsy' }).isIn(['asc', 'desc']).withMessage('order must be asc or desc'),
  query('q').optional().isString().isLength({ max: 100 }).withMessage('Search text is too long'),
];

export const importRules = [
  body('csv').isString().withMessage('csv text is required').isLength({ min: 1, max: 90000 }).withMessage('CSV is empty or too large'),
];
