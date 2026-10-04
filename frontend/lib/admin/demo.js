export function seedDemo() {
  const organizations = [
    {
      id: 1,
      name: "Brahmaputra Parking Services",
      code: "BPS",
      phone: "+91 361 234 5678",
      contactPerson: "Ananya Das",
      status: "ACTIVE",
    },
    {
      id: 2,
      name: "City Mobility Collective",
      code: "CMC",
      phone: "+91 361 246 8100",
      status: "ACTIVE",
    },
  ];
  const sites = [
    {
      id: 1,
      name: "Panbazar Riverside",
      code: "GMC-PBZ-01",
      address: "MG Road, Panbazar, Guwahati",
      ward: "12",
      timezone: "Asia/Kolkata",
      status: "ACTIVE",
    },
    {
      id: 2,
      name: "Fancy Bazaar Market",
      code: "GMC-FBZ-02",
      address: "Fancy Bazaar, Guwahati",
      ward: "09",
      timezone: "Asia/Kolkata",
      status: "ACTIVE",
    },
    {
      id: 3,
      name: "Dispur Civic Centre",
      code: "GMC-DSP-03",
      address: "GS Road, Dispur, Guwahati",
      ward: "31",
      timezone: "Asia/Kolkata",
      status: "MAINTENANCE",
    },
  ];
  const users = [
    {
      id: 1,
      name: "Ananya Das",
      email: "ananya@example.com",
      phone: "+91 98765 40001",
      platformRole: "USER",
      status: "ACTIVE",
    },
    {
      id: 2,
      name: "Rahul Bora",
      email: "rahul@example.com",
      platformRole: "USER",
      status: "ACTIVE",
    },
    {
      id: 3,
      name: "Priya Sharma",
      phone: "+91 98765 40003",
      platformRole: "USER",
      status: "ACTIVE",
    },
  ];
  const leases = sites.map((s, i) => ({
    id: i + 1,
    parkingAreaId: s.id,
    organizationId: i === 2 ? 2 : 1,
    workOrderNo: `GMC/2026/0${i + 1}`,
    startsAt: "2026-01-01T00:00:00.000Z",
    endsAt: "2027-01-01T00:00:00.000Z",
    status: "ACTIVE",
  }));
  const slots = sites.flatMap((s) =>
    Array.from({ length: s.id === 1 ? 12 : 8 }, (_, i) => ({
      id: s.id * 100 + i,
      parkingAreaId: s.id,
      code: `A-${String(i + 1).padStart(2, "0")}`,
      zone: "A",
      vehicleType: i < 3 ? "TWO_WHEELER" : "FOUR_WHEELER",
      isAccessible: i === 3,
      hasCharger: i === 4,
      status: s.id === 3 ? "OUT_OF_SERVICE" : "ACTIVE",
    })),
  );
  const bookings = Array.from({ length: 6 }, (_, i) => ({
    id: i + 1,
    reference: `DEMO-2026-00${i + 1}`,
    userId: (i % 3) + 1,
    leaseId: (i % 2) + 1,
    slotId: ((i % 2) + 1) * 100 + i,
    vehicleRegistration: `AS 01 AB ${1200 + i}`,
    startsAt: "2026-10-04T04:30:00Z",
    endsAt: "2026-10-04T06:30:00Z",
    totalMinor: "4000",
    currency: "INR",
    status: i < 3 ? "CHECKED_IN" : i === 3 ? "CONFIRMED" : "COMPLETED",
  }));
  return {
    organizations,
    sites,
    users,
    leases,
    slots,
    bookings,
    memberships: [
      { id: 1, userId: 1, organizationId: 1, role: "OWNER", status: "ACTIVE" },
    ],
    assignments: [
      { id: 1, memberId: 1, leaseId: 1, role: "MANAGER", status: "ACTIVE" },
    ],
    pricing: [
      {
        id: 1,
        leaseId: 1,
        name: "Standard · 2 hours",
        vehicleType: "FOUR_WHEELER",
        currency: "INR",
        durationMinutes: 120,
        priceMinor: "4000",
        graceMinutes: 10,
        overtimeUnitMinutes: 60,
        overtimePriceMinor: "2000",
        validFrom: "2026-01-01T00:00:00Z",
        isActive: true,
      },
    ],
    hours: sites.map((s) => ({
      id: s.id,
      parkingAreaId: s.id,
      weekday: 0,
      opensMinute: 480,
      closesMinute: 1320,
    })),
    closures: [],
    qrcodes: [
      {
        id: 1,
        parkingAreaId: 1,
        label: "Main entrance",
        token: "demo-preview-only",
        expiresAt: null,
        revokedAt: null,
      },
    ],
    vehicles: [
      {
        id: 1,
        userId: 3,
        registrationNumber: "AS 01 AB 1202",
        vehicleType: "FOUR_WHEELER",
      },
    ],
    payments: bookings.map((b) => ({
      id: b.id,
      bookingId: b.id,
      provider: "DEMO",
      method: "UPI",
      amountMinor: "4000",
      currency: "INR",
      status: b.id === 4 ? "PENDING" : "SUCCEEDED",
      paidAt: b.id === 4 ? null : "2026-10-04T04:30:00Z",
    })),
    refunds: [],
    events: [],
    audit: [
      {
        id: 1,
        actor: { name: "Demo administrator" },
        action: "DEMO_INITIALIZED",
        entityType: "Workspace",
        entityId: "demo",
        createdAt: "2026-10-04T04:00:00Z",
      },
    ],
  };
}
export function hydrate(db, key, row) {
  const get = (table, id) => db[table]?.find((r) => r.id === id);
  return {
    ...row,
    parkingArea: get("sites", row.parkingAreaId),
    organization: get("organizations", row.organizationId),
    user: get("users", row.userId),
    lease: row.leaseId
      ? hydrate(db, "leases", get("leases", row.leaseId) || {})
      : undefined,
    member: row.memberId
      ? hydrate(db, "memberships", get("memberships", row.memberId) || {})
      : undefined,
    slot: row.slotId
      ? hydrate(db, "slots", get("slots", row.slotId) || {})
      : undefined,
    ...(key === "sites"
      ? {
          _count: {
            slots: db.slots.filter((s) => s.parkingAreaId === row.id).length,
          },
          leases: db.leases
            .filter((l) => l.parkingAreaId === row.id)
            .map((l) => hydrate(db, "leases", l)),
        }
      : {}),
  };
}
export function demoOverview(db) {
  return {
    counts: {
      organizations: db.organizations.length,
      sites: db.sites.length,
      slots: db.slots.length,
      occupied: db.bookings.filter((b) => b.status === "CHECKED_IN").length,
      bookings: db.bookings.length,
      pendingPayments: db.payments.filter((p) => p.status === "PENDING").length,
    },
    revenue: [
      {
        currency: "INR",
        amountMinor: db.payments
          .filter((p) => p.status === "SUCCEEDED")
          .reduce((sum, p) => sum + BigInt(p.amountMinor), 0n)
          .toString(),
      },
    ],
    sites: db.sites.map((s) => hydrate(db, "sites", s)),
    recentBookings: db.bookings.map((b) => hydrate(db, "bookings", b)),
    expiringLeases: [],
  };
}
