# Vercel deployment

Create a separate project in the Fashion Studio team from `hrfashionstudio6/hr-`.
Use the Next.js preset, root directory `frontend`, Node 22.x or newer, and enable
source files outside the root directory. Keep the standard Next.js build and output
settings. The repository uses npm workspaces; install with the root lockfile.

Set private project environment variables before deployment:

- `MONGODB_URI`: the authorized Atlas connection string.
- `APP_ORIGIN`: the exact HTTPS origin of the attendance app's canonical domain.
- `SETUP_KEY`: at least 32 random characters for the first HR account.

Do not set API_URL or PORT. Vercel provides NODE_ENV and VERCEL automatically.
The Next.js API adapter runs the existing Express backend and connects lazily to
the isolated `attendly_hr` database. The database named in the URI is not used.
Do not modify the existing `eastern-western` Vercel project.

Local verification: build with `VERCEL=1`, then run
`node scripts/smoke-production.mjs --vercel` from the repository root. This uses a
disposable MongoDB and checks HTML, API routing, setup, cookies and DB isolation.
