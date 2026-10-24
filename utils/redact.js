const SENSITIVE_KEY = /password|token|secret|authorization|api[-_]?key|setupkey/i;

// Audit log mein jane se pehle sensitive fields chhupa deta hai
export function redact(value) {
  if (Array.isArray(value)) return value.map(redact);

  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const plain = typeof value.toObject === 'function' ? value.toObject() : value;
    return Object.fromEntries(
      Object.entries(plain).map(([key, val]) =>
        SENSITIVE_KEY.test(key) ? [key, '[REDACTED]'] : [key, redact(val)]
      )
    );
  }

  return value;
}
