import mongoose from 'mongoose';

export const EMPLOYMENT_STATUSES = ['active', 'inactive', 'terminated'];
export const GENDERS = ['male', 'female', 'other'];

const employeeSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    employeeCode: { type: String, required: true, unique: true, trim: true, uppercase: true },
    // fullName/email User ke saath sync rehte hain (update sirf service se hota hai)
    fullName: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true, index: true },
    designation: { type: mongoose.Schema.Types.ObjectId, ref: 'Designation', required: true, index: true },
    joiningDate: { type: Date, required: true },
    exitDate: { type: Date, default: null },
    employmentStatus: { type: String, enum: EMPLOYMENT_STATUSES, default: 'active', index: true },
    phone: { type: String, trim: true, maxlength: 20, default: '' },
    address: { type: String, trim: true, maxlength: 300, default: '' },
    gender: { type: String, enum: [...GENDERS, null], default: null },
    // Salary breakdown
    basicSalary: { type: Number, required: true, min: 0.01, select: false },
    hraAllowance: { type: Number, default: 0, select: false },
    medicalAllowance: { type: Number, default: 0, select: false },
    otherAllowance: { type: Number, default: 0, select: false },
    isCustomSalaryStructure: { type: Boolean, default: false, select: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Virtual for gross salary: Gross = basic + HRA + medical + other
employeeSchema.virtual('grossSalary').get(function () {
  const basic = this.basicSalary || 0;
  if (!this.isCustomSalaryStructure) {
    return basic * 1.5; // Default: basic + 40% HRA + 10% Medical = 1.5 * basic
  }
  return basic + (this.hraAllowance || 0) + (this.medicalAllowance || 0) + (this.otherAllowance || 0);
});

export default mongoose.model('Employee', employeeSchema);
