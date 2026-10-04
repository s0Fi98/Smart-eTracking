import { resources, readShape, safeUser } from "./resources.js";
import { assert } from "./validation.js";

const unique = (values) => [...new Set(values)];
const ids = (values) => ({ in: values });
const none = { id: { in: [] } };
export const and = (...parts) => ({ AND: parts });
const organizationRoles = ["OWNER", "ADMIN", "ACCOUNTANT", "VIEWER"];
const siteRoles = ["MANAGER", "OPERATOR", "TICKET_COLLECTOR", "VIEWER"];
const current = (lease, now) =>
  lease.status === "ACTIVE" &&
  new Date(lease.startsAt) <= now &&
  new Date(lease.endsAt) > now;
export function editableFields(name) {
  const config = resources[name];
  return config?.fields
    ? config.editable ||
        Object.keys(config.fields).filter(
          (key) => !config.immutable?.includes(key),
        )
    : [];
}

// Roles are loaded from the database on EVERY request, never trusted from cookies.
export async function loadAccess(db, user, now = new Date()) {
  if (user.platformRole === "SUPER_ADMIN") return buildAccess(user, [], now);
  const memberships = await db.organizationMember.findMany({
    where: {
      userId: user.id,
      status: "ACTIVE",
      organization: { status: "ACTIVE" },
    },
    include: {
      organization: {
        include: {
          leases: {
            where: {
              status: "ACTIVE",
              startsAt: { lte: now },
              endsAt: { gt: now },
            },
            select: {
              id: true,
              organizationId: true,
              parkingAreaId: true,
              status: true,
              startsAt: true,
              endsAt: true,
            },
          },
        },
      },
      assignments: {
        where: {
          status: "ACTIVE",
          lease: {
            status: "ACTIVE",
            startsAt: { lte: now },
            endsAt: { gt: now },
          },
        },
        include: {
          lease: {
            include: { parkingArea: { select: { id: true, name: true } } },
          },
        },
      },
    },
  });
  return buildAccess(user, memberships, now);
}
export function buildAccess(user, memberships, now = new Date()) {
  const active = memberships.filter(
    (m) =>
      m.userId === user.id &&
      m.status === "ACTIVE" &&
      m.organization?.status === "ACTIVE",
  );
  const assignments = active.flatMap((m) =>
    (m.assignments || [])
      .filter(
        (a) =>
          a.status === "ACTIVE" &&
          siteRoles.includes(a.role) &&
          a.lease?.organizationId === m.organizationId &&
          current(a.lease, now),
      )
      .map((a) => ({ ...a, organizationId: m.organizationId })),
  );
  const orgs = (roles) =>
    active.filter((m) => roles.includes(m.role)).map((m) => m.organizationId);
  const orgReadIds = orgs(organizationRoles);
  const orgAdminIds = orgs(["OWNER", "ADMIN"]);
  const managed = assignments.filter((a) => a.role === "MANAGER");
  const siteIdsFor = (organizations) =>
    unique(
      active
        .filter((m) => organizations.includes(m.organizationId))
        .flatMap((m) =>
          (m.organization.leases || [])
            .filter((l) => current(l, now))
            .map((l) => l.parkingAreaId),
        ),
    );
  const access = {
    userId: user.id,
    superAdmin: user.platformRole === "SUPER_ADMIN",
    now,
    memberships: active,
    assignments,
    orgReadIds,
    orgAdminIds,
    orgOwnerIds: orgs(["OWNER"]),
    orgFinanceIds: orgs(["OWNER", "ADMIN", "ACCOUNTANT"]),
    assignedLeaseIds: unique(assignments.map((a) => a.leaseId)),
    financeLeaseIds: unique(
      assignments
        .filter((a) => ["MANAGER", "TICKET_COLLECTOR"].includes(a.role))
        .map((a) => a.leaseId),
    ),
    managerLeaseIds: unique(managed.map((a) => a.leaseId)),
    managerOrganizationIds: unique(managed.map((a) => a.organizationId)),
    orgManagedSiteIds: siteIdsFor(orgAdminIds),
    managerSiteIds: unique(managed.map((a) => a.lease.parkingAreaId)),
    siteIds: unique([
      ...siteIdsFor(orgReadIds),
      ...assignments.map((a) => a.lease.parkingAreaId),
    ]),
    contextOrgIds: unique([
      ...orgReadIds,
      ...assignments.map((a) => a.organizationId),
    ]),
  };
  access.canLogin =
    user.status === "ACTIVE" &&
    (access.superAdmin || orgReadIds.length > 0 || assignments.length > 0);
  access.permissions = Object.fromEntries(
    Object.keys(resources).map((name) => [
      name,
      {
        read: canRead(access, name),
        create: canCreate(access, name),
        update: access.superAdmin
          ? editableFields(name).length > 0
          : [
              "organizations",
              "sites",
              "slots",
              "pricing",
              "memberships",
              "assignments",
              "hours",
              "closures",
              "qrcodes",
            ].includes(name) &&
            (orgAdminIds.length > 0 ||
              ([
                "sites",
                "slots",
                "pricing",
                "assignments",
                "hours",
                "closures",
                "qrcodes",
              ].includes(name) &&
                managed.length > 0)),
      },
    ]),
  );
  return access;
}
export function canRead(a, name) {
  if (a.superAdmin) return Object.hasOwn(resources, name);
  if (["audit", "events", "vehicles"].includes(name)) return false;
  if (["users", "memberships"].includes(name)) return a.orgAdminIds.length > 0;
  if (name === "assignments")
    return a.orgAdminIds.length > 0 || a.managerLeaseIds.length > 0;
  if (name === "organizations") return a.orgReadIds.length > 0;
  if (["payments", "refunds"].includes(name))
    return a.orgFinanceIds.length > 0 || a.financeLeaseIds.length > 0;
  if (["sites", "slots", "hours", "closures", "qrcodes"].includes(name))
    return a.siteIds.length > 0;
  return (
    ["leases", "pricing", "bookings"].includes(name) &&
    (a.orgReadIds.length > 0 || a.assignedLeaseIds.length > 0)
  );
}
export function canCreate(a, name) {
  if (!resources[name]?.fields) return false;
  if (a.superAdmin) return true;
  if (["users", "memberships"].includes(name)) return a.orgAdminIds.length > 0;
  if (["slots", "hours", "closures", "qrcodes"].includes(name))
    return a.orgManagedSiteIds.length > 0 || a.managerSiteIds.length > 0;
  return (
    ["pricing", "assignments"].includes(name) &&
    (a.orgAdminIds.length > 0 || a.managerLeaseIds.length > 0)
  );
}
const leaseScope = (organizationIds, leaseIds) => ({
  OR: [{ organizationId: ids(organizationIds) }, { id: ids(leaseIds) }],
});
export function scope(a, name) {
  if (a.superAdmin) return {};
  if (!canRead(a, name)) return none;
  const lease = leaseScope(a.orgReadIds, a.assignedLeaseIds);
  const finance = leaseScope(a.orgFinanceIds, a.financeLeaseIds);
  switch (name) {
    case "organizations":
      return { id: ids(a.orgReadIds) };
    case "sites":
      return { id: ids(a.siteIds) };
    case "leases":
      return lease;
    case "slots":
    case "hours":
    case "closures":
    case "qrcodes":
      return { parkingAreaId: ids(a.siteIds) };
    case "pricing":
    case "bookings":
      return { lease };
    case "payments":
      return { booking: { lease: finance } };
    case "refunds":
      return { payment: { booking: { lease: finance } } };
    case "memberships":
      return { organizationId: ids(a.orgAdminIds) };
    case "assignments":
      return { lease: leaseScope(a.orgAdminIds, a.managerLeaseIds) };
    case "users":
      return {
        platformRole: "USER",
        memberships: { some: { organizationId: ids(a.orgAdminIds) } },
      };
    default:
      return none;
  }
}

