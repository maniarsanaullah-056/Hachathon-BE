import mongoose from 'mongoose';

const designationSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
    description: { type: String, trim: true, maxlength: 300, default: '' },
  },
  { timestamps: true }
);

designationSchema.index({ title: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });

export default mongoose.model('Designation', designationSchema);
