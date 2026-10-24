export const ROLES = Object.freeze({
  ADMIN: 'admin',
  HR: 'hr',
  EMPLOYEE: 'employee',
});

export const ROLE_LIST = Object.values(ROLES);

// Kam az kam 8 chars, 1 upper, 1 lower, 1 digit. 72 bcrypt ki limit hai.
export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,72}$/;
export const PASSWORD_RULE_MESSAGE =
  'Password must be 8-72 characters and include an uppercase letter, a lowercase letter and a number';