const contactUser = {
  id: true,
  name: true,
  email: true,
  phone: true,
  username: true,
  platformRole: true,
  status: true,
};
// Do not leak other leaseholders through eager-loaded relations on a shared site.
export function scopedShape(a, name) {
  const shape = readShape(resources[name]);
  if (a.superAdmin) return shape;
  function minimize(value) {
    if (value === safeUser) return contactUser;
    if (value && typeof value === "object")
      return Object.fromEntries(
        Object.entries(value).map(([k, v]) => [k, minimize(v)]),
      );
    return value;
  }
  const result = minimize(shape);
  if (name === "sites") result.include.leases.where = scope(a, "leases");
  return result;
}
export function rowFields(a, name, row) {
  if (a.superAdmin) return editableFields(name);
  if (name === "organizations" && a.orgAdminIds.includes(row.id))
    return editableFields(name).filter((k) => !["status", "code"].includes(k));
  if (["sites", "slots", "hours", "closures", "qrcodes"].includes(name)) {
    const siteId = name === "sites" ? row.id : row.parkingAreaId;
    if (a.orgManagedSiteIds.includes(siteId)) return editableFields(name);
    if (a.managerSiteIds.includes(siteId))
      return name === "sites" ? ["status"] : editableFields(name);
  }
  if (["pricing", "assignments"].includes(name)) {
    if (
      a.orgAdminIds.includes(row.lease?.organizationId) ||
      a.managerLeaseIds.includes(row.leaseId)
    ) {
      if (
        name === "assignments" &&
        !a.orgAdminIds.includes(row.lease?.organizationId) &&
        (row.role === "MANAGER" || row.member?.userId === a.userId)
      )
        return [];
      return editableFields(name);
    }
  }
  if (
    name === "memberships" &&
    a.orgAdminIds.includes(row.organizationId) &&
    row.userId !== a.userId
  ) {
    if (
      a.orgOwnerIds.includes(row.organizationId) ||
      !["OWNER", "ADMIN"].includes(row.role)
    )
      return editableFields(name);
  }
  return [];
}
export const withPermissions = (a, name, row) => ({
  ...row,
  _access: { updateFields: rowFields(a, name, row) },
});
export function publicAccess(a) {
  return {
    superAdmin: a.superAdmin,
    permissions: a.permissions,
    label: a.superAdmin
      ? "Super administrator"
      : unique([
          ...a.memberships
            .filter((m) => organizationRoles.includes(m.role))
            .map((m) => m.role),
          ...a.assignments.map((x) => x.role),
        ])
          .join(" · ")
          .replaceAll("_", " "),
    organizations: a.memberships
      .filter((m) => a.contextOrgIds.includes(m.organizationId))
      .map((m) => ({
        id: m.organizationId,
        name: m.organization.name,
        role: m.role,
      })),
    managedOrganizationIds: a.orgAdminIds,
    ownerOrganizationIds: a.orgOwnerIds,
    managedSiteIds: unique([...a.orgManagedSiteIds, ...a.managerSiteIds]),
    managedLeaseIds: a.managerLeaseIds,
    assignments: a.assignments.map((x) => ({
      leaseId: x.leaseId,
      role: x.role,
      parkingAreaId: x.lease.parkingAreaId,
      siteName: x.lease.parkingArea?.name,
    })),
  };
}

