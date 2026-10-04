const field = (key, label, type = "text", extra = {}) => ({
  key,
  label,
  type,
  ...extra,
});
const choice = (key, label, values, extra = {}) =>
  field(key, label, "select", { values, ...extra });
const ref = (key, label, source) =>
  field(key, label, "reference", { source, required: true, immutable: true });
const req = (key, label, type = "text", extra = {}) =>
  field(key, label, type, { required: true, ...extra });
const account = () =>
  choice("status", "Status", ["ACTIVE", "INACTIVE", "SUSPENDED"]);
const vehicle = () =>
  choice("vehicleType", "Vehicle type", [
    "TWO_WHEELER",
    "THREE_WHEELER",
    "FOUR_WHEELER",
    "HEAVY_VEHICLE",
  ]);
const site = () => ref("parkingAreaId", "Parking area", "sites");
const dates = () => [
  req("startsAt", "Starts at", "datetime-local"),
  req("endsAt", "Ends at", "datetime-local"),
];
export const resources = {
  organizations: {
    title: "Organizations",
    singular: "organization",
    description: "Leaseholders, business details and contacts.",
    columns: ["name", "code", "phone", "status"],
    fields: [
      req("name", "Organization name"),
      req("code", "Organization code"),
      req("phone", "Phone"),
      field("legalName", "Legal name"),
      field("registrationNumber", "Registration number"),
      field("taxNumber", "Tax number"),
      field("contactPerson", "Contact person"),
      field("email", "Email", "email"),
      field("address", "Address"),
      account(),
    ],
  },
  sites: {
    title: "Parking areas",
    singular: "parking area",
    description:
      "Physical parking locations, independent of their leaseholders.",
    columns: ["name", "code", "ward", "status"],
    fields: [
      req("name", "Parking area name"),
      req("code", "Site code"),
      req("address", "Address"),
      req("authority", "Authority", "text", {
        default: "Guwahati Municipal Corporation",
      }),
      field("ward", "Ward"),
      field("areaSqft", "Area (square feet)", "number"),
      field("latitude", "Latitude", "decimal"),
      field("longitude", "Longitude", "decimal"),
      req("timezone", "IANA timezone", "text", { default: "Asia/Kolkata" }),
      choice("status", "Status", ["ACTIVE", "INACTIVE", "MAINTENANCE"]),
    ],
  },
  leases: {
    title: "Leases",
    singular: "lease",
    description:
      "Connect an organization to a site for a defined period. Edit status only; create a new lease to change its terms.",
    columns: [
      "workOrderNo",
      "parkingArea",
      "organization",
      "startsAt",
      "endsAt",
      "status",
    ],
    fields: [
      site(),
      ref("organizationId", "Organization", "organizations"),
      req("workOrderNo", "Work order number"),
      ...dates(),
      choice("status", "Status", ["DRAFT", "ACTIVE", "ENDED", "CANCELLED"]),
    ],
    edit: ["status"],
  },
  slots: {
    title: "Parking slots",
    singular: "slot",
    description: "Maintain the actual inventory, vehicle types and facilities.",
    columns: ["code", "parkingArea", "vehicleType", "zone", "status"],
    fields: [
      site(),
      req("code", "Slot code"),
      field("zone", "Zone"),
      field("floor", "Floor"),
      vehicle(),
      field("isAccessible", "Accessible slot", "checkbox"),
      field("hasCharger", "EV charger", "checkbox"),
      choice("status", "Status", ["ACTIVE", "OUT_OF_SERVICE", "RETIRED"]),
    ],
  },
  pricing: {
    title: "Pricing plans",
    singular: "pricing plan",
    description:
      "Versioned tariffs. Existing terms are immutable; deactivate an old plan and create its replacement.",
    columns: [
      "name",
      "lease",
      "vehicleType",
      "durationMinutes",
      "priceMinor",
      "isActive",
    ],
    fields: [
      ref("leaseId", "Lease", "leases"),
      req("name", "Plan name"),
      vehicle(),
      choice("currency", "Currency", ["INR"]),
      req("durationMinutes", "Duration (minutes)", "number"),
      req("priceMinor", "Price (paise, 100 = ₹1)", "money"),
      req("graceMinutes", "Grace (minutes)", "number", { default: 0 }),
      req("overtimeUnitMinutes", "Overtime unit (minutes)", "number"),
      req("overtimePriceMinor", "Overtime price (paise)", "money"),
      req("validFrom", "Valid from", "datetime-local"),
      field("validUntil", "Valid until", "datetime-local"),
      field("isActive", "Active plan", "checkbox", { default: true }),
    ],
    edit: ["isActive"],
  },
  users: {
    title: "Users",
    singular: "user",
    description:
      "Customers and staff accounts. Super administrators are provisioned securely using the backend CLI.",
    columns: ["name", "email", "phone", "platformRole", "status"],
    fields: [
      req("name", "Full name"),
      field("email", "Email", "email"),
      field("phone", "Phone"),
      field("username", "Username"),
      field(
        "password",
        "Initial password (optional, minimum 12 characters)",
        "password",
        { createOnly: true },
      ),
      account(),
    ],
  },
  memberships: {
    title: "Organization roles",
    singular: "membership",
    description: "Grant a user a role within an organization.",
    columns: ["user", "organization", "role", "status"],
    fields: [
      ref("organizationId", "Organization", "organizations"),
      ref("userId", "User", "users"),
      choice(
        "role",
        "Organization role",
        ["OWNER", "ADMIN", "ACCOUNTANT", "VIEWER"],
        { default: "VIEWER" },
      ),
      account(),
    ],
    edit: ["role", "status"],
  },
  assignments: {
    title: "Site operators",
    singular: "site assignment",
    description:
      "Assign an organization member to a lease belonging to the same organization.",
    columns: ["member", "lease", "role", "status"],
    fields: [
      ref("memberId", "Organization member", "memberships"),
      ref("leaseId", "Lease", "leases"),
      choice("role", "Site role", [
        "MANAGER",
        "OPERATOR",
        "TICKET_COLLECTOR",
        "VIEWER",
      ]),
      account(),
    ],
    edit: ["role", "status"],
  },
  hours: {
    title: "Opening hours",
    singular: "opening period",
    description:
      "Local site time. Monday = 0, Sunday = 6. Split overnight opening periods at midnight.",
    columns: ["parkingArea", "weekday", "opensMinute", "closesMinute"],
    fields: [
      site(),
      choice("weekday", "Weekday", ["0", "1", "2", "3", "4", "5", "6"]),
      req("opensMinute", "Opens (minutes after midnight, 0–1439)", "number"),
      req("closesMinute", "Closes (minutes after midnight, 1–1440)", "number"),
    ],
  },
  closures: {
    title: "Site closures",
    singular: "closure",
    description:
      "Temporary closures for maintenance, events or local restrictions.",
    columns: ["parkingArea", "reason", "startsAt", "endsAt"],
    fields: [site(), req("reason", "Reason"), ...dates()],
  },
  qrcodes: {
    title: "QR codes",
    singular: "QR code",
    description:
      "Site discovery codes. A QR code is not a booking or proof of payment.",
    columns: ["label", "parkingArea", "token", "expiresAt", "revokedAt"],
    fields: [
      site(),
      field("label", "Label"),
      field("expiresAt", "Expires at", "datetime-local"),
      field("revokedAt", "Revoked at (set to revoke)", "datetime-local", {
        editOnly: true,
      }),
    ],
  },
  vehicles: {
    title: "Vehicles",
    singular: "vehicle",
    description: "Vehicles associated with customer accounts.",
    columns: ["registrationNumber", "user", "vehicleType"],
    fields: [
      ref("userId", "User", "users"),
      req("registrationNumber", "Registration number"),
      vehicle(),
    ],
  },
  bookings: {
    title: "Bookings",
    description:
      "Booking history and recorded parking times. Booking transitions are managed by the booking service.",
    columns: [
      "reference",
      "user",
      "vehicleRegistration",
      "startsAt",
      "endsAt",
      "totalMinor",
      "status",
    ],
  },
  payments: {
    title: "Payments",
    description:
      "Read-only collection history. Payment confirmation must come from verified gateway workflows.",
    columns: [
      "provider",
      "bookingId",
      "method",
      "amountMinor",
      "currency",
      "paidAt",
      "status",
    ],
  },
  refunds: {
    title: "Refunds",
    description:
      "Read-only refund history. This panel does not initiate or mark refunds as paid.",
    columns: ["paymentId", "provider", "amountMinor", "reason", "status"],
  },
  events: {
    title: "Payment events",
    description:
      "Verified gateway event history; payloads should be redacted at ingestion.",
    columns: [
      "provider",
      "providerEventId",
      "eventType",
      "receivedAt",
      "processedAt",
    ],
  },
  audit: {
    title: "Audit log",
    description: "An accountable trail of administrative changes.",
    columns: ["actor", "action", "entityType", "entityId", "createdAt"],
  },
};
export const groups = [
  { label: "Workspace", items: [["overview", "Overview"]] },
  {
    label: "Parking network",
    items: [
      ["organizations", "Organizations"],
      ["sites", "Parking areas"],
      ["leases", "Leases"],
      ["slots", "Slots & facilities"],
      ["pricing", "Pricing plans"],
      ["qrcodes", "QR codes"],
    ],
  },
  {
    label: "People & operations",
    items: [
      ["users", "People & access"],
      ["hours", "Hours & closures"],
      ["bookings", "Bookings"],
    ],
  },
  {
    label: "Finance & records",
    items: [
      ["payments", "Payments & refunds"],
      ["audit", "Audit log"],
      ["help", "Getting started"],
    ],
  },
];
export const tabs = {
  users: ["users", "memberships", "assignments", "vehicles"],
  hours: ["hours", "closures"],
  payments: ["payments", "refunds", "events"],
};
export function display(value, key = "") {
  if (value == null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Active" : "Inactive";
  if (typeof value === "object")
    return (
      value.name ||
      value.workOrderNo ||
      value.code ||
      (value.user
        ? `${value.user.name} · ${value.organization?.name || value.organizationId}`
        : JSON.stringify(value))
    );
  if (/At$|validFrom|validUntil/.test(key))
    return new Date(value).toLocaleString([], {
      dateStyle: "medium",
      timeStyle: "short",
    });
  if (key.endsWith("Minor")) {
    try {
      const n = BigInt(value);
      return `${n / 100n}.${String(n % 100n).padStart(2, "0")}`;
    } catch {
      return String(value);
    }
  }
  return String(value).replaceAll("_", " ");
}
export const label = (key) =>
  ({
    priceMinor: "Price / currency",
    totalMinor: "Total / currency",
    amountMinor: "Amount / currency",
    isActive: "Status",
    parkingArea: "Parking area",
    durationMinutes: "Minutes",
    opensMinute: "Opens (min)",
    closesMinute: "Closes (min)",
  })[key] ||
  key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
