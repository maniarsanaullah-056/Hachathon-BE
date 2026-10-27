import mongoose from 'mongoose';

const aiLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    role: { type: String, required: true },
    prompt: { type: String, required: true },
    response: { type: String, required: true },
    tool: { type: String, default: null },
    latencyMs: { type: Number, default: 0 },
    status: { type: String, enum: ['success', 'error', 'fallback'], default: 'success' },
  },
  { timestamps: true }
);

export default mongoose.model('AiLog', aiLogSchema);
