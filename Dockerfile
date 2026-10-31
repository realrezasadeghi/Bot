
# --------------------------------------------------
# Base
# --------------------------------------------------

FROM node:22-alpine AS base

ARG PNPM_VERSION=12.4.2

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN npm install --global "pnpm@${PNPM_VERSION}" && \
    pnpm config set store-dir /pnpm/store

WORKDIR /app


# --------------------------------------------------
# Build Dependencies
# --------------------------------------------------

FROM base AS build-deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile


# --------------------------------------------------
# Build
# --------------------------------------------------

FROM build-deps AS build

COPY tsconfig.json tsconfig.build.json ./
COPY src ./src

RUN pnpm build


# --------------------------------------------------
# Production Dependencies
# --------------------------------------------------

FROM base AS prod-deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod


# --------------------------------------------------
# Runtime
# --------------------------------------------------

FROM node:22-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --chown=node:node package.json ./

COPY --from=prod-deps --chown=node:node \
    /app/node_modules ./node_modules

COPY --from=build --chown=node:node \
    /app/dist ./dist

COPY --chown=node:node drizzle ./drizzle

USER node

EXPOSE 3000

CMD ["node", "dist/bootstrap/http.js"]
