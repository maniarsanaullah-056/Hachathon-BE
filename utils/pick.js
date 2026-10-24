// Sirf whitelist wali fields uthata hai (mass assignment se bachao)
export const pick = (obj = {}, keys = []) =>
  Object.fromEntries(keys.filter((k) => obj[k] !== undefined).map((k) => [k, obj[k]]));
