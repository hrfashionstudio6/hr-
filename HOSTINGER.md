# Hostinger deployment

Deploy this repository as a separate Node.js application on `hr.easternwestern.net`.
Verify the subdomain and database name are unused before provisioning. Do not replace
the application, DNS records, or environment for `easternwestern.net`.

- Node: 22 or newer
- Root directory: repository root
- Install: `npm ci`
- Build: `npm run build`
- Start: `npm start` (entry file `server.mjs`)
- Configure the root `.env.example` variables in Hostinger's environment settings.
- Keep secrets out of Git and deployment archives.

The production server serves Next.js and Express on the platform's `PORT`.
It explicitly selects the `attendly_hr` database, irrespective of the database
path inside `MONGODB_URI`. Reuse the authorized cluster connection only after
confirming this database is dedicated to attendance.

Use a private random `SETUP_KEY` of at least 32 characters to create the first HR
account. Once setup is complete, remove the key from hosting environment settings.
Verify HR login, employee creation, employee login, check-in/out, and history
isolation over HTTPS. Also verify the existing fashion website still responds.
