import { body } from 'express-validator';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export const updateCompanyRules = [
  body('name').optional().isString().trim().isLength({ min: 2, max: 120 }).withMessage('Name must be 2-120 characters'),
  body('timezone')
    .optional()
    .isString()
    .custom((value) => {
      try {
        new Intl.DateTimeFormat('en-US', { timeZone: value });
        return true;
      } catch {
        throw new Error('Invalid IANA timezone, e.g. Asia/Karachi');
      }
    }),
  body('officeStartTime').optional().matches(TIME_RE).withMessage('Use HH:mm format'),
  body('officeEndTime').optional().matches(TIME_RE).withMessage('Use HH:mm format'),
  body('graceMinutes').optional().isInt({ min: 0, max: 120 }).withMessage('Grace period must be 0-120 minutes').toInt(),
  body('halfDayThresholdHours').optional().isFloat({ min: 0, max: 12 }).withMessage('Must be between 0 and 12').toFloat(),
  body('weekendDays')
    .optional()
    .isArray({ max: 7 }).withMessage('weekendDays must be an array')
    .custom((arr) => arr.every((d) => Number.isInteger(d) && d >= 0 && d <= 6) && new Set(arr).size === arr.length)
    .withMessage('weekendDays must contain unique numbers 0 (Sunday) to 6 (Saturday)'),
  body('officeLocation').optional().isObject().withMessage('officeLocation must be an object'),
  body('officeLocation.latitude').optional({ values: 'null' }).isFloat({ min: -90, max: 90 }).withMessage('Latitude must be -90 to 90').toFloat(),
  body('officeLocation.longitude').optional({ values: 'null' }).isFloat({ min: -180, max: 180 }).withMessage('Longitude must be -180 to 180').toFloat(),
  body('officeLocation.radiusMeters').optional({ values: 'null' }).isFloat({ min: 10, max: 5000 }).withMessage('Radius must be 10-5000 meters').toFloat(),
];

export const policiesRules = [
  body('policies').isArray({ max: 50 }).withMessage('policies must be an array (max 50)'),
  body('policies.*.title').isString().trim().isLength({ min: 2, max: 150 }).withMessage('Policy title must be 2-150 characters'),
  body('policies.*.content').isString().trim().isLength({ min: 2, max: 5000 }).withMessage('Policy content must be 2-5000 characters'),
];