// Called inside the write transaction, after reloading the actor's current grants.
export async function authorizeSave(
  tx,
  a,
  name,
  data,
  existing,
  organizationId,
) {
  if (a.superAdmin) return;
  assert(
    existing ? rowFields(a, name, existing).length > 0 : canCreate(a, name),
    "You do not have permission to change this resource.",
    403,
  );
  if (existing) {
    const fields = rowFields(a, name, existing);
    assert(
      Object.keys(data).every((k) => fields.includes(k)),
      "You cannot change one or more of these fields.",
      403,
    );
  }
  const row = { ...existing, ...data };
  if (name === "users") {
    assert(
      !existing && a.orgAdminIds.includes(organizationId),
      "Select an organization you manage for this new staff account.",
      403,
    );
  }
  if (["slots", "hours", "closures", "qrcodes"].includes(name)) {
    assert(
      [...a.orgManagedSiteIds, ...a.managerSiteIds].includes(row.parkingAreaId),
      "This parking area is outside your management scope.",
      403,
    );
  }
  if (["pricing", "assignments"].includes(name)) {
    const lease = await tx.parkingLease.findFirst({
      where: and(
        { id: row.leaseId },
        leaseScope(a.orgAdminIds, a.managerLeaseIds),
      ),
    });
    assert(
      lease &&
        ["ACTIVE", "DRAFT"].includes(lease.status) &&
        lease.endsAt > a.now,
      "This lease is outside your management scope or has ended.",
      403,
    );
    if (
      name === "assignments" &&
      !a.orgAdminIds.includes(lease.organizationId)
    ) {
      assert(
        row.role !== "MANAGER" && existing?.role !== "MANAGER",
        "Only organization administrators can appoint site managers.",
        403,
      );
      const member = await tx.organizationMember.findUnique({
        where: { id: row.memberId },
      });
      assert(
        member && member.userId !== a.userId,
        "Site managers cannot change their own assignments.",
        403,
      );
    }
  }
  if (name === "memberships") {
    assert(
      a.orgAdminIds.includes(row.organizationId) && row.userId !== a.userId,
      "You cannot change this membership or your own organization role.",
      403,
    );
    if (!a.orgOwnerIds.includes(row.organizationId))
      assert(
        !["OWNER", "ADMIN"].includes(row.role) &&
          !["OWNER", "ADMIN"].includes(existing?.role),
        "Only organization owners can appoint or change owners and administrators.",
        403,
      );
    if (!existing) {
      const user = await tx.user.findFirst({
        where: and({ id: row.userId }, scope(a, "users")),
      });
      assert(
        user,
        "Create a new staff account first, or ask a super administrator to link an existing external account.",
        403,
      );
    }
    if (
      existing?.role === "OWNER" &&
      existing.status === "ACTIVE" &&
      (row.role !== "OWNER" || row.status !== "ACTIVE")
    ) {
      const remaining = await tx.organizationMember.count({
        where: {
          organizationId: row.organizationId,
          role: "OWNER",
          status: "ACTIVE",
          id: { not: existing.id },
        },
      });
      assert(remaining > 0, "Keep at least one active organization owner.");
    }
  }
}
