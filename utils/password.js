import crypto from 'crypto';

// Confusing characters (0/O, 1/l/I) nikaal diye hain
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghijkmnpqrstuvwxyz';
const DIGIT = '23456789';
const SYMBOL = '@#$%&*!?';

const pickChar = (set) => set[crypto.randomInt(set.length)];

// Cryptographically secure temporary password (PASSWORD_REGEX ke mutabiq)
export function generateTempPassword(length = 12) {
  const chars = [pickChar(UPPER), pickChar(LOWER), pickChar(DIGIT), pickChar(SYMBOL)];
  const all = UPPER + LOWER + DIGIT + SYMBOL;
  while (chars.length < length) chars.push(pickChar(all));
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
