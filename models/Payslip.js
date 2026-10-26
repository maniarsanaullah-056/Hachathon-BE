import mongoose from 'mongoose';

const payslipSchema = new mongoose.Schema(
  {
    payrollRun: { type: mongoose.Schema.Types.ObjectId, ref: 'PayrollRun', required: true, index: true },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    month: { type: String, required: true }, // YYYY-MM
    employeeCode: { type: String, required: true },
    employeeName: { type: String, required: true },
    departmentName: { type: String, default: '' },
    designationTitle: { type: String, default: '' },

    // Calculations & breakdown
    workingDaysInMonth: { type: Number, required: true },
    daysWorked: { type: Number, required: true },
    absentDays: { type: Number, default: 0 },
    unpaidLeaveDays: { type: Number, default: 0 },
    halfDays: { type: Number, default: 0 },
    lateCount: { type: Number, default: 0 },

    basicSalary: { type: Number, required: true },
    hra: { type: Number, default: 0 },
    medical: { type: Number, default: 0 },
    otherAllowances: { type: Number, default: 0 },
    grossSalary: { type: Number, required: true },

    perDayRate: { type: Number, required: true },
    proratedGross: { type: Number, required: true },
    attendanceDeduction: { type: Number, default: 0 },
    latePenaltyDeduction: { type: Number, default: 0 },
    totalDeductions: { type: Number, default: 0 },

    taxableGrossAnnual: { type: Number, default: 0 },
    annualTax: { type: Number, default: 0 },
    monthlyTax: { type: Number, default: 0 },

    netSalary: { type: Number, required: true },
    status: { type: String, enum: ['draft', 'finalized'], default: 'draft', index: true },
  },
  { timestamps: true }
);

payslipSchema.index({ payrollRun: 1, employee: 1 }, { unique: true });

export default mongoose.model('Payslip', payslipSchema);
