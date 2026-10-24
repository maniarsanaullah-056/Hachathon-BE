import Company from '../models/Company.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { pick } from '../utils/pick.js';
import { logAudit } from '../services/auditService.js';

const SETTINGS_FIELDS = [
  'name',
  'timezone',
  'officeStartTime',
  'officeEndTime',
  'graceMinutes',
  'halfDayThresholdHours',
  'weekendDays',
];

async function loadCompany() {
  const company = await Company.findOne();
  if (!company) throw new ApiError(404, 'Company has not been set up yet');
  return company;
}

export const getCompany = asyncHandler(async (_req, res) => {
  sendSuccess(res, { company: await loadCompany() });
});

export const updateCompany = asyncHandler(async (req, res) => {
  const company = await loadCompany();
  const before = company.toObject();

  const start = req.body.officeStartTime ?? company.officeStartTime;
  const end = req.body.officeEndTime ?? company.officeEndTime;
  if (end <= start) {
    throw new ApiError(422, 'Validation failed', {
      errors: [{ field: 'officeEndTime', message: 'Office end time must be after the start time' }],
    });
  }

  company.set(pick(req.body, SETTINGS_FIELDS));

  const loc = req.body.officeLocation;
  if (loc) {
    ['latitude', 'longitude', 'radiusMeters'].forEach((key) => {
      if (loc[key] !== undefined) company.set(`officeLocation.${key}`, loc[key]);
    });
  }

  await company.save();
  await logAudit({ actor: req.user, action: 'COMPANY_UPDATED', entity: 'Company', entityId: company._id, before, after: company, req });
  sendSuccess(res, { company }, 'Company settings updated');
});

export const updatePolicies = asyncHandler(async (req, res) => {
  const company = await loadCompany();
  const before = { policies: company.policies.toObject() };

  company.policies = req.body.policies.map(({ title, content }) => ({ title, content }));
  await company.save();

  await logAudit({ actor: req.user, action: 'COMPANY_POLICIES_UPDATED', entity: 'Company', entityId: company._id, before, after: { policies: company.policies.toObject() }, req });
  sendSuccess(res, { company }, 'Policies updated');
});
