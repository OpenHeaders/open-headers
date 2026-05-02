import type { V5 } from '@openheaders/core/types';
import { VariableResolver } from '@openheaders/core/variables';
import { beforeEach, describe, expect, it } from 'vitest';
import type { RuleAttributionContext } from '@/panel/data/header-attribution';
import { computeRuleApplicability } from '@/panel/data/rule-applicability';
import type { RuleSnapshotHeaderMod } from '@/types/telemetry';

function makeRule(overrides: Partial<V5.HeaderRule> = {}): V5.HeaderRule {
  return {
    schemaVersion: 5,
    uid: 'r1',
    type: 'header',
    name: 'Test',
    enabled: true,
    path: 'collections/c1/rules',
    conditions: [{ uid: 'tcd00040', type: 'request-domains', values: ['example.com'] }],
    action: {
      requestHeaders: [{ uid: 'thm00064', operation: 'override', headerName: 'X-Foo', value: 'v1' }],
      responseHeaders: [],
    },
    ...overrides,
  } as V5.HeaderRule;
}

function makeMod(overrides: Partial<RuleSnapshotHeaderMod> = {}): RuleSnapshotHeaderMod {
  return {
    direction: 'request',
    operation: 'override',
    headerName: 'X-Foo',
    valueTemplate: 'v1',
    valueResolved: 'v1',
    ...overrides,
  };
}

interface FixtureOverrides {
  /** Pass `null` to simulate a deleted rule. */
  liveRule?: V5.Rule | null;
  snapshotMod?: Partial<RuleSnapshotHeaderMod>;
}

function makeFixture(overrides: FixtureOverrides = {}): {
  liveRule: V5.Rule | null;
  ctx: RuleAttributionContext;
} {
  const liveRule = overrides.liveRule === undefined ? makeRule() : overrides.liveRule;
  const snapshotMod = makeMod(overrides.snapshotMod ?? {});
  const ctx: RuleAttributionContext = {
    ruleUid: 'r1',
    ruleName: 'Test',
    ruleType: 'header',
    snapshotMod,
    snapshotMods: [snapshotMod],
    siblingMods: [],
  };
  return { liveRule, ctx };
}

const URL_MATCHING = 'https://example.com/api';
const URL_NOT_MATCHING = 'https://other.example.org/x';

