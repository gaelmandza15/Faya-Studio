# Faya-Studio — staging/production image
#
# The platform metadata client is generated for PostgreSQL. Project data still
# uses SQLite files under /app/workspaces (single-instance volume).

FROM node:24-slim AS deps
WORKDIR /app
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-slim AS builder
WORKDIR /app
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# prisma generate does not connect; the URL only satisfies validation.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
RUN npx tsx scripts/prepare-postgres-schema.ts \
  && npx prisma generate --schema prisma/postgres/schema.prisma \
  && npm run build

FROM node:24-slim AS runner
WORKDIR /app
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/src ./src
COPY --from=builder /app/templates ./templates
COPY --from=builder /app/tsconfig.json ./tsconfig.json

RUN mkdir -p workspaces
VOLUME ["/app/workspaces"]

EXPOSE 3000
CMD ["npm", "start"]
