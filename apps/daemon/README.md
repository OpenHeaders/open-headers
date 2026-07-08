# @openheaders/daemon

Standalone Open Headers daemon — the self-hosted back-end tier of
[Open Headers](https://openheaders.io). It runs the same sync engine as the
desktop app, headless: workspaces, rules, and live values served to the browser
extension, desktop app, and CLI over one WebSocket/HTTP bind.

Your machine, your LAN, a Raspberry Pi/NAS, or a VM you rent. No account, no
cloud relay, no telemetry, no phone-home — the daemon makes zero outbound
connections.

## Requirements

- Node.js 22 or newer
- macOS or Linux for the service lifecycle (`oh daemon install/start/stop`);
  any platform can run `node dist/main.js` directly

## Install

```sh
npm install -g @openheaders/daemon
```

The native SQLite module is built for your machine's Node at install time
(prebuilt bindings for common platforms; a compiler toolchain only if none
matches).

## Quick start

```sh
oh daemon install                 # write the user service unit (launchd/systemd)
oh daemon show-token              # mint the first client token (shown once)
oh daemon start
oh daemon status                  # probes /healthz
```

`show-token` prints the join URLs and a one-time secret. Add the daemon as a
backend in a client (Settings → Backends) with that token.

The daemon binds `127.0.0.1:8137` by default — loopback only. To make it
LAN-reachable:

```sh
oh daemon install --bind-address 0.0.0.0
```

Tokens are required on every non-loopback connection; pairing and token
administration beyond the first token happen from a connected client.

## Configuration

Precedence, highest first: argv → env → `daemon.json` → defaults.

| Flag | Env | `daemon.json` | Default |
| --- | --- | --- | --- |
| `--data-dir` | `OH_DAEMON_DATA_DIR` | `dataDir` | platform state dir |
| `--bind-address` | `OH_DAEMON_BIND_ADDRESS` | `bindAddress` | `127.0.0.1` |
| `--bind-port` | `OH_DAEMON_BIND_PORT` | `bindPort` | `8137` |
| `--log-level` | `OH_DAEMON_LOG_LEVEL` | `logLevel` | `info` |
| `--trusted-proxy` | `OH_DAEMON_TRUSTED_PROXY` | `trustedProxy` | `false` |
| `--allowed-host` (repeatable) | `OH_DAEMON_ALLOWED_HOSTS` (comma-separated) | `allowedHosts` | none |
| `--config` | `OH_DAEMON_CONFIG` | — | `<data dir>/daemon.json` |

Everything the daemon persists (`storage.json`, `oracle.db`, blobs) lives under
the data dir.

## Admission and rate limits

Every route on the bind enforces its own Origin/Host posture: `/mcp` refuses
any browser-originated request outright; the WebSocket sync route accepts
browser-extension origins and the daemon's own served origin; the pairing
pages accept only same-origin form posts; `/healthz` stays open. Requests
addressed by a hostname the daemon doesn't answer as are refused on the
browser-facing routes — IP addresses, `localhost`, and mDNS `*.local` names
always work; anything else (a reverse-proxy domain, an intranet name) must be
declared with `--allowed-host`.

Failed token attempts — pairing-code guesses, WebSocket auth rejections, and
`/mcp` bearer failures — feed one per-peer budget. A peer that crosses it is
blocked for a cool-down (HTTP 429 with `Retry-After`; upgrades refused), and
the daemon logs a single `peer throttled: … (peer=<addr>)` line at the
transition.

## Behind a reverse proxy (TLS)

TLS is reverse-proxy-first: terminate `wss://` at nginx or Caddy and forward
plain `ws://` to the daemon on loopback. The daemon can stay bound to
`127.0.0.1` when the proxy runs on the same machine — only the proxy is
reachable from outside.

```sh
oh daemon install --trusted-proxy --allowed-host oh.example.com
```

`--trusted-proxy` makes auth logs and rate limits use the client address the
proxy appends to `X-Forwarded-For` instead of the proxy's own; never set it
without a proxy in front, since clients could then spoof the header.
`--allowed-host` admits the proxy's domain on the browser-facing routes.

Caddy (automatic certificates, WebSocket upgrades and `X-Forwarded-For` are
handled by default):

```caddyfile
oh.example.com {
    reverse_proxy 127.0.0.1:8137
}
```

nginx:

```nginx
server {
    listen 443 ssl;
    server_name oh.example.com;
    ssl_certificate     /etc/ssl/oh.example.com.crt;
    ssl_certificate_key /etc/ssl/oh.example.com.key;

    location / {
        proxy_pass http://127.0.0.1:8137;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 300s;
    }
}
```

Clients then dial `wss://oh.example.com` with a paired token, exactly like a
LAN join.

## Logs

One line per event: `<ISO timestamp> <LEVEL> [scope] message`. Authentication
rejections include the peer address and reason on a single line, so log
scanners can match them directly.

## License

MIT
