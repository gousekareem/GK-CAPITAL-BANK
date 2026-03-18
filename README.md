# GK Capital Bank — Full Stack Digital Banking System
 
> **Version 3.0** | Node.js · React · MongoDB | March 2026
 
A production-grade, full-stack digital banking web application simulating the complete online banking experience. Built for educational and demonstration purposes using real-world technologies and patterns found in actual banking systems.
 
---
 
## Table of Contents
 
- [Tech Stack](#tech-stack)
- [Features](#features)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Login Credentials](#login-credentials-after-seed)
- [API Reference](#api-reference)
- [Security Architecture](#security-architecture)
- [Troubleshooting](#troubleshooting)
 
---
 
## Tech Stack
 
| Layer      | Technology              | Version      | Purpose                     |
|------------|-------------------------|--------------|-----------------------------|
| Frontend   | React.js                | 18.2         | User Interface              |
| Styling    | Tailwind CSS            | 3.4          | Utility-first CSS           |
| State      | Zustand                 | 4.4          | Global State Management     |
| Charts     | Recharts                | 2.10         | Data Visualizations         |
| Backend    | Node.js + Express       | 20 + 4.18    | REST API Server             |
| Database   | MongoDB + Mongoose      | 7.0 + 8.0    | NoSQL Database              |
| Auth       | JWT + bcryptjs          | 9.0 + 2.4    | Security & Hashing          |
| OTP        | Fast2SMS / Twilio / SMTP| Latest       | SMS & Email OTP             |
| PDF        | PDFKit                  | 0.14         | Statement Generation        |
| Scheduler  | node-cron               | 3.0          | Scheduled Transfers         |
| AI/NLP     | Keyword Parser / OpenAI | Latest       | AI Banking Agent            |
 
---
 
## Features
 
- **Two-Factor Authentication (2FA)** — Register, verify email, and login with OTP confirmation
- **Real-time Money Transfers** — IMPS, NEFT, RTGS, UPI, and Internal transfers with OTP confirmation
- **Fraud Detection** — Multi-rule risk scoring engine (0–100), auto-block at score ≥ 90
- **PDF Bank Statements** — Downloadable A4 statements for any month via PDFKit
- **AI Banking Agent** — Natural language and voice command banking (e.g., "Send 500 to Mom")
- **Cash Flow Predictor** — 30-day balance forecast using Linear Regression
- **Credit Score Engine** — On-demand credit score (300–900) based on balance, activity, and age
- **Carbon Footprint Tracker** — CO₂ estimation per spending category
- **Double-Entry Ledger** — Complete accounting ledger for every transaction
- **Session Management** — Multi-device login tracking with geo anomaly detection
- **Admin Dashboard** — Fraud review, account freeze/unfreeze, audit logs, reversal approvals
- **KYC System** — Document upload and admin verification flow
- **Scheduled Transfers** — One-time and recurring future transfers via cron jobs
- **BNPL / EMI Plans** — Buy Now Pay Later with installment tracking
 
---
 
## Architecture
 
```
Browser (React SPA)
    ↓  Axios HTTP
Express API (localhost:5000)
    ↓  Rate Limiter → CORS → JWT Auth → Route Handler → Controller → Service
MongoDB (localhost:27017)
```
 
**Pattern:** Monolithic backend with microservice-like route separation. All routes are organized by domain: `auth`, `transactions`, `accounts`, `admin`, `agent`, `KYC`, `sessions`, `analytics`.
 
---
 
## Project Structure
 
### Backend (`src/`)
 
| File/Folder                        | Purpose                                                      |
|------------------------------------|--------------------------------------------------------------|
| `server.js`                        | Entry point — boots Express, registers routes, starts server |
| `config/database.js`               | MongoDB connection with reconnection handling                |
| `models/User.js`                   | User schema — fields, password hashing, virtuals            |
| `models/index.js`                  | 14 MongoDB schemas: OTP, Transaction, Ledger, Fraud, etc.   |
| `controllers/authController.js`    | 2FA login steps, register, refresh token, OTP verify        |
| `controllers/transactionController.js` | Atomic transfer, OTP send, history, insights            |
| `controllers/mainController.js`    | Dashboard, admin, KYC, sessions, agent, analytics, BNPL     |
| `services/otpService.js`           | OTP routing to Fast2SMS / Twilio / Email / Console          |
| `services/fraudService.js`         | Risk scoring 0–100 with 6 detection rules                   |
| `services/agentService.js`         | NLP parsing, intent detection, action execution             |
| `services/ledgerService.js`        | Double-entry ledger + Linear Regression cash flow predictor |
| `services/statementService.js`     | Full A4 bank statement PDF generation                       |
| `middleware/auth.js`               | JWT guard for all protected routes                          |
| `utils/seed.js`                    | Creates demo user, transactions, and beneficiaries          |
| `workers/schedulerWorker.js`       | Cron jobs — scheduled transfers, expired OTP cleanup        |
 
### Frontend (`src/`)
 
| File/Folder              | Purpose                                                    |
|--------------------------|------------------------------------------------------------|
| `App.js`                 | Router — all routes with Private/Public guards            |
| `pages/Pages.jsx`        | All 19 page components (Login → Admin Dashboard)          |
| `components/Layout.jsx`  | Sidebar + topbar shell with auto-logout                   |
| `services/api.js`        | All Axios API calls organized by domain                   |
| `store/authStore.js`     | Zustand store — user state, login steps, logout           |
| `hooks/useAutoLogout.js` | Auto logout after 15 min inactivity + biometric tracker   |
 
---
 
## Getting Started
 
### Prerequisites
 
| Software           | Version        | Notes                                         |
|--------------------|----------------|-----------------------------------------------|
| Node.js            | v20 LTS+       | Check "Add to PATH" during install            |
| MongoDB Community  | v7.0           | Check "Install as Windows Service"            |
| VS Code            | Latest         | Run as Administrator for `npm install`        |
 
### Setup
 
**1. Start MongoDB**
```bash
net start MongoDB
# Expected: "The MongoDB service was started successfully."
```
 
**2. Backend — Install, Seed, and Run**
```bash
cd backend
npm install
npm run seed     # Creates demo user, transactions, beneficiaries
npm run dev
```
Expected output:
```
MongoDB connected: 127.0.0.1
GK Capital Bank Server v3.0 → http://localhost:5000
OTP Provider: console
```
 
**3. Frontend — Install and Run** *(open a second terminal)*
```bash
cd frontend
npm install
npm start        # Browser opens at http://localhost:3000
```
 
---
 
## Login Credentials (After Seed)
 
| Field          | Value                                              |
|----------------|----------------------------------------------------|
| Email          | `demo@gkcapital.in`                                |
| Password       | `Demo@1234`                                        |
| Customer ID    | Shown in seed output (e.g. `GKC1234567890`)        |
| Initial Balance| ₹87,450.50                                         |
| OTP (dev mode) | Printed in backend terminal — look for `📲 OTP [LOGIN]` |
 
---
 
## Environment Variables
 
Create `backend/.env` — **never commit this file to git.**
 
| Variable                  | Default / Example                           | Description                                         |
|---------------------------|---------------------------------------------|-----------------------------------------------------|
| `NODE_ENV`                | `development`                               | Enables extra logging and `devOtp` in responses     |
| `PORT`                    | `5000`                                      | Backend server port                                 |
| `FRONTEND_URL`            | `http://localhost:3000`                     | Allowed CORS origin                                 |
| `MONGODB_URI`             | `mongodb://127.0.0.1:27017/sbi_banking`     | MongoDB connection string                           |
| `JWT_SECRET`              | `long_random_string`                        | Secret for access tokens — **change in production** |
| `JWT_REFRESH_SECRET`      | `another_long_string`                       | Secret for refresh tokens — **change in production**|
| `SMS_PROVIDER`            | `console`                                   | OTP delivery: `console`, `fast2sms`, `twilio`, `email` |
| `FAST2SMS_API_KEY`        | *(from fast2sms.com)*                       | Required only if `SMS_PROVIDER=fast2sms`            |
| `TWILIO_ACCOUNT_SID`      | `ACxxxx...`                                 | Required only if `SMS_PROVIDER=twilio`              |
| `TWILIO_AUTH_TOKEN`       | *(from twilio.com)*                         | Required only if `SMS_PROVIDER=twilio`              |
| `TWILIO_PHONE_NUMBER`     | `+1XXXXXXXXXX`                              | Your Twilio phone number                            |
| `SMTP_HOST`               | `smtp.gmail.com`                            | Email server hostname                               |
| `SMTP_PORT`               | `587`                                       | Email server port (STARTTLS)                        |
| `SMTP_USER`               | `your@gmail.com`                            | Gmail address                                       |
| `SMTP_PASS`               | *(16-char app password)*                    | Gmail App Password — not your Gmail password        |
| `AI_USE_OPENAI`           | `false`                                     | Set `true` to use GPT-3.5-turbo for agent parsing   |
| `OPENAI_API_KEY`          | `sk-...`                                    | Required only if `AI_USE_OPENAI=true`               |
| `FRAUD_LARGE_AMOUNT`      | `50000`                                     | Transfer amount that triggers `large_amount` flag   |
| `FRAUD_RAPID_TX_COUNT`    | `5`                                         | Transfers in window triggering `rapid_transfers`    |
| `FRAUD_RAPID_WINDOW_MINS` | `10`                                        | Time window (minutes) for rapid transfer detection  |
| `FRAUD_RISK_BLOCK_SCORE`  | `90`                                        | Risk score at which transfer is auto-blocked        |
 
### Setting Up SMS (Fast2SMS — India)
1. Sign up at [fast2sms.com](https://fast2sms.com) → Dashboard → Dev API → Copy API Key
2. Set `SMS_PROVIDER=fast2sms` and `FAST2SMS_API_KEY=your_key` in `backend/.env`
3. Update phone number in `seed.js` to your real 10-digit number
4. Run `npm run seed`, then `npm run dev`
 
### Setting Up Email OTP (Gmail)
1. Go to [myaccount.google.com](https://myaccount.google.com) → Security → App Passwords
2. Generate a 16-character App Password
3. Set `SMTP_USER`, `SMTP_PASS`, and `SMS_PROVIDER=email` in `backend/.env`
 
---
 
## API Reference
 
### Authentication
 
| Method | Endpoint                        | Body                              | Returns                              |
|--------|---------------------------------|-----------------------------------|--------------------------------------|
| POST   | `/api/auth/register`            | firstName, lastName, email, phone, password | customerId, accountNumber |
| POST   | `/api/auth/login`               | identifier, password              | tempToken, masked phone, devOtp      |
| POST   | `/api/auth/login/verify-otp`    | tempToken, otp                    | accessToken, refreshToken, user      |
| POST   | `/api/auth/refresh-token`       | refreshToken                      | accessToken, refreshToken            |
| POST   | `/api/auth/logout`              | *(Bearer)*                        | message                              |
| POST   | `/api/auth/forgot-password`     | email                             | message                              |
| POST   | `/api/auth/reset-password`      | email, otp, newPassword           | message                              |
| GET    | `/api/auth/me`                  | *(Bearer)*                        | user object                          |
 
### Transactions
 
| Method | Endpoint                              | Description                        |
|--------|---------------------------------------|------------------------------------|
| GET    | `/api/accounts/dashboard`             | Account summary + recent transactions |
| POST   | `/api/transactions/otp/send`          | Send transaction OTP               |
| POST   | `/api/transactions/transfer`          | Execute atomic transfer            |
| GET    | `/api/transactions/history`           | Paginated history with filters     |
| GET    | `/api/transactions/insights`          | Category breakdown + monthly trend |
| POST   | `/api/transactions/reversal/request`  | Request a reversal                 |
 
### Features
 
| Method         | Endpoint                            | Description                         |
|----------------|-------------------------------------|-------------------------------------|
| GET/POST/DELETE| `/api/beneficiaries`                | List, add, remove beneficiaries     |
| GET/PATCH      | `/api/profile`                      | Get and update profile              |
| POST           | `/api/bnpl/convert`                 | Create EMI plan                     |
| GET            | `/api/ai/credit-score`              | Calculate credit score              |
| GET            | `/api/ai/carbon-footprint`          | Return total carbon kg              |
| GET            | `/api/statements/:year/:month/download` | Stream PDF statement           |
| POST           | `/api/agent/command`                | Process NLP command                 |
| GET            | `/api/agent/cashflow`               | Linear regression cash flow         |
| GET/POST/DELETE| `/api/scheduled`                    | Manage scheduled transfers          |
| GET/DELETE     | `/api/sessions`                     | List/revoke login sessions          |
| POST           | `/api/kyc/upload`                   | Upload KYC document                 |
 
### Admin
 
| Method | Endpoint                        | Description                             |
|--------|---------------------------------|-----------------------------------------|
| GET    | `/api/admin/dashboard`          | Stats, fraud summary, recent activity  |
| GET    | `/api/admin/users`              | Paginated user list with search        |
| POST   | `/api/admin/freeze`             | Freeze account (userId, reason)        |
| POST   | `/api/admin/unfreeze`           | Unfreeze account                       |
| GET    | `/api/admin/fraud/alerts`       | Paginated fraud alerts                 |
| GET    | `/api/admin/audit-logs`         | Paginated audit log                    |
| POST   | `/api/admin/reversals/process`  | Approve or reject a reversal           |
 
---
 
## Security Architecture
 
| Layer           | Measure                   | Implementation                                  |
|-----------------|---------------------------|-------------------------------------------------|
| Network         | CORS restriction          | Only `localhost:3000` allowed by default        |
| Network         | Security headers          | `helmet.js` — X-Frame-Options, HSTS, CSP       |
| Network         | Rate limiting             | `express-rate-limit` on all critical endpoints  |
| Authentication  | 2-Factor Auth             | Credentials → OTP → JWT (neither step skippable)|
| Authentication  | JWT expiry                | Access tokens expire in 1 hour                  |
| Authentication  | Account lockout           | 5 failed attempts = 30 minute lockout           |
| Data            | Password hashing          | `bcryptjs` with salt rounds 12                  |
| Data            | Input validation          | `express-validator` on all input fields         |
| Transactions    | OTP per transfer          | Every money movement requires a fresh OTP       |
| Transactions    | Idempotency               | UUID key prevents double-payment                |
| Transactions    | Atomic updates            | MongoDB sessions — all-or-nothing               |
| Transactions    | Circuit breaker           | OTP service failure does not crash transfers    |
| Fraud           | Risk scoring              | 6 rules, 0–100 score, auto-block at 90          |
| Fraud           | Geo detection             | New city/country triggers anomaly flag          |
| Fraud           | Behavioral biometrics     | Typing speed and mouse pattern baseline         |
| Session         | Remote logout             | User can terminate any session remotely         |
| Session         | Auto logout               | 15 min inactivity timeout with 1 min warning    |
| Logging         | Audit trail               | Every action logged with userId, IP, metadata   |
 
---
 
## Troubleshooting
 
| Error                              | Cause                        | Fix                                          |
|------------------------------------|------------------------------|----------------------------------------------|
| `EPERM: operation not permitted`   | npm needs admin rights       | Reopen VS Code as Administrator              |
| `Cannot find module dotenv`        | `npm install` not run        | Run `npm install` in `backend/`              |
| `MongoDB connection refused`       | MongoDB service not running  | Run `net start MongoDB` as admin             |
| `Port 3000 in use`                 | Another app on port 3000     | Add `PORT=3001` to `frontend/.env`           |
| `Port 5000 in use`                 | Another app on port 5000     | Set `PORT=5001` in `backend/.env`            |
| `Cannot find module geoip-lite`    | Package not installed        | Run `npm install geoip-lite` in `backend/`   |
 
---
 
## Making a User Admin
 
Run in MongoDB shell:
```js
db.users.updateOne({ email: "demo@gkcapital.in" }, { $set: { isAdmin: true } })
```
Admin panel is accessible at `http://localhost:3000/admin`.
 
---
 
## License
 
Built for educational and demonstration purposes.  
**GK Capital Bank System v3.0** — March 2026
