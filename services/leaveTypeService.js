import LeaveType from '../models/LeaveType.js';

// Brief ke default quotas: annual 14, sick 8, casual 10, unpaid unlimited
export const DEFAULT_LEAVE_TYPES = [
  { name: 'Annual Leave', code: 'ANNUAL', yearlyQuota: 14, isUnlimited: false, isPaid: true },
  { name: 'Sick Leave', code: 'SICK', yearlyQuota: 8, isUnlimited: false, isPaid: true },
  { name: 'Casual Leave', code: 'CASUAL', yearlyQuota: 10, isUnlimited: false, isPaid: true },
  { name: 'Unpaid Leave', code: 'UNPAID', yearlyQuota: null, isUnlimited: true, isPaid: false },
];

// Sirf tab insert karta hai jab koi leave type maujood na ho
export async function ensureDefaultLeaveTypes() {
  if ((await LeaveType.countDocuments()) > 0) return { created: 0 };
  const created = await LeaveType.insertMany(DEFAULT_LEAVE_TYPES);
  return { created: created.length, items: created };
}
