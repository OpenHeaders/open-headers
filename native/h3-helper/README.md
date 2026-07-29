# oh-h3-helper

The HTTP/3 wire pipeline behind the request engine's `httpVersion: '3'`
knob — a static helper binary (quinn + h3 + rustls) speaking the framed
stdio protocol documented in `docs/REQUEST_ENGINE_H3_PROTOCOL.md` to the
node host. It performs exactly one wire hop per request; all policy
(redirects, cookies, digest, deadlines, capped reads) lives above the
seam in TypeScript.

Build (not part of the pnpm/turbo pipeline — cargo is invoked
explicitly):

```bash
cargo build --release
```

The h3 / h3-quinn crates are pre-1.0 — if cargo reports a version
resolution conflict, align the two pins in `Cargo.toml` to the current
compatible pair; the protocol and code do not depend on a specific
patch release.

Point the node host at the binary for dev / live passes:

```bash
export OPENHEADERS_H3_HELPER="$PWD/target/release/oh-h3-helper"
```

Packaged distribution (per-OS/per-arch matrix, bundled per platform —
never downloaded at runtime) is a later Phase E slice.
