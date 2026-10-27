import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    message: { type: String, required: true, trim: true, maxlength: 1000 },
    type: {
      type: String,
      enum: ['leave', 'correction', 'payroll', 'announcement', 'general'],
      default: 'general',
      index: true,
    },
    referenceId: { type: String, default: null },
    isRead: { type: Boolean, default: false, index: true },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.model('Notification', notificationSchema);
