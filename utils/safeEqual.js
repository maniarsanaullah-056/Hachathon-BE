import crypto from 'crypto';

// Timing attack se bachne ke liye constant-time comparison
export function safeEqual(a = '', b = '') {
  const hashA = crypto.createHash('sha256').update(String(a)).digest();
  const hashB = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}
