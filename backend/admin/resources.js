// Explicit allowlists: never pass arbitrary client fields or model names to Prisma.
const str = (required = false, max = 191) => ({
  type: "string",
  required,
  max,
});
const integer = (required = false, min = 0, max = 2147483647) => ({
  type: "integer",
  required,
  min,
  max,
});
const ref = () => integer(true, 1);
const choice = (...values) => ({ type: "enum", values });
const date = (required = false) => ({ type: "date", required });
const money = () => ({ type: "money", required: true });
const bool = { type: "boolean" };
const account = choice("ACTIVE", "INACTIVE", "SUSPENDED");
const vehicle = {
  ...choice("TWO_WHEELER", "THREE_WHEELER", "FOUR_WHEELER", "HEAVY_VEHICLE"),
  required: true,
};
export const safeUser = {
  id: true,
  name: true,
  email: true,
  phone: true,
  username: true,
  platformRole: true,
  status: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
};
const leaseInclude = { organization: true, parkingArea: true };
const bookingInclude = {
  user: { select: safeUser },
  slot: { include: { parkingArea: true } },
  lease: { include: leaseInclude },
};
export const resources = {
  organizations: {
    model: "organization",
    search: ["name", "code", "phone", "email"],
    fields: {
      code: str(true, 50),
      name: str(true),
      legalName: str(),
      registrationNumber: str(false, 100),
      taxNumber: str(false, 50),
      contactPerson: str(false, 120),
      phone: str(true, 20),
      email: str(),
      address: str(false, 5000),
      status: account,
    },
    include: { _count: { select: { leases: true, members: true } } },
  },
  sites: {
    model: "parkingArea",
    search: ["name", "code", "address", "ward"],
    fields: {
      code: str(true, 80),
      name: str(true),
      authority: str(),
      address: str(true, 5000),
      ward: str(false, 50),
      areaSqft: integer(),
      latitude: { type: "decimal", min: -90, max: 90 },
      longitude: { type: "decimal", min: -180, max: 180 },
      timezone: str(false, 64),
      status: choice("ACTIVE", "INACTIVE", "MAINTENANCE"),
    },
    include: {
      _count: { select: { slots: true } },
      leases: {
        include: { organization: true },
        orderBy: { startsAt: "desc" },
      },
    },
  },
  leases: {
    model: "parkingLease",
    search: ["workOrderNo"],
    fields: {
      parkingAreaId: ref(),
      organizationId: ref(),
      workOrderNo: str(true, 100),
      startsAt: date(true),
      endsAt: date(true),
      status: choice("DRAFT", "ACTIVE", "ENDED", "CANCELLED"),
    },
    editable: ["status"],
    include: leaseInclude,
  },
  slots: {
    model: "parkingSlot",
    search: ["code", "zone", "floor"],
    fields: {
      parkingAreaId: ref(),
      code: str(true, 50),
      zone: str(false, 50),
      floor: str(false, 30),
      vehicleType: vehicle,
      isAccessible: bool,
      hasCharger: bool,
      status: choice("ACTIVE", "OUT_OF_SERVICE", "RETIRED"),
    },
    immutable: ["parkingAreaId"],
    include: { parkingArea: true },
  },
  pricing: {
    model: "pricePlan",
    search: ["name"],
    fields: {
      leaseId: ref(),
      name: str(true, 100),
      vehicleType: vehicle,
      currency: choice("INR"),
      durationMinutes: integer(true, 1),
      priceMinor: money(),
      graceMinutes: integer(),
      overtimeUnitMinutes: integer(true, 1),
      overtimePriceMinor: money(),
      validFrom: date(true),
      validUntil: date(),
      isActive: bool,
    },
    editable: ["isActive"],
    include: { lease: { include: leaseInclude } },
  },
  users: {
    model: "user",
    search: ["name", "email", "phone", "username"],
    select: safeUser,
    fields: {
      name: str(true, 120),
      email: str(),
      phone: str(false, 20),
      username: str(false, 50),
      password: str(false, 256),
      status: account,
    },
    editable: ["name", "email", "phone", "username", "status", "password"],
  },
  memberships: {
    model: "organizationMember",
    search: [],
    fields: {
      organizationId: ref(),
      userId: ref(),
      role: choice("OWNER", "ADMIN", "ACCOUNTANT", "VIEWER", "MEMBER"),
      status: account,
    },
    editable: ["role", "status"],
    include: { organization: true, user: { select: safeUser } },
  },
  assignments: {
    model: "siteAssignment",
    search: [],
    fields: {
      memberId: ref(),
      leaseId: ref(),
      role: {
        ...choice("MANAGER", "OPERATOR", "TICKET_COLLECTOR", "VIEWER"),
        required: true,
      },
      status: account,
    },
    editable: ["role", "status"],
    include: {
      member: { include: { organization: true, user: { select: safeUser } } },
      lease: { include: leaseInclude },
    },
  },
  hours: {
    model: "openingHours",
    search: [],
    fields: {
      parkingAreaId: ref(),
      weekday: integer(true, 0, 6),
      opensMinute: integer(true, 0, 1439),
      closesMinute: integer(true, 1, 1440),
    },
    immutable: ["parkingAreaId"],
    include: { parkingArea: true },
  },
  closures: {
    model: "siteClosure",
    search: ["reason"],
    fields: {
      parkingAreaId: ref(),
      startsAt: date(true),
      endsAt: date(true),
      reason: str(true, 255),
    },
    immutable: ["parkingAreaId"],
    include: { parkingArea: true },
  },
  qrcodes: {
    model: "siteQrCode",
    search: ["label", "token"],
    fields: {
      parkingAreaId: ref(),
      label: str(false, 100),
      expiresAt: date(),
      revokedAt: date(),
    },
    editable: ["label", "expiresAt", "revokedAt"],
    include: { parkingArea: true },
  },
  vehicles: {
    model: "vehicle",
    search: ["registrationNumber"],
    fields: {
      userId: ref(),
      registrationNumber: str(true, 30),
      vehicleType: vehicle,
    },
    immutable: ["userId"],
    include: { user: { select: safeUser } },
  },
  bookings: {
    model: "booking",
    search: ["reference", "vehicleRegistration"],
    include: bookingInclude,
  },
  payments: {
    model: "payment",
    search: ["provider", "providerPaymentId", "providerOrderId"],
    include: { booking: { include: bookingInclude }, refunds: true },
  },
  refunds: {
    model: "refund",
    search: ["reason", "providerRefundId"],
    include: { payment: { include: { booking: { include: bookingInclude } } } },
  },
  events: {
    model: "paymentEvent",
    search: ["provider", "providerEventId", "eventType"],
  },
  audit: {
    model: "auditLog",
    search: ["action", "entityType", "entityId"],
    include: { actor: { select: safeUser } },
  },
};
export function readShape(resource) {
  return resource.select
    ? { select: resource.select }
    : resource.include
      ? { include: resource.include }
      : {};
}
