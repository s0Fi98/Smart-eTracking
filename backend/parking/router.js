import { Router } from "express";
import { createHash } from "node:crypto";
import { assert } from "../admin/validation.js";
import { createAuth } from "../admin/auth.js";
import { loadAccess } from "../admin/access.js";

const activeLease = (now) => ({
  status: "ACTIVE",
  startsAt: { lte: now },
  endsAt: { gt: now },
  organization: { status: "ACTIVE" },
});
const activeQr = (now) => ({
  revokedAt: null,
  OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
});
export function ticketKey(secret) {
  assert(
    typeof secret === "string" && /^[a-f0-9]{64}$/.test(secret),
    "A valid private ticket code is required.",
    401,
  );
  return `guest:${createHash("sha256").update(secret).digest("hex")}`;
}
export function fare(booking, now = new Date()) {
  const p = booking.pricingSnapshot;
  const elapsedMinutes = Math.max(
    0,
    Math.ceil((now - new Date(booking.checkedInAt)) / 60000),
  );
  const units = Math.ceil(
    Math.max(0, elapsedMinutes - p.durationMinutes - p.graceMinutes) /
      p.overtimeUnitMinutes,
  );
  const overtimeMinor = BigInt(units) * BigInt(p.overtimePriceMinor);
  return {
    elapsedMinutes,
    overtimeMinor,
    totalMinor:
      BigInt(booking.subtotalMinor) +
      BigInt(booking.taxMinor || 0) -
      BigInt(booking.discountMinor || 0) +
      overtimeMinor,
  };
}
export function receipt(b, now = new Date()) {
  return {
    reference: b.reference,
    vehicleRegistration: b.vehicleRegistration,
    status: b.status,
    checkedInAt: b.checkedInAt,
    checkedOutAt: b.checkedOutAt,
    currency: b.currency,
    slot: b.slot?.code,
    ...(b.status === "COMPLETED"
      ? { totalMinor: b.totalMinor, overtimeMinor: b.overtimeMinor }
      : fare(b, now)),
  };
}
export function isOpen(hours, timezone, now) {
  if (!hours.length) return true;
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  const weekday = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(
    parts.weekday,
  );
  const minute = Number(parts.hour) * 60 + Number(parts.minute);
  return hours.some(
    (h) =>
      h.weekday === weekday &&
      minute >= h.opensMinute &&
      minute < h.closesMinute,
  );
}
async function resolveQr(db, token, now) {
  assert(
    typeof token === "string" && /^[0-9a-f-]{36}$/i.test(token),
    "Invalid QR code.",
    404,
  );
  const qr = await db.siteQrCode.findFirst({
    where: { token, ...activeQr(now), parkingArea: { status: "ACTIVE" } },
    include: { parkingArea: true },
  });
  assert(qr, "This QR code is unavailable or expired.", 404);
  const lease = await db.parkingLease.findFirst({
    where: { parkingAreaId: qr.parkingAreaId, ...activeLease(now) },
  });
  assert(lease, "This site has no active operating lease.", 409);
  return { qr, lease };
}
export function createParkingRouter(db) {
  const router = Router();
  router.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  const attempts = new Map();
  router.post("/entry", (req, res, next) => {
    const now = Date.now();
    for (const [key, value] of attempts)
      if (value.until < now) attempts.delete(key);
    const value = attempts.get(req.ip) || { count: 0, until: now + 60000 };
    assert(
      value.count < 20 && (attempts.has(req.ip) || attempts.size < 10000),
      "Too many entry requests. Try again shortly.",
      429,
    );
    value.count++;
    attempts.set(req.ip, value);
    next();
  });
  router.get("/sites", async (req, res) => {
    const now = new Date();
    const sites = await db.parkingArea.findMany({
      where: {
        status: "ACTIVE",
        leases: { some: activeLease(now) },
        qrCodes: { some: activeQr(now) },
      },
      orderBy: { code: "asc" },
      take: 1000,
      select: {
        code: true,
        name: true,
        qrCodes: {
          where: activeQr(now),
          orderBy: { id: "desc" },
          take: 1,
          select: { token: true },
        },
        leases: {
          where: activeLease(now),
          take: 1,
          select: { organization: { select: { name: true } } },
        },
        _count: { select: { slots: { where: { status: "ACTIVE" } } } },
      },
    });
    res.json({
      sites: sites.map((s) => ({
        id: s.code,
        name: s.name,
        token: s.qrCodes[0].token,
        totalCapacity: s._count.slots,
        ticketCollector: s.leases[0].organization.name,
      })),
    });
  });
  router.post("/entry", async (req, res) => {
    const { token, ticketCode, pricePlanId, vehicleRegistration } =
      req.body || {};
    const key = ticketKey(ticketCode);
    const plate =
      typeof vehicleRegistration === "string"
        ? vehicleRegistration.toUpperCase().replace(/[ -]/g, "")
        : "";
    assert(
      /^[A-Z0-9]{4,30}$/.test(plate),
      "Enter a vehicle registration of 4–30 letters and digits.",
    );
    assert(
      Number.isSafeInteger(pricePlanId) && pricePlanId > 0,
      "Choose a price plan.",
    );
    const result = await db.$transaction(
      async (tx) => {
        const now = new Date();
        const initial = await resolveQr(tx, token, now);
        // Serialize entry allocation with site management and other entries.
        await tx.$queryRaw`SELECT id FROM parking_areas WHERE id = ${initial.qr.parkingAreaId} FOR UPDATE`;
        const { qr, lease } = await resolveQr(tx, token, now);
        const existing = await tx.booking.findUnique({
          where: { idempotencyKey: key },
          include: { slot: true },
        });
        if (existing) {
          assert(
            existing.qrCodeId === qr.id &&
              existing.vehicleRegistration === plate &&
              existing.pricePlanId === pricePlanId,
            "Ticket code already belongs to a different entry.",
            409,
          );
          return receipt(existing, now);
        }
        const plan = await tx.pricePlan.findFirst({
          where: {
            id: pricePlanId,
            leaseId: lease.id,
            isActive: true,
            validFrom: { lte: now },
            OR: [{ validUntil: null }, { validUntil: { gt: now } }],
          },
        });
        assert(
          plan && plan.durationMinutes > 0 && plan.overtimeUnitMinutes > 0,
          "This tariff is unavailable.",
          409,
        );
        const end = new Date(now.getTime() + plan.durationMinutes * 60000);
        assert(
          end <= lease.endsAt,
          "The operating lease ends before this parking period.",
          409,
        );
        const hours = await tx.openingHours.findMany({
          where: { parkingAreaId: qr.parkingAreaId },
        });
        assert(
          isOpen(hours, qr.parkingArea.timezone, now),
          "This parking site is closed.",
          409,
        );
        const closure = await tx.siteClosure.findFirst({
          where: {
            parkingAreaId: qr.parkingAreaId,
            startsAt: { lt: end },
            endsAt: { gt: now },
          },
        });
        assert(
          !closure,
          "This parking site is closed for the requested period.",
          409,
        );
        const duplicate = await tx.booking.findFirst({
          where: {
            lease: { parkingAreaId: qr.parkingAreaId },
            vehicleRegistration: plate,
            status: "CHECKED_IN",
          },
        });
        assert(
          !duplicate,
          "This vehicle already has an active ticket here. Use your saved ticket or contact staff.",
          409,
        );
        const slot = await tx.parkingSlot.findFirst({
          where: {
            parkingAreaId: qr.parkingAreaId,
            vehicleType: plan.vehicleType,
            status: "ACTIVE",
            bookings: {
              none: {
                OR: [
                  { status: "CHECKED_IN" },
                  {
                    status: "CONFIRMED",
                    startsAt: { lt: end },
                    endsAt: { gt: now },
                  },
                  {
                    status: "HELD",
                    holdExpiresAt: { gt: now },
                    startsAt: { lt: end },
                    endsAt: { gt: now },
                  },
                ],
              },
            },
          },
          orderBy: { id: "asc" },
        });
        assert(slot, "No suitable slots are available.", 409);
        await tx.$queryRaw`SELECT id FROM parking_slots WHERE id = ${slot.id} FOR UPDATE`;
        const user = await tx.user.create({
          data: {
            name: "Parking guest",
            platformRole: "USER",
            status: "ACTIVE",
          },
        });
        const booking = await tx.booking.create({
          data: {
            idempotencyKey: key,
            userId: user.id,
            leaseId: lease.id,
            slotId: slot.id,
            pricePlanId: plan.id,
            qrCodeId: qr.id,
            vehicleRegistration: plate,
            vehicleType: plan.vehicleType,
            status: "CHECKED_IN",
            startsAt: now,
            endsAt: end,
            checkedInAt: now,
            currency: plan.currency,
            subtotalMinor: plan.priceMinor,
            totalMinor: plan.priceMinor,
            pricingSnapshot: {
              durationMinutes: plan.durationMinutes,
              graceMinutes: plan.graceMinutes,
              overtimeUnitMinutes: plan.overtimeUnitMinutes,
              overtimePriceMinor: String(plan.overtimePriceMinor),
              priceMinor: String(plan.priceMinor),
            },
          },
          include: { slot: true },
        });
        await tx.auditLog.create({
          data: {
            action: "QR_CHECK_IN",
            entityType: "bookings",
            entityId: String(booking.id),
          },
        });
        return receipt(booking, now);
      },
      { isolationLevel: "ReadCommitted" },
    );
    res.json({ ticket: result });
  });
  router.post("/ticket", async (req, res) => {
    const b = await db.booking.findUnique({
      where: { idempotencyKey: ticketKey(req.body?.ticketCode) },
      include: { slot: true, qrCode: true },
    });
    assert(
      b && b.qrCode?.token === req.body?.token,
      "Ticket not found for this site.",
      404,
    );
    // Existing tickets remain accessible after the QR expires or its lease ends.
    res.json({ ticket: receipt(b) });
  });
  return router;
}
export function createCashRouter(db, authOptions) {
  const router = Router();
  router.use(createAuth(db, authOptions).requireAdmin);
  async function load(tx, req) {
    const user = await tx.user.findUnique({ where: { id: req.admin.id } });
    const a = await loadAccess(tx, user);
    const b = await tx.booking.findUnique({
      where: { reference: req.params.reference },
      include: { lease: true, slot: true },
    });
    assert(
      b &&
        a.canLogin &&
        (a.superAdmin ||
          a.orgAdminIds.includes(b.lease.organizationId) ||
          a.financeLeaseIds.includes(b.leaseId)),
      "Cash collection is not permitted for this booking.",
      403,
    );
    return b;
  }
  router.get("/:reference", async (req, res) =>
    res.json({ ticket: receipt(await load(db, req)) }),
  );
  router.post("/:reference", async (req, res) => {
    const result = await db.$transaction(
      async (tx) => {
        const first = await load(tx, req);
        await tx.$queryRaw`SELECT id FROM bookings WHERE id = ${first.id} FOR UPDATE`;
        const b = await load(tx, req);
        if (b.status === "COMPLETED") return receipt(b);
        assert(
          b.status === "CHECKED_IN",
          "Only checked-in tickets can be settled.",
          409,
        );
        const now = new Date(),
          quote = fare(b, now);
        assert(
          String(req.body?.amountMinor) === String(quote.totalMinor),
          "Fare changed. Refresh the quote before collecting cash.",
          409,
        );
        const paid = await tx.payment.count({
          where: { bookingId: b.id, status: "SUCCEEDED" },
        });
        assert(
          paid === 0,
          "This booking already has a payment. Ask an administrator to reconcile it.",
          409,
        );
        await tx.payment.create({
          data: {
            bookingId: b.id,
            idempotencyKey: `cash:${b.reference}`,
            provider: "CASH",
            method: "CASH",
            status: "SUCCEEDED",
            amountMinor: quote.totalMinor,
            currency: b.currency,
            paidAt: now,
          },
        });
        const updated = await tx.booking.update({
          where: { id: b.id },
          data: {
            status: "COMPLETED",
            checkedOutAt: now,
            overtimeMinor: quote.overtimeMinor,
            totalMinor: quote.totalMinor,
          },
          include: { slot: true },
        });
        await tx.auditLog.create({
          data: {
            actorId: req.admin.id,
            action: "CASH_CHECKOUT",
            entityType: "bookings",
            entityId: String(b.id),
            metadata: { amountMinor: String(quote.totalMinor) },
          },
        });
        return receipt(updated);
      },
      { isolationLevel: "ReadCommitted" },
    );
    res.json({ ticket: result });
  });
  return router;
}
