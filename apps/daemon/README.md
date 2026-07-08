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
| `--config` | `OH_DAEMON_CONFIG` | — | `<data dir>/daemon.json` |

Everything the daemon persists (`storage.json`, `oracle.db`, blobs) lives under
the data dir.

## Logs

One line per event: `<ISO timestamp> <LEVEL> [scope] message`. Authentication
rejections include the peer address and reason on a single line, so log
scanners can match them directly.

## License

MIT
