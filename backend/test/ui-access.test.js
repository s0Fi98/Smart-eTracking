import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
// The frontend package is compiled by Next. Import the dependency-free policy
// hints as ESM here without changing the frontend package's module convention.
const source = await readFile(
  new URL("../../frontend/lib/admin/access.js", import.meta.url),
  "utf8",
);
const { canView, canCreate, permittedFields, navigationFor, fieldOptions } =
  await import(
    `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
  );

test("staff navigation and action hints do not expose ungranted screens or edits", () => {
  const user = {
    access: {
      permissions: {
        assignments: { read: true, create: true },
        sites: { read: true, create: false },
      },
    },
  };
  const groups = [
    {
      label: "Manage",
      items: [
        ["users", "People"],
        ["sites", "Sites"],
        ["audit", "Audit"],
      ],
    },
  ];
  assert.deepEqual(
    navigationFor(groups, { users: ["users", "assignments"] }, user, "live")[0]
      .items,
    [
      ["assignments", "People"],
      ["sites", "Sites"],
    ],
  );
  assert.equal(canView(user, "live", "audit"), false);
  assert.equal(canCreate(user, "live", "sites", { fields: [] }), false);
  const config = { fields: [{ key: "name" }, { key: "status" }] };
  assert.deepEqual(
    permittedFields(user, "live", "sites", config, {
      _access: { updateFields: ["status"] },
    }).map((f) => f.key),
    ["status"],
  );
  assert.deepEqual(permittedFields(user, "live", "sites", config, {}), []);
});

test("role and reference choices follow target organization rather than highest role elsewhere", () => {
  const user = {
    access: {
      managedOrganizationIds: [1, 2],
      ownerOrganizationIds: [1],
      managedSiteIds: [101],
      managedLeaseIds: [1001],
    },
  };
  const role = {
    key: "role",
    values: ["MEMBER", "OWNER", "ADMIN", "ACCOUNTANT", "VIEWER"],
  };
  assert.deepEqual(
    fieldOptions(
      user,
      "live",
      "memberships",
      role,
      {},
      { organizationId: "2" },
    ),
    ["MEMBER", "ACCOUNTANT", "VIEWER"],
  );
  assert.deepEqual(
    fieldOptions(
      user,
      "live",
      "memberships",
      role,
      {},
      { organizationId: "1" },
    ),
    role.values,
  );
  const opts = {
    sites: [{ id: 101 }, { id: 201 }],
    leases: [{ id: 1001, organizationId: 3 }],
  };
  assert.deepEqual(
    fieldOptions(
      user,
      "live",
      "slots",
      { key: "parkingAreaId", source: "sites" },
      opts,
    ),
    [{ id: 101 }],
  );
  assert.deepEqual(
    fieldOptions(
      user,
      "live",
      "assignments",
      { key: "role", values: ["MANAGER", "OPERATOR", "VIEWER"] },
      opts,
      { leaseId: 1001 },
    ),
    ["OPERATOR", "VIEWER"],
  );
});
