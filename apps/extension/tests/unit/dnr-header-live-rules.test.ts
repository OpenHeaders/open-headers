/**
 * Layer 1 (Live Rules Mode) behavior tests for the header compiler.
 *
 * Contract:
 *   - When `rulesEngine.liveRulesMode` is on (default), every compiled
 *     header rule carries `Cache-Control: no-cache, no-store, must-revalidate`
 *     + `Pragma: no-cache` on its request-side modifyHeaders — so matching
 *     requests revalidate with the server and the rule's effect is visible
 *     on every fire, not only on first load.
 *   - When the user's own rule already targets `Cache-Control` (set /
 *     append / remove / merge), the injection is skipped — user intent wins.
 *   - Injection is *prepended* so DNR's last-write-wins on same-header
 *     naturally preserves the user's own action ordering.
 *   - A response-only rule triggers the injection too — otherwise a cached
 *     response reuse would hide the user's response-header modification.
 */
import type { V5 } from '@openheaders/core/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@utils/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Importing the schema barrel registers every setting — including
// `rulesEngine.liveRulesMode` with its default `true` — so the header
// compiler's `getSetting` call resolves without having to init the store.
import '@/workbench/settings/schema';
import { headerCompiler } from '@/background/dnr-builders/header-builder';
import type { CompilerContext } from '@/background/dnr-builders/types';
import { set as setSetting } from '@/workbench/settings/store';

function makeCtx(start = 1): CompilerContext {
  let id = start;
  return { allocateId: () => id++ };
}

function baseRule(action: V5.HeaderRule['action']): V5.HeaderRule {
  return {
    schemaVersion: 5,
    uid: 'h1',
    path: 'rules/header',
    name: 'Rule',
    type: 'header',
    enabled: true,
    conditions: [{ type: 'request-domains', values: ['openheaders.io'] }],
    action,
  };
}

// All tests run with Live Rules Mode on unless they flip it explicitly.
beforeEach(() => {
  setSetting('rulesEngine.liveRulesMode', true);
});

describe('Live Rules Mode — Layer 1 injection', () => {
  it('prepends Cache-Control + Pragma on request-only rules', () => {
    const plan = headerCompiler.compile(
      baseRule({
        requestHeaders: [{ operation: 'override', headerName: 'Authorization', value: 'Bearer xyz' }],
        responseHeaders: [],
      }),
      makeCtx(),
    );
    const rules = plan.dynamicRules ?? [];
    expect(rules).toHaveLength(1);
    const reqMods = rules[0]!.action.requestHeaders ?? [];
    expect(reqMods).toHaveLength(3);
    // Order: cache-bypass FIRST, user's header last. DNR's last-write-wins
    // makes any future user Cache-Control override ours without re-editing
    // the synthesizer.
    expect(reqMods[0]!.header).toBe('Cache-Control');
    expect(reqMods[0]!.value).toBe('no-cache');
    expect(reqMods[1]!.header).toBe('Pragma');
    expect(reqMods[1]!.value).toBe('no-cache');
    expect(reqMods[2]!.header).toBe('Authorization');
  });

  it('triggers on response-only rules too (cache-bypass on request side)', () => {
    const plan = headerCompiler.compile(
      baseRule({
        requestHeaders: [],
        responseHeaders: [{ operation: 'override', headerName: 'X-Custom', value: 'yes' }],
      }),
      makeCtx(),
    );
    const rules = plan.dynamicRules ?? [];
    // Response-only becomes combined after Layer 1 injection → main_frame + sub-resource split.
    expect(rules.length).toBeGreaterThan(0);
    for (const r of rules) {
      const reqMods = r.action.requestHeaders ?? [];
      expect(reqMods.map((m) => m.header)).toEqual(['Cache-Control', 'Pragma']);
      expect(r.action.responseHeaders).toHaveLength(1);
      expect(r.action.responseHeaders![0]!.header).toBe('X-Custom');
    }
  });

  it("skips injection when user's rule sets Cache-Control explicitly", () => {
    const plan = headerCompiler.compile(
      baseRule({
        requestHeaders: [{ operation: 'override', headerName: 'Cache-Control', value: 'max-age=300' }],
        responseHeaders: [],
      }),
      makeCtx(),
    );
    const reqMods = (plan.dynamicRules ?? [])[0]!.action.requestHeaders ?? [];
    expect(reqMods).toHaveLength(1);
    expect(reqMods[0]!.header).toBe('Cache-Control');
    expect(reqMods[0]!.value).toBe('max-age=300');
  });

  it("skips injection when user's rule removes Cache-Control (presence, not truthy)", () => {
    const plan = headerCompiler.compile(
      baseRule({
        requestHeaders: [{ operation: 'remove', headerName: 'Cache-Control' }],
        responseHeaders: [],
      }),
      makeCtx(),
    );
    const reqMods = (plan.dynamicRules ?? [])[0]!.action.requestHeaders ?? [];
    expect(reqMods).toHaveLength(1);
    expect(reqMods[0]!.operation).toBe('remove');
    expect(reqMods[0]!.header).toBe('Cache-Control');
  });

  it('case-insensitive precedence check — lowercase "cache-control" still wins', () => {
    const plan = headerCompiler.compile(
      baseRule({
        requestHeaders: [{ operation: 'override', headerName: 'cache-control', value: 'max-age=60' }],
        responseHeaders: [],
      }),
      makeCtx(),
    );
    const reqMods = (plan.dynamicRules ?? [])[0]!.action.requestHeaders ?? [];
    expect(reqMods).toHaveLength(1);
    // normalizeHeaderName canonicalizes to "Cache-Control".
    expect(reqMods[0]!.header.toLowerCase()).toBe('cache-control');
    expect(reqMods[0]!.value).toBe('max-age=60');
  });

  it('does not inject Cache-Control when Live Rules Mode is off', () => {
    setSetting('rulesEngine.liveRulesMode', false);
    const plan = headerCompiler.compile(
      baseRule({
        requestHeaders: [{ operation: 'override', headerName: 'Authorization', value: 'Bearer xyz' }],
        responseHeaders: [],
      }),
      makeCtx(),
    );
    const reqMods = (plan.dynamicRules ?? [])[0]!.action.requestHeaders ?? [];
    expect(reqMods).toHaveLength(1);
    expect(reqMods[0]!.header).toBe('Authorization');
  });

  it('does not inject anything when the rule has no request or response mods', () => {
    const plan = headerCompiler.compile(
      baseRule({
        requestHeaders: [],
        responseHeaders: [],
      }),
      makeCtx(),
    );
    expect(plan.dynamicRules ?? []).toEqual([]);
  });
});
