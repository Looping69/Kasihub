FROM oven/bun:1.3.4 AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lock ./
COPY prisma ./prisma
RUN bun install --frozen-lockfile

FROM base AS builder
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the standalone server and make sure Prisma client exists for runtime.
RUN bunx prisma generate && bun run build

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
WORKDIR /app

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/upload ./upload
COPY --from=builder /app/download ./download

RUN mkdir -p /data && chown -R 1001:1001 /app /data

USER 1001:1001

EXPOSE 3000

# DATABASE_URL should point at a mounted persistent sqlite file, e.g. file:/data/custom.db
CMD ["bun", ".next/standalone/server.js"]
