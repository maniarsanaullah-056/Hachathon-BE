import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateAnnualTax, calculateMonthlyTax } from '../utils/taxCalculator.js';
import { calculateHaversineDistance, isWeekend } from '../services/dateHelperService.js';
import { isValidIsoDate, formatDateOnly } from '../utils/dates.js';
import { parseCsv, toCsv } from '../utils/csv.js';
import { PASSWORD_REGEX } from '../utils/constants.js';
import { generateTempPassword } from '../utils/password.js';

test('tax slabs include exact boundary values and expected payroll examples', () => {
  assert.equal(calculateAnnualTax(600_000), 0);
  assert.equal(calculateAnnualTax(1_200_000), 30_000);
  assert.equal(calculateAnnualTax(2_400_000), 210_000);
  assert.equal(calculateAnnualTax(3_600_000), 510_000);
  assert.equal(calculateAnnualTax(540_000), 0);
  assert.equal(calculateMonthlyTax(720_000), 500);
  assert.equal(calculateMonthlyTax(1_800_000), 10_000);
  assert.equal(calculateMonthlyTax(3_600_000), 42_500);
  assert.equal(calculateMonthlyTax(5_400_000), 95_000);
});

test('weekend, ISO date, and date formatting rules are deterministic', () => {
  assert.equal(isWeekend(new Date('2026-10-25T12:00:00Z'), [0, 6]), true);
  assert.equal(isWeekend(new Date('2026-10-26T12:00:00Z'), [0, 6]), false);
  assert.equal(isValidIsoDate('2026-02-28'), true);
  assert.equal(isValidIsoDate('2026-02-30'), false);
  assert.equal(isValidIsoDate('2026-2-03'), false);
  assert.equal(formatDateOnly(new Date('2026-10-27T23:30:00-07:00')), '2026-10-28');
});

test('Haversine distance is zero for the same point and about 111m per latitude millidegree', () => {
  assert.equal(calculateHaversineDistance(24.8607, 67.0011, 24.8607, 67.0011), 0);
  const distance = calculateHaversineDistance(24.8607, 67.0011, 24.8617, 67.0011);
  assert.ok(distance > 100 && distance < 120, `unexpected distance ${distance}`);
});

test('CSV parser and serializer preserve quoted commas, quotes, and formula safety', () => {
  const rows = parseCsv('name,note\r\n"Doe, Jane","said ""hello"""');
  assert.deepEqual(rows, [['name', 'note'], ['Doe, Jane', 'said "hello"']]);
  assert.match(toCsv(['value'], [{ value: '=1+1' }]), /'=1\+1/);
  assert.throws(() => parseCsv('a,"unterminated'), /unterminated/);
});

test('temporary passwords meet the documented bcrypt-safe policy', () => {
  for (let i = 0; i < 100; i += 1) {
    const password = generateTempPassword();
    assert.equal(PASSWORD_REGEX.test(password), true);
    assert.ok(password.length <= 72);
  }
  assert.equal(PASSWORD_REGEX.test('short'), false);
});
