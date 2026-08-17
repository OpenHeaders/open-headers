# Contributing to Open Headers

Thank you for your interest in Open Headers! The project is open source
under the [Apache License 2.0](../LICENSE) and welcomes community
contributions — bug reports, bug fixes, feature discussions, and
documentation improvements.

## What we accept

- **Bug fixes: always welcome.** If something is broken, a pull request
  that fixes it (ideally with a regression test) can be opened directly.
  Linking an issue that describes the bug helps review but is not
  required for small, self-evident fixes.
- **Features: discussion first.** Open an issue describing the problem
  and the proposed behavior **before** writing code. Open Headers has a
  deep set of architectural conventions (a shared core with schema
  validation at system boundaries, main-process-first desktop design,
  strict typing, 14000+ tests), and feature work that skips the design
  conversation usually has to be redone to fit them. A feature PR
  without a prior agreed-upon issue may be closed with a pointer to
  this policy.
- **Documentation and test improvements: welcome** under the same
  bug-fix rules.

## Developer Certificate of Origin (DCO)

Every commit must be signed off, certifying the
[Developer Certificate of Origin](https://developercertificate.org/):

```
Signed-off-by: John Doe <john.doe@example.com>
```

Use `git commit -s` to add the line automatically. The sign-off asserts
that you wrote the change or otherwise have the right to submit it
under the Apache-2.0 license. There is no CLA; the DCO sign-off is the
only inbound requirement. Use your real name and a reachable email
address.

## How to contribute

### Report bugs

[Open a bug report](https://github.com/OpenHeaders/open-headers-app/issues/new?template=bug_report.yml) with:

- Steps to reproduce
- Expected vs actual behavior
- Platform (macOS/Windows/Linux), browser, and app/extension version
- Screenshots or logs if relevant

### Propose features

[Open a feature request](https://github.com/OpenHeaders/open-headers-app/issues/new?template=feature_request.yml) describing:

- The problem you're solving (the workflow, not just the mechanism)
- The behavior you'd like to see
- Any implementation ideas (optional)

### Ask questions & discuss

Use [GitHub Discussions](https://github.com/OpenHeaders/open-headers-app/discussions)
for questions, ideas you'd like feedback on before filing an issue, and
sharing how you use Open Headers.

## Pull request checklist

1. For features, link the issue where the design was agreed.
2. Every commit carries a `Signed-off-by` line (`git commit -s`).
3. Code follows the repo style (Biome-enforced; no `any` types) and
   matches the local idiom of the files it touches.
4. New or changed behavior comes with tests in the same PR; run the
   targeted test files for the packages you touched plus
   `pnpm turbo typecheck`.
5. `pnpm biome check .` passes.

## Development setup

```bash
git clone https://github.com/OpenHeaders/open-headers-app.git
cd open-headers-app
pnpm install               # requires pnpm 10+, Node 22+
pnpm turbo typecheck       # Typecheck all packages
pnpm turbo test            # Run all tests
pnpm turbo build           # Build everything
```

See [DEVELOPER.md](DEVELOPER.md) for the full technical documentation
and [ARCHITECTURE.md](ARCHITECTURE.md) for the system overview.

## Issue labels

| Label | Description |
|-------|-------------|
| `bug` | Something isn't working |
| `feature` | New feature request |
| `enhancement` | Improvement to existing functionality |
| `question` | Needs clarification or discussion |
| `good first issue` | Simple issues for newcomers |
| `platform-macos` | macOS-specific |
| `platform-windows` | Windows-specific |
| `platform-linux` | Linux-specific |

## Code of conduct

Be respectful and constructive in all interactions. We're building
something useful together.

## Thank you

Every bug report, fix, feature idea, and question helps make Open
Headers better. We appreciate your involvement!
