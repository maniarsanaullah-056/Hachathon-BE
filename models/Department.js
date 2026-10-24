import mongoose from 'mongoose';

const departmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    description: { type: String, trim: true, maxlength: 300, default: '' },
  },
  { timestamps: true }
);

// Case-insensitive unique: "HR" aur "hr" same maane jayenge
departmentSchema.index({ name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });

export default mongoose.model('Department', departmentSchema);
