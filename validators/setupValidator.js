import { body } from 'express-validator';
import { PASSWORD_REGEX, PASSWORD_RULE_MESSAGE } from '../utils/constants.js';

export const setupValidator = [
  body('companyName')
    .isString().withMessage('Company name is required')
    .trim()
    .isLength({ min: 2, max: 120 }).withMessage('Company name must be 2-120 characters'),
  body('adminName')
    .isString().withMessage('Admin name is required')
    .trim()
    .isLength({ min: 2, max: 100 }).withMessage('Admin name must be 2-100 characters'),
  body('adminEmail')
    .isString().withMessage('Admin email is required')
    .trim()
    .toLowerCase()
    .isEmail().withMessage('Enter a valid email address'),
  body('adminPassword')
    .isString().withMessage('Password is required')
    .matches(PASSWORD_REGEX).withMessage(PASSWORD_RULE_MESSAGE),
  body('setupKey').optional().isString().withMessage('Invalid setup key'),
];
