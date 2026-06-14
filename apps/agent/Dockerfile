# DevPilot agent — production image.
#
# Deviation from a typical compile-to-dist image: this service runs TypeScript
# directly via `tsx`. The stack is ESM-first and `@octokit/rest` v22 is
# ESM-only, so the project deliberately skips a `tsc` emit step (the `build`
# script is just a type-check). We therefore ship the sources + node_modules and
# run them with tsx, rather than `node dist/index.js`.
FROM node:24-alpine AS deps
WORKDIR /app
# pnpm via corepack; copy only manifests first for a cached install layer.
RUN corepack enable
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --prod=false

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY tsconfig.json ./
# Restate ingress (9080) + liveness probe (9081).
EXPOSE 9080 9081
CMD ["pnpm", "start:prod"]
