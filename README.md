# HCM Lite Backend

## Run
1. `npm install`
2. `cp .env.example .env` aur `MONGODB_URI` + `JWT_SECRET` (32+ chars) bharein
3. `npm run dev`, phir `curl http://localhost:5000/api/health`

## API (Phase 1 + 2)
Response format: `{ success, message, data }`. Errors: `{ success:false, message, errors? }`.

| Route | Access | Notes |
|---|---|---|
| GET /api/health | public | DB status |
| GET /api/setup/status, POST /api/setup | public (one-time) | first Admin + company |
| POST /api/auth/login, GET /api/auth/me, POST /api/auth/change-password | login | |
| GET/PATCH /api/company, PUT /api/company/policies | read: all, write: Admin | |
| /api/departments, /api/designations (GET/POST/PATCH/DELETE) | Admin, HR | delete blocked if in use |
| /api/leave-types, /api/holidays | read: all, write: Admin | POST /api/leave-types/defaults loads 14/8/10/unlimited |
| /api/users (GET/POST, PATCH /:id/status, POST /:id/reset-password) | Admin | HR accounts only |
| GET/POST /api/employees | Admin, HR | search, filters, sort, pagination |
| GET /api/employees/:id | Admin, HR, Employee (own only) | salary only for Admin/HR |
| PATCH /api/employees/:id, /:id/status, POST /:id/reset-password | Admin, HR | |
| GET/PATCH /api/employees/me | Employee | phone and address only |
| POST /api/employees/import?dryRun=true|false | Admin, HR | body `{ csv }`, max 50 rows |
| GET /api/employees/export | Admin, HR | CSV download |

CSV import errors: `{ row, field, reason }`. Row 1 = header.
