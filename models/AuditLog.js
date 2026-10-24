import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    actorRole: { type: String, default: 'system' },
    action: { type: String, required: true, index: true },
    entity: { type: String, required: true },
    entityId: { type: mongoose.Schema.Types.ObjectId, default: null },
    before: { type: mongoose.Schema.Types.Mixed, default: null },
    after: { type: mongoose.Schema.Types.Mixed, default: null },
    ip: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Audit log immutable hai: update/delete operations block hain
const blocked = [
  'updateOne',
  'updateMany',
  'findOneAndUpdate',
  'findOneAndReplace',
  'replaceOne',
  'deleteOne',
  'deleteMany',
  'findOneAndDelete',
];

blocked.forEach((op) => {
  auditLogSchema.pre(op, function blockMutation() {
    throw new Error('Audit logs are immutable');
  });
});

auditLogSchema.pre('save', function blockResave(next) {
  if (!this.isNew) return next(new Error('Audit logs are immutable'));
  next();
});

export default mongoose.model('AuditLog', auditLogSchema);
