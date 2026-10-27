# HCM Lite Backend - Complete API Documentation

Base URL: `/api`  
Standard Response Format:
```json
{
  "success": true,
  "message": "OK",
  "data": { ... }
}
```
Standard Error Format:
```json
{
  "success": false,
  "message": "Error description",
  "code": "OPTIONAL_ERROR_CODE",
  "errors": [{ "field": "email", "message": "Invalid email" }]
}
```

---

## 1. Setup & Authentication
### GET `/api/setup/status`
- **Access**: Public
- **Response**: `{ success: true, data: { isSetupComplete: false } }`

### POST `/api/setup` or `/api/setup/init`
- **Access**: Public (one-time; returns 409 if already initialized)
- **Body**:
```json
{
  "companyName": "Saylani Tech",
  "adminName": "System Admin",
  "adminEmail": "admin@saylani.org",
  "adminPassword": "AdminPassword123"
}
```

### POST `/api/auth/login`
- **Access**: Public
- **Body**: `{ "email": "admin@saylani.org", "password": "AdminPassword123" }`
- **Response**:
```json
{
  "success": true,
  "data": {
    "token": "eyJhbG...",
    "user": { "_id": "...", "name": "System Admin", "email": "admin@saylani.org", "role": "admin" },
    "mustChangePassword": false
  }
}
```

### POST `/api/auth/logout`
- **Access**: Authenticated

### GET `/api/auth/me`
- **Access**: Authenticated (accessible even with `mustChangePassword=true`)

### POST `/api/auth/change-password`
- **Access**: Authenticated
- **Body**: `{ "currentPassword": "...", "newPassword": "..." }`

### POST `/api/admins`
- **Access**: Public registration endpoint. Creates the initial company/admin if setup has not run; otherwise adds an admin to the existing company.
- **Body** (both this format and `name`/`email`/`password` are accepted):
```json
{
  "companyName": "My Company",
  "adminName": "Main Admin",
  "adminEmail": "admin@example.com",
  "adminPassword": "AdminPass123"
}
```
- **Note**: Public access allows anyone who can reach the API to create an admin account after initial setup.

---

## 2. Settings & Organization
### GET `/api/settings`
- **Access**: Authenticated (All roles)

### PUT `/api/settings`
- **Access**: Admin only
- **Body**:
```json
{
  "officeStartTime": "09:00",
  "officeEndTime": "18:00",
  "graceMinutes": 15,
  "halfDayThresholdHours": 5,
  "weekendDays": [0, 6],
  "officeLocation": { "latitude": 24.8607, "longitude": 67.0011, "radiusMeters": 150 },
  "latePenaltyRule": { "enabled": true, "latesThreshold": 3, "deductionDays": 0.5 }
}
```

### CRUD `/api/departments`
- **GET**: All roles
- **POST / PATCH / DELETE**: Admin / HR (delete blocked if in use)

### CRUD `/api/designations`
- **GET**: All roles
- **POST / PATCH / DELETE**: Admin / HR (delete blocked if in use)

### CRUD `/api/leave-types` & `/api/holidays`
- **GET**: All roles
- **POST / PATCH / DELETE**: Admin only

---

## 3. Users Management (HR Logins)
- **Access**: Admin only
- **GET `/api/users`**: List HR users
- **POST `/api/users`**: `{ "name": "HR Manager", "email": "hr@saylani.org" }`
- **PATCH `/api/users/:id/deactivate`**
- **PATCH `/api/users/:id/activate`**
- **POST `/api/users/:id/reset-password`**

---

## 4. Employees Management
### GET `/api/employees`
- **Access**: Admin / HR
- **Query Params**: `?q=john&department=...&designation=...&status=active&page=1&limit=20`

### POST `/api/employees`
- **Access**: Admin / HR
- **Body**:
```json
{
  "employeeCode": "EMP001",
  "fullName": "Alice Smith",
  "email": "alice@saylani.org",
  "department": "<department_id>",
  "designation": "<designation_id>",
  "joiningDate": "2026-01-01",
  "basicSalary": 100000,
  "phone": "+923001234567",
  "gender": "female"
}
```

