import { resources } from './resources.js';
export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export const assert = (condition, message, status = 400) => { if (!condition) throw new HttpError(status, message); };
export function parseId(value) {
  assert(/^\d+$/.test(String(value)) && Number.isSafeInteger(Number(value)) && Number(value) > 0 && Number(value) <= 2147483647, 'Invalid record ID.');
  return Number(value);
}
export function parseData(resourceName, body, editing = false) {
  const config = resources[resourceName];
  assert(config?.fields, 'This resource is read-only.', 405);
  assert(body && typeof body === 'object' && !Array.isArray(body), 'A JSON object is required.');
  const allowed = editing ? config.editable || Object.keys(config.fields).filter(k => !config.immutable?.includes(k)) : Object.keys(config.fields);
  for (const key of Object.keys(body)) assert(allowed.includes(key), `Field ${key} cannot be changed.`);
  const data = {};
  for (const [key, rule] of Object.entries(config.fields)) {
    let value = body[key];
    if (value === undefined) { assert(editing || !rule.required, `${key} is required.`); continue; }
    if (value === '' || value === null) {
      assert(!rule.required && ['string', 'date', 'decimal', 'integer'].includes(rule.type), `${key} is required.`);
      // Optional strings/dates can be cleared; schema-default strings cannot be null.
      assert(!['timezone', 'authority', 'password', 'graceMinutes'].includes(key), `${key} cannot be empty.`);
      data[key] = null; continue;
    }
    switch (rule.type) {
      case 'string':
        assert(typeof value === 'string', `${key} must be text.`);
        value = key === 'password' ? value : value.trim();
        assert(value.length > 0 && value.length <= rule.max, `${key} must contain 1–${rule.max} characters.`);
        break;
      case 'integer':
        assert((typeof value === 'number' || typeof value === 'string') && /^\d+$/.test(String(value)), `${key} must be a whole number.`);
        value = Number(value);
        assert(Number.isSafeInteger(value) && value >= rule.min && value <= rule.max, `${key} must be between ${rule.min} and ${rule.max}.`);
        break;
      case 'decimal':
        assert(['number', 'string'].includes(typeof value) && String(value).trim() !== '' && Number.isFinite(Number(value)), `${key} must be numeric.`);
        assert(Number(value) >= rule.min && Number(value) <= rule.max, `${key} is outside its valid range.`);
        value = String(value); break;
      case 'money':
        assert(typeof value === 'string' && /^\d{1,16}$/.test(value), `${key} must be an integer minor-unit string (maximum 16 digits).`);
        value = BigInt(value); break;
      case 'boolean': assert(typeof value === 'boolean', `${key} must be true or false.`); break;
      case 'enum': assert(rule.values.includes(value), `${key} has an invalid value.`); break;
      case 'date':
        assert(typeof value === 'string' && /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value)), `${key} must be an ISO date with a timezone.`);
        value = new Date(value); break;
    }
    data[key] = value;
  }
  if (data.email) {
    assert(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email), 'Enter a valid email address.');
    data.email = data.email.toLowerCase();
  }
  if (data.timezone) {
    try { new Intl.DateTimeFormat('en', { timeZone: data.timezone }).format(); } catch { throw new HttpError(400, 'Invalid IANA timezone.'); }
  }
  if (data.registrationNumber) data.registrationNumber = data.registrationNumber.toUpperCase().replace(/\s+/g, '');
  return data;
}

// Called inside serializable transactions; lock parent rows for interval checks.
export async function validateRelations(tx, name, data, existing, actorId) {
  const row = { ...existing, ...data };
  const id = existing?.id;
  const interval = (start, end) => assert(start && end && new Date(end) > new Date(start), 'End time must be after start time.');
  if (name === 'users') {
    assert(row.email || row.phone || row.username, 'At least one email, phone, or username is required.');
    if (id === actorId) assert(row.status === 'ACTIVE', 'You cannot deactivate your own administrator account.');
    if (existing?.platformRole === 'SUPER_ADMIN' && row.status !== 'ACTIVE') {
      const remaining = await tx.user.count({ where: { platformRole: 'SUPER_ADMIN', status: 'ACTIVE', id: { not: id } } });
      assert(remaining > 0, 'Keep at least one active super administrator.');
    }
  }
  if (name === 'leases') {
    interval(row.startsAt, row.endsAt);
    await tx.$queryRaw`SELECT id FROM parking_areas WHERE id = ${row.parkingAreaId} FOR UPDATE`;
    if (row.status === 'ACTIVE' || row.status === 'ENDED') {
      const overlap = await tx.parkingLease.findFirst({ where: { parkingAreaId: row.parkingAreaId, id: id ? { not: id } : undefined, status: { in: ['ACTIVE', 'ENDED'] }, startsAt: { lt: row.endsAt }, endsAt: { gt: row.startsAt } } });
      assert(!overlap, 'This site already has an operating lease in that period.', 409);
    }
    if (existing) {
      const transitions = { DRAFT: ['DRAFT', 'ACTIVE', 'CANCELLED'], ACTIVE: ['ACTIVE', 'ENDED'], ENDED: ['ENDED'], CANCELLED: ['CANCELLED'] };
      assert(transitions[existing.status].includes(row.status), 'Invalid lease status transition.');
      if (row.status === 'ENDED') assert(new Date(row.endsAt) <= new Date(), 'A lease cannot be ended before its end time.');
    }
  }
  if (name === 'assignments') {
    const [member, lease] = await Promise.all([tx.organizationMember.findUnique({ where: { id: row.memberId } }), tx.parkingLease.findUnique({ where: { id: row.leaseId } })]);
    assert(member && lease && member.organizationId === lease.organizationId, 'Staff membership and lease must belong to the same organization.');
  }
  if (name === 'hours') {
    assert(row.closesMinute > row.opensMinute, 'Closing minute must be after opening minute. Split overnight hours into two days.');
    await tx.$queryRaw`SELECT id FROM parking_areas WHERE id = ${row.parkingAreaId} FOR UPDATE`;
    const overlap = await tx.openingHours.findFirst({ where: { parkingAreaId: row.parkingAreaId, weekday: row.weekday, id: id ? { not: id } : undefined, opensMinute: { lt: row.closesMinute }, closesMinute: { gt: row.opensMinute } } });
    assert(!overlap, 'Opening hours overlap an existing period.', 409);
  }
  if (name === 'closures') interval(row.startsAt, row.endsAt);
  if (name === 'pricing') {
    if (row.validUntil) interval(row.validFrom, row.validUntil);
    const lease = await tx.parkingLease.findUnique({ where: { id: row.leaseId } });
    assert(lease, 'Lease not found.');
    assert(new Date(row.validFrom) >= lease.startsAt && new Date(row.validFrom) < lease.endsAt && (!row.validUntil || new Date(row.validUntil) <= lease.endsAt), 'Price plan validity must fit within the lease.');
  }
  if (name === 'slots' && existing && (row.vehicleType !== existing.vehicleType || row.status !== 'ACTIVE')) {
    const count = await tx.booking.count({ where: { slotId: id, OR: [{ status: 'CHECKED_IN' }, { status: 'CONFIRMED', endsAt: { gt: new Date() } }, { status: 'HELD', holdExpiresAt: { gt: new Date() } }] } });
    assert(count === 0, 'This slot has current or upcoming bookings; resolve them before changing its availability or vehicle type.', 409);
  }
  if (name === 'qrcodes' && existing?.revokedAt) assert(row.revokedAt, 'A revoked QR code cannot be reactivated; issue a new code.');
}
