import { body } from 'express-validator';
import { PASSWORD_REGEX, PASSWORD_RULE_MESSAGE } from '../utils/constants.js';

// Accept both the short field names and the names used by the initial setup form.
export function normalizeAdminRegistrationBody(req, _res, next) {
  const body = req.body || {};
  req.body = {
    ...body,
    name: body.name ?? body.adminName,
    email: body.email ?? body.adminEmail,
    password: body.password ?? body.adminPassword,
  };
  next();
}

export const createAdminValidator = [
  body('name')
    .isString().withMessage('Name is required')
    .trim()
    .isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
  body('email')
    .isString().withMessage('Email is required')
    .trim()
    .toLowerCase()
    .isEmail().withMessage('Enter a valid email address'),
  body('password')
    .isString().withMessage('Password is required')
    .matches(PASSWORD_REGEX).withMessage(PASSWORD_RULE_MESSAGE),
  body('companyName')
    .optional()
    .isString().withMessage('Company name must be text')
    .trim()
    .isLength({ min: 2, max: 120 }).withMessage('Company name must be 2-120 characters'),
];
