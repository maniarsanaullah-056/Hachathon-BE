import mongoose from 'mongoose';

export const CORRECTION_STATUSES = ['pending', 'approved', 'rejected'];

const attendanceCorrectionSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    attendance: { type: mongoose.Schema.Types.ObjectId, ref: 'Attendance', default: null },
    date: { type: String, required: true }, // YYYY-MM-DD
    proposedCheckIn: { type: Date, default: null },
    proposedCheckOut: { type: Date, default: null },
    reason: { type: String, required: true, trim: true, maxlength: 500 },
    status: { type: String, enum: CORRECTION_STATUSES, default: 'pending', index: true },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    reviewerComment: { type: String, default: '', trim: true, maxlength: 500 },
  },
  { timestamps: true }
);

export default mongoose.model('AttendanceCorrection', attendanceCorrectionSchema);
