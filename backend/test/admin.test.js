import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../app.js';
import { hashPassword, verifyPassword, signSession, readSession } from '../admin/auth.js';
import { parseData, validateRelations } from '../admin/validation.js';
const secret = 'test-session-secret-with-at-least-32-characters';
const origin = 'http://localhost:3000';

test('salted passwords and signed sessions reject incorrect secrets, tampering and expiry', async () => {
  const hash = await hashPassword('a strong test passphrase');
  assert.ok(await verifyPassword('a strong test passphrase', hash));
  assert.equal(await verifyPassword('wrong', hash), false);
  assert.notEqual(hash, await hashPassword('a strong test passphrase'));
  assert.equal(await verifyPassword('something', 'invalid-hash'), false);
  const token = signSession({ id: 7, passwordHash: hash }, secret, 100000);
  assert.equal(readSession(token, secret, 100001).id, 7);
  assert.equal(readSession(token, secret, 100000 + 8 * 3600 * 1000), null);
  assert.equal(readSession(`${token.slice(0, 10)}x${token.slice(11)}`, secret, 100001), null);
});

test('input validation rejects privilege escalation, price edits and lossy money', () => {
  assert.throws(() => parseData('users', { name: 'Admin', platformRole: 'SUPER_ADMIN' }), /cannot be changed/);
  assert.throws(() => parseData('pricing', { priceMinor: '500' }, true), /cannot be changed/);
  assert.throws(() => parseData('payments', { status: 'SUCCEEDED' }), /read-only/);
  assert.throws(() => parseData('hours', { parkingAreaId: 1, weekday: 7, opensMinute: 0, closesMinute: 1440 }), /between/);
  assert.throws(() => parseData('leases', { parkingAreaId: 1, organizationId: 1, workOrderNo: 'X', startsAt: '2026-01-01', endsAt: '2027-01-01' }), /timezone/);
  assert.throws(() => parseData('pricing', { leaseId: 1, name: 'Hourly', vehicleType: 'FOUR_WHEELER', durationMinutes: 60, priceMinor: 20.1 }), /minor-unit/);
  assert.equal(parseData('users', { name: 'Test', email: 'TEST@EXAMPLE.COM' }).email, 'test@example.com');
  assert.throws(() => parseData('sites', { name: 'Site', code: 'A', address: 'A', timezone: 'Not/AZone' }), /timezone/);
});

test('cross-organization assignments, overlapping intervals and QR reactivation are rejected', async () => {
  const tx = {
    $queryRaw: async () => [{ id: 1 }],
    organizationMember: { findUnique: async () => ({ organizationId: 1 }) },
    parkingLease: { findUnique: async () => ({ organizationId: 2 }), findFirst: async () => ({ id: 8 }) },
    openingHours: { findFirst: async () => ({ id: 2 }) },
  };
  await assert.rejects(validateRelations(tx, 'assignments', { memberId: 1, leaseId: 2 }, null, 1), /same organization/);
  await assert.rejects(validateRelations(tx, 'hours', { parkingAreaId: 1, weekday: 0, opensMinute: 100, closesMinute: 200 }, null, 1), /overlap/);
  await assert.rejects(validateRelations(tx, 'leases', { parkingAreaId: 1, status: 'ACTIVE', startsAt: new Date('2026-01-01'), endsAt: new Date('2027-01-01') }, null, 1), /operating lease/);
  await assert.rejects(validateRelations(tx, 'qrcodes', { revokedAt: null }, { revokedAt: new Date() }, 1), /cannot be reactivated/);
});

