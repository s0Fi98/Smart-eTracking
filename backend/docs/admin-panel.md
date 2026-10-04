# Admin panel: setup and operating guide

The administration console lives at **`/dashboard/`**. It follows the Prisma structure in `backend/prisma/schema.prisma`: organizations lease physical parking sites, sites contain slots, and staff receive organization memberships and site assignments.

Preview: [desktop screenshot](images/admin-desktop.png) · [mobile screenshot](images/admin-mobile.png).

The console has two explicit modes:

| Mode | What it does |
| --- | --- |
| Live | Authenticates an active SUPER_ADMIN, reads MySQL through the Express API, saves setup changes, and records audit entries. Requires database setup below. |
| Demo | Uses sample Guwahati parking data stored only in this browser's local storage. No database connection, account, gateway or real payment is involved. |

## 1. Explore immediately

From the repository root:

```sh
cd frontend
npm install
npm run dev
```

Open **http://localhost:3000/dashboard/** and select **Explore demo**. Sample organizations, sites, bookings and transactions demonstrate the relationships. You can create/edit setup records, search tables, preview QR codes and inspect record details. Demo changes persist in the same browser; **Reset demo** restores the original sample network. Demo data does not automatically refresh from live records or get imported into MySQL. Demo mode illustrates the UI; server-side cross-record validation applies only in live mode.

If the API is unavailable, the live sign-in screen shows a connection error. You can still explicitly enter demo mode. There is no silent switch from live records to sample data.

## 2. Prepare the live database

Use the database design and migration notes in [database-design.md](database-design.md) first. The earlier three-model schema is not compatible with this panel.

For an **existing database**, back it up and implement the staged migration described there. Move operators into organizations, area tenure into leases, and old staff roles into memberships/assignments. Do not push the replacement schema over existing records or accept data-loss prompts.

For a **new, empty development database only**, create a MySQL database, configure the backend `.env`, and initialize it with:

```sh
cd backend
npm install
npm run db:validate
npm run db:push
npm run db:generate
```

`db:push` is an empty-development-database convenience, not a production migration strategy. Existing installations should generate the client after their reviewed migration is ready. No migration is applied automatically when you start the API.

Use `backend/config.example.env` as a reference. Prisma CLI uses `DATABASE_URL`; the runtime MariaDB adapter uses `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME`. Both sets must point to the **same database**. Do not commit `.env` files.

Set these additional variables in `backend/.env`:

```dotenv
PORT=5000
ADMIN_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
ADMIN_SESSION_SECRET=replace-with-at-least-32-random-characters
```

Generate a secret locally, for example with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`, and put the result in `ADMIN_SESSION_SECRET`. The placeholder above must be replaced; use a private random value, not a project name or shared password.

## 3. Create the first super administrator

There are no built-in credentials and no public admin registration. Temporarily set these variables in the backend's local environment or `.env`:

```dotenv
ADMIN_EMAIL=your-admin-email@example.com
ADMIN_NAME=Platform Administrator
ADMIN_PASSWORD=choose-a-unique-password-at-least-12-characters
```

From `backend/`, run:

```sh
npm run admin:create
```

The command hashes the password with scrypt, creates an active SUPER_ADMIN, and writes a bootstrap audit entry. It refuses to overwrite or promote an existing email. Remove `ADMIN_PASSWORD` from the environment/file after provisioning. The user-management screen cannot grant SUPER_ADMIN or reset passwords; trusted server provisioning is the current mechanism for creating additional platform administrators. There is no password-recovery UI in this release.

## 4. Start and sign in

Start the backend:

```sh
cd backend
npm run dev
```

In another terminal, start the frontend as above. By default the frontend calls `http://localhost:5000`. To change it, set `NEXT_PUBLIC_API_URL` in `frontend/.env.local` **before starting or building** the frontend, using `frontend/config.example.env` as a reference.

Open **http://localhost:3000/dashboard/** and sign in with the provisioned administrator email/password. Use the same host spelling on both sides: `localhost` with `localhost`, or `127.0.0.1` with `127.0.0.1`. Mixed hosts can prevent the browser from sending the session cookie.

Live access is currently for SUPER_ADMIN only. Organization and site roles can be configured and viewed, but separate staff portals and their scoped permissions are not implemented in this release.

Sessions last eight hours. An HttpOnly cookie carries the signed session; credentials are not stored in localStorage. Sign out clears the browser cookie. Each request rechecks the user's active status and platform role. Password-hash changes or rotating the signing secret invalidate existing sessions. Ten unsuccessful attempts per client IP are allowed per 15-minute window; this limiter is process-local, so multi-instance deployments should provide shared rate limiting at their ingress.

