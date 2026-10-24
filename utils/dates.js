const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Strict YYYY-MM-DD check (2026-02-30 jaisi date reject hoti hai)
export function isValidIsoDate(value) {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

// Date-only values UTC midnight par store hote hain, taake timezone se din na badle
export const toDateOnly = (value) => new Date(`${value}T00:00:00.000Z`);
export const formatDateOnly = (date) => (date ? new Date(date).toISOString().slice(0, 10) : '');
export const todayDateOnly = () => toDateOnly(new Date().toISOString().slice(0, 10));
