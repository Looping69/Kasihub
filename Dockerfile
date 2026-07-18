FROM node:22-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Author: Klaasvaakie ( |╲ )
# Build the standalone frontend; all persistent data is owned by Encore.
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
WORKDIR /app

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/upload ./upload
COPY --from=builder /app/download ./download

RUN chown -R 1001:1001 /app

USER 1001:1001

EXPOSE 3000

# Author: Klaasvaakie ( |╲ )
# ENCORE_API_URL must point at the deployed Encore gateway.
CMD ["node", "server.js"]
