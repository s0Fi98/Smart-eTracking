# Running database migrations

Run the commands below from `backend/`. Prisma CLI reads `DATABASE_URL` from `.env` through `prisma.config.ts`. Keep it pointed at the intended database and consistent with the runtime `DB_*` variables.

## Hosted MySQL: P3014 / P1010

`prisma migrate dev` needs a separate temporary shadow database. Hosted MySQL accounts often lack permission to create one. This error does not mean the application database password is wrong: the reported permission failure is for the shadow database.

Use `migrate deploy` to apply existing migration files on the hosted database. It does not use a shadow database. The account still needs permission to create/alter tables and indexes inside the target database.

The initial migration is already generated locally:

`prisma/migrations/20261004000000_init_parking/migration.sql`

It creates all 17 tables, indexes and foreign keys from the current schema. Generating it did not connect to or modify the hosted database.

## If the target database is empty

Check its tables using your hosting database manager/phpMyAdmin. An empty database has no application tables. A `_prisma_migrations` table may remain from an earlier attempt; inspect `npm run db:status` if it exists. Failed migrations need investigation before retrying.

Review the generated SQL, then run:

```sh
npm run db:validate
npm run db:deploy
npm run db:generate
npm run db:status
```

`db:deploy` applies the committed SQL and records migration history in `_prisma_migrations`. Run it only against the intended database. Once successful, configure administrator provisioning variables as described in [admin-panel.md](admin-panel.md), then run:

```sh
npm run admin:create
npm run dev
```

Commit the migration folder and `migration_lock.toml` with your schema. Do not edit an already applied migration; add another migration for later changes.

## If tables already exist

Do not apply this initial CREATE TABLE migration directly, run `migrate reset`, or accept a database reset prompt. Back up the database first.

- If it contains the old parking schema, baseline the actual old structure and prepare a staged migration that transfers operators into organizations, tenure into leases, and staff roles into memberships. See [database-design.md](database-design.md). The initial migration supplied here represents the new schema and must not be marked applied to an old-schema database.
- If it already matches the complete current schema (for example, from `db push`), verify that match before baselining. A read-only check that does not use a shadow database is:

  ```sh
  npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code
  ```

  Exit 0 means Prisma found no supported schema differences; exit 2 means differences exist; exit 1 is an error. Review unsupported/custom database objects separately. Only after confirming that the existing database already has all the initial migration's changes, and that it has no conflicting migration history, mark that migration as applied:

  ```sh
  npx prisma migrate resolve --applied 20261004000000_init_parking
  npm run db:generate
  npm run db:status
  ```

  `resolve --applied` does not create or change application tables. It must never be used to pretend that missing schema changes were executed.

## Creating future migrations

Prefer a separate local/development MySQL database where Prisma can create a shadow database. Apply this migration history there, edit the schema, then run:

```sh
npx prisma migrate dev --name describe_your_change
npm run db:generate
```

Review and commit the generated SQL. Deploy those same migration files to the hosted database with `npm run db:deploy`. Ensure `.env` points to the development database while running `migrate dev`; never use it as the production deployment command.

Alternatively, for a hosted development database, create another dedicated disposable database using the hosting control panel. Configure its separate URL as `SHADOW_DATABASE_URL` and add `shadowDatabaseUrl: env("SHADOW_DATABASE_URL")` under `datasource` in `prisma.config.ts`. Prisma can then reset that shadow database without needing to create it. Never use the main database's URL for the shadow database: Prisma resets its contents.

The initial migration was generated without a shadow database using:

```sh
npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script --output prisma/migrations/20261004000000_init_parking/migration.sql
```

This is a one-time initial-schema generation command, not the command to use for future changes or against an existing schema. Do not overwrite the migration after applying it.

Reference: [Prisma 7 shadow database documentation](https://www.prisma.io/docs/orm/v7/prisma-migrate/understanding-prisma-migrate/shadow-database).

## Staff role access update

`20261004010000_staff_access` adds the MEMBER organization role and narrows old VIEWER memberships with site assignments to site-only access. On an already initialized database, review it and run `npm run db:deploy`, then `npm run db:generate` and restart the backend. See [staff-access.md](staff-access.md) before assigning staff roles.