### GET `/api/employees/:id`
- **Access**: Admin, HR, Employee (own profile only)

### GET `/api/employees/:id/360`
- **Access**: Admin, HR, Employee (own profile only)
- **Response**: Aggregated profile + recent attendance + leave balances + salary breakdown + payslips + history.

### PATCH `/api/employees/me`
- **Access**: Employee only
- **Body**: `{ "phone": "+923009876543", "address": "Karachi, Pakistan" }`

### PUT `/api/employees/:id/salary-structure`
- **Access**: Admin / HR
- **Body**:
```json
{
  "basicSalary": 120000,
  "hraAllowance": 48000,
  "medicalAllowance": 12000,
  "otherAllowance": 5000
}
```

### POST `/api/employees/import?dryRun=true|false`
- **Access**: Admin / HR
- **Body**: `{ "csv": "employeeCode,fullName,email,department,designation,joiningDate,basicSalary\n..." }`

### GET `/api/employees/export`
- **Access**: Admin / HR
- **Returns**: CSV file download

---

## 5. Attendance & Geolocation Check-in
### POST `/api/attendance/check-in`
- **Access**: Authenticated (Employee profile required)
- **Body (Standard Web)**: `{ "source": "web" }`
- **Body (Bonus Camera + Geolocation)**:
```json
{
  "source": "camera",
  "faceCount": 1,
  "lat": 24.8607,
  "lng": 67.0011,
  "accuracy": 15
}
```
- **Rules**:
  - Server stamps current time.
  - Second check-in on the same day = **409 Conflict**.
  - Late after `officeStartTime + graceMinutes` (09:15).
  - Camera rejects if `faceCount != 1`, `accuracy > 100m`, or Haversine distance > radius.

### POST `/api/attendance/check-out`
- **Access**: Authenticated
- **Rules**: Calculates worked hours; sets `half_day` if worked < 5 hours.

### GET `/api/attendance/today`
- **Access**: Authenticated

### GET `/api/attendance/me?month=YYYY-MM`
- **Access**: Authenticated

### GET `/api/attendance/board?date=YYYY-MM-DD&departmentId=`
- **Access**: Admin / HR

### GET `/api/attendance/calendar/:employeeId?month=YYYY-MM`
- **Access**: Authenticated

---

## 6. Attendance Corrections
### POST `/api/corrections`
- **Access**: Authenticated
- **Body**:
```json
{
  "date": "2026-10-20",
  "proposedCheckIn": "2026-10-20T09:00:00.000Z",
  "proposedCheckOut": "2026-10-20T18:00:00.000Z",
  "reason": "Biometric terminal was offline"
}
```

### GET `/api/corrections`
- **Access**: Employee (own requests), Admin/HR (all requests)

### PATCH `/api/corrections/:id/approve`
- **Access**: Admin / HR
- **Body**: `{ "comment": "Verified and approved" }`

### PATCH `/api/corrections/:id/reject`
- **Access**: Admin / HR
- **Body**: `{ "comment": "Insufficient evidence" }`

---

## 7. Leave Management
### POST `/api/leaves`
- **Access**: Authenticated
- **Body**:
```json
{
  "leaveTypeId": "<leave_type_id>",
  "startDate": "2026-11-02",
  "endDate": "2026-11-04",
  "reason": "Family vacation"
}
```
- **Rules**: Calculates working days only (skips weekends and active holidays). Overlap with pending/approved = **422**. Over available balance = **422**.

### GET `/api/leaves`
- **Access**: Employee (own), Admin/HR (all with filters `status`, `employeeId`)

### GET `/api/leaves/balance`
- **Access**: Authenticated (Employee views own balance, HR/Admin can query `?employeeId=`)

### PATCH `/api/leaves/:id/cancel`
- **Access**: Employee (cancels pending or future approved leaves)

### PATCH `/api/leaves/:id/approve`
- **Access**: Admin / HR
- **Body**: `{ "comment": "Enjoy your leave" }`

### PATCH `/api/leaves/:id/reject`
- **Access**: Admin / HR
- **Body**: `{ "comment": "Team critical period" }`

---

