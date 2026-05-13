/**
 * Header compiler guard: unresolved `{{ref}}` templates in headerName
 * or value cause the mod to be skipped, not shipped to Chrome.
 *
 * Why this matters: `resolveRulesForCompile` substitutes every
 * resolvable reference before the builder runs. Anything that survives
 * is a ref the resolver couldn't satisfy — TOTP entries in `reject`
 * mode, missing env vars, broken refs. Chrome's DNR rejects literal
 * `{{` characters in header names; values would be sent literally,
 * which is also wrong. Skipping the mod keeps the rule set clean and
 * the user-visible "rule won't fire" verdict honest.
 */

import type { HeaderRule } from '@openheaders/core/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@utils/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import '@/workbench/settings/schema';
import { headerCompiler } from '@/background/dnr-builders/header-builder';
import type { CompilerContext } from '@/background/dnr-builders/types';
import { set as setSetting } from '@/workbench/settings/store';

function makeCtx(start = 1): CompilerContext {
  let id = start;
  return { allocateId: () => id++ };
}

function baseRule(action: HeaderRule['action']): HeaderRule {
  return {
    schemaVersion: 5,
    uid: 'h1',
    path: 'rules/header',
    name: 'Rule',
    type: 'header',
    enabled: true,
    conditions: [{ uid: 'tcd00014', type: 'request-domains', values: ['openheaders.io'] }],
    action,
  };
}

beforeEach(() => {
  // Flip Live Rules Mode off so the synthesizer doesn't add unrelated
  // cache-bypass mods to the assertion targets.
  setSetting('rulesEngine.liveRulesMode', false);
});

describe('header compiler — unresolved template guard', () => {
  it('skips a mod whose header-name template did not resolve', () => {
    const plan = headerCompiler.compile(
      baseRule({
        requestHeaders: [{ uid: 'thm00007', operation: 'override', headerName: 'X-{{vault.TOTP_X}}', value: 'v' }],
        responseHeaders: [],
      }),
      makeCtx(),
    );
    expect(plan.dynamicRules ?? []).toHaveLength(0);
  });

  it('skips a mod whose value template did not resolve', () => {
    const plan = headerCompiler.compile(
      baseRule({
        requestHeaders: [{ uid: 'thm00008', operation: 'override', headerName: 'X-Foo', value: '{{vault.TOTP_X}}' }],
        responseHeaders: [],
      }),
      makeCtx(),
    );
    expect(plan.dynamicRules ?? []).toHaveLength(0);
  });

  it('passes through a fully-resolved sibling mod even when another mod has an unresolved template', () => {
    // Per-mod skip: one bad mod shouldn't take down the rule's other
    // mods. The resolved sibling still ships to DNR.
    const plan = headerCompiler.compile(
      baseRule({
        requestHeaders: [
          { uid: 'thm00009', operation: 'override', headerName: 'X-Foo', value: 'v' },
          { uid: 'thm00010', operation: 'override', headerName: '{{vault.TOTP_X}}', value: 'v' },
        ],
        responseHeaders: [],
      }),
      makeCtx(),
    );
    const rules = plan.dynamicRules ?? [];
    expect(rules).toHaveLength(1);
    const reqMods = rules[0]?.action.requestHeaders ?? [];
    expect(reqMods).toHaveLength(1);
    expect(reqMods[0]?.header).toBe('X-Foo');
  });

  it('inject-manager skips a merge mod whose mergeSeparator template did not resolve', async () => {
    // merge mods don't go through the DNR header compiler (they're
    // handled by `inject-manager`). The unresolved-template guard in
    // `extractHeaderMergeEntry` ensures unresolved separators don't
    // reach the page injection.
    const { __testExtractHeaderMergeEntry } = await import('@/background/inject-manager');
    const rule = baseRule({
      requestHeaders: [{ uid: 'thm00011', operation: 'merge', headerName: 'Cookie', value: 'k=v', mergeSeparator: '{{vault.TOTP_X}}' }],
      responseHeaders: [],
    });
    expect(__testExtractHeaderMergeEntry(rule)).toBeNull();
  });

  it("skips remove-op mod whose header-name template didn't resolve", () => {
    // `remove` doesn't have a value, but the name still has to be a
    // valid token — same guard applies.
    const plan = headerCompiler.compile(
      baseRule({
        requestHeaders: [{ uid: 'thm00012', operation: 'remove', headerName: '{{vault.TOTP_X}}' }],
        responseHeaders: [],
      }),
      makeCtx(),
    );
    expect(plan.dynamicRules ?? []).toHaveLength(0);
  });
});
