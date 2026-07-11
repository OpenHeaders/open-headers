# Open Headers daemon image — self-contained multi-stage build from
# repo source. Build from the REPO ROOT:
#
#   docker build -f apps/daemon/docker/Dockerfile -t openheaders-daemon .
#
# Multi-arch via buildx (image publish stays a release act):
#
#   docker buildx build -f apps/daemon/docker/Dockerfile \
#     --platform linux/amd64,linux/arm64 -t openheaders-daemon .
#
# The build stage compiles the daemon and the Workbench web bundle from
# source, then runs scripts/pack.mjs — the same staging + verification
# the npm channel uses: better-sqlite3 resolved for the image's ABI,
# then a boot check (/healthz answers, `ohd status` sees it,
# SIGTERM exits 0). The runtime image carries only that verified stage;
# nothing is fetched at runtime — every dependency is packed at build.
#
# Runtime contract (docker-compose.yml is the composed example):
#   data    /data volume — daemon.json, storage.json, oracle.db, blobs/, logs/
#   config  /data/daemon.json (config-as-code) or OH_DAEMON_* env overrides
#   bind    reachability from other containers needs OH_DAEMON_BIND_ADDRESS=0.0.0.0,
#           which the boot refusal accepts only with OH_DAEMON_TRUSTED_PROXY=1
#           (a TLS-terminating proxy fronts every request) or
#           OH_DAEMON_ALLOW_INSECURE_LAN=1 (deliberate cleartext)
#   cli     `ohd` is on PATH — see docker-compose.yml for the token bootstrap

FROM node:22-bookworm AS build
ENV CI=1 TURBO_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile --filter open-headers --filter "@openheaders/daemon..." --filter "@openheaders/web..."
# The Workbench bundle outgrows Node's default ~2 GB heap cap.
RUN NODE_OPTIONS=--max-old-space-size=4096 pnpm turbo build --filter=@openheaders/daemon --filter=@openheaders/web
RUN pnpm --filter @openheaders/daemon exec node scripts/pack.mjs

FROM node:22-slim
WORKDIR /app
COPY --from=build /repo/apps/daemon/dist-package/package.json ./package.json
COPY --from=build /repo/apps/daemon/dist-package/node_modules ./node_modules
COPY --from=build /repo/apps/daemon/dist-package/dist ./dist
RUN ln -s /app/dist/cli.js /usr/local/bin/ohd && mkdir /data && chown node:node /data
ENV NODE_ENV=production OH_DAEMON_DATA_DIR=/data
USER node
VOLUME /data
EXPOSE 8137
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s \
  CMD ["node", "-e", "fetch(`http://127.0.0.1:${process.env.OH_DAEMON_BIND_PORT ?? 8137}/healthz`).then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "dist/main.js"]
