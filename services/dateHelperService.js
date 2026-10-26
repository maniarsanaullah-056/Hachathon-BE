import Company from '../models/Company.js';
import Holiday from '../models/Holiday.js';
import { formatDateOnly } from '../utils/dates.js';

/**
 * Returns the company settings singleton
 */
export async function getCompanySettings() {
  let company = await Company.findOne({ singletonKey: 'main' });
  if (!company) {
    company = await Company.findOne();
  }
  return (
    company || {
      officeStartTime: '09:00',
      officeEndTime: '18:00',
      graceMinutes: 15,
      weekendDays: [0, 6],
      halfDayThresholdHours: 5,
      officeLocation: { latitude: null, longitude: null, radiusMeters: 150 },
      latePenaltyRule: { enabled: true, latesThreshold: 3, deductionDays: 0.5 },
    }
  );
}

/**
 * Checks if a specific date is a weekend according to company settings
 * @param {Date} date
 * @param {Array<number>} weekendDays
 */
export function isWeekend(date, weekendDays = [0, 6]) {
  const day = date.getDay(); // 0 is Sunday, 6 is Saturday
  return weekendDays.includes(day);
}

/**
 * Gets all holiday dates as YYYY-MM-DD strings for a given date range
 */
export async function getHolidayDatesSet(startDateStr, endDateStr) {
  const holidays = await Holiday.find({
    date: {
      $gte: new Date(startDateStr),
      $lte: new Date(endDateStr + 'T23:59:59.999Z'),
    },
  });

  const set = new Set();
  for (const h of holidays) {
    set.add(formatDateOnly(h.date));
  }
  return set;
}

/**
 * Returns list of working date strings (YYYY-MM-DD) between start and end (inclusive)
 */
export async function getWorkingDaysBetween(startDateStr, endDateStr) {
  const settings = await getCompanySettings();
  const weekendDays = settings.weekendDays || [0, 6];
  const holidaySet = await getHolidayDatesSet(startDateStr, endDateStr);

  const workingDays = [];
  const curr = new Date(startDateStr + 'T00:00:00');
  const end = new Date(endDateStr + 'T00:00:00');

  while (curr <= end) {
    const dateStr = formatDateOnly(curr);
    if (!isWeekend(curr, weekendDays) && !holidaySet.has(dateStr)) {
      workingDays.push(dateStr);
    }
    curr.setDate(curr.getDate() + 1);
  }

  return workingDays;
}

/**
 * Calculates Haversine distance in meters between two lat/lng coordinates
 */
export function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in metres
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}
