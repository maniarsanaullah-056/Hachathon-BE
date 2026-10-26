import mongoose from 'mongoose';

export const PAYROLL_STATUSES = ['draft', 'finalized'];

const payrollRunSchema = new mongoose.Schema(
  {
    month: { type: String, required: true, unique: true }, // Format: YYYY-MM
    year: { type: Number, required: true },
    monthNumber: { type: Number, required: true }, // 1 to 12
    workingDays: { type: Number, required: true },
    totalEmployees: { type: Number, default: 0 },
    totalGross: { type: Number, default: 0 },
    totalDeductions: { type: Number, default: 0 },
    totalTax: { type: Number, default: 0 },
    totalNet: { type: Number, default: 0 },
    status: { type: String, enum: PAYROLL_STATUSES, default: 'draft', index: true },
    finalizedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    finalizedAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

export default mongoose.model('PayrollRun', payrollRunSchema);
