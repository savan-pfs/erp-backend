# Passion Farms ERP — Backend

Node.js/Express API for the Passion Farms ERP system. PostgreSQL database with migrations; compatible with pgAdmin and any PostgreSQL client.

## Features

- **Authentication** — JWT-based auth with role-based access control (RBAC)
- **Organizations & users** — Multi-tenant orgs, roles, permissions, user management
- **Cultivation** — Farms, crops, genetics, rooms, mother plants, batches, plants, batch lineage
- **Operations** — Tasks, calendar, dashboard, environmental/feeding/IPM logs, harvest
- **Inventory & manufacturing** — Inventory, waste management, manufacturing workflows
- **Compliance** — Documents, licenses, audit logs, reports, state legality
- **Other** — Billing, integrations, system settings, analytics, locations
- **Security** — Helmet, CORS, bcrypt password hashing, Joi validation

## Requirements

- Node.js 18+
- PostgreSQL (or pgAdmin) with a database (e.g. `passionfarms_db`)

## Installation

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Environment**
   ```bash
   cp .env.example .env
   # Edit .env: set DB_PASSWORD, JWT_SECRET, and other values
   ```

3. **Create database** (PostgreSQL / pgAdmin)
   ```sql
   CREATE DATABASE passionfarms_db;
   ```

4. **Run migrations**
   ```bash
   npm run migrate
   ```

5. **Seed (optional)**
   ```bash
   npm run seed
   # or full seed:
   npm run seed:full
   ```

6. **Start server**
   ```bash
   npm run dev    # development (nodemon, DB check on startup)
   npm start      # production
   ```

Server runs at `http://localhost:3004`. Health (including DB status): `GET http://localhost:3004/api/health`.

## Environment Variables

| Variable       | Description                    | Example                |
|----------------|--------------------------------|------------------------|
| `PORT`         | Server port                    | `3004`                 |
| `NODE_ENV`     | Environment                    | `development`          |
| `DB_HOST`      | PostgreSQL host                | `localhost`            |
| `DB_PORT`      | PostgreSQL port                | `5432`                 |
| `DB_NAME`      | Database name                  | `passionfarms_db`      |
| `DB_USER`      | Database user                  | `postgres`             |
| `DB_PASSWORD`  | Database password              | *(required)*           |
| `JWT_SECRET`   | Secret for JWT signing         | *(required)*           |
| `JWT_EXPIRE`   | Token expiry                   | `7d`                   |
| `FRONTEND_URL` | Allowed frontend origin (CORS) | `http://localhost:5173`|

## Scripts

| Command           | Description |
|-------------------|-------------|
| `npm start`       | Start production server |
| `npm run dev`     | Start dev server (nodemon); checks DB connection on startup |
| `npm run migrate` | Run database migrations |
| `npm run seed`    | Seed initial data |
| `npm run seed:full` | Full comprehensive seed |
| `npm run db:clear` | Clear local DB (drops all tables). Run `npm run migrate` after to recreate schema. |

## API Overview

All routes are under `/api`. Main areas:

- **Auth** — `/api/auth` (login, register, verify)
- **Users & orgs** — `/api/users`, `/api/organizations`, `/api/roles`, `/api/permissions`
- **Cultivation** — `/api/farms`, `/api/crops`, `/api/rooms`, `/api/batches`, `/api/plants`, `/api/mothers`, `/api/genetics`, `/api/batch-lineage`
- **Operations** — `/api/tasks`, `/api/calendar`, `/api/dashboard`, `/api/environmental-logs`, `/api/feeding-logs`, `/api/ipm-logs`, `/api/harvest`
- **Inventory** — `/api/inventory`, `/api/waste-management`, `/api/manufacturing`
- **Compliance** — `/api/documents`, `/api/licenses`, `/api/audit-logs`, `/api/reports`
- **Other** — `/api/billing`, `/api/integrations`, `/api/system-settings`, `/api/analytics`, `/api/location`, `/api/database`

**Health:** `GET /api/health` — returns `status`, `database` (connected/error), `timestamp`.

## Repository

https://github.com/savan-pfs/erp-backend

## Security

- Password hashing (bcryptjs)
- JWT authentication
- Role-based access control (RBAC)
- Input validation (Joi)
- Helmet security headers
- CORS configurable via `FRONTEND_URL`
