import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

// Token mein sirf user id hai. Role DB se load hota hai,
// taake token se role kabhi trust na ho.
export const signToken = (user) =>
  jwt.sign({ sub: user._id.toString() }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
    algorithm: 'HS256',
  });

export const verifyToken = (token) =>
  jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] });
