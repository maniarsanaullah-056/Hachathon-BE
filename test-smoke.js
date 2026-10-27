import { calculateAnnualTax, calculateMonthlyTax } from './utils/taxCalculator.js';
import { calculateHaversineDistance, isWeekend } from './services/dateHelperService.js';
import { parseSmartLeave } from './services/aiService.js';
import { parseCsv } from './utils/csv.js';
import assert from 'assert';

console.log('🧪 Starting HCM Lite Backend Logic Smoke Tests...\n');

// 1. Tax Calculation Verification
console.log('Test 1: Tax Slabs & Calculation');
assert.strictEqual(calculateAnnualTax(500000), 0, '0-600k must be 0 tax');
assert.strictEqual(calculateAnnualTax(600000), 0, '600k must be 0 tax');
assert.strictEqual(calculateAnnualTax(800000), (800000 - 600000) * 0.05, '600k-1.2M 5% excess');
assert.strictEqual(calculateAnnualTax(1500000), 75000, '1.5M tax must be 75k');
assert.strictEqual(calculateMonthlyTax(1500000), Math.round((75000 / 12) * 100) / 100, 'Monthly tax match');
console.log('  ✅ Tax slabs and monthly tax calculation passed.');

// 2. Haversine Distance
console.log('Test 2: Haversine Geolocation Distance');
const d = calculateHaversineDistance(24.8607, 67.0011, 24.8607, 67.0011);
assert.strictEqual(d, 0, 'Same point distance must be 0');
const dOff = calculateHaversineDistance(24.8607, 67.0011, 24.8617, 67.0011);
assert(dOff > 100 && dOff < 120, '100m shift calculated accurately');
console.log('  ✅ Haversine distance formula verified.');

// 3. Weekend Check
console.log('Test 3: Weekend logic');
const sunday = new Date('2026-10-25T12:00:00');
const monday = new Date('2026-10-26T12:00:00');
assert.strictEqual(isWeekend(sunday, [0, 6]), true, 'Sunday is weekend');
assert.strictEqual(isWeekend(monday, [0, 6]), false, 'Monday is working day');
console.log('  ✅ Weekend check passed.');

// 4. Smart Leave Parser
console.log('Test 4: AI Smart Leave natural language extraction');
const parsed = await parseSmartLeave('Need sick leave tomorrow due to fever');
assert.strictEqual(parsed.type, 'sick', 'Detects sick leave');
assert(parsed.start.length === 10, 'Valid start date YYYY-MM-DD');
const parsedCasual = await parseSmartLeave('Sister wedding next Monday and Tuesday');
assert.strictEqual(parsedCasual.type, 'casual', 'Detects casual leave');
console.log('  ✅ Smart leave natural language parser passed.');

// 5. CSV Parsing
console.log('Test 5: CSV Parsing utility');
const rawCsv = 'employeeCode,fullName,email\nEMP001,John Doe,john@example.com';
const rows = parseCsv(rawCsv);
assert.strictEqual(rows.length, 2, 'Parses header and 1 data row');
assert.deepStrictEqual(rows[0], ['employeeCode', 'fullName', 'email'], 'Header matches');
assert.deepStrictEqual(rows[1], ['EMP001', 'John Doe', 'john@example.com'], 'Row matches');
console.log('  ✅ CSV parsing utility verified.');

console.log('\n🎉 ALL LOGIC AND MATH SMOKE TESTS PASSED SUCCESSFULLY!\n');
