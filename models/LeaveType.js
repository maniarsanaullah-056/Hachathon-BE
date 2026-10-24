import mongoose from 'mongoose';

const leaveTypeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
    code: { type: String, required: true, trim: true, uppercase: true, match: /^[A-Z_]{2,12}$/ },
    yearlyQuota: { type: Number, min: 0, max: 365, default: null },
    isUnlimited: { type: Boolean, default: false },
    isPaid: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
    description: { type: String, trim: true, maxlength: 300, default: '' },
  },
  { timestamps: true }
);

leaveTypeSchema.index({ name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });
leaveTypeSchema.index({ code: 1 }, { unique: true });

// Unlimited ho to quota null; warna quota zaroori hai
leaveTypeSchema.pre('validate', function checkQuota(next) {
  if (this.isUnlimited) {
    this.yearlyQuota = null;
  } else if (this.yearlyQuota === null || this.yearlyQuota === undefined) {
    this.invalidate('yearlyQuota', 'Yearly quota is required unless the leave type is unlimited');
  }
  next();
});

export default mongoose.model('LeaveType', leaveTypeSchema);