## 5. Set up a parking operation

Follow this order so that relationship selectors contain the right records.

1. **Organizations → Add organization.** Enter the leaseholder's name, unique code and phone; add legal and contact details as needed. An organization can hold several site leases.
2. **Parking areas → Add parking area.** Add a unique site code, name, address, timezone and optional coordinates. A parking area is the physical location, not its current operator. Use `Asia/Kolkata` for Guwahati sites.
3. **Leases → Add lease.** Select the area and organization, record the work-order number and start/end times. Start with DRAFT, then change status to ACTIVE when ready. Operating lease periods cannot overlap on one site. Lease terms are immutable after creation; only status can be edited. DRAFT can become ACTIVE or CANCELLED; ACTIVE becomes ENDED only after its end time. ENDED/CANCELLED records remain historical.
4. **Slots & facilities → Add slot.** Create one record per actual parking space. Slot codes must be unique within a site. Set vehicle type, zone, floor, accessibility and charger availability. Capacity comes from slot records. Retired slots are excluded from capacity; out-of-service slots are unavailable for allocation. You cannot change a slot's availability/type while it has current or upcoming bookings.
5. **Hours & closures → Opening hours.** Add each opening period using the site's local clock. Monday is 0, Sunday is 6. 08:00 = 480; 20:00 = 1200. For 24-hour operation use 0–1440 for each day. Split 22:00–02:00 into 1320–1440 on the first day and 0–120 on the next. Overlapping periods are rejected. The current panel supports adding/editing periods, not deleting them; correcting a schedule with fewer periods requires a reviewed maintenance change.
6. **Hours & closures → Site closures.** Add date/time intervals for maintenance and exceptional closures. End must follow start. Scheduling is stored for the future booking service to enforce; the public scan view currently reports site information and inventory, not a bookability guarantee.
7. **Pricing plans → Add pricing plan.** Select the lease, vehicle type, duration, price, grace time and overtime unit/rate. Money inputs are integer **paise**: 2,000 = ₹20; 4,000 = ₹40. New tariffs use INR. Validity must fit within the lease. To change terms, create a new plan and deactivate the old one; only the active flag can be edited on an existing tariff. Already sold bookings keep their pricing snapshot.
8. **People & access → Users.** Add staff/customer identities. At least one email, phone or username is required. Optional initial passwords must be 12–256 characters; USER accounts still cannot enter this super-admin console.
9. **People & access → Organization roles.** Select a user and organization; choose OWNER, ADMIN, ACCOUNTANT or VIEWER. The default is VIEWER. This records scoped access for future staff services, not platform access.
10. **People & access → Site operators.** Select a membership and a lease of the same organization; choose MANAGER, OPERATOR, TICKET_COLLECTOR or VIEWER. Cross-organization assignments are rejected.
11. **QR codes → Add QR code.** Select a site, label the code and optionally set expiry. Choose the row's **QR** action to preview, copy its link or download SVG. Use a frontend host reachable by customers before downloading a live sign: the link uses the current frontend origin. A localhost QR is useful only on the development machine.

To revoke a QR, edit it and set **Revoked at**. Revocation is permanent; create a replacement code instead of clearing that timestamp. The preview flags expired/revoked codes. Demo QR codes are explicitly marked and cannot resolve to live sites.

Dates entered in forms and displayed in tables use the browser's timezone (shown in the footer); the API stores UTC. Opening-hour minutes use the site's timezone. Lease end times are exclusive: an operating period through 31 December ends at 00:00 on 1 January in the applicable timezone.

## 6. Daily use and monitoring

| Screen | Purpose |
| --- | --- |
| Overview | Site/organization/slot counts, checked-in occupancy, all-time successful gross collections grouped by currency, recent bookings, pending payments, and a preview of leases ending in the next 30 days. Refunds are not deducted from gross collections. |
| Bookings | Read customer, vehicle, reservation and actual entry/exit records. View full record details for price snapshots and related data. |
| Payments & refunds | Tabs for payment attempts, refunds and gateway events. These are read-only ledgers. |
| People & access | Users, organization roles, site operators, and saved customer vehicles. |
| Audit log | Actor, action, resource, record ID, timestamp, and changed-field metadata for admin writes. |
| Getting started | In-app summary of this setup sequence. |

