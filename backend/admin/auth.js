import { createHash, createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { HttpError, assert } from './validation.js';
const scrypt = promisify(scryptCallback);
const COOKIE = 'parking_admin';
const TTL_SECONDS = 8 * 60 * 60;
export async function hashPassword(password) {
  assert(typeof password === 'string' && password.length >= 12 && password.length <= 256, 'Passwords must contain 12–256 characters.');
  const salt = randomBytes(16).toString('hex');
  const hash = await scrypt(password, salt, 64);
  return `scrypt:${salt}:${hash.toString('hex')}`;
}
export async function verifyPassword(password, stored) {
  if (typeof password !== 'string' || password.length > 256) return false;
  const [algorithm, salt, hex] = typeof stored === 'string' ? stored.split(':') : [];
  const valid = algorithm === 'scrypt' && /^[a-f0-9]{32}$/.test(salt || '') && /^[a-f0-9]{128}$/.test(hex || '');
  const result = await scrypt(password, valid ? salt : '00000000000000000000000000000000', 64);
  return valid && timingSafeEqual(result, Buffer.from(hex, 'hex'));
}
const version = user => createHash('sha256').update(user.passwordHash || '').digest('hex').slice(0, 24);
export function signSession(user, secret, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ id: user.id, exp: Math.floor(now / 1000) + TTL_SECONDS, version: version(user) })).toString('base64url');
  return `${payload}.${createHmac('sha256', secret).update(payload).digest('base64url')}`;
}
export function readSession(token, secret, now = Date.now()) {
  if (!token || token.length > 1024) return null;
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra) return null;
  const expected = createHmac('sha256', secret).update(payload).digest();
  const provided = Buffer.from(signature, 'base64url');
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return Number.isSafeInteger(decoded.id) && decoded.id > 0 && decoded.exp > Math.floor(now / 1000) && typeof decoded.version === 'string' ? decoded : null;
  } catch { return null; }
}
export const publicIdentity = user => ({ id: user.id, name: user.name, email: user.email, platformRole: user.platformRole });
export function createAuth(prisma, { secret = process.env.ADMIN_SESSION_SECRET, secure = process.env.NODE_ENV === 'production' } = {}) {
  const attempts = new Map();
  const ready = () => assert(typeof secret === 'string' && secret.length >= 32, 'Admin authentication is not configured. Set ADMIN_SESSION_SECRET to at least 32 random characters.', 503);
  const cookieOptions = { httpOnly: true, secure, sameSite: 'lax', path: '/api/admin' };
  return {
    async login(req, res) {
      ready();
      const key = req.ip;
      const now = Date.now();
      for (const [ip, attempt] of attempts) if (attempt.until <= now) attempts.delete(ip);
      const entry = attempts.get(key) || { count: 0, until: now + 15 * 60 * 1000 };
      assert(entry.count < 10, 'Too many sign-in attempts. Try again in 15 minutes.', 429);
      if (attempts.size >= 10000 && !attempts.has(key)) throw new HttpError(429, 'Sign-in is busy. Try again later.');
      entry.count++; attempts.set(key, entry);
      const { email, password } = req.body || {};
      assert(typeof email === 'string' && email.length <= 191 && typeof password === 'string' && password.length <= 256, 'Email and password are required.');
      const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
      const valid = await verifyPassword(password, user?.passwordHash);
      assert(valid && user?.status === 'ACTIVE' && user?.platformRole === 'SUPER_ADMIN', 'Invalid administrator email or password.', 401);
      await prisma.$transaction(async tx => {
        await tx.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
        await tx.auditLog.create({ data: { actorId: user.id, action: 'ADMIN_LOGIN', entityType: 'users', entityId: String(user.id) } });
      });
      attempts.delete(key);
      res.cookie(COOKIE, signSession(user, secret), { ...cookieOptions, maxAge: TTL_SECONDS * 1000 });
      res.json({ user: publicIdentity(user) });
    },
    async requireAdmin(req, res, next) {
      ready();
      const value = (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
      const session = readSession(value, secret);
      assert(session, 'Sign in to continue.', 401);
      const user = await prisma.user.findUnique({ where: { id: session.id } });
      assert(user && user.status === 'ACTIVE' && user.platformRole === 'SUPER_ADMIN' && version(user) === session.version, 'Your administrator session has expired.', 401);
      req.admin = user;
      next();
    },
    logout(req, res) {
      res.clearCookie(COOKIE, cookieOptions);
      res.json({ ok: true });
    },
  };
}
