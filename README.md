# HCM Lite Backend

A complete modern Human Capital Management (HCM) backend built with Node.js, Express, and MongoDB, featuring role-based access control (Admin, HR, Employee), automated attendance, leave tracking, payroll calculation with tax slabs, and an AI assistant.

---

## 🚀 Quick Start (< 5 minutes)

### 1. Prerequisites
- Node.js (v18+)
- MongoDB (local or MongoDB Atlas connection string)

### 2. Installation
```bash
npm install
```

### 3. Environment Setup
Create a `.env` file from `.env.example`:
```bash
cp .env.example .env
```
Ensure `MONGODB_URI` and `JWT_SECRET` (at least 32 characters) are set:
```ini
MONGODB_URI=mongodb://localhost:27017/hcm-lite
JWT_SECRET=supersecretlongjwtstringwithatleast32characterslong
NODE_ENV=development
PORT=5000
FRONTEND_URL=http://localhost:5173

# Optional: AI Provider Configuration (OpenAI or Gemini-compatible)
AI_API_KEY=
AI_MODEL=gemini-1.5-flash
AI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
```

### 4. Run Server
```bash
npm run dev
```
Verify the server is running:
```bash
curl http://localhost:5000/api/health
```

### 5. Run Smoke Tests
Verify core math, tax slabs, distance checks, and parsing:
```bash
npm run test:smoke
```

Run the focused unit and API integration suite:
```bash
npm test
```
Unit tests run without MongoDB. API integration tests require `TEST_MONGODB_URI` to point to a disposable database whose name contains `qa` or `test`; the suite drops that database before running. On PowerShell:
```powershell
$env:TEST_MONGODB_URI = "mongodb://localhost:27017/hcm-lite-qa"
npm test
```

---

## 🛠️ First-Run Flow & Initial Setup

When starting with an empty database:
1. Verify setup status:
   ```bash
   GET /api/setup/status
   # Returns: { "data": { "isSetupComplete": false } }
   ```
2. Initialize Company & First Admin:
   ```bash
   POST /api/setup/init
   Content-Type: application/json

   {
     "companyName": "Saylani Tech",
     "adminName": "System Admin",
     "adminEmail": "admin@saylani.org",
     "adminPassword": "AdminPassword123"
   }
   ```
   *Note: Subsequent calls to `/api/setup` or `/api/setup/init` will return **409 Conflict**.*

---

## 👥 Role Walkthrough & Menus

### 1. Admin
- **Company Setup & Settings**: Manage `/api/settings`, departments, designations, holidays, leave types.
- **HR Accounts**: Create, activate, deactivate, and reset passwords for HR managers (`/api/users`).
- **Payroll Finalization**: Review payroll drafts and execute `/api/payroll/runs/:id/finalize` (locks the payroll run).
- **Audit Logs**: View append-only system audit trails at `/api/audit`.
- **Admin Dashboard**: Strategic headcount, attrition YTD %, payroll costs, gender, and tenure distribution (`/api/dashboard/admin`).

### 2. HR Manager
- **Employee Directory**: Register employees (`POST /api/employees` generates login and temporary password).
- **Salary Structures**: Edit basic and custom allowances (`PUT /api/employees/:id/salary-structure`).
- **Attendance & Corrections**: Monitor attendance board (`/api/attendance/board`), review and approve/reject attendance corrections (`/api/corrections/:id/approve`).
- **Leave Decisions**: Approve or reject leave applications with mandatory comments (`/api/leaves/:id/approve`).
- **Payroll Drafts**: Generate and recompute monthly payroll drafts (`POST /api/payroll/runs`).
- **CSV Import/Export**: Bulk import with dry-run validation (`POST /api/employees/import?dryRun=true`).

### 3. Employee
- **Personal Profile**: View profile (`GET /api/employees/me`) and update phone/address only (`PATCH /api/employees/me`).
- **Attendance**: Clock in/out (`POST /api/attendance/check-in`, `POST /api/attendance/check-out`), view personal attendance calendar (`GET /api/attendance/me`).
- **Corrections**: Request attendance corrections with reason (`POST /api/corrections`).
- **Leaves**: Check balances (`GET /api/leaves/balance`), apply for leaves (`POST /api/leaves`), and cancel pending/future leaves.
- **Payslips**: Download official PDF payslips for finalized payroll runs (`GET /api/payslips/:id/pdf`).
- **Employee Dashboard & Comms**: View weekly hours vs 40, notifications, and announcements (`/api/dashboard/employee`).

---

## 🤖 AI Assistant Capabilities

- **Endpoint**: `POST /api/ai/chat` (Rate limited to 20 calls/hr per user, 15s timeout).
- **Tool Calling**: Backend services run scoped by the caller's role:
  - `get_headcount`, `get_attendance_summary`, `get_late_comers`, `get_payroll_summary` (restricted to Admin/HR).
  - `get_my_leave_balance` (employee personal balances).
  - `search_employees` (employees see public info; salary is redacted).
- **Policy Compliance**: Answers Section 3 HR policies (timings, grace periods, leave quotas, tax slabs). Refuses requests from employees asking about colleagues' salaries.
- **Smart Leave Extraction**: `POST /api/ai/smart-leave` translates relative natural language requests (e.g. *"Next Monday and Tuesday off for sister's wedding"*) into structured JSON.
- **Dashboard Executive Summary**: `POST /api/ai/dashboard-summary` provides 3-5 concise bullet points summarizing KPI metrics.
- **Roman Urdu Support**: Comprehends Roman Urdu inquiries (e.g. *"Meri kitni chuttiyan baki hain?"*).

---

## 📐 Business Rules & Assumptions

1. **Attendance Timings**:
   - Office start time is `09:00` with `15` minutes grace. Check-in at or after `09:16` is marked `late`.
   - Work duration under `5` hours is automatically marked `half_day`.
2. **Camera Attendance**:
   - Requires `faceCount === 1` and GPS accuracy `<= 100m`.
   - Office distance calculated using the Haversine formula; must be within `radiusMeters` (default 150m).
3. **Leave Deductions**:
   - Leave quota calculations count only working days (Saturdays, Sundays, and active holidays are excluded).
   - Overlapping leave applications or requests exceeding quota return `422 Unprocessable Entity`.
4. **Payroll Math**:
   - Default structure: `Gross = 1.5 * Basic` (`HRA = 40%`, `Medical = 10%`).
   - Daily rate: `Gross / Working Days in Month`.
   - Mid-month joiners/leavers are prorated by employed working days.
   - Deductions: `(Absent Days + Unpaid Leave Days + 0.5 * Half Days) * Daily Rate`.
   - Late penalty: Configured to deduct `0.5` day for every `3` late arrivals.
   - Annual tax computed on `Gross * 12` using standard slabs; monthly tax deducted is `Annual Tax / 12`.
5. **Audit Logs**:
   - Append-only. Every administrative update, approval, rejection, and finalization is logged with actor details, timestamps, IP, and state diffs.

---

## 📚 Documentation
- Complete API Specification: [`docs/API.md`](file:///c:/Users/hp/Desktop/Practice/Hachathon-BE/docs/API.md)
- Implementation & Checklist: [`docs/BACKEND_STATUS.md`](file:///c:/Users/hp/Desktop/Practice/Hachathon-BE/docs/BACKEND_STATUS.md)
