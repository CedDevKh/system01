# syntax=docker/dockerfile:1

# --- deps ---
FROM node:20-alpine AS deps
WORKDIR /app

# Prisma needs OpenSSL at runtime, and some packages expect glibc compat.
RUN apk add --no-cache openssl libc6-compat

COPY package.json package-lock.json ./
RUN npm ci


# --- build ---
FROM node:20-alpine AS builder
WORKDIR /app

RUN apk add --no-cache openssl libc6-compat

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client and build Next.js
RUN npx prisma generate
RUN npm run build


# --- runner ---
FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache openssl libc6-compat

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# App runtime files
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/prisma ./prisma

COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["/entrypoint.sh"]
CMD ["npm", "run", "start"]
