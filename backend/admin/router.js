import { Router } from "express";
import { createAuth, hashPassword, publicIdentity } from "./auth.js";
import { resources, safeUser } from "./resources.js";
import {
  assert,
  HttpError,
  parseData,
  parseId,
  validateRelations,
} from "./validation.js";
import {
  and,
  loadAccess,
  canRead,
  scope,
  scopedShape,
  withPermissions,
  authorizeSave,
  publicAccess,
} from "./access.js";

export function createAdminRouter(prisma, authOptions) {
  const router = Router();
  const auth = createAuth(prisma, authOptions);
  router.post("/login", auth.login);
  router.post("/logout", auth.logout);
  router.use(auth.requireAdmin);
  router.get("/session", (req, res) =>
    res.json({ user: publicIdentity(req.admin, req.access) }),
  );
  router.get("/options", async (req, res) => {
    const a = req.access,
      limit = 1001;
    const lookup = (name, orderBy) =>
      canRead(a, name)
        ? prisma[resources[name].model].findMany({
            where: scope(a, name),
            take: limit,
            ...scopedShape(a, name),
            orderBy,
          })
        : Promise.resolve([]);
    const [organizations, sites, leases, users, memberships] =
      await Promise.all([
        lookup("organizations", { name: "asc" }),
        lookup("sites", { name: "asc" }),
        lookup("leases", { id: "desc" }),
        lookup("users", { name: "asc" }),
        a.superAdmin
          ? lookup("memberships", { id: "desc" })
          : prisma.organizationMember.findMany({
              where: {
                organizationId: {
                  in: [...a.orgAdminIds, ...a.managerOrganizationIds],
                },
                status: "ACTIVE",
                user: { status: "ACTIVE", platformRole: "USER" },
              },
              take: limit,
              orderBy: { id: "desc" },
              select: {
                id: true,
                organizationId: true,
                userId: true,
                organization: { select: { id: true, name: true } },
                user: { select: { id: true, name: true } },
              },
            }),
      ]);
    const result = { organizations, sites, leases, users, memberships };
    res.json({
      ...Object.fromEntries(
        Object.entries(result).map(([key, list]) => [key, list.slice(0, 1000)]),
      ),
      truncated: Object.values(result).some((list) => list.length > 1000),
      access: publicAccess(a),
    });
  });
  router.get("/overview", async (req, res) => {
    const a = req.access,
      now = new Date();
    const count = (name, extra = {}) =>
      canRead(a, name)
        ? prisma[resources[name].model].count({
            where: and(scope(a, name), extra),
          })
        : Promise.resolve(0);
    const [
      organizations,
      sitesCount,
      slots,
      occupied,
      bookings,
      pendingPayments,
      revenue,
      recentBookings,
      sites,
      expiringLeases,
    ] = await Promise.all([
      a.superAdmin
        ? prisma.organization.count()
        : prisma.organization.count({ where: { id: { in: a.contextOrgIds } } }),
      count("sites"),
      count("slots", { status: { not: "RETIRED" } }),
      count("slots", {
        bookings: { some: and(scope(a, "bookings"), { status: "CHECKED_IN" }) },
      }),
      count("bookings"),
      count("payments", { status: "PENDING" }),
      canRead(a, "payments")
        ? prisma.payment.groupBy({
            by: ["currency"],
            where: and(scope(a, "payments"), { status: "SUCCEEDED" }),
            _sum: { amountMinor: true },
          })
        : [],
      canRead(a, "bookings")
        ? prisma.booking.findMany({
            where: scope(a, "bookings"),
            take: 6,
            orderBy: { createdAt: "desc" },
            ...scopedShape(a, "bookings"),
          })
        : [],
      canRead(a, "sites")
        ? prisma.parkingArea.findMany({
            where: scope(a, "sites"),
            take: 6,
            orderBy: { name: "asc" },
            include: {
              _count: {
                select: { slots: { where: { status: { not: "RETIRED" } } } },
              },
              leases: {
                where: and(scope(a, "leases"), {
                  status: "ACTIVE",
                  startsAt: { lte: now },
                  endsAt: { gt: now },
                }),
                include: { organization: true },
              },
            },
          })
        : [],
      canRead(a, "leases")
        ? prisma.parkingLease.findMany({
            take: 5,
            where: and(scope(a, "leases"), {
              status: "ACTIVE",
              endsAt: { gt: now, lte: new Date(now.getTime() + 30 * 86400000) },
            }),
            ...scopedShape(a, "leases"),
            orderBy: { endsAt: "asc" },
          })
        : [],
    ]);
    res.json({
      counts: {
        organizations,
        sites: sitesCount,
        slots,
        occupied,
        bookings,
        pendingPayments,
      },
      revenue: revenue.map((row) => ({
        currency: row.currency,
        amountMinor: row._sum.amountMinor || 0n,
      })),
      recentBookings,
      sites,
      expiringLeases,
    });
  });
  router.get("/resources/:resource", async (req, res) => {
    const name = req.params.resource;
    const config = Object.hasOwn(resources, name) ? resources[name] : null;
    assert(config, "Unknown resource.", 404);
    assert(
      canRead(req.access, name),
      "You do not have access to this resource.",
      403,
    );
    const page = Number(req.query.page || 1),
      pageSize = Number(req.query.pageSize || 20);
    assert(
      Number.isInteger(page) &&
        page >= 1 &&
        page <= 100000 &&
        Number.isInteger(pageSize) &&
        pageSize >= 1 &&
        pageSize <= 100,
      "Invalid pagination.",
    );
    assert(
      !req.query.q || typeof req.query.q === "string",
      "Search must be text.",
    );
    const q = (req.query.q || "").trim().slice(0, 191);
    const search = {};
    if (q && config.search.length)
      search.OR = config.search.map((key) => ({ [key]: { contains: q } }));
    if (req.query.status) {
      const statuses =
        config.fields?.status?.values ||
        {
          bookings: [
            "HELD",
            "CONFIRMED",
            "CHECKED_IN",
            "COMPLETED",
            "CANCELLED",
            "EXPIRED",
            "NO_SHOW",
          ],
          payments: ["PENDING", "SUCCEEDED", "FAILED", "CANCELLED"],
          refunds: ["PENDING", "SUCCEEDED", "FAILED"],
        }[name];
      assert(statuses?.includes(req.query.status), "Invalid status filter.");
      search.status = req.query.status;
    }
    const where = and(scope(req.access, name), search);
    const [items, total] = await Promise.all([
      prisma[config.model].findMany({
        where,
        ...scopedShape(req.access, name),
        orderBy: { id: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma[config.model].count({ where }),
    ]);
    res.json({
      items: items.map((row) => withPermissions(req.access, name, row)),
      total,
      page,
      pageSize,
    });
  });
  const save = (editing) => async (req, res) => {
    const name = req.params.resource;
    const config = Object.hasOwn(resources, name) ? resources[name] : null;
    assert(config, "Unknown resource.", 404);
    const id = editing ? parseId(req.params.id) : null;
    // Organization is required when a scoped administrator creates an identity.
    let body = req.body;
    let organizationId;
    if (
      name === "users" &&
      !editing &&
      body &&
      Object.hasOwn(body, "organizationId")
    ) {
      organizationId = parseId(body.organizationId);
      const { organizationId: ignored, ...fields } = body;
      body = fields;
    }
    const data = parseData(name, body, editing);
    const passwordHash = data.password
      ? await hashPassword(data.password)
      : undefined;
    const record = await prisma.$transaction(
      async (tx) => {
        const actor = await tx.user.findUnique({ where: { id: req.admin.id } });
        assert(
          actor?.status === "ACTIVE" &&
            actor.passwordHash === req.admin.passwordHash,
          "Your staff session has expired.",
          401,
        );
        const access = await loadAccess(tx, actor);
        assert(
          access.canLogin,
          "Your staff access has been removed or expired.",
          403,
        );
        const existing = editing
          ? await tx[config.model].findFirst({
              where: and({ id }, scope(access, name)),
              ...scopedShape(access, name),
            })
          : null;
        if (editing)
          assert(existing, "Record not found or outside your scope.", 404);
        await authorizeSave(tx, access, name, data, existing, organizationId);
        await validateRelations(tx, name, data, existing, actor.id);
        const { password: ignored, ...values } = data;
        if (passwordHash) values.passwordHash = passwordHash;
        const result = editing
          ? await tx[config.model].update({
              where: { id },
              data: values,
              ...scopedShape(access, name),
            })
          : await tx[config.model].create({
              data: values,
              ...scopedShape(access, name),
            });
        if (name === "users" && !editing && organizationId) {
          const membership = await tx.organizationMember.create({
            data: { userId: result.id, organizationId, role: "MEMBER" },
          });
          await tx.auditLog.create({
            data: {
              actorId: actor.id,
              action: "CREATE",
              entityType: "memberships",
              entityId: String(membership.id),
              metadata: { organizationId, userId: result.id },
            },
          });
        }
        const keys = Object.keys(data).map((k) =>
          k === "password" ? "passwordChanged" : k,
        );
        await tx.auditLog.create({
          data: {
            actorId: actor.id,
            action: editing ? "UPDATE" : "CREATE",
            entityType: name,
            entityId: String(result.id),
            metadata: {
              changedFields: keys,
              organizationId:
                organizationId ||
                result.organizationId ||
                result.lease?.organizationId ||
                null,
              parkingAreaId: result.parkingAreaId || null,
              leaseId: result.leaseId || null,
            },
          },
        });
        return withPermissions(access, name, result);
      },
      { isolationLevel: "Serializable" },
    );
    res.status(editing ? 200 : 201).json(record);
  };
  router.post("/resources/:resource", save(false));
  router.patch("/resources/:resource/:id", save(true));
  router.use((req, res, next) =>
    next(new HttpError(404, "Admin endpoint not found.")),
  );
  return router;
}
