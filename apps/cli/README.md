# @openheaders/cli

`oh` — the [Open Headers](https://openheaders.io) command line: headless
scripting and CI integration against the same daemon the desktop app and
browser extension use. List rules, toggle them, switch environments and
workspaces, set variables, send saved requests, run workflows, diff
workspaces — straight from the shell, always in sync with what the UI shows.

## Requirements

- Node.js 22 or newer
- A running Open Headers desktop app (or standalone daemon) with the MCP
  surface enabled — Settings → MCP

## Install

```sh
npm install -g @openheaders/cli
```

## Quick start

Mint an access token in Open Headers → Settings → MCP, then pair once:

```sh
oh connect --daemon http://127.0.0.1:8137 --token <secret>
```

Later runs need no flags:

```sh
oh status
oh rules list
oh rules toggle <uid> off
oh env switch staging
oh request send login --env staging
oh workflow run health-probe
oh workspace diff <other-workspace>
```

Every command takes `--json` (the tool result's JSON payload, verbatim) and
`--workspace <id>`. In CI, skip the config file entirely: set `OH_DAEMON_URL`
and `OH_TOKEN` in the environment.

## Exit codes

| Code | Meaning |
| --- | --- |
| 0 | success |
| 1 | operation failed (the daemon answered; the operation itself reports failure) |
| 2 | usage error |
| 3 | daemon unreachable, or its MCP surface is disabled |
| 4 | token rejected, or the tool's tier is disabled on the host |

`oh help` lists every command and option.
