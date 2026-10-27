import mongoose from 'mongoose';

export const LEAVE_STATUSES = ['pending', 'approved', 'rejected', 'cancelled'];

const leaveApplicationSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    leaveType: { type: mongoose.Schema.Types.ObjectId, ref: 'LeaveType', required: true },
    startDate: { type: String, required: true }, // YYYY-MM-DD
    endDate: { type: String, required: true },   // YYYY-MM-DD
    daysCount: { type: Number, required: true, min: 1 },
    reason: { type: String, required: true, trim: true, maxlength: 500 },
    status: { type: String, enum: LEAVE_STATUSES, default: 'pending', index: true },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    reviewerComment: { type: String, default: '', trim: true, maxlength: 500 },
    dates: [{ type: String }], // List of actual working dates covered
  },
  { timestamps: true }
);

export default mongoose.model('LeaveApplication', leaveApplicationSchema);
