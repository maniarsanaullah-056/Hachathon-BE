import { body } from 'express-validator';
import { PASSWORD_REGEX, PASSWORD_RULE_MESSAGE } from '../utils/constants.js';

export const loginValidator = [
  body('email')
    .isString().withMessage('Email is required')
    .trim()
    .toLowerCase()
    .isEmail().withMessage('Enter a valid email address'),
  body('password')
    .isString().withMessage('Password is required')
    .isLength({ min: 1, max: 72 }).withMessage('Password is required'),
];

export const changePasswordValidator = [
  body('currentPassword').isString().withMessage('Current password is required'),
  body('newPassword')
    .isString().withMessage('New password is required')
    .matches(PASSWORD_REGEX).withMessage(PASSWORD_RULE_MESSAGE),
];
