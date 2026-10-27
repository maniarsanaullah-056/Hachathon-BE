import mongoose from 'mongoose';

const announcementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    content: { type: String, required: true, trim: true, maxlength: 5000 },
    priority: { type: String, enum: ['normal', 'urgent'], default: 'normal' },
    isActive: { type: Boolean, default: true, index: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

export default mongoose.model('Announcement', announcementSchema);
