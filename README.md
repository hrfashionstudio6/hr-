# Attendly — Next.js + Tailwind + Express + MongoDB

## Requirements
- Node.js 22.13 or newer (working, trusted installation)
- MongoDB locally, Docker, or a MongoDB Atlas connection string

## Quick start (Windows PowerShell)
Run these commands inside the extracted `attendly-mongodb` folder:

```powershell
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env.local
npm install
```
Edit `backend/.env`:
- `MONGODB_URI`: local MongoDB address or your Atlas connection string.
- `SETUP_KEY`: a secret random value of at least 32 characters. Required to create the first HR administrator. Do not commit it.
- `APP_ORIGIN`: `http://localhost:3000` for local use.

To generate a setup key:
```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

If using Docker for local MongoDB:
```powershell
docker compose up -d
```
Otherwise start your installed MongoDB service or use Atlas. Then:
```powershell
npm run dev
```
Open **http://localhost:3000**. The API listens at **http://127.0.0.1:4000**. Next.js proxies `/api` requests to Express; the browser uses one origin.

## First login
1. Enter company name, HR name, email, password, timezone, and SETUP_KEY.
2. HR is created once. There is no open employee registration.
3. HR uses **Add employee** to provide employee details, email, initial password and duty times.
4. Employees sign in with those credentials. They can change their password from the sidebar.
5. HR can reset an employee password in their profile. Leaving that field empty preserves the existing password.
6. Deactivate an employee to revoke login and sessions without deleting attendance history.

Passwords must be 12–72 characters and at most 72 UTF-8 bytes. Passwords are hashed using bcrypt. Login uses random opaque sessions stored as SHA-256 hashes in MongoDB and sent in HttpOnly cookies. Sessions expire after 8 hours. Login and setup have rate limits. Mutations validate the browser Origin and require JSON. Authorization is enforced by Express on every request.

## Included features
- Responsive dark-sidebar HR dashboard with attendance chart, employee directory, filters and CSV export.
- HR employee creation/editing: name, email, job title, department, phone, address, joining date, emergency contact and duty times.
- Employee check-in/check-out using server timestamps, own history and read-only profile.
- Automatic late status in the workspace timezone and working hours from actual check-in/out.
- MongoDB unique indexes prevent duplicate attendance and multiple open sessions per employee.
- An unfinished session can be checked out on the following day; schedules themselves are same-day shifts.
- Password changes invalidate existing sessions; HR password resets invalidate the employee's sessions.

## Project layout
- `frontend/`: actual Next.js App Router application, React, Tailwind CSS and reusable components.
- `backend/`: standalone Node.js Express API, Mongoose models and integration tests.
- `docker-compose.yml`: optional local MongoDB, bound only to loopback, with persistent volume.

This is an independent source-code project. It does not use Sites hosting, Cloudflare D1, or ChatGPT sign-in.

## Tests and production build
```powershell
npm test
npm run typecheck -w frontend
npm run build
```
The integration suite starts a disposable MongoDB using mongodb-memory-server; first execution downloads the MongoDB binary and requires network access. It covers first HR setup, employee creation, duplicate email, role isolation, concurrent check-in, checkout, password changes, session revocation and timezone boundaries.

**Verification status:** Dependency installation and the production Next.js build (including TypeScript checks) pass. MongoDB integration tests are being verified separately. A package-lock.json is included for reproducible installs.

For production, set `NODE_ENV=production`, use HTTPS, set APP_ORIGIN to the exact frontend origin, and configure API_URL to the private Express endpoint. Secure cookies require HTTPS. Keep the API behind your reverse proxy; it binds to 127.0.0.1 by default. Use an authenticated MongoDB connection and backups. Do not publish `.env` files. Review current framework security patches before exposing the application publicly.

For Hostinger, use the combined production server: configure root environment variables, run `npm run build`, then `npm start`. See HOSTINGER.md. Both development and production explicitly use the isolated `attendly_hr` database. The original separate frontend/backend start commands are also available for self-managed installations.

## Current scope
One HR administrator per workspace; one same-day shift and one attendance record per employee per day. Leave, holidays, payroll, breaks, biometric integration, overnight shift scheduling, manual attendance corrections and email password recovery are not implemented. HR can reset employee passwords; administrator credential recovery is a server-admin task. All history is loaded per account in this version, so add server pagination before very large rollouts.

## Roman Urdu setup
ZIP extract karein. Node.js aur MongoDB install/run karein. Dono env example files copy karein, MongoDB URL aur setup key set karein. Root folder mein `npm install`, phir `npm run dev` chalayein. Browser mein localhost:3000 kholen. Pehle HR account banayein, phir employees ke email/password aur duty timings add karein.

