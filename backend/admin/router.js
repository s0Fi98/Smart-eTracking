import { Router } from 'express';
import { createAuth, hashPassword, publicIdentity } from './auth.js';
import { resources, readShape, safeUser } from './resources.js';
import { assert, HttpError, parseData, parseId, validateRelations } from './validation.js';

export function createAdminRouter(prisma, authOptions) {
  const router = Router();
  const auth = createAuth(prisma, authOptions);
  router.post('/login', auth.login);
  router.post('/logout', auth.logout);
  router.use(auth.requireAdmin);
  router.get('/session', (req, res) => res.json({ user: publicIdentity(req.admin) }));
  router.get('/options', async (req, res) => {
    const limit = 1001;
    const [organizations, sites, leases, users, memberships] = await Promise.all([
      prisma.organization.findMany({ take: limit, orderBy: { name: 'asc' } }),
      prisma.parkingArea.findMany({ take: limit, orderBy: { name: 'asc' } }),
      prisma.parkingLease.findMany({ take: limit, include: resources.leases.include, orderBy: { id: 'desc' } }),
      prisma.user.findMany({ take: limit, select: safeUser, orderBy: { name: 'asc' } }),
      prisma.organizationMember.findMany({ take: limit, include: resources.memberships.include, orderBy: { id: 'desc' } }),
    ]);
    const result = { organizations, sites, leases, users, memberships };
    res.json({ ...Object.fromEntries(Object.entries(result).map(([key, list]) => [key, list.slice(0, 1000)])), truncated: Object.values(result).some(list => list.length > 1000) });
  });
  router.get('/overview', async (req, res) => {
    const now = new Date();
    const [organizations, sitesCount, slots, occupied, bookings, pendingPayments, revenue, recentBookings, sites, expiringLeases] = await Promise.all([
      prisma.organization.count(), prisma.parkingArea.count(), prisma.parkingSlot.count({ where: { status: { not: 'RETIRED' } } }),
      prisma.parkingSlot.count({ where: { bookings: { some: { status: 'CHECKED_IN' } } } }),
      prisma.booking.count(), prisma.payment.count({ where: { status: 'PENDING' } }),
      prisma.payment.groupBy({ by: ['currency'], where: { status: 'SUCCEEDED' }, _sum: { amountMinor: true } }),
      prisma.booking.findMany({ take: 6, orderBy: { createdAt: 'desc' }, include: resources.bookings.include }),
      prisma.parkingArea.findMany({ take: 6, orderBy: { name: 'asc' }, include: { _count: { select: { slots: { where: { status: { not: 'RETIRED' } } } } }, leases: { where: { status: 'ACTIVE', startsAt: { lte: now }, endsAt: { gt: now } }, include: { organization: true } } } }),
      prisma.parkingLease.findMany({ take: 5, where: { status: 'ACTIVE', endsAt: { gt: now, lte: new Date(now.getTime() + 30 * 86400000) } }, include: resources.leases.include, orderBy: { endsAt: 'asc' } }),
    ]);
    res.json({ counts: { organizations, sites: sitesCount, slots, occupied, bookings, pendingPayments }, revenue: revenue.map(row => ({ currency: row.currency, amountMinor: row._sum.amountMinor || 0n })), recentBookings, sites, expiringLeases });
  });
  router.get('/resources/:resource', async (req, res) => {
    const config = Object.hasOwn(resources, req.params.resource) ? resources[req.params.resource] : null;
    assert(config, 'Unknown resource.', 404);
    const page = Number(req.query.page || 1), pageSize = Number(req.query.pageSize || 20);
    assert(Number.isInteger(page) && page >= 1 && page <= 100000 && Number.isInteger(pageSize) && pageSize >= 1 && pageSize <= 100, 'Invalid pagination.');
    assert(!req.query.q || typeof req.query.q === 'string', 'Search must be text.');
    const q = (req.query.q || '').trim().slice(0, 191);
    const where = {};
    if (q && config.search.length) where.OR = config.search.map(key => ({ [key]: { contains: q } }));
    if (req.query.status) {
      const statuses = config.fields?.status?.values || ({ bookings: ['HELD','CONFIRMED','CHECKED_IN','COMPLETED','CANCELLED','EXPIRED','NO_SHOW'], payments: ['PENDING','SUCCEEDED','FAILED','CANCELLED'], refunds: ['PENDING','SUCCEEDED','FAILED'] })[req.params.resource];
      assert(statuses?.includes(req.query.status), 'Invalid status filter.');
      where.status = req.query.status;
    }
    const [items, total] = await Promise.all([
      prisma[config.model].findMany({ where, ...readShape(config), orderBy: { id: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
      prisma[config.model].count({ where }),
    ]);
    res.json({ items, total, page, pageSize });
  });
  const save = editing => async (req, res) => {
    const name = req.params.resource;
    const config = Object.hasOwn(resources, name) ? resources[name] : null;
    assert(config, 'Unknown resource.', 404);
    const id = editing ? parseId(req.params.id) : null;
    const data = parseData(name, req.body, editing);
    if (data.password) { data.passwordHash = await hashPassword(data.password); delete data.password; }
    const record = await prisma.$transaction(async tx => {
      const existing = editing ? await tx[config.model].findUnique({ where: { id } }) : null;
      if (editing) assert(existing, 'Record not found.', 404);
      await validateRelations(tx, name, data, existing, req.admin.id);
      const result = editing
        ? await tx[config.model].update({ where: { id }, data, ...readShape(config) })
        : await tx[config.model].create({ data, ...readShape(config) });
      const keys = Object.keys(data).filter(k => k !== 'passwordHash');
      await tx.auditLog.create({ data: { actorId: req.admin.id, action: editing ? 'UPDATE' : 'CREATE', entityType: name, entityId: String(result.id), metadata: { changedFields: keys } } });
      return result;
    }, { isolationLevel: 'Serializable' });
    res.status(editing ? 200 : 201).json(record);
  };
  router.post('/resources/:resource', save(false));
  router.patch('/resources/:resource/:id', save(true));
  router.use((req, res, next) => next(new HttpError(404, 'Admin endpoint not found.')));
  return router;
}
