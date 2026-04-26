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
    version: 1,
    path: 'collections/c1/rules',
    conditions: [{ type: 'request-domains', values: ['example.com'] }],
    action: {
      requestHeaders: [{ operation: 'override', headerName: 'X-Foo', value: 'v1' }],
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

function makeCtx(overrides: Partial<RuleAttributionContext> = {}): RuleAttributionContext {
  const rule = overrides.currentRule === undefined ? makeRule() : overrides.currentRule;
  return {
    ruleUid: 'r1',
    ruleName: 'Test',
    ruleType: 'header',
    ruleVersion: 1,
    snapshotMod: makeMod(),
    currentRule: rule,
    currentMod:
      rule && rule.type === 'header' ? rule.action.requestHeaders[0] ?? null : null,
    edited: false,
    siblingMods: [],
    ...overrides,
  };
}

const URL_MATCHING = 'https://example.com/api';
const URL_NOT_MATCHING = 'https://other.example.org/x';

describe('computeRuleApplicability', () => {
  let resolver: VariableResolver;
  beforeEach(() => {
    resolver = new VariableResolver();
  });

  it('reports `will-fire` for an enabled, matching rule with resolvable templates', () => {
    const ctx = makeCtx();
    const verdict = computeRuleApplicability({ ctx, url: URL_MATCHING, resolver });
    expect(verdict.kind).toBe('will-fire');
  });

  it('reports `rule-deleted` when the live rule is null', () => {
    const ctx = makeCtx({ currentRule: null, currentMod: null });
    const verdict = computeRuleApplicability({ ctx, url: URL_MATCHING, resolver });
    expect(verdict.kind).toBe('rule-deleted');
  });

  it('reports `rule-disabled` when enabled is false', () => {
    const ctx = makeCtx({ currentRule: makeRule({ enabled: false }) });
    const verdict = computeRuleApplicability({ ctx, url: URL_MATCHING, resolver });
    expect(verdict.kind).toBe('rule-disabled');
  });

  it('reports `mod-gone` when the matching mod is no longer on the rule', () => {
    const ctx = makeCtx({ currentMod: null });
    const verdict = computeRuleApplicability({ ctx, url: URL_MATCHING, resolver });
    expect(verdict.kind).toBe('mod-gone');
  });

  it('reports `conditions-mismatch` when the URL no longer matches the rule', () => {
    const ctx = makeCtx();
    const verdict = computeRuleApplicability({ ctx, url: URL_NOT_MATCHING, resolver });
    expect(verdict.kind).toBe('conditions-mismatch');
  });

  it('reports `conditions-mismatch` when the rule has no conditions', () => {
    const ctx = makeCtx({ currentRule: makeRule({ conditions: [] }) });
    const verdict = computeRuleApplicability({ ctx, url: URL_MATCHING, resolver });
    expect(verdict.kind).toBe('conditions-mismatch');
  });

  it('reports `name-template-unresolved` when the live name template references an unresolvable var', () => {
    const ctx = makeCtx({
      currentRule: makeRule({
        action: {
          requestHeaders: [{ operation: 'override', headerName: '{{vault.TOTP_X}}', value: 'v1' }],
          responseHeaders: [],
        },
      }),
      currentMod: { operation: 'override', headerName: '{{vault.TOTP_X}}', value: 'v1' },
    });
    const verdict = computeRuleApplicability({ ctx, url: URL_MATCHING, resolver });
    expect(verdict.kind).toBe('name-template-unresolved');
    if (verdict.kind === 'name-template-unresolved') expect(verdict.template).toBe('{{vault.TOTP_X}}');
  });

  it('reports `value-template-unresolved` when the live value template references an unresolvable var', () => {
    const ctx = makeCtx({
      currentRule: makeRule({
        action: {
          requestHeaders: [{ operation: 'override', headerName: 'X-Foo', value: '{{vault.TOTP_X}}' }],
          responseHeaders: [],
        },
      }),
      currentMod: { operation: 'override', headerName: 'X-Foo', value: '{{vault.TOTP_X}}' },
    });
    const verdict = computeRuleApplicability({ ctx, url: URL_MATCHING, resolver });
    expect(verdict.kind).toBe('value-template-unresolved');
  });

  it('reports `separator-template-unresolved` when the live mergeSeparator references an unresolvable var', () => {
    const ctx = makeCtx({
      currentRule: makeRule({
        action: {
          requestHeaders: [
            { operation: 'merge', headerName: 'Cookie', value: 'k=v', mergeSeparator: '{{vault.TOTP_X}}' },
          ],
          responseHeaders: [],
        },
      }),
      currentMod: { operation: 'merge', headerName: 'Cookie', value: 'k=v', mergeSeparator: '{{vault.TOTP_X}}' },
    });
    const verdict = computeRuleApplicability({ ctx, url: URL_MATCHING, resolver });
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
      version: 1,
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
    const ctx = makeCtx({
      currentRule: makeRule({
        action: {
          requestHeaders: [{ operation: 'override', headerName: 'X-Foo', value: '{{vault.TOTP_X}}' }],
          responseHeaders: [],
        },
      }),
      currentMod: { operation: 'override', headerName: 'X-Foo', value: '{{vault.TOTP_X}}' },
    });
    const verdict = computeRuleApplicability({ ctx, url: URL_MATCHING, resolver });
    expect(verdict.kind).toBe('value-template-unresolved');
  });
});
