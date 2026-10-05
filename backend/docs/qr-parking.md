# QR entry and cash checkout

## Setup

Start the backend (`cd backend && npm run dev`) and frontend (`cd frontend && npm run dev`). `NEXT_PUBLIC_API_URL` must point to the backend; the frontend origin must be in `ADMIN_ALLOWED_ORIGINS`. Production requires HTTPS for private ticket codes and staff cookies. This feature uses the existing database schema; no new migration is needed. Apply existing migrations first if your database is behind.

In `/dashboard/`, configure an active organization, active parking area, a currently active lease, active slots with vehicle types, and active price plans for those types. Set the base duration/price, grace minutes, and overtime unit/price. Create an unexpired site QR. Opening hours use the area's timezone; no hours means unrestricted hours. Closures block new entries that overlap their interval. A price plan's duration must fit inside the remaining lease.

## Customer flow

1. Open `/qrs/`. It lists up to 1,000 active database sites with valid QR codes and current operating leases. Search, print or download a standee.
2. Both **Proceed** and the QR open `/scan/?token=...`. This route supports newly created sites without a frontend rebuild. Existing exported `/lot/[siteId]` links resolve a live site with the exact matching code; mock sites without a database match cannot accept entry.
3. Enter the vehicle registration and choose a tariff. **Proceed — record entry** allocates a suitable slot and creates a checked-in guest booking. This is immediate parking, not a future reservation.
4. Save the displayed private ticket code. It is also saved in this browser. At exit, use **Calculate fare / refresh status**, show the public ticket reference to the collector, and pay cash.
5. Refresh after staff confirms collection. Only a completed database booking displays exit clearance.

Private ticket codes grant access to the associated receipt, so do not share them publicly. A plate alone cannot retrieve someone's ticket. If the browser data is lost, staff can find the booking by vehicle registration and collect cash through the dashboard. Each guest entry creates a User with no login credentials. Codes are hashed into the booking idempotency key; the raw code is never stored in the database. The browser keeps a pending entry code before sending the request, allowing safe retries after network failures.

## Staff cash collection

Open **Bookings**, find the checked-in ticket, then choose **Cash checkout**. Review the amount, collect the cash, then click **Confirm cash received & release slot**. If the fare changes at an overtime boundary, refresh the quote and collect the updated amount. The backend atomically records a successful CASH payment, completes the booking, and adds a CASH_CHECKOUT audit entry. Repeating the request does not collect twice.

Super admins, the owning organization's OWNER/ADMIN, and the assigned lease's MANAGER/TICKET_COLLECTOR may collect cash. ACCOUNTANT, OPERATOR, and VIEWER roles cannot confirm collection. Current staff access is rechecked on each request. Staff without current lease access must ask an organization admin or super admin to settle an older ticket.

The base charge is always due. Overtime is charged per started overtime unit after the purchased duration plus grace. Tariff terms are snapshotted at entry; later plan changes do not alter existing tickets. Fare runs until the staff checkout timestamp. There is no online gateway or customer-controlled payment confirmation.

## API and operational notes

- `GET /api/parking/sites`: public QR directory.
- `GET /api/qr/:token`: live site details and tariffs.
- `POST /api/parking/entry`: `{token, ticketCode, pricePlanId, vehicleRegistration}`. The ticket code must be 64 lowercase hexadecimal characters generated from 32 cryptographically random bytes.
- `POST /api/parking/ticket`: `{token, ticketCode}`; private receipt and current fare. Existing receipts remain accessible after QR revocation/lease expiry.
- `GET /api/admin/cash/:reference`: authenticated, scoped quote.
- `POST /api/admin/cash/:reference`: `{amountMinor}`; authenticated cash acknowledgment with exact server-quoted amount.

Money is returned as decimal strings in minor units. No public endpoint accepts a price or payment status. Entry allocation locks the parking area and chosen slot in a transaction; checked-in vehicles continue blocking slots after their estimated departure. Cash settlement locks the booking. The public entry limiter is process-local (20 requests/IP/minute); multi-instance deployment needs a shared gateway limiter. There is no proof of physical presence beyond possession of the public QR, so unattended deployment needs an entry verification policy. Browser tickets are not verified customer identities.

Tests use an in-memory Prisma double; database row-lock contention should also be exercised against a disposable MySQL database before production rollout. No live customer bookings are created during automated tests.
