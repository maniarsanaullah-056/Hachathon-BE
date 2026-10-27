import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import { sendSuccess } from '../utils/apiResponse.js';
import Company from '../models/Company.js';
import { logAudit } from '../services/auditService.js';
import { pick } from '../utils/pick.js';

const SETTINGS_FIELDS = [
  'name',
  'timezone',
  'currency',
  'officeStartTime',
  'officeEndTime',
  'graceMinutes',
  'weekendDays',
  'halfDayThresholdHours',
  'officeLocation',
  'latePenaltyRule',
  'policies',
];

export const getSettings = asyncHandler(async (_req, res) => {
  let company = await Company.findOne({ singletonKey: 'main' });
  if (!company) {
    company = await Company.findOne();
  }
  if (!company) {
    throw new ApiError(404, 'Settings not configured yet. Complete first-run setup.');
  }
  sendSuccess(res, company);
});

export const updateSettings = asyncHandler(async (req, res) => {
  let company = await Company.findOne({ singletonKey: 'main' });
  if (!company) company = await Company.findOne();
  if (!company) throw new ApiError(404, 'Settings not configured yet');

  const before = company.toObject();
  const updates = pick(req.body, SETTINGS_FIELDS);

  // Partial updates merge
  if (updates.officeLocation) {
    updates.officeLocation = { ...company.officeLocation.toObject(), ...updates.officeLocation };
  }
  if (updates.latePenaltyRule) {
    updates.latePenaltyRule = { ...company.latePenaltyRule?.toObject(), ...updates.latePenaltyRule };
  }

  company.set(updates);
  await company.save();

  await logAudit({
    actor: req.user,
    action: 'SETTINGS_UPDATED',
    entity: 'Company',
    entityId: company._id,
    before,
    after: company,
    req,
  });

  sendSuccess(res, company, 'Settings updated successfully');
});
