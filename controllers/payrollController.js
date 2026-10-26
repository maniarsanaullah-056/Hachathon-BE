import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import { sendSuccess } from '../utils/apiResponse.js';
import PayrollRun from '../models/PayrollRun.js';
import Payslip from '../models/Payslip.js';
import Employee from '../models/Employee.js';
import Company from '../models/Company.js';
import { computePayrollForMonth, finalizePayrollRun } from '../services/payrollService.js';
import { generatePayslipPdfBuffer } from '../services/pdfService.js';
import { ROLES } from '../utils/constants.js';

export const createPayrollRun = asyncHandler(async (req, res) => {
  const { month } = req.body;
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    throw new ApiError(400, 'Valid month (YYYY-MM) is required');
  }

  const existing = await PayrollRun.findOne({ month });
  if (existing) {
    throw new ApiError(409, `Payroll run for ${month} already exists. You can recompute if it is in draft.`);
  }

  const run = await computePayrollForMonth(month, req.user);
  sendSuccess(res, run, 'Payroll draft created successfully', 201);
});

export const listPayrollRuns = asyncHandler(async (_req, res) => {
  const runs = await PayrollRun.find()
    .sort({ month: -1 })
    .populate('createdBy', 'name email')
    .populate('finalizedBy', 'name email');
  sendSuccess(res, runs);
});

export const getPayrollRun = asyncHandler(async (req, res) => {
  const run = await PayrollRun.findById(req.params.id)
    .populate('createdBy', 'name email')
    .populate('finalizedBy', 'name email');
  if (!run) throw new ApiError(404, 'Payroll run not found');

  const payslips = await Payslip.find({ payrollRun: run._id }).sort({ employeeCode: 1 });
  sendSuccess(res, { run, payslips });
});

export const recomputePayrollRun = asyncHandler(async (req, res) => {
  const run = await PayrollRun.findById(req.params.id);
  if (!run) throw new ApiError(404, 'Payroll run not found');

  if (run.status === 'finalized') {
    throw new ApiError(409, 'Cannot recompute a finalized and locked payroll run');
  }

  const updated = await computePayrollForMonth(run.month, req.user, run);
  sendSuccess(res, updated, 'Payroll draft recomputed successfully');
});

export const finalizePayroll = asyncHandler(async (req, res) => {
  const finalized = await finalizePayrollRun(req.params.id, req.user, req);
  sendSuccess(res, finalized, 'Payroll run finalized and locked successfully');
});

export const listPayslips = asyncHandler(async (req, res) => {
  let filter = {};

  if (req.user.role === ROLES.EMPLOYEE) {
    const employee = await Employee.findOne({ user: req.user._id });
    if (!employee) return sendSuccess(res, []);
    filter.employee = employee._id;
    filter.status = 'finalized'; // Employees only see finalized payslips
  } else {
    if (req.query.runId) filter.payrollRun = req.query.runId;
    if (req.query.employeeId) filter.employee = req.query.employeeId;
    if (req.query.month) filter.month = req.query.month;
  }

  const payslips = await Payslip.find(filter).sort({ month: -1 });
  sendSuccess(res, payslips);
});

export const downloadPayslipPdf = asyncHandler(async (req, res) => {
  const payslip = await Payslip.findById(req.params.id);
  if (!payslip) throw new ApiError(404, 'Payslip not found');

  // Employee guard: only own payslip
  if (req.user.role === ROLES.EMPLOYEE) {
    const employee = await Employee.findOne({ user: req.user._id });
    if (!employee || String(payslip.employee) !== String(employee._id)) {
      throw new ApiError(403, 'You can only download your own payslip');
    }
  }

  const company = (await Company.findOne()) || { name: 'HCM Lite' };
  const pdfBuffer = await generatePayslipPdfBuffer(payslip, company);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="payslip-${payslip.employeeCode}-${payslip.month}.pdf"`
  );
  res.send(pdfBuffer);
});
