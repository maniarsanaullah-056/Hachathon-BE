import mongoose from 'mongoose';

export const ATTENDANCE_STATUSES = [
  'present',
  'late',
  'half_day',
  'absent',
  'missing_checkout',
  'on_leave',
];

export const ATTENDANCE_SOURCES = ['web', 'camera', 'correction'];

const attendanceSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    date: { type: String, required: true, index: true }, // Format: YYYY-MM-DD
    checkInTime: { type: Date, default: null },
    checkOutTime: { type: Date, default: null },
    status: {
      type: String,
      enum: ATTENDANCE_STATUSES,
      default: 'present',
      index: true,
    },
    source: {
      type: String,
      enum: ATTENDANCE_SOURCES,
      default: 'web',
    },
    workedHours: { type: Number, default: 0 },
    isLate: { type: Boolean, default: false },
    lateMinutes: { type: Number, default: 0 },
    location: {
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null },
      accuracy: { type: Number, default: null },
      distanceMeters: { type: Number, default: null },
    },
    faceVerified: { type: Boolean, default: false },
    remarks: { type: String, default: '' },
    approvedLeave: { type: mongoose.Schema.Types.ObjectId, ref: 'LeaveApplication', default: null },
  },
  { timestamps: true }
);

// Unique compound index: One attendance record per employee per day
attendanceSchema.index({ employee: 1, date: 1 }, { unique: true });

export default mongoose.model('Attendance', attendanceSchema);
