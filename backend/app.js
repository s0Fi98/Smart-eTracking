import express from 'express';
import cors from 'cors';
import { createAdminRouter } from './admin/router.js';
import { HttpError, assert } from './admin/validation.js';
export function createApp(prisma, options = {}) {
  const app = express();
  const origins = options.origins || (process.env.ADMIN_ALLOWED_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000').split(',').map(s => s.trim()).filter(Boolean);
  app.disable('x-powered-by');
  app.set('json replacer', (key, value) => typeof value === 'bigint' ? value.toString() : value);
  app.use(cors({ origin(origin, callback) { callback(null, !origin || origins.includes(origin)); }, credentials: true }));
  app.use(express.json({ limit: '64kb' }));
  app.use('/api/admin', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !origins.includes(req.headers.origin)) return next(new HttpError(403, 'Request origin is not allowed.'));
    next();
  });
  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
  app.use('/api/admin', createAdminRouter(prisma, options.auth));
  // Old unauthenticated management endpoints must not bypass admin authorization.
  app.use(['/api/operators', '/api/parking-areas'], (req, res) => res.status(410).json({ message: 'Use the authenticated /api/admin/resources endpoints.' }));
  app.get('/api/qr/:token', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    assert(/^[0-9a-f-]{36}$/i.test(req.params.token), 'QR code not found.', 404);
    const qr = await prisma.siteQrCode.findUnique({ where: { token: req.params.token }, include: { parkingArea: true } });
    const now = new Date();
    assert(qr && !qr.revokedAt && (!qr.expiresAt || qr.expiresAt > now) && qr.parkingArea.status === 'ACTIVE', 'This QR code is unavailable or expired.', 404);
    const lease = await prisma.parkingLease.findFirst({ where: { parkingAreaId: qr.parkingAreaId, status: 'ACTIVE', startsAt: { lte: now }, endsAt: { gt: now }, organization: { status: 'ACTIVE' } } });
    assert(lease, 'This site does not have an active operating lease.', 404);
    const [slotsAvailable, plans] = await Promise.all([
      prisma.parkingSlot.count({ where: { parkingAreaId: qr.parkingAreaId, status: 'ACTIVE', bookings: { none: { OR: [{ status: 'CHECKED_IN' }, { status: 'CONFIRMED', startsAt: { lte: now }, endsAt: { gt: now } }, { status: 'HELD', startsAt: { lte: now }, endsAt: { gt: now }, holdExpiresAt: { gt: now } }] } } } }),
      prisma.pricePlan.findMany({ where: { leaseId: lease.id, isActive: true, validFrom: { lte: now }, OR: [{ validUntil: null }, { validUntil: { gt: now } }] }, select: { name: true, durationMinutes: true, priceMinor: true, currency: true, vehicleType: true } }),
    ]);
    const { code, name, address, timezone } = qr.parkingArea;
    res.json({ site: { code, name, address, timezone }, slotsAvailable, plans });
  });
  app.use((req, res) => res.status(404).json({ message: 'Endpoint not found.' }));
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ message: 'Invalid JSON body.' });
    if (err.type === 'entity.too.large') return res.status(413).json({ message: 'Request body is too large.' });
    const messages = {
      P2002: [409, 'A record with these unique values already exists.'],
      P2003: [400, 'The referenced record does not exist or is still in use.'],
      P2025: [404, 'Record not found.'],
      P2034: [409, 'Another administrator changed this data. Refresh and try again.'],
      P2021: [503, 'Database schema is not ready. Complete the migration described in the admin guide.'],
      P2022: [503, 'Database schema is out of date. Complete the migration described in the admin guide.'],
      P1001: [503, 'Cannot connect to the database. Check the backend database configuration.'],
    };
    const [status, message] = messages[err.code] || [500, 'The request could not be completed. Check the backend logs.'];
    // Do not log request bodies or database query parameters (may contain credentials).
    console.error('API error', err.code || err.name || 'UnknownError');
    res.status(status).json({ message });
  });
  return app;
}