Search submits when you select **Search**. Text-searchable fields differ by resource: organizations use name/code/contact; sites use name/code/address/ward; leases use work order; slots use code/zone/floor; users use name/email/phone/username; bookings use reference/registration. Relationship-only tables have no server-side free-text fields. Use pagination to browse and **View** for details. **Refresh** reloads live records; screens do not receive real-time push updates.

Tables paginate at 20 rows. Reference dropdowns load up to 1,000 records per resource and show a warning if truncated. A larger installation should extend reference endpoints with server-side typeahead; do not choose an unrelated record when the intended one is absent.

The panel deliberately has no hard-delete actions. Suspend/deactivate users and organizations, retire slots, end leases, and revoke QR codes to retain history. A super administrator cannot deactivate their own account or remove the last active administrator through this panel.

## 7. QR and customer boundaries

New admin codes point to **`/scan/?token=…`**. That page checks expiry/revocation and active site/lease/organization state through `/api/qr/:token`, then shows the site, current inventory count and active rates. Its available-slot count is an instant inventory estimate, not a reservation promise; opening hours, closures, interval availability and overstay rules still belong to the booking service. The page explicitly states that online booking is not yet available.

The original `/lot/[siteId]` and `/qrs` experiences still use their existing mock registry. They do not become database-backed booking/payment services through this admin change. The admin does not create reservations, confirm payments, issue refunds or run payment webhooks. Existing financial records can be inspected; live booking/payment workers are a separate implementation step.

## 8. Deployment and troubleshooting

The frontend remains a static export. Build with `npm run build` in `frontend/` and serve `frontend/out/`, including `/dashboard/` and `/scan/`. The Express backend runs separately. If the local environment blocks Turbopack worker port creation, `npm run build -- --webpack` is an equivalent build option.

For production, set `NODE_ENV=production` for the backend, use HTTPS, configure an unpredictable session secret and list only exact trusted frontend origins. Host frontend/API on the same site (for example `parking.example.com` and `api.example.com`) or reverse proxy `/api` on the frontend origin. Cookies are Secure in production and SameSite=Lax. Cross-site hosting on unrelated domains is not supported by this cookie configuration. Set `NEXT_PUBLIC_API_URL` to the API origin; for a same-origin proxy set it to the public frontend origin before building. Build-time variables are not changed by restarting a static file server.

The new authenticated resource API replaces legacy `/api/operators` and `/api/parking-areas`, which return 410 to prevent unauthenticated management writes.

| Symptom | Check |
| --- | --- |
| Cannot connect | Backend running on configured port; correct build-time API URL; correct allowed frontend origin. |
| Authentication not configured | `ADMIN_SESSION_SECRET` has at least 32 random characters; restart backend after environment edits. |
| Invalid administrator email/password | Bootstrap completed, email correct, password correct, user active and SUPER_ADMIN. Regular staff cannot log in here. |
| Sign-in works but next request is unauthorized | Same host/site on frontend and API; HTTPS in production; browser cookies allowed. |
| Schema not ready/out of date | Apply the reviewed migration, regenerate Prisma client, restart API. |
| Duplicate record | Organization/site code, user identifier, slot code, membership, assignment or work-order uniqueness conflict. |
| Lease/hours overlap | Adjust periods so one ends at or before another begins. |
| Another administrator changed the data | Refresh and retry; the transaction was rolled back. |
| QR unavailable | Check token, expiry, revocation, site status, active lease dates and organization status. |

## Verification and API reference

Run `npm test` from `backend/` for password/session, HTTP authorization, origin protection, input validation, cross-organization, overlap and audit-path tests. These use a database test double; they do not establish MySQL migration/concurrency correctness. Run `npm run db:validate` and the frontend production build as additional checks. Validate a migrated staging database before production use.

Core endpoints:

- `POST /api/admin/login`, `GET /api/admin/session`, `POST /api/admin/logout`.
- `GET /api/admin/overview`, `GET /api/admin/options`.
- `GET /api/admin/resources/:resource?page=1&pageSize=20&q=…&status=…`.
- `POST /api/admin/resources/:resource` and `PATCH /api/admin/resources/:resource/:id` for writable setup resources.
- `GET /api/qr/:token` for limited public site discovery.

Writes require a session cookie and an allowed `Origin` header. Allowed resource names and exact field allowlists are in `backend/admin/resources.js`. Password hashes never appear in API user records. Monetary values serialize as decimal minor-unit strings to preserve precision. No endpoint accepts a client-selected Prisma model or arbitrary nested update object.
