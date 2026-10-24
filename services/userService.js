import User from '../models/User.js';
import { generateTempPassword } from '../utils/password.js';
import { ROLES } from '../utils/constants.js';
import { logAudit } from './auditService.js';

// HR account (employee record ke baghair) banata hai
export async function createHrUser({ name, email }, actor, req) {
  const tempPassword = generateTempPassword();
  const user = await User.create({
    name,
    email,
    password: tempPassword,
    role: ROLES.HR, // role hamesha server decide karta hai
    company: actor.company,
    mustChangePassword: true,
  });

  await logAudit({
    actor,
    action: 'HR_USER_CREATED',
    entity: 'User',
    entityId: user._id,
    after: { name: user.name, email: user.email, role: user.role },
    req,
  });

  return { user, tempPassword };
}

// Naya temporary password; purane tokens bhi invalid ho jate hain
export async function resetUserPassword(user, actor, req) {
  const tempPassword = generateTempPassword();
  user.password = tempPassword;
  user.mustChangePassword = true;
  user.passwordChangedAt = new Date();
  await user.save();

  await logAudit({
    actor,
    action: 'PASSWORD_RESET',
    entity: 'User',
    entityId: user._id,
    after: { email: user.email, role: user.role },
    req,
  });

  return tempPassword;
}
