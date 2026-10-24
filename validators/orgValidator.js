import { body, param } from 'express-validator';
import { isValidIsoDate } from '../utils/dates.js';

export const idParam = [param('id').isMongoId().withMessage('Invalid id')];

// partial = update (PATCH): fields optional
const f = (name, partial) => (partial ? body(name).optional() : body(name));
const optionalText = (name, max) =>
  body(name).optional({ values: 'falsy' }).isString().trim().isLength({ max }).withMessage(`${name} must be at most ${max} characters`);

export const departmentRules = (partial = false) => [
  f('name', partial).isString().trim().isLength({ min: 2, max: 80 }).withMessage('Name must be 2-80 characters'),
  optionalText('description', 300),
];

export const designationRules = (partial = false) => [
  f('title', partial).isString().trim().isLength({ min: 2, max: 80 }).withMessage('Title must be 2-80 characters'),
  body('department').optional({ values: 'falsy' }).isMongoId().withMessage('Invalid department'),
  optionalText('description', 300),
];

export const leaveTypeRules = (partial = false) => [
  f('name', partial).isString().trim().isLength({ min: 2, max: 60 }).withMessage('Name must be 2-60 characters'),
  f('code', partial).isString().trim().matches(/^[A-Za-z_]{2,12}$/).withMessage('Code must be 2-12 letters or _'),
  body('yearlyQuota').optional({ values: 'null' }).isFloat({ min: 0, max: 365 }).withMessage('Quota must be 0-365').toFloat(),
  body('isUnlimited').optional().isBoolean().withMessage('isUnlimited must be true/false').toBoolean(),
  body('isPaid').optional().isBoolean().withMessage('isPaid must be true/false').toBoolean(),
  body('isActive').optional().isBoolean().withMessage('isActive must be true/false').toBoolean(),
  optionalText('description', 300),
];

export const holidayRules = (partial = false) => [
  f('name', partial).isString().trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
  f('date', partial).custom(isValidIsoDate).withMessage('Date must be a valid ISO date (YYYY-MM-DD)'),
];
