import AuditLog from '../models/AuditLog.js';
import { redact } from '../utils/redact.js';

export async function logAudit({ actor = null, action, entity, entityId = null, before = null, after = null, req = null }) {
  try {
    await AuditLog.create({
      actor: actor?._id || null,
      actorRole: actor?.role || 'system',
      action,
      entity,
      entityId,
      before: before ? redact(before) : null,
      after: after ? redact(after) : null,
      ip: req?.ip || null,
    });
  } catch (err) {
    // Audit failure se main operation nahi rukna chahiye, lekin console mein dikhe
    console.error('[AUDIT] Failed to write audit log:', err.message);
  }
}
