# @openheaders/core

The [Open Headers](https://openheaders.com) domain model — types, valibot
schemas, wire protocol, and shared utilities used by every Open Headers
app (browser extension, desktop app, server, CLI).

Open Headers is your existing Web DevToolkit inside a browser extension —
modify live browser requests, manage API collections, collaborate with
your team. Local-first: no account, no cloud, your data stays on your
machine.

## Install

```bash
npm install @openheaders/core
```

## Usage

Use subpath imports; the root barrel re-exports only a small helper set.

```ts
import type { Rule, Workspace } from '@openheaders/core/types';
import { validateHeaderName } from '@openheaders/core/utils';
import { WS_PORT, PROTOCOL_VERSION } from '@openheaders/core/protocol';
import { VaultSchema } from '@openheaders/core/schemas';
```

The package ships plain ESM with type declarations; every domain area is
addressable as its own subpath (`/types`, `/schemas`, `/protocol`,
`/utils`, `/licensing`, `/telemetry`, …) so consumers pull in only what
they use.

## Source

Developed in the [open-headers](https://github.com/OpenHeaders/open-headers)
monorepo alongside the apps that consume it.

## License

Apache-2.0 — see the LICENSE and NOTICE files shipped with this package.
