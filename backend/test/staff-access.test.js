import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../app.js";
import { hashPassword } from "../admin/auth.js";
import { staffDb } from "./support/staff-db.js";
const origin = "http://localhost:3000";
const password = "test-only-staff-passphrase";
const secret = "test-only-session-secret-at-least-32-characters";
async function fixture(t) {
  const db = staffDb(await hashPassword(password));
  const server = createApp(db, {
    origins: [origin],
    auth: { secret, secure: false },
  }).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api/admin`;
  async function request(path, method = "GET", body, cookie) {
    const result = await fetch(base + path, {
      method,
      headers: {
        origin,
        "content-type": "application/json",
        ...(cookie ? { cookie } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return {
      status: result.status,
      body: await result.json(),
      cookie: result.headers.get("set-cookie")?.split(";")[0],
    };
  }
  const login = (id) =>
    request("/login", "POST", { email: `user${id}@test.example`, password });
  const api = (cookie) => (path, method, body) =>
    request(path, method, body, cookie);
  return { db, login, api };
}

test("all staff roles sign in; customer, unassigned member, suspended and future-only staff cannot", async (t) => {
  const { login } = await fixture(t);
  for (const id of [1, 10, 11, 12, 13, 14, 15, 16, 17, 20]) {
    const result = await login(id);
    assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.ok(result.body.user.access.label);
    assert.equal(result.body.user.passwordHash, undefined);
  }
  for (const id of [18, 21, 99]) assert.equal((await login(id)).status, 403);
  assert.equal((await login(19)).status, 401);
});

test("operator reads only assigned lease; counts, search, dropdowns and nested site leases stay scoped", async (t) => {
  const { login, api } = await fixture(t);
  const call = api((await login(12)).cookie);
  const bookings = await call("/resources/bookings");
  assert.deepEqual(
    bookings.body.items.map((r) => r.id),
    [1],
  );
  assert.equal(bookings.body.total, 1);
  assert.equal((await call("/resources/bookings?q=BOOKING-3")).body.total, 0);
  const sites = await call("/resources/sites");
  assert.deepEqual(
    sites.body.items.map((r) => r.id),
    [101],
  );
  assert.deepEqual(
    sites.body.items[0].leases.map((r) => r.id),
    [1001],
  );
  const overview = (await call("/overview")).body;
  assert.equal(overview.counts.sites, 1);
  assert.equal(overview.counts.bookings, 1);
  assert.equal(overview.counts.occupied, 1);
  assert.deepEqual(overview.revenue, []);
  const options = (await call("/options")).body;
  assert.deepEqual(
    options.leases.map((l) => l.id),
    [1001],
  );
  assert.deepEqual(options.users, []);
  assert.deepEqual(options.memberships, []);
  for (const name of [
    "users",
    "memberships",
    "payments",
    "refunds",
    "audit",
    "events",
    "vehicles",
  ])
    assert.equal((await call(`/resources/${name}`)).status, 403);
  assert.equal(
    (await call("/resources/slots/101", "PATCH", { status: "RETIRED" })).status,
    403,
  );
});

test("accountant sees only own organization financial history and cannot write setup", async (t) => {
  const { login, api } = await fixture(t);
  const call = api((await login(13)).cookie);
  assert.deepEqual(
    (await call("/resources/payments")).body.items.map((p) => p.id),
    [1, 2],
  );
  assert.deepEqual(
    (await call("/resources/refunds")).body.items.map((p) => p.id),
    [1, 2],
  );
  assert.equal((await call("/overview")).body.revenue[0].amountMinor, "4000");
  assert.equal((await call("/resources/events")).status, 403);
  assert.equal(
    (await call("/resources/organizations/1", "PATCH", { name: "Hijack" }))
      .status,
    403,
  );
  assert.equal(
    (await call("/resources/payments", "POST", { status: "SUCCEEDED" })).status,
    405,
  );
});

test("collector and site viewer remain lease scoped; viewer and organization viewer cannot mutate", async (t) => {
  const { login, api } = await fixture(t);
  const collector = api((await login(16)).cookie);
  assert.deepEqual(
    (await collector("/resources/payments")).body.items.map((p) => p.id),
    [1],
  );
  for (const id of [14, 17]) {
    const call = api((await login(id)).cookie);
    assert.equal(
      (await call("/resources/bookings")).body.total,
      id === 14 ? 2 : 1,
    );
    assert.equal(
      (
        await call("/resources/slots", "POST", {
          parkingAreaId: 101,
          code: "NEW",
          vehicleType: "TWO_WHEELER",
        })
      ).status,
      403,
    );
  }
});

test("manager may configure their own site, not another site or their own/escalated assignments", async (t) => {
  const { login, api, db } = await fixture(t);
  const call = api((await login(15)).cookie);
  assert.equal(
    (
      await call("/resources/slots", "POST", {
        parkingAreaId: 101,
        code: "NEW",
        vehicleType: "TWO_WHEELER",
      })
    ).status,
    201,
  );
  assert.equal(
    (
      await call("/resources/slots", "POST", {
        parkingAreaId: 102,
        code: "CROSS-SITE",
        vehicleType: "TWO_WHEELER",
      })
    ).status,
    403,
  );
  assert.equal(
    (await call("/resources/sites/201", "PATCH", { status: "INACTIVE" }))
      .status,
    404,
  );
  assert.equal(
    (await call("/resources/sites/101", "PATCH", { name: "Rename" })).status,
    403,
  );
  assert.equal(
    (
      await call("/resources/assignments", "POST", {
        memberId: 18,
        leaseId: 1001,
        role: "OPERATOR",
      })
    ).status,
    201,
  );
  assert.equal(
    (
      await call("/resources/assignments", "POST", {
        memberId: 18,
        leaseId: 1001,
        role: "MANAGER",
      })
    ).status,
    403,
  );
  assert.equal(
    (await call("/resources/assignments/15", "PATCH", { role: "OPERATOR" }))
      .status,
    403,
  );
  const options = (await call("/options")).body;
  assert.ok(
    options.memberships.every(
      (m) => m.organizationId === 1 && !("email" in m.user),
    ),
  );
  assert.ok(
    db.rows.auditLog.some(
      (log) => log.entityType === "slots" && log.action === "CREATE",
    ),
  );
});

test("org admin creates staff atomically, cannot take over shared identities or appoint admins", async (t) => {
  const { login, api, db } = await fixture(t);
  const call = api((await login(11)).cookie);
  const response = await call("/resources/users", "POST", {
    organizationId: 1,
    name: "New staff",
    email: "staff@test.example",
    password,
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  assert.equal(response.body.passwordHash, undefined);
  assert.ok(
    db.rows.organizationMember.some(
      (m) =>
        m.userId === response.body.id &&
        m.organizationId === 1 &&
        m.role === "MEMBER",
    ),
  );
  assert.equal(
    (
      await call("/resources/users", "POST", {
        organizationId: 2,
        name: "Wrong org",
        email: "wrong@test.example",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await call("/resources/users/12", "PATCH", {
        password: "stolen-user-new-password",
      })
    ).status,
    403,
  );
  assert.equal(
    (await call("/resources/memberships/12", "PATCH", { role: "ADMIN" }))
      .status,
    403,
  );
  assert.equal(
    (await call("/resources/memberships/11", "PATCH", { role: "OWNER" }))
      .status,
    403,
  );
  assert.equal(
    (await call("/resources/memberships/12", "PATCH", { role: "ACCOUNTANT" }))
      .status,
    200,
  );
  assert.equal(
    (
      await call("/resources/memberships", "POST", {
        organizationId: 1,
        userId: 20,
        role: "MEMBER",
      })
    ).status,
    403,
  );
  assert.equal(
    (await call("/resources/organizations/2", "PATCH", { name: "Other org" }))
      .status,
    404,
  );
  assert.equal(
    (await call("/resources/organizations/1", "PATCH", { name: "Our org" }))
      .status,
    200,
  );
  assert.equal(
    (await call("/resources/organizations/1", "PATCH", { status: "SUSPENDED" }))
      .status,
    403,
  );
});

test("owner may appoint admins; access revocation, password reset and expired lease invalidate existing sessions", async (t) => {
  const { login, api, db } = await fixture(t);
  const owner = api((await login(10)).cookie);
  assert.equal(
    (await owner("/resources/memberships/12", "PATCH", { role: "ADMIN" }))
      .status,
    200,
  );
  // Restore site-only membership before checking lease expiry.
  db.rows.organizationMember.find((m) => m.id === 12).role = "MEMBER";
  const operator = api((await login(12)).cookie);
  db.rows.siteAssignment.find((a) => a.id === 12).status = "INACTIVE";
  assert.equal((await operator("/session")).status, 403);
  db.rows.siteAssignment.find((a) => a.id === 12).status = "ACTIVE";
  db.rows.parkingLease.find((l) => l.id === 1001).endsAt = new Date(0);
  assert.equal((await operator("/session")).status, 403);
  db.rows.parkingLease.find((l) => l.id === 1001).endsAt = new Date(
    Date.now() + 86400000,
  );
  const superuser = api((await login(1)).cookie);
  assert.equal(
    (
      await superuser("/resources/users/12", "PATCH", {
        password: "replacement-password-only-test",
      })
    ).status,
    200,
  );
  assert.equal((await operator("/session")).status, 401);
  db.rows.organization.find((o) => o.id === 1).status = "SUSPENDED";
  assert.equal((await owner("/session")).status, 403);
  assert.ok(
    db.rows.auditLog.every((log) => !JSON.stringify(log).includes(password)),
  );
});

test("roles in different organizations never combine into cross-tenant write privileges", async (t) => {
  const { login, api, db } = await fixture(t);
  db.rows.organizationMember.push({
    id: 112,
    userId: 11,
    organizationId: 2,
    role: "MEMBER",
    status: "ACTIVE",
  });
  db.rows.siteAssignment.push({
    id: 112,
    memberId: 112,
    leaseId: 2001,
    role: "OPERATOR",
    status: "ACTIVE",
  });
  const call = api((await login(11)).cookie);
  const sites = (await call("/resources/sites")).body.items;
  assert.ok(sites.find((s) => s.id === 101)._access.updateFields.length > 0);
  assert.deepEqual(sites.find((s) => s.id === 201)._access.updateFields, []);
  assert.equal(
    (await call("/resources/sites/201", "PATCH", { status: "INACTIVE" }))
      .status,
    403,
  );
  assert.equal(
    (
      await call("/resources/slots", "POST", {
        parkingAreaId: 201,
        code: "ESCALATE",
        vehicleType: "FOUR_WHEELER",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await call("/resources/pricing", "POST", {
        leaseId: 2001,
        name: "External tariff",
        vehicleType: "FOUR_WHEELER",
        durationMinutes: 60,
        priceMinor: "2000",
        overtimeUnitMinutes: 60,
        overtimePriceMinor: "2000",
        validFrom: new Date().toISOString(),
      })
    ).status,
    403,
  );
  assert.deepEqual(
    (await call("/resources/payments")).body.items.map((p) => p.id),
    [1, 2],
  );
  assert.deepEqual(
    (await call("/resources/bookings")).body.items.map((p) => p.id),
    [1, 2, 3],
  );
});

test("suspended membership removes access on existing cookies and super admin retains global visibility", async (t) => {
  const { login, api, db } = await fixture(t);
  const admin = api((await login(11)).cookie);
  db.rows.organizationMember.find((m) => m.id === 11).status = "SUSPENDED";
  assert.equal((await admin("/options")).status, 403);
  const superuser = api((await login(1)).cookie);
  assert.equal((await superuser("/resources/bookings")).body.total, 4);
  assert.equal((await superuser("/resources/events")).status, 200);
  assert.equal(
    (await superuser("/resources/users")).body.items.some(
      (u) => "passwordHash" in u,
    ),
    false,
  );
});
