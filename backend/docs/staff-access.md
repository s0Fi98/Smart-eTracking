# Staff login and role-scoped access

Everyone signs in at **`/dashboard/` using their own email and password**. There is no role picker: the API derives permissions from active organization memberships and site assignments. Menus, forms, table rows, reference lists, and overview totals follow that scope.

## Update an existing installation

Back up the database and review the new migration, then run from `backend/`:

```sh
npm run db:deploy
npm run db:generate
npm run dev
```

Restart/rebuild the frontend too. The new migration is `20261004010000_staff_access`; it adds the organization role `MEMBER` and makes it the default. It also converts existing VIEWER memberships that have site assignments to MEMBER, preventing old default memberships from unintentionally granting access to every site in the organization. Review those users after deployment; an owner or super administrator can deliberately restore organization-wide VIEWER access if needed.

No changes are made to existing passwords. An account without a password cannot sign in until a super administrator sets one. No default staff passwords are provided.

If the database still uses the original three-table schema, follow [migrations.md](migrations.md) before deploying this change. Do not reset a database to resolve migration-history conflicts.

## Create an operator, collector, site manager, or site viewer

As a super administrator or organization OWNER/ADMIN:

1. Open **People & access → Users → Add user**.
2. Enter the staff name, email and password (12–256 characters). Select the organization. Saving creates the user and an active MEMBER membership in one transaction. Organization administrators must select an organization they manage. A super administrator may omit the organization when creating a customer/unassigned account.
3. Open **People & access → Site operators → Add site assignment**.
4. Select the new membership and a lease belonging to the same organization. Choose MANAGER, OPERATOR, TICKET_COLLECTOR or VIEWER, with status ACTIVE.
5. Ensure the user, membership, organization and assignment are active, and the lease is ACTIVE with a start time at/before now and an end time in the future.
6. Sign out and sign in with the staff email/password on the same `/dashboard/` page.

A MEMBER without a current site assignment has no dashboard access. Draft, future, ended, expired and cancelled leases do not grant site staff access. Organization-wide roles can sign in even if their organization has no current sites yet.

For an existing user, a super administrator can create the organization membership. Organization administrators can link accounts already visible within organizations they manage, but cannot discover or claim arbitrary external accounts. Ask a super administrator to link a pre-existing external user rather than trying to create a duplicate email.

## Create an organization administrator, accountant, or viewer

Create the user with an organization as above, then edit their **Organization roles** membership:

- OWNER: organization administration and authority to appoint other owners/admins.
- ADMIN: organization setup and lower-privilege staff administration.
- ACCOUNTANT: organization financial and related operational records, read only.
- VIEWER: organization operational records, read only; no payment/refund ledger access.
- MEMBER: no organization-wide access; requires explicit site assignments.

Only an organization OWNER or SUPER_ADMIN can appoint/change OWNER or ADMIN memberships. Organization admins can manage ACCOUNTANT, VIEWER and MEMBER memberships. Scoped staff cannot change their own organization membership. The last active owner cannot be removed through scoped administration.

An account's platform role remains USER for all these staff roles. Do not change it to SUPER_ADMIN to make staff login work.

## Implemented permission matrix

| Role | Read scope | Setup changes |
| --- | --- | --- |
| SUPER_ADMIN | All organizations and resources, including audit, gateway events and saved vehicles | All existing setup operations; platform accounts are provisioned through CLI |
| Organization OWNER / ADMIN | Their organization's leases/history, current sites, staff, bookings, payments and refunds | Organization profile; current-site details, slots, tariffs, hours, closures, QR codes; staff creation, memberships and assignments subject to delegation rules |
| Organization ACCOUNTANT | Their organization's operational context, bookings, payments and refunds | None |
| Organization VIEWER | Their organization's sites, leases, slots, tariffs, schedules, QR codes and bookings | None |
| Site MANAGER | Current assigned sites/leases, operational records, bookings, payments and refunds | Site status, slots, tariffs, schedules, QR codes, and non-manager assignments on those leases |
| Site OPERATOR | Current assigned sites/leases and booking records | None in this release; booking operations remain read only |
| Site TICKET_COLLECTOR | Current assigned sites/leases, bookings, payments and refunds | None in this release; collections/refunds remain read only |
| Site VIEWER | Current assigned sites/leases and booking records | None |

Physical site creation and lease creation/status changes remain platform-admin operations. Organization staff can see their organization's historical leases/bookings/finances, but can change shared physical site settings only during a current operating lease. They cannot see another leaseholder's nested lease history even if the physical site is the same.

Site managers may appoint OPERATOR, TICKET_COLLECTOR or VIEWER on their managed leases, but cannot appoint managers or alter their own assignment. Their membership selector exposes only an active staff name/ID directory from the relevant organization so they can make assignments; it does not expose account credentials or contact fields. Site managers do not receive organization-wide staff management.

Multiple roles add access within their individual scopes. For example, ADMIN of organization A and OPERATOR at a site in organization B does not grant administrator writes in B. The API checks the target record's scope, not merely whether the person is an admin somewhere.

## Passwords and account management

Only SUPER_ADMIN can edit an existing global user identity or set a replacement password: **Users → Edit → Password**. Leave password blank to keep it unchanged. Resetting the password invalidates that user's existing signed sessions. A password is never displayed in record details or written to the audit payload.

Organization administrators create new identities but manage existing staff through membership/assignment status rather than editing global credentials. This prevents one organization's administrator from taking over a shared user account used by another organization.

To revoke a staff member's access to one organization, deactivate/suspend the membership or relevant site assignment. To revoke all access, a super administrator can suspend the user. Organization suspension and lease expiry also remove dependent access. Each API request reloads roles; an existing cookie does not preserve a revoked grant. Reload or sign in again if the UI still shows an old menu after another administrator changes roles.

## Current boundaries

Role-aware login does not add booking creation/check-in/checkout, payment collection, refund execution or gateway processing. Those tables remain read-only. Operators and collectors can now securely inspect their assigned site's records, but the corresponding write workflows still need implementation.

Audit and raw gateway events are platform-only. Organization/site viewers do not receive financial ledgers. Saved global vehicle records are platform-only; authorized booking records still show the vehicle registration associated with that booking.

Demo mode remains an explicitly labeled super-admin UI preview; it does not authenticate staff, enforce the production API's role policy, or provision real users.

## Troubleshooting

- **Invalid staff email/password:** verify the email, active user status and password; have a super administrator set a password if none exists.
- **No active staff access:** check organization status, membership status, and the organization role. MEMBER requires a current ACTIVE site assignment on an ACTIVE lease.
- **Operator sees too many sites:** check for an organization-wide OWNER/ADMIN/ACCOUNTANT/VIEWER membership; use MEMBER for site-only staff.
- **Cannot create staff:** choose an organization you manage. For duplicate email, ask a super administrator to link the existing account.
- **Cannot appoint an admin/manager:** organization admins cannot appoint other organization admins; site managers cannot appoint managers. Ask the appropriate owner/organization administrator.
- **Forbidden record or missing menu:** that resource or write is outside your role's scope. Changing a URL or record ID does not grant access.
- **Unknown MEMBER value / schema mismatch:** apply the role migration and regenerate the Prisma client, then restart the backend.

Implementation: `backend/admin/access.js` is the central policy. `auth.js` reloads it on every request. `router.js` applies it to resource rows, relations, options, aggregates and transactional writes. `frontend/lib/admin/access.js` controls presentation only; browser state is never authorization.
