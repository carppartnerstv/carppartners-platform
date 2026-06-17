// =====================================================================
// Emisión y verificación de JWT.  (Briefing 4.2)
//  - access token: 24h, lleva { sub, role }
//  - refresh token: 30d, lleva { sub, jti } y se valida también contra Redis
// =====================================================================
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

export function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, type: 'access' },
    config.jwt.accessSecret,
    { expiresIn: config.jwt.accessTtl },
  );
}

/**
 * Devuelve { token, jti }. El jti se guarda en Redis para poder revocar.
 */
export function signRefreshToken(user) {
  const jti = crypto.randomUUID();
  const token = jwt.sign(
    { sub: user.id, jti, type: 'refresh' },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshTtl },
  );
  return { token, jti };
}

export function verifyAccessToken(token) {
  const payload = jwt.verify(token, config.jwt.accessSecret);
  if (payload.type !== 'access') throw new Error('Tipo de token inválido');
  return payload;
}

export function verifyRefreshToken(token) {
  const payload = jwt.verify(token, config.jwt.refreshSecret);
  if (payload.type !== 'refresh') throw new Error('Tipo de token inválido');
  return payload;
}
