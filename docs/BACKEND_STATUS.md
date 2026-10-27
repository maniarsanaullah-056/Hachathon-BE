# HCM Lite Backend Status

This document tracks the implementation status of all 25 core functionalities and bonus items of HCM Lite.

| # | Functionality | Status | Route / Component | Description |
|---|---|---|---|---|
| 01 | First-run setup | DONE | `POST /api/setup`, `POST /api/setup/init`, `GET /api/setup/status` | One-time company + Admin registration. Returns 409 after setup is completed. |
| 02 | Login / Logout / Change password + role menus | DONE | `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `POST /api/auth/change-password` | JWT auth, password hashing with bcrypt, `mustChangePassword` guard blocking all other APIs until reset. |
| 03 | Company settings | DONE | `GET /api/settings`, `PUT /api/settings` | Office hours (09:00), grace (15m), half-day hours (5), weekends, office geolocation lat/lng + radius (150m), late penalty rule. |
| 04 | Departments, Designations, Leave types, Holidays | DONE | `/api/departments`, `/api/designations`, `/api/leave-types`, `/api/holidays` | Admin/HR CRUD, read access for employees to leave types & holidays. Delete integrity checks. |
| 05 | HR logins create / deactivate / reset | DONE | `GET/POST /api/users`, `PATCH /users/:id/deactivate`, `PATCH /users/:id/activate`, `POST /users/:id/reset-password` | Admin-managed HR credentials with temporary passwords and status controls. |
| 06 | Register employee (creates login) + edit | DONE | `POST /api/employees`, `PUT/PATCH /api/employees/:id` | Generates employee record + linked login account with one-time temporary password. |
| 07 | Directory + search + Employee 360 | DONE | `GET /api/employees`, `GET /api/employees/:id/360`, `PATCH /api/employees/me` | Search, filters, pagination, 360 profile with attendance summary, leave balances, salary, payslips, audit history. |
| 08 | CSV import dry-run + export | DONE | `POST /api/employees/import?dryRun=`, `GET /api/employees/export` | Dry-run validation returning errors array `{row, field, reason}`, atomic commit, CSV download. |
| 09 | Web check-in / out | DONE | `POST /api/attendance/check-in`, `POST /api/attendance/check-out` | Server time stamping, duplicate 409 prevention, late (>09:15) / half-day (<5h) / present statuses. |
| 10 | Attendance calendar + daily board | DONE | `GET /attendance/today`, `GET /attendance/me`, `GET /attendance/board`, `GET /attendance/calendar/:employeeId` | Daily company board and monthly employee calendar views. |
| 11 | Corrections request / approve | DONE | `POST /api/corrections`, `GET /api/corrections`, `PATCH /corrections/:id/approve`, `PATCH /corrections/:id/reject` | Employee correction request, HR approval/rejection with comment, auto attendance update + notifications. |
| 12 | Apply / cancel leave + balance + history | DONE | `POST /api/leaves`, `GET /api/leaves`, `GET /api/leaves/balance`, `PATCH /leaves/:id/cancel` | Working day calculation (skips weekends and holidays), overlap 422 check, quota overbalance 422 check. |
| 13 | Approve / reject leave with comment | DONE | `PATCH /api/leaves/:id/approve`, `PATCH /api/leaves/:id/reject` | HR decision with reviewer comments, attendance marking on approval, audit logging, and notifications. |
| 14 | Salary structure | DONE | `PUT /api/employees/:id/salary-structure` | Gross = 1.5x basic (HRA 40%, Medical 10%), editable allowances by HR. |
| 15 | Payroll draft | DONE | `POST /api/payroll/runs`, `GET /api/payroll/runs`, `POST /runs/:id/recompute` | Computes working days, joiner/leaver proration, deductions (absents, unpaid leave, half-days, late penalties), annual tax slabs. |
| 16 | Finalize / lock payroll (Admin) | DONE | `POST /api/payroll/runs/:id/finalize` | Admin only. Locks run and payslips against edits (409). Dispatches payslip ready notifications to employees. |
| 17 | Payslips + PDF | DONE | `GET /api/payslips`, `GET /api/payslips/:id/pdf` | PDF generation using pdfkit. Employee data scope guard: employees can only view/download their own payslip. |
| 18 | Dashboards with filters | DONE | `GET /api/dashboard/admin`, `GET /dashboard/hr`, `GET /dashboard/employee` | Aggregations for headcount, attrition YTD, attendance rate, late %, absenteeism, payroll cost, and hours this week. |
| 19 | AI Chat | DONE | `POST /api/ai/chat` | LLM tool calling (headcount, attendance, late comers, leave balances, payroll totals, search), role scope enforcement, 15s timeout, rate limiter, ai_logs. |
| 20 | AI Dashboard summary | DONE | `POST /api/ai/dashboard-summary` | Generates 3-5 factual bullet points summarizing computed KPI figures for Admin/HR. |
| 21 | Smart leave | DONE | `POST /api/ai/smart-leave` | Natural language leave parsing ("next Monday and Tuesday...") into structured JSON with server-side relative date calculation. |
| 22 | Policy Q&A | DONE | `POST /api/ai/chat` | Loaded with Section 3 HR policies in system prompt; answers strictly according to rules or replies "I don't know". |
| 23 | Announcements | DONE | `GET /api/announcements`, `POST /api/announcements` | Admin/HR announcements broadcasted to all active employees. |
| 24 | Notifications | DONE | `GET /api/notifications`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all` | In-app notifications for leave decisions, correction updates, payslips, and announcements. |
| 25 | Audit log | DONE | `GET /api/audit` | Append-only audit trail for all sensitive actions, actor, IP, timestamp, before/after JSON diffs. |
| Bonus | Camera + Location attendance | DONE | `POST /api/attendance/check-in` | Validates `faceCount === 1`, GPS `accuracy <= 100m`, and Haversine distance within configured office radius. |
| Bonus | Attrition risk, Anomaly flags, Late penalty rule | DONE | `services/dashboardService.js`, `services/payrollService.js` | Top late-comer anomaly alerts, attrition risk, configurable 3 lates = 0.5 day deduction. |
| Bonus | Roman Urdu AI support | DONE | `services/aiService.js` | System prompt and intent matching recognize Roman Urdu queries. |

---

## Verification & Test Checklist
- [x] Initial setup only allows one company/admin, blocks duplicate calls (409).
- [x] Must change password blocks protected APIs until updated.
- [x] Duplicate check-in on the same day blocked (409).
- [x] Late calculation applied after 09:15 (09:00 start + 15m grace).
- [x] Camera check-in validates single face, accuracy <= 100m, and Haversine distance within radius.
- [x] Leave calculation skips weekends and holidays; prevents overlaps and overbalance (422).
- [x] Salary calculations: Gross = 1.5x basic; tax slabs accurately computed.
- [x] Finalized payroll is locked and non-editable (409).
- [x] Employee role cannot view colleagues' salaries or inspect other employees' profiles/payslips (403).
- [x] CSV dry run returns validation errors array without modifying DB.
- [x] All 5 smoke tests passed cleanly.
