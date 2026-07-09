# sani.md

- 2026-07-09: Started repo analysis for deployment path. Found a Next.js-style app with Bun lockfile, Caddyfile, Prisma, and local upload/download dirs. Next step: inspect package.json and runtime config, then map build/start/deploy steps.
- 2026-07-09: Deployment path confirmed. App is Next.js 16 with standalone output. Build: un run build. Start: un run start on port 3000 behind Caddy. Needs persistent SQLite at DATABASE_URL and durable upload/ / download/ dirs.

- 2026-07-09: Docker build validated successfully. Fixed Bun image user creation issue by using numeric UID/GID ownership. Container now builds with Prisma generate + Next standalone output.
- Recommended runtime: mount persistent /data and set DATABASE_URL=file:/data/custom.db; expose 3000 behind Caddy or host port mapping.

- 2026-07-10: Confirmed this workspace is already a Git repository (git rev-parse --is-inside-work-tree returned true). There are existing modified files plus new Docker artifacts; no re-init performed.