## 8. Payroll & Payslips
### POST `/api/payroll/runs`
- **Access**: Admin / HR
- **Body**: `{ "month": "2026-10" }`
- **Rules**:
  - Gross = 1.5 * basic (or custom structure).
  - Per day = Gross / working days in month.
  - Proration for mid-month joiners/leavers based on working days employed.
  - Deductions = (absents + unpaid leave + 0.5 * half_days) * per day rate + late penalties.
  - Annual Tax calculation on Gross * 12 using official slabs; monthly tax = annual tax / 12.
  - Net = Gross - Deductions - Monthly Tax.

### GET `/api/payroll/runs` & GET `/api/payroll/runs/:id`
- **Access**: Admin / HR

### POST `/api/payroll/runs/:id/recompute`
- **Access**: Admin / HR (Draft status only)

### POST `/api/payroll/runs/:id/finalize`
- **Access**: Admin only
- **Rules**: Locks the run. Any subsequent edit returns 409/403. Dispatches notifications to all employees.

### GET `/api/payslips`
- **Access**: Authenticated (Employee sees only own finalized payslips; Admin/HR see all)

### GET `/api/payslips/:id/pdf`
- **Access**: Authenticated (Employee can only download own PDF; Admin/HR can download any)

---

## 9. Dashboards
### GET `/api/dashboard/admin`
- **Access**: Admin only
- **Query Params**: `?from=YYYY-MM-DD&to=YYYY-MM-DD&departmentId=`
- **Metrics**: Headcount, Attrition YTD %, Total Payroll Cost, Average Salary, Headcount by Department, Gender breakdown, Tenure buckets, Latest Audit Feed.

### GET `/api/dashboard/hr`
- **Access**: Admin / HR
- **Query Params**: `?from=YYYY-MM-DD&to=YYYY-MM-DD&departmentId=`
- **Metrics**: Headcount, Present today, Late today, On leave today, Pending approvals count, Attendance rate %, Late %, Absenteeism rate %, Top 5 late-comers, Leave utilization by type, Anomaly flags.

### GET `/api/dashboard/employee`
- **Access**: Employee only
- **Metrics**: Hours worked this week vs 40, Late arrivals this month, Leave balances, Last finalized payslip, Active company announcements.

---

## 10. AI Assistant
### POST `/api/ai/chat`
- **Access**: Authenticated (Rate limit: 20 calls/user/hour; 15s timeout)
- **Body**: `{ "message": "How many sick leaves do I have left?", "history": [] }`
- **Features**:
  - Tool calling scoped by caller role (Headcount, Attendance, Late Comers, Leave Balance, Payroll Summary, Search Employees).
  - Strict privacy guard: Refuses to disclose colleagues' salaries to employees.
  - Multilingual & Roman Urdu support.
  - Logs all requests in `ai_logs`.

### POST `/api/ai/dashboard-summary`
- **Access**: Admin / HR
- **Body**: `{ ...dashboardMetricsJson }`
- **Returns**: 3-5 concise factual bullet points analyzing KPI numbers.

### POST `/api/ai/smart-leave`
- **Access**: Authenticated
- **Body**: `{ "text": "Next Monday and Tuesday off for sister wedding" }`
- **Returns**: `{ "type": "casual", "start": "2026-11-02", "end": "2026-11-03", "reason": "...", "aiGenerated": true }`

---

## 11. Announcements & In-App Notifications
### GET `/api/announcements`
- **Access**: Authenticated

### POST `/api/announcements`
- **Access**: Admin / HR
- **Body**: `{ "title": "Quarterly Townhall", "content": "All hands meeting this Thursday at 3 PM", "priority": "normal" }`

### GET `/api/notifications`
- **Access**: Authenticated (Returns user's notifications and unreadCount)

### PATCH `/api/notifications/:id/read` & PATCH `/api/notifications/read-all`
- **Access**: Authenticated

---

## 12. Audit Log
### GET `/api/audit`
- **Access**: Admin only
- **Query Params**: `?action=&entity=&actorId=&page=1&limit=20`
- **Rules**: Append-only audit trail logging all actions with actor, IP, timestamp, before/after JSON.
