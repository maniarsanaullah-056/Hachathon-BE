import mongoose from 'mongoose';

const policySchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 150 },
  content: { type: String, required: true, trim: true, maxlength: 5000 },
});

const companySchema = new mongoose.Schema(
  {
    // Sirf ek hi company ho sakti hai: yeh unique key race condition rokti hai
    singletonKey: { type: String, default: 'main', unique: true, immutable: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },

    timezone: { type: String, default: 'Asia/Karachi' },
    currency: { type: String, default: 'PKR' },
    officeStartTime: { type: String, default: '09:00' },
    officeEndTime: { type: String, default: '18:00' },
    graceMinutes: { type: Number, default: 15, min: 0, max: 120 },
    weekendDays: { type: [Number], default: [0, 6] }, // 0 = Sunday, 6 = Saturday
    halfDayThresholdHours: { type: Number, default: 5, min: 0, max: 12 },

    // Geolocation settings for attendance
    officeLocation: {
      latitude: { type: Number, min: -90, max: 90, default: null },
      longitude: { type: Number, min: -180, max: 180, default: null },
      radiusMeters: { type: Number, min: 10, max: 5000, default: 150 },
    },

    // Bonus late penalty setting: e.g. 3 lates = 0.5 day deduction
    latePenaltyRule: {
      enabled: { type: Boolean, default: true },
      latesThreshold: { type: Number, default: 3 },
      deductionDays: { type: Number, default: 0.5 },
    },

    policies: { type: [policySchema], default: [] },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export default mongoose.model('Company', companySchema);
