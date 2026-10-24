import mongoose from 'mongoose';

const holidaySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    date: { type: Date, required: true, unique: true }, // UTC midnight
  },
  { timestamps: true }
);

export default mongoose.model('Holiday', holidaySchema);
