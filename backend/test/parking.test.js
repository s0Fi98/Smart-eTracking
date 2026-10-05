import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../app.js";
import { fare, isOpen, ticketKey } from "../parking/router.js";
import { staffDb } from "./support/staff-db.js";
import { signSession } from "../admin/auth.js";
const token = "11111111-1111-4111-8111-111111111111";
const secret = "parking-tests-only-secret-32-characters";
async function fixture(t) {
  const db = staffDb("unused-password-hash");
  db.rows.booking = [];
  db.rows.payment = [];
  db.rows.siteQrCode = [
    { id: 1, token, parkingAreaId: 101, revokedAt: null, expiresAt: null },
  ];
  db.rows.parkingSlot = [
    {
      id: 1,
      code: "A1",
      parkingAreaId: 101,
      vehicleType: "FOUR_WHEELER",
      status: "ACTIVE",
    },
  ];
  db.rows.pricePlan = [
    {
      id: 1,
      leaseId: 1001,
      name: "Hourly",
      vehicleType: "FOUR_WHEELER",
      currency: "INR",
      durationMinutes: 60,
      priceMinor: 2000n,
      graceMinutes: 5,
      overtimeUnitMinutes: 30,
      overtimePriceMinor: 1000n,
      validFrom: new Date(0),
      validUntil: null,
      isActive: true,
    },
  ];
  const server = createApp(db, { auth: { secret, secure: false } }).listen(
    0,
    "127.0.0.1",
  );
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  async function call(path, body, userId, method = "POST") {
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/api/${path}`,
      {
        method,
        headers: {
          origin: "http://localhost:3000",
          "content-type": "application/json",
          ...(userId
            ? {
                cookie: `parking_admin=${signSession(
                  db.rows.user.find((u) => u.id === userId),
                  secret,
                )}`,
              }
            : {}),
        },
        ...(method === "POST" ? { body: JSON.stringify(body || {}) } : {}),
      },
    );
    return { status: response.status, data: await response.json() };
  }
  return { db, call };
}
const entry = (extra = {}) => ({
  token,
  ticketCode: "a".repeat(64),
  pricePlanId: 1,
  vehicleRegistration: "AS01AB1234",
  ...extra,
});
test("fare uses purchased terms, grace, started overtime units and exact integer money", () => {
  const b = {
    checkedInAt: new Date(0),
    subtotalMinor: 2000n,
    pricingSnapshot: {
      durationMinutes: 60,
      graceMinutes: 5,
      overtimeUnitMinutes: 30,
      overtimePriceMinor: "1000",
    },
  };
  assert.equal(fare(b, new Date(65 * 60000)).totalMinor, 2000n);
  assert.equal(fare(b, new Date(65 * 60000 + 1)).totalMinor, 3000n);
  assert.equal(fare(b, new Date(96 * 60000)).totalMinor, 4000n);
  assert.throws(() => ticketKey("guess"));
  assert.equal(
    isOpen(
      [{ weekday: 0, opensMinute: 600, closesMinute: 660 }],
      "Asia/Kolkata",
      new Date("2026-10-05T04:30:00Z"),
    ),
    true,
  );
  assert.equal(
    isOpen(
      [{ weekday: 0, opensMinute: 600, closesMinute: 660 }],
      "Asia/Kolkata",
      new Date("2026-10-05T05:30:00Z"),
    ),
    false,
  );
});
test("entry persists, retries once, hides tickets, prevents duplicate and full-slot entries", async (t) => {
  const { db, call } = await fixture(t);
  assert.equal(
    (await call("parking/sites", null, null, "GET")).data.sites.length,
    1,
  );
  const first = await call("parking/entry", entry());
  assert.equal(first.status, 200, JSON.stringify(first));
  assert.equal(
    (await call("parking/entry", entry())).data.ticket.reference,
    first.data.ticket.reference,
  );
  assert.equal(db.rows.booking.length, 1);
  assert.equal(
    (await call("parking/entry", entry({ ticketCode: "b".repeat(64) }))).status,
    409,
  );
  assert.equal(
    (
      await call(
        "parking/entry",
        entry({
          ticketCode: "b".repeat(64),
          vehicleRegistration: "AS02XY4567",
        }),
      )
    ).status,
    409,
  );
  assert.equal(
    (await call("parking/ticket", { token, ticketCode: "c".repeat(64) }))
      .status,
    404,
  );
  assert.equal(
    (await call("parking/ticket", { token, ticketCode: "a".repeat(64) }))
      .status,
    200,
  );
  assert.equal(
    (await call("parking/entry", entry({ vehicleRegistration: "AS02XY4567" })))
      .status,
    409,
  );
});
test("cash requires scoped collector, correct amount, records payment and releases slot exactly once", async (t) => {
  const { db, call } = await fixture(t);
  const ref = (await call("parking/entry", entry())).data.ticket.reference;
  const path = `admin/cash/${ref}`;
  assert.equal((await call(path, {}, null)).status, 401);
  assert.equal((await call(path, {}, 20)).status, 403);
  assert.equal((await call(path, {}, 13)).status, 403); // Accountant is read only.
  assert.equal((await call(path, { amountMinor: "1" }, 1)).status, 409);
  assert.equal((await call(path, {}, 12)).status, 403); // Operator cannot collect.
  assert.equal((await call(path, null, 15, "GET")).status, 200); // Assigned manager.
  const result = await call(path, { amountMinor: "2000" }, 16); // Assigned collector.
  assert.equal(result.status, 200, JSON.stringify(result));
  assert.equal(result.data.ticket.status, "COMPLETED");
  assert.equal((await call(path, { amountMinor: "2000" }, 1)).status, 200);
  assert.equal(db.rows.payment.length, 1);
  assert.equal(
    db.rows.auditLog.filter((a) => a.action === "CASH_CHECKOUT").length,
    1,
  );
  assert.equal(
    (await call("parking/entry", entry({ ticketCode: "b".repeat(64) }))).status,
    200,
  );
});
test("revoked QR, inactive plan, closures and expired leases prevent entry without creating users", async (t) => {
  const { db, call } = await fixture(t);
  const users = db.rows.user.length;
  db.rows.siteQrCode[0].revokedAt = new Date();
  assert.equal((await call("parking/entry", entry())).status, 404);
  db.rows.siteQrCode[0].revokedAt = null;
  db.rows.pricePlan[0].isActive = false;
  assert.equal((await call("parking/entry", entry())).status, 409);
  db.rows.pricePlan[0].isActive = true;
  db.rows.siteClosure.push({
    id: 1,
    parkingAreaId: 101,
    startsAt: new Date(0),
    endsAt: new Date(Date.now() + 86400000),
  });
  assert.equal((await call("parking/entry", entry())).status, 409);
  db.rows.siteClosure = [];
  db.rows.parkingLease[0].endsAt = new Date(0);
  assert.equal((await call("parking/entry", entry())).status, 409);
  assert.equal(db.rows.user.length, users);
});
