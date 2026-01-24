# system01

Self-hostable web app foundation for a Property Management System (PMS) + Restaurant POS (offline-first later) with a channel sync path (iCal first).

## Tech

- Next.js (App Router) + TypeScript
- PostgreSQL (Docker Compose for local dev)
- Prisma ORM
- NextAuth (Credentials provider) + Prisma adapter

## Prerequisites

- Node.js (LTS recommended)
- Docker Desktop (for local Postgres) or any reachable Postgres server

## Local setup (Windows PowerShell)

1) Install dependencies

```powershell
npm install
```

2) Create env

- Copy `.env.example` to `.env` (or keep the generated `.env` if already present)
- Update `SEED_ADMIN_PASSWORD`

3) Start Postgres (Docker)

```powershell
npm run db:up
```

This project runs Docker Postgres on port `15432` to avoid conflicts with a locally-installed Postgres on `5432`.

If you see a Docker engine pipe error, start Docker Desktop and retry.

4) Migrate + seed

```powershell
npx prisma generate
npx prisma migrate dev
npx prisma db seed
```

5) Run the app

```powershell
npm run dev
```

App: http://localhost:3000

## Auth

- NextAuth endpoint: `/api/auth/*`
- Seed creates an admin credentials user from `.env` (`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`).

## Multi-property rule

- Every business entity is modeled with a mandatory `propertyId`.
- Users must choose an **active property** for the current session at `/select-property` before accessing the app.

## Notes

- Database records are modeled as multi-property from day 1 (every core table has `propertyId`).
- Folio/billing is modeled as append-only lines (reversals instead of edits).