test('HTTP authentication, origin checks, audit writes and read-only financial history', async t => {
  let user = { id: 1, name: 'Admin', email: 'admin@example.test', passwordHash: await hashPassword('test administrator password'), platformRole: 'SUPER_ADMIN', status: 'ACTIVE' };
  const organizations = [], audit = [];
  const db = {
    user: { findUnique: async ({ where }) => where.id === user.id || where.email === user.email ? user : null, update: async () => user, findMany: async () => { const { passwordHash, ...safe } = user; return [safe]; }, count: async () => 1 },
    organization: { create: async ({ data }) => { const row = { id: 10, ...data }; organizations.push(row); return row; }, findMany: async () => organizations, count: async () => organizations.length },
    auditLog: { create: async ({ data }) => { audit.push(data); return data; } },
    $transaction: async fn => fn(db),
  };
  const server = createApp(db, { origins: [origin], auth: { secret, secure: false } }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (path, options = {}) => fetch(base + path, options);
  assert.equal((await request('/api/admin/resources/organizations')).status, 401);
  assert.equal((await request('/api/operators')).status, 410);
  assert.equal((await request('/api/admin/login', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://evil.test' }, body: '{}' })).status, 403);
  const login = await request('/api/admin/login', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify({ email: user.email, password: 'test administrator password' }) });
  assert.equal(login.status, 200);
  const setCookie = login.headers.get('set-cookie');
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Lax/i);
  const cookie = setCookie.split(';')[0];
  assert.equal((await login.json()).user.passwordHash, undefined);
  const headers = { origin, cookie, 'content-type': 'application/json' };
  const create = await request('/api/admin/resources/organizations', { method: 'POST', headers, body: JSON.stringify({ code: 'ORG-A', name: 'Org A', phone: '+919999999999' }) });
  assert.equal(create.status, 201);
  assert.equal((await create.json()).name, 'Org A');
  assert.ok(audit.some(entry => entry.action === 'CREATE' && entry.entityType === 'organizations'));
  const list = await request('/api/admin/resources/users', { headers });
  assert.equal((await list.json()).items[0].passwordHash, undefined);
  assert.equal((await request('/api/admin/resources/payments', { method: 'POST', headers, body: '{}' })).status, 405);
  assert.equal((await request('/api/admin/resources/users', { method: 'POST', headers, body: JSON.stringify({ name: 'Escalate', platformRole: 'SUPER_ADMIN' }) })).status, 400);
  user = { ...user, status: 'SUSPENDED' };
  assert.equal((await request('/api/admin/session', { headers })).status, 401);
});

test('ordinary users cannot sign into administration', async t => {
  const db = { user: { findUnique: async () => ({ id: 2, status: 'ACTIVE', platformRole: 'USER', passwordHash: await hashPassword('ordinary user password') }) } };
  const server = createApp(db, { origins: [origin], auth: { secret } }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/admin/login`, { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify({ email: 'user@example.test', password: 'ordinary user password' }) });
  assert.equal(response.status, 401);
});

test('public QR discovery serializes prices exactly and rejects revoked or inactive sites', async t => {
  let revokedAt = null, status = 'ACTIVE';
  const db = {
    siteQrCode: { findUnique: async () => ({ parkingAreaId: 1, revokedAt, expiresAt: null, parkingArea: { id: 1, code: 'PBZ', name: 'Panbazar', address: 'MG Road', timezone: 'Asia/Kolkata', status } }) },
    parkingLease: { findFirst: async () => ({ id: 2 }) },
    parkingSlot: { count: async () => 4 },
    pricePlan: { findMany: async () => [{ name: 'Hourly', durationMinutes: 60, priceMinor: 2000n, currency: 'INR', vehicleType: 'FOUR_WHEELER' }] },
  };
  const server = createApp(db, { origins: [origin], auth: { secret } }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/api/qr/11111111-1111-4111-8111-111111111111`;
  const response = await fetch(url);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.slotsAvailable, 4);
  assert.equal(body.plans[0].priceMinor, '2000');
  assert.deepEqual(Object.keys(body.site).sort(), ['address', 'code', 'name', 'timezone']);
  revokedAt = new Date();
  assert.equal((await fetch(url)).status, 404);
  revokedAt = null; status = 'INACTIVE';
  assert.equal((await fetch(url)).status, 404);
});
