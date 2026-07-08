# Open Headers daemon image (DAEMON_PLAN.md §6 channels) — wraps the
# verified staged distribution. Build from apps/daemon after staging:
#
#   pnpm --filter @openheaders/daemon pack
#   docker build -t openheaders/daemon apps/daemon
#
# The stage's own node_modules never enters the image (host-ABI native
# module); the deps stage resolves better-sqlite3 for the image's
# platform at build time. Nothing is fetched at runtime.
#
# First boot — mint the client token into the data volume BEFORE the
# daemon starts (storage.json is single-writer):
#
#   docker run --rm -v oh-data:/data --entrypoint node openheaders/daemon \
#     dist/cli.js daemon show-token --data-dir /data --bind-address 0.0.0.0
#   docker run -d -v oh-data:/data -p 8137:8137 openheaders/daemon
#
# The printed join URLs are container-local; clients join at the host's
# published address (ws://<docker-host>:8137) with the minted token.

FROM node:22-slim AS deps
WORKDIR /app
COPY dist-package/package.json ./
RUN npm install --omit=dev --no-audit --no-fund

FROM node:22-slim
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY dist-package/package.json ./package.json
COPY dist-package/dist ./dist
VOLUME /data
EXPOSE 8137
ENTRYPOINT ["node", "dist/main.js", "--data-dir", "/data", "--bind-address", "0.0.0.0"]