describe('computeRuleApplicability', () => {
  let resolver: VariableResolver;
  beforeEach(() => {
    resolver = new VariableResolver();
  });

  it('reports `will-fire` for an enabled, matching rule with resolvable templates', () => {
    const { liveRule, ctx } = makeFixture();
    const verdict = computeRuleApplicability({ liveRule, ctx, url: URL_MATCHING, resolver });
    expect(verdict.kind).toBe('will-fire');
  });

  it('reports `rule-deleted` when the live rule is null', () => {
    const { ctx } = makeFixture({ liveRule: null });
    const verdict = computeRuleApplicability({ liveRule: null, ctx, url: URL_MATCHING, resolver });
    expect(verdict.kind).toBe('rule-deleted');
  });

  it('reports `rule-disabled` when enabled is false', () => {
    const { liveRule, ctx } = makeFixture({ liveRule: makeRule({ enabled: false }) });
    const verdict = computeRuleApplicability({ liveRule, ctx, url: URL_MATCHING, resolver });
    expect(verdict.kind).toBe('rule-disabled');
  });

  it('reports `mod-gone` when the matching mod is no longer on the rule', () => {
    // Live rule has a different header name than the snapshot's, so
    // findCurrentMod can't map the snapshot to a live mod.
    const liveRule = makeRule({
      action: {
        requestHeaders: [{ uid: 'thm00064', operation: 'override', headerName: 'X-Other', value: 'v' }],
        responseHeaders: [],
      },
    });
    const { ctx } = makeFixture({ liveRule });
    const verdict = computeRuleApplicability({ liveRule, ctx, url: URL_MATCHING, resolver });
    expect(verdict.kind).toBe('mod-gone');
  });

  it('reports `conditions-mismatch` when the URL no longer matches the rule', () => {
    const { liveRule, ctx } = makeFixture();
    const verdict = computeRuleApplicability({ liveRule, ctx, url: URL_NOT_MATCHING, resolver });
    expect(verdict.kind).toBe('conditions-mismatch');
  });

  it('reports `conditions-mismatch` when the rule has no conditions', () => {
    const { liveRule, ctx } = makeFixture({ liveRule: makeRule({ conditions: [] }) });
    const verdict = computeRuleApplicability({ liveRule, ctx, url: URL_MATCHING, resolver });
    expect(verdict.kind).toBe('conditions-mismatch');
  });

  it('reports `name-template-unresolved` when the live name template references an unresolvable var', () => {
    const liveRule = makeRule({
      action: {
        requestHeaders: [{ uid: 'thm00065', operation: 'override', headerName: '{{vault.TOTP_X}}', value: 'v1' }],
        responseHeaders: [],
      },
    });
    // Snapshot's headerName is the resolved value; headerNameTemplate is
    // the raw template — needed for findCurrentMod to map snapshot → live
    // when the live mod's name field IS the template.
    const { ctx } = makeFixture({
      liveRule,
      snapshotMod: { headerName: 'resolved-x', headerNameTemplate: '{{vault.TOTP_X}}' },
    });
    const verdict = computeRuleApplicability({ liveRule, ctx, url: URL_MATCHING, resolver });
    expect(verdict.kind).toBe('name-template-unresolved');
    if (verdict.kind === 'name-template-unresolved') expect(verdict.template).toBe('{{vault.TOTP_X}}');
  });

  it('reports `value-template-unresolved` when the live value template references an unresolvable var', () => {
    const liveRule = makeRule({
      action: {
        requestHeaders: [{ uid: 'thm00067', operation: 'override', headerName: 'X-Foo', value: '{{vault.TOTP_X}}' }],
        responseHeaders: [],
      },
    });
    const { ctx } = makeFixture({ liveRule });
    const verdict = computeRuleApplicability({ liveRule, ctx, url: URL_MATCHING, resolver });
    expect(verdict.kind).toBe('value-template-unresolved');
  });

  it('reports `separator-template-unresolved` when the live mergeSeparator references an unresolvable var', () => {
    const liveRule = makeRule({
      action: {
        requestHeaders: [
          { uid: 'thm00069', operation: 'merge', headerName: 'Cookie', value: 'k=v', mergeSeparator: '{{vault.TOTP_X}}' },
        ],
        responseHeaders: [],
      },
    });
    const { ctx } = makeFixture({
      liveRule,
      snapshotMod: { operation: 'merge', headerName: 'Cookie', valueTemplate: 'k=v', valueResolved: 'k=v' },
    });
    const verdict = computeRuleApplicability({ liveRule, ctx, url: URL_MATCHING, resolver });
    expect(verdict.kind).toBe('separator-template-unresolved');
  });

  it('reports unresolved when a vault TOTP entry resolves as deferred (defer-mode resolver hides this from result)', () => {
    // Renderer-side resolvers run in `defer` mode for vault refs:
    // TOTP entries return `value: ''` with `deferred: true`, so the
    // template's substituted `result` doesn't carry `{{` and the
    // `errors` array stays empty. Without explicit `deferred`-flag
    // introspection the popover would say `will-fire` here even
    // though the SW would skip the rule. Pin that behavior.
    resolver.setDeferredVaultMode('defer');
    resolver.setVault({
      schemaVersion: 5,
      
      secrets: [
        {
          kind: 'totp',
          name: 'TOTP_X',
          seed: 'JBSWY3DPEHPK3PXP',
          algorithm: 'SHA1',
          digits: 6,
          period: 30,
        },
      ],
    });
    const liveRule = makeRule({
      action: {
        requestHeaders: [{ uid: 'thm00071', operation: 'override', headerName: 'X-Foo', value: '{{vault.TOTP_X}}' }],
        responseHeaders: [],
      },
    });
    const { ctx } = makeFixture({ liveRule });
    const verdict = computeRuleApplicability({ liveRule, ctx, url: URL_MATCHING, resolver });
    expect(verdict.kind).toBe('value-template-unresolved');
  });
});
