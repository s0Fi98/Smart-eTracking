import { randomUUID } from "node:crypto";
// In-memory Prisma test double: resolves actual relationships and evaluates
// filters independently so HTTP tests can assert which tenant records escape.
const now = Date.now();
const past = new Date(now - 86400000),
  later = new Date(now + 86400000 * 60);
export function staffDb(passwordHash) {
  const rows = {
    organization: [1, 2].map((id) => ({
      id,
      name: `Organization ${id}`,
      code: `ORG${id}`,
      status: "ACTIVE",
      phone: "123",
    })),
    parkingArea: [101, 102, 103, 201].map((id) => ({
      id,
      name: `Site ${id}`,
      code: `SITE${id}`,
      status: "ACTIVE",
      address: "Test address",
      timezone: "Asia/Kolkata",
    })),
    parkingLease: [
      {
        id: 1001,
        organizationId: 1,
        parkingAreaId: 101,
        status: "ACTIVE",
        startsAt: past,
        endsAt: later,
      },
      {
        id: 1002,
        organizationId: 1,
        parkingAreaId: 102,
        status: "ACTIVE",
        startsAt: past,
        endsAt: later,
      },
      {
        id: 2001,
        organizationId: 2,
        parkingAreaId: 201,
        status: "ACTIVE",
        startsAt: past,
        endsAt: later,
      },
      {
        id: 2002,
        organizationId: 2,
        parkingAreaId: 101,
        status: "ENDED",
        startsAt: new Date(2020, 0, 1),
        endsAt: new Date(2021, 0, 1),
      },
      {
        id: 3001,
        organizationId: 1,
        parkingAreaId: 103,
        status: "ACTIVE",
        startsAt: later,
        endsAt: new Date(now + 86400000 * 120),
      },
    ].map((l) => ({ ...l, workOrderNo: `WORK-${l.id}` })),
    user: [1, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 99].map((id) => ({
      id,
      name: `User ${id}`,
      email: `user${id}@test.example`,
      passwordHash,
      platformRole: id === 1 ? "SUPER_ADMIN" : "USER",
      status: id === 19 ? "SUSPENDED" : "ACTIVE",
    })),
    organizationMember: [
      [10, 1, "OWNER"],
      [11, 1, "ADMIN"],
      [12, 1, "MEMBER"],
      [13, 1, "ACCOUNTANT"],
      [14, 1, "VIEWER"],
      [15, 1, "MEMBER"],
      [16, 1, "MEMBER"],
      [17, 1, "MEMBER"],
      [18, 1, "MEMBER"],
      [19, 1, "ADMIN"],
      [20, 2, "OWNER"],
      [21, 1, "MEMBER"],
    ].map(([userId, organizationId, role]) => ({
      id: userId,
      userId,
      organizationId,
      role,
      status: "ACTIVE",
    })),
    siteAssignment: [
      [12, "OPERATOR", 1001],
      [15, "MANAGER", 1001],
      [16, "TICKET_COLLECTOR", 1001],
      [17, "VIEWER", 1001],
      [21, "OPERATOR", 3001],
    ].map(([memberId, role, leaseId]) => ({
      id: memberId,
      memberId,
      role,
      leaseId,
      status: "ACTIVE",
    })),
    parkingSlot: [101, 102, 201].map((id) => ({
      id,
      parkingAreaId: id,
      code: `SLOT${id}`,
      status: "ACTIVE",
      vehicleType: "FOUR_WHEELER",
    })),
    pricePlan: [1001, 1002, 2001].map((leaseId, i) => ({
      id: i + 1,
      leaseId,
      name: "Hourly",
      priceMinor: 2000n,
      isActive: true,
      validFrom: past,
      durationMinutes: 60,
      overtimeUnitMinutes: 60,
      overtimePriceMinor: 2000n,
    })),
    booking: [1001, 1002, 2001, 2002].map((leaseId, i) => ({
      id: i + 1,
      leaseId,
      slotId: [101, 102, 201, 101][i],
      userId: 99,
      reference: `BOOKING-${i + 1}`,
      status: "CHECKED_IN",
      createdAt: past,
      totalMinor: 2000n,
      currency: "INR",
      vehicleRegistration: `CAR${i}`,
    })),
    payment: [1, 2, 3, 4].map((id) => ({
      id,
      bookingId: id,
      status: "SUCCEEDED",
      amountMinor: 2000n,
      currency: "INR",
      provider: "TEST",
    })),
    refund: [1, 2, 3].map((id) => ({
      id,
      paymentId: id,
      status: "SUCCEEDED",
      amountMinor: 100n,
    })),
    openingHours: [],
    siteClosure: [],
    siteQrCode: [],
    vehicle: [],
    paymentEvent: [{ id: 1, payload: { private: true } }],
    auditLog: [],
  };
  const relationships = {
    organization: {
      leases: ["parkingLease", "organizationId"],
      members: ["organizationMember", "organizationId"],
    },
    parkingArea: {
      qrCodes: ["siteQrCode", "parkingAreaId"],
      leases: ["parkingLease", "parkingAreaId"],
      slots: ["parkingSlot", "parkingAreaId"],
    },
    parkingLease: {
      organization: ["organization", "id", "organizationId"],
      parkingArea: ["parkingArea", "id", "parkingAreaId"],
    },
    user: { memberships: ["organizationMember", "userId"] },
    organizationMember: {
      organization: ["organization", "id", "organizationId"],
      user: ["user", "id", "userId"],
      assignments: ["siteAssignment", "memberId"],
    },
    siteAssignment: {
      member: ["organizationMember", "id", "memberId"],
      lease: ["parkingLease", "id", "leaseId"],
    },
    parkingSlot: {
      parkingArea: ["parkingArea", "id", "parkingAreaId"],
      bookings: ["booking", "slotId"],
    },
    pricePlan: { lease: ["parkingLease", "id", "leaseId"] },
    booking: {
      qrCode: ["siteQrCode", "id", "qrCodeId"],
      lease: ["parkingLease", "id", "leaseId"],
      user: ["user", "id", "userId"],
      slot: ["parkingSlot", "id", "slotId"],
    },
    payment: {
      booking: ["booking", "id", "bookingId"],
      refunds: ["refund", "paymentId"],
    },
    refund: { payment: ["payment", "id", "paymentId"] },
    openingHours: { parkingArea: ["parkingArea", "id", "parkingAreaId"] },
    siteClosure: { parkingArea: ["parkingArea", "id", "parkingAreaId"] },
    siteQrCode: { parkingArea: ["parkingArea", "id", "parkingAreaId"] },
    auditLog: { actor: ["user", "id", "actorId"] },
  };
  function related(model, row, key) {
    const [target, foreign, local] = relationships[model][key];
    const found = rows[target].filter((r) => r[foreign] === row[local || "id"]);
    return { target, many: !local, value: local ? found[0] : found };
  }
  function matches(model, row, where = {}) {
    if (!row) return false;
    return Object.entries(where).every(([key, value]) => {
      if (value === undefined) return true;
      if (key === "AND")
        return (Array.isArray(value) ? value : [value]).every((x) =>
          matches(model, row, x),
        );
      if (key === "OR") return value.some((x) => matches(model, row, x));
      if (relationships[model]?.[key]) {
        const rel = related(model, row, key);
        return rel.many
          ? value.some
            ? rel.value.some((r) => matches(rel.target, r, value.some))
            : value.none
              ? !rel.value.some((r) => matches(rel.target, r, value.none))
              : false
          : matches(rel.target, rel.value, value.is || value);
      }
      const actual = row[key];
      if (!value || typeof value !== "object" || value instanceof Date)
        return actual === value;
      return Object.entries(value).every(([op, expected]) => {
        if (op === "in") return expected.includes(actual);
        if (op === "not") return actual !== expected;
        if (op === "contains")
          return String(actual || "")
            .toLowerCase()
            .includes(expected.toLowerCase());
        if (op === "gt") return actual > expected;
        if (op === "gte") return actual >= expected;
        if (op === "lt") return actual < expected;
        if (op === "lte") return actual <= expected;
        throw new Error(`Unsupported test filter ${op}`);
      });
    });
  }
  function project(model, row, args = {}) {
    if (!row) return null;
    const result = args.select ? {} : { ...row };
    for (const [key, spec] of Object.entries(
      args.select || args.include || {},
    )) {
      if (key === "_count") {
        result[key] = Object.fromEntries(
          Object.entries(spec.select).map(([name, filter]) => {
            const rel = related(model, row, name);
            return [
              name,
              rel.value.filter((r) => matches(rel.target, r, filter.where))
                .length,
            ];
          }),
        );
      } else if (relationships[model]?.[key]) {
        const rel = related(model, row, key),
          options = spec === true ? {} : spec;
        result[key] = rel.many
          ? rel.value
              .filter((r) => matches(rel.target, r, options.where))
              .map((r) => project(rel.target, r, options))
          : project(rel.target, rel.value, options);
      } else if (spec) result[key] = row[key];
    }
    return result;
  }
  const db = { rows, $queryRaw: async () => [] };
  for (const model of Object.keys(rows))
    db[model] = {
      findMany: async (args = {}) =>
        rows[model]
          .filter((row) => matches(model, row, args.where))
          .slice(args.skip || 0, (args.skip || 0) + (args.take || Infinity))
          .map((row) => project(model, row, args)),
      findFirst: async (args = {}) =>
        project(
          model,
          rows[model].find((row) => matches(model, row, args.where)),
          args,
        ),
      findUnique: async (args = {}) =>
        project(
          model,
          rows[model].find((row) => matches(model, row, args.where)),
          args,
        ),
      count: async (args = {}) =>
        rows[model].filter((row) => matches(model, row, args.where)).length,
      create: async (args) => {
        const row = {
          id: Math.max(0, ...rows[model].map((r) => r.id)) + 1,
          ...(model === "booking"
            ? { reference: randomUUID(), taxMinor: 0n, discountMinor: 0n }
            : {}),
          status: "ACTIVE",
          platformRole: "USER",
          ...args.data,
        };
        rows[model].push(row);
        return project(model, row, args);
      },
      update: async (args) => {
        const row = rows[model].find((r) => matches(model, r, args.where));
        Object.assign(row, args.data);
        return project(model, row, args);
      },
      groupBy: async (args) => [
        {
          currency: "INR",
          _sum: {
            amountMinor: rows[model]
              .filter((row) => matches(model, row, args.where))
              .reduce((sum, row) => sum + row.amountMinor, 0n),
          },
        },
      ],
    };
  db.$transaction = async (fn) => {
    const backup = structuredClone(rows);
    try {
      return await fn(db);
    } catch (error) {
      for (const model of Object.keys(rows)) rows[model] = backup[model];
      throw error;
    }
  };
  return db;
}
