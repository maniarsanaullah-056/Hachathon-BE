import { body, param } from 'express-validator';

export const createHrRules = [
  body('name').isString().trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
  body('email').isString().trim().toLowerCase().isEmail().withMessage('Enter a valid email address'),
];

export const userIdParam = [param('id').isMongoId().withMessage('Invalid id')];

export const userStatusRules = [
  body('isActive').isBoolean({ strict: true }).withMessage('isActive must be true or false'),
];
