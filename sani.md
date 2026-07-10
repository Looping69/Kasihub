# sani.md

- 2026-07-09: Started repo analysis for deployment path. Found a Next.js-style app with Bun lockfile, Caddyfile, Prisma, and local upload/download dirs. Next step: inspect package.json and runtime config, then map build/start/deploy steps.
- 2026-07-09: Deployment path confirmed. App is Next.js 16 with standalone output. Build: un run build. Start: un run start on port 3000 behind Caddy. Needs persistent SQLite at DATABASE_URL and durable upload/ / download/ dirs.

- 2026-07-09: Docker build validated successfully. Fixed Bun image user creation issue by using numeric UID/GID ownership. Container now builds with Prisma generate + Next standalone output.
- Recommended runtime: mount persistent /data and set DATABASE_URL=file:/data/custom.db; expose 3000 behind Caddy or host port mapping.

- 2026-07-10: Confirmed this workspace is already a Git repository (git rev-parse --is-inside-work-tree returned true). There are existing modified files plus new Docker artifacts; no re-init performed.
- 2026-07-10: Created initial Git commit on main (`git commit -m "Initial commit"`, hash 6f8a0bb). Working tree may remain dirty if breadcrumb updates are kept uncommitted.
- 2026-07-10: Created private GitHub remote and pushed main. Repo URL: https://github.com/Looping69/Kasihub
- 2026-07-10: Added the KaSi feedback widget script to `src/app/layout.tsx` so the floating overlay loads site-wide after interactive.
