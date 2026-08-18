# oh-h3-helper

The HTTP/3 wire pipeline behind the request engine's `httpVersion: '3'`
knob — a static helper binary (quinn + h3 + rustls) speaking the framed
stdio protocol documented in the request-engine H3-protocol design to the
node host. It performs exactly one wire hop per request; all policy
(redirects, cookies, digest, deadlines, capped reads) lives above the
seam in TypeScript.

Build (not part of the pnpm/turbo pipeline — cargo is invoked
explicitly):

```bash
cargo build --release                    # plain host build
node ../../scripts/build-h3-helper.mjs   # build + stage dist/<target>/ (what the packaging pipeline reads)
```

The h3 / h3-quinn crates are pre-1.0 — if cargo reports a version
resolution conflict, align the two pins in `Cargo.toml` to the current
compatible pair; the protocol and code do not depend on a specific
patch release.

Point the node host at the binary for dev / live passes:

```bash
export OPENHEADERS_H3_HELPER="$PWD/target/release/oh-h3-helper"
```

Packaged distribution (never downloaded at runtime): the release
pipeline builds the five-target matrix (`mac-arm64`, `mac-x64`,
`win-x64`, `linux-x64`, `linux-arm64`) via `scripts/build-h3-helper.mjs`
and ships the binary inside the desktop installers
(`resources/h3-helper/`), the ohd SEA binary (`helper` payload kind),
and the daemon npm tarball (`dist/h3-helper/<target>/`). The
path-gated `H3 Helper` workflow keeps the two protocol twins proven
against each other on every change.
