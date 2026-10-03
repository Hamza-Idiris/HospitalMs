# Hospital Management System (MERN, multi-hospital)

Implements the HMS specification v1.0: multi-tenant hospitals, 8 roles, patient registration → visit → consultation → lab / X-ray / pharmacy → payments → receipts → reports, with audit logs.

## Run it locally

Requirements: Node 18+, MongoDB running locally (or a MongoDB Atlas URI).

```bash
npm run install:all
# server/.env already exists (copied from .env.example) — set MONGODB_URI and a long JWT_SECRET
npm run seed            # creates the Super Admin + a demo hospital with one user per role
npm run dev:server      # API on http://localhost:5000
npm run dev:client      # App on http://localhost:5173
```

### Demo logins (after `npm run seed`)

| Role | Email | Password |
|---|---|---|
| Super Admin | admin@hms.local | Admin@12345 |
| Hospital Manager | manager@demo.local | Password@123 |
| Receptionist | reception@demo.local | Password@123 |
| Cashier | cashier@demo.local | Password@123 |
| Doctor (Orthopedics) | doctor@demo.local | Password@123 |
| Doctor (General Medicine) | doctor2@demo.local | Password@123 |
| Lab technician | lab@demo.local | Password@123 |
| X-Ray technician | xray@demo.local | Password@123 |
| Pharmacist | pharmacy@demo.local | Password@123 |

**Change all of these before any real use.** Use `SUPER_ADMIN_*` in `server/.env` to set your own admin before seeding.

### Try the full workflow
1. Receptionist: **Register patient** → **Create visit** (department → doctor). A consultation charge is queued.
2. Cashier: **Pending payments** → receive payment → print receipt (RC-000001).
3. Doctor: open the patient from **My queue** → consultation → order a lab test / X-ray, write a prescription.
4. Cashier pays the lab/X-ray charge → Lab/X-Ray technician **Start** → enter result/report (attachments allowed).
5. Doctor sees the result (and a notification). Pharmacist dispenses the prescription.
6. Manager: **Reports**, **Services & prices**, **Audit logs**.

## Structure

```
server/src
  models/      14 collections + counters (users, hospitals, departments, patients, visits, services,
               payments, consultations, labOrders, labResults, xrayOrders, xrayReports, prescriptions,
               auditLogs, notifications)
  routes/      /api/auth, hospitals, users, departments, services, patients, visits, consultations,
               payments, laboratory, xray, pharmacy, reports, plus dashboard / audit-logs / notifications / files
  middleware/  authenticate (JWT + live user/hospital check), authorize(roles), requireHospital
  utils/       access.js (doctor + hospital isolation), billing (price snapshots), counters, audit, uploads
client/src     React + Vite + Tailwind + React Router + TanStack Query + React Hook Form + Axios
```

## How the key rules are enforced (backend, never only the UI)
- **Hospital isolation:** every operational query includes `hospitalId` taken from the logged-in user's token record, never from the request. Cross-hospital IDs return 404/403.
- **Doctor isolation:** doctors only see patients with a visit assigned to them (`utils/access.js`), and can only order/prescribe/consult on their own visits.
- **Price history:** a payment stores a snapshot of service name and price when the charge is created. Changing a price never alters old charges. Price changes are logged with old/new price and kept in `priceHistory`.
- **Discounts:** original, discount, final, reason, authorizing user and time are stored. Cashiers are capped by the hospital's `cashierMaxDiscountPercent`; managers can go higher.
- **Payments & receipts:** each payment transaction gets its own sequential receipt number (per hospital). Payments are applied atomically so two cashiers cannot over-collect.
- **Payment gate (Rules 6 & 7):** with `requirePrepayment` on (default, set per hospital), lab/X-ray cannot start until the charge is paid (HTTP 402).
- **Files:** uploads are private, served only through an authenticated route to same-hospital clinical roles.
- Also: bcrypt (cost 12), login rate limiting, helmet, Mongo operator sanitising, zod validation, uniform error handling.

## Notes and deliberate scope choices
- **Password reset:** there is no email service in v1, so the Hospital Manager resets staff passwords (Staff → Reset password) and the Super Admin manages managers. Users can change their own password through `POST /api/auth/change-password`.
- **Payment methods** include EVC Plus and eDahab alongside cash and card.
- **Not included yet (spec "future features"):** SMS/WhatsApp, online payments, insurance, inventory, appointments, patient portal.
- **Automated tests are not included.** The server loads cleanly and the client builds, but the workflow above should be click-tested against a real MongoDB before go-live.

## Deployment (spec §3)
- Client: build with `npm run build:client`, deploy `client/dist` to Vercel/Netlify, set `VITE_API_URL=https://<api-host>/api`.
- Server: Render/Railway/VPS with `MONGODB_URI` (Atlas), `JWT_SECRET`, `CLIENT_ORIGIN` (your client URL). Uploaded files live on local disk (`server/uploads`) — use a persistent volume, or move to S3-style storage for multi-instance hosting.
- Back up MongoDB regularly (Atlas scheduled backups) and set a strong `JWT_SECRET`.
