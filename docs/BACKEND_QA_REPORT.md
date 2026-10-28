# Backend QA report

## Environment

- Node.js 22.17.0; API is configured to use port 5000.
- The checked-in `.env.example` documents `mongodb://localhost:27017/hcm-lite`; this workspace has no configured `MONGODB_URI` and no local MongoDB process.
- QA did not use seed or dummy data in the application database. A temporary MongoDB binary download was attempted and stopped because the requested archive was hundreds of MB.
- Real-provider AI checks require `AI_API_KEY` and remain blocked. Mocked-provider API tests also require a reachable MongoDB QA database.

## Automated checks

| Test ID | Result | Finding / fix | Re-test |
|---|---|---|---|
| UNIT-TAX | PASS | Added slab boundary and requested payroll tax examples to `tests/unit.test.js`. | `npm test` |
| UNIT-DATES | PASS | Added weekend, ISO-date rejection, and UTC date formatting checks. | `npm test` |
| UNIT-GEO | PASS | Added same-point and known-distance Haversine checks. | `npm test` |
| UNIT-CSV | PASS | Added quoted-field and formula-injection checks. | `npm test` |
| UNIT-PASSWORD | PASS | Added temporary-password policy checks. | `npm test` |
| F01 | BLOCKED | Setup status/create/duplicate setup integration check is present; no MongoDB server/URI was available to run it. | Pending QA MongoDB URI |
| F02 | BLOCKED | Login/JWT/logout/token expiry/password persistence checks need a MongoDB-backed app run. | Pending QA MongoDB URI |
| F03 | BLOCKED | Settings CRUD and role matrix need API integration runs. | Pending QA MongoDB URI |
| F04 | BLOCKED | Non-consecutive late penalty behavior needs payroll integration data. | Pending QA MongoDB URI |
| F05 | BLOCKED | Department/designation/leave-type/holiday and HR account lifecycle checks need API integration runs. | Pending QA MongoDB URI |
| F06 | BLOCKED | Employee registration, credentials, and edit checks need API integration runs. | Pending QA MongoDB URI |
| F07 | BLOCKED | Directory filtering, pagination, 360 scope, and self-profile checks need API integration runs. | Pending QA MongoDB URI |
| F08 | BLOCKED | CSV dry-run/import/export no-write and data-integrity checks need API integration runs. | Pending QA MongoDB URI |
| F09 | BLOCKED | Server-time check-in/out and duplicate record checks need API integration runs. | Pending QA MongoDB URI |
| F10 | BLOCKED | Attendance status and board calculations need controlled-time database integration. | Pending QA MongoDB URI and clock seam |
| F11 | BLOCKED | Correction workflow, GPS camera checks, notification, and audit checks need API integration runs. | Pending QA MongoDB URI |
| F12 | BLOCKED | Working-day, holiday, leave-balance, overlap, and quota checks need API integration runs. | Pending QA MongoDB URI |
| F13 | BLOCKED | Leave cancel/decision permissions and side effects need API integration runs. | Pending QA MongoDB URI |
| F14 | BLOCKED | Salary structure and gross calculation need API integration runs. | Pending QA MongoDB URI |
| F15 | BLOCKED | Payroll deductions/proration/tax calculation need database-backed payroll fixtures. | Pending QA MongoDB URI |
| F16 | BLOCKED | Draft/recompute/finalize permissions and lock behavior need API integration runs. | Pending QA MongoDB URI |
| F17 | BLOCKED | Payslip ownership and PDF content checks need API integration runs. | Pending QA MongoDB URI |
| F18 | BLOCKED | Dashboard role metrics, filters, and empty-state aggregation checks need API integration runs. | Pending QA MongoDB URI |
| F19 | BLOCKED | Chat provider/tool/role checks require mocked-provider API wiring and database integration. | Pending QA MongoDB URI |
| F20 | BLOCKED | Dashboard-summary role and factuality checks require mocked-provider API wiring and database integration. | Pending QA MongoDB URI |
| F21 | BLOCKED | Smart-leave retry/schema/relative-date API checks require mocked-provider wiring and database integration. | Pending QA MongoDB URI |
| F22 | BLOCKED | Policy, rate-limit, timeout, and ai_logs checks require mocked-provider API wiring and database integration. | Pending QA MongoDB URI |
| F23 | BLOCKED | Announcement permissions and visibility need API integration runs. | Pending QA MongoDB URI |
| F24 | BLOCKED | Notification create/read/unread side effects need API integration runs. | Pending QA MongoDB URI |
| F25 | BLOCKED | Audit actor/scope/filter/immutability checks need API integration runs. | Pending QA MongoDB URI |

## Functional phase status

All database-backed API phases F01–F25 and security/regression checks are **BLOCKED**, not passed: they need a fresh MongoDB instance. The existing service has no injectable clock, so attendance/payroll date-edge integration cases still require a controlled test clock or a dedicated QA database plus a narrowly scoped clock seam.

AI real-provider checks are **BLOCKED** until a private backend `AI_API_KEY` is configured. After configuration, manually verify exact KPI answers, policy and Roman Urdu answers, colleague salary refusal with no salary in logs, and real provider timeout/retry behavior. Verify GPS behavior with device coordinates separately.

## Bugs found and fixed

| Finding | Fix |
|---|---|
| Test runner and focused regression tests were missing. | Added `npm test`, `npm run test:smoke`, and `tests/unit.test.js`. |
| There was no safe API integration test harness for a disposable database. | Added a Supertest setup/auth test guarded by `TEST_MONGODB_URI`; it refuses to drop a database whose name does not contain `qa` or `test`. |
| `node --test tests` failed on Windows because Node treated the directory as a file. | Changed the npm script to list the two test files explicitly; re-tested with `npm test`. |
| Public `POST /api/admins` could create more admin accounts after setup. | Restricted it to first-run bootstrap; later attempts return 409. Added a regression assertion to the guarded integration suite. |

## Remaining limitations

- Full API/role-scope suite, all phase IDs F01–F25, fresh-DB continuous scenario, and security matrix need a reachable disposable MongoDB QA database.
- `TEST_MONGODB_URI` must point only to a disposable database named with `qa` or `test`; integration setup drops that database before running.
- Real-provider AI and live GPS checks remain manual as described above.
