## What & why

<!-- Bug fixes: describe the bug and the fix (link an issue if one exists).
     Features: link the issue where the design was agreed — feature PRs
     without a prior discussion may be closed (see docs/CONTRIBUTING.md). -->

## Checklist

- [ ] Every commit is signed off (`git commit -s`) — the DCO
      `Signed-off-by:` line is required
- [ ] Tests cover the new or changed behavior
- [ ] Targeted tests for the touched packages pass, plus
      `pnpm turbo typecheck`
- [ ] `pnpm biome check .` passes
