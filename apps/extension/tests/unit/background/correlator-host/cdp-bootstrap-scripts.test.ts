/**
 * `compileBootstrapScripts` — the residual in-page wrappers of in-scope rules
 * rendered as CDP document-bootstrap sources (Phase E1b), the delivery-plane
 * twin of `compileFetchPatterns`. Only the bootstrap-eligible wrappers
 * contribute: Fetch-realizable rules ride the network plane (excluded),
 * `inject` is page-DOM (excluded), and initiator-domain-gated wrappers stay on
 * the per-document `onCommitted` path (excluded). `oh-setup` is always first so
 * it captures the page's pristine references before any wrapper runs; keys are
 * `<type>:<uid>`, stable across re-derive.
 */

import type {
  DelayRule,
  HeaderRule,
  InjectRule,
  ResponseRule,
  RuleCondition,
  SseRule,
  WsRule,
} from '@openheaders/core/types';
import { describe, expect, it } from 'vitest';

import { compileBootstrapScripts, injectionToSource } from '@/background/correlator-host/cdp-bootstrap-scripts';

const urlFilter: RuleCondition = { uid: 'cnd-uf', type: 'url-filter', values: ['*://api.openheaders.io/*'] };
const initiatorDomains: RuleCondition = { uid: 'cnd-id', type: 'initiator-domains', values: ['app.openheaders.io'] };
const xhrOnly: RuleCondition = { uid: 'cnd-rt', type: 'resource-types', values: ['xhr'] };

function delayRule(overrides: Partial<DelayRule> = {}): DelayRule {
  return {
    schemaVersion: 5,
    uid: 'dl000001',
    path: 'rules/delay',
    name: 'Delay',
    type: 'delay',
    enabled: true,
    conditions: [urlFilter],
    action: { delayMs: 250 },
    ...overrides,
  };
}

function wsRule(overrides: Partial<WsRule> = {}): WsRule {
  return {
    schemaVersion: 5,
    uid: 'ws000001',
    path: 'rules/ws',
    name: 'Socket',
    type: 'ws',
    enabled: true,
    conditions: [urlFilter],
    action: { operation: 'modify', direction: 'send', payload: 'hi', injectTrigger: 'open' },
    ...overrides,
  };
}

function sseRule(overrides: Partial<SseRule> = {}): SseRule {
  return {
    schemaVersion: 5,
    uid: 'ss000001',
    path: 'rules/sse',
    name: 'Events',
    type: 'sse',
    enabled: true,
    conditions: [urlFilter],
    action: { operation: 'inject', payload: 'data', injectTrigger: 'open' },
    ...overrides,
  };
}

/** Unrestricted response (no resource-types) → debug-tier → Fetch-realizable. */
function realizableResponseRule(overrides: Partial<ResponseRule['action']> = {}): ResponseRule {
  return {
    schemaVersion: 5,
    uid: 'rs000001',
    path: 'rules/response',
    name: 'Mock',
    type: 'response',
    enabled: true,
    conditions: [urlFilter],
    action: {
      responseSource: 'mock',
      statusCode: 418,
      contentType: 'application/json',
      bodyType: 'static',
      responseBody: '{"oh":"mocked"}',
      responseHeaders: {},
      resourceType: 'rest',
      ...overrides,
    },
  };
}

/** Same response but confined to xhr → NOT debug-tier → residual (bootstrap). */
function xhrResponseRule(overrides: Partial<ResponseRule> = {}): ResponseRule {
  const rule = realizableResponseRule();
  return { ...rule, uid: 'rs000002', conditions: [urlFilter, xhrOnly], ...overrides };
}

function headerMergeRule(overrides: Partial<HeaderRule> = {}): HeaderRule {
  return {
    schemaVersion: 5,
    uid: 'hd000001',
    path: 'rules/header',
    name: 'Merge',
    type: 'header',
    enabled: true,
    conditions: [urlFilter],
    action: {
      requestHeaders: [
        { uid: 'hm000001', operation: 'merge', headerName: 'X-Trace', value: 'oh', mergeSeparator: ', ' },
      ],
      responseHeaders: [],
    },
    ...overrides,
  };
}

describe('compileBootstrapScripts', () => {
  it('returns no scripts for an empty rule set', () => {
    expect(compileBootstrapScripts([])).toEqual([]);
  });

  it('returns no scripts when every rule is Fetch-realizable (network plane owns them)', () => {
    expect(compileBootstrapScripts([realizableResponseRule()])).toEqual([]);
  });

  it('bootstraps a ws wrapper, with oh-setup always first', () => {
    const scripts = compileBootstrapScripts([wsRule()]);
    expect(scripts.map((s) => s.key)).toEqual(['oh-setup', 'ws:ws000001']);
    // Setup captures the pristine originals before any wrapper patches them.
    expect(scripts[0]!.source).toContain('__ohOrig');
  });

  it('bootstraps delay / sse / xhr-confined response wrappers (the residual set)', () => {
    const scripts = compileBootstrapScripts([delayRule(), sseRule(), xhrResponseRule()]);
    expect(scripts.map((s) => s.key)).toEqual(['oh-setup', 'delay:dl000001', 'sse:ss000001', 'response:rs000002']);
  });

  it('renders a func wrapper as an immediately-invoked source carrying its config', () => {
    const [, delay] = compileBootstrapScripts([delayRule({ action: { delayMs: 1234 } })]);
    // func.toString() IIFE invoked with the JSON config — the delayMs rides inline.
    expect(delay!.source).toMatch(/^\(function/);
    expect(delay!.source).toContain('1234');
    expect(delay!.source).toContain('dl000001');
  });

  it('renders a dynamic (user-JS) wrapper as its inline-script source verbatim', () => {
    const dyn = xhrResponseRule({
      uid: 'rs000003',
      action: {
        responseSource: 'mock',
        statusCode: 200,
        contentType: 'application/json',
        bodyType: 'dynamic',
        responseBody: 'function buildResponse(){ return { ok: true }; }',
        responseHeaders: {},
        resourceType: 'rest',
      },
      conditions: [urlFilter, xhrOnly],
    });
    const [, script] = compileBootstrapScripts([dyn]);
    expect(script!.key).toBe('response:rs000003');
    // Inline-script injections are already self-contained IIFEs — passed through.
    expect(script!.source).toContain('function buildResponse');
  });

  it('excludes inject rules (page-DOM, not a fetch/socket wrapper)', () => {
    const inject: InjectRule = {
      schemaVersion: 5,
      uid: 'in000001',
      path: 'rules/inject',
      name: 'Inject',
      type: 'inject',
      enabled: true,
      conditions: [{ uid: 'cnd-page', type: 'url-filter', values: ['*://app.openheaders.io/*'] }],
      action: { injectType: 'script', source: 'code', code: 'void 0;', position: 'head' },
    };
    expect(compileBootstrapScripts([inject])).toEqual([]);
  });

  it('excludes an initiator-domain-gated wrapper (kept on the onCommitted path)', () => {
    expect(compileBootstrapScripts([wsRule({ conditions: [urlFilter, initiatorDomains] })])).toEqual([]);
  });

  it('bootstraps a header-merge rule but not a merge-less (pure-DNR) header rule', () => {
    const merge = headerMergeRule();
    const dnrOnly = headerMergeRule({
      uid: 'hd000002',
      action: {
        requestHeaders: [{ uid: 'hm000002', operation: 'override', headerName: 'X-Set', value: 'v' }],
        responseHeaders: [],
      },
    });
    expect(compileBootstrapScripts([merge, dnrOnly]).map((s) => s.key)).toEqual(['oh-setup', 'header:hd000001']);
  });

  it('keys are stable across re-derive (same rule → same key)', () => {
    const first = compileBootstrapScripts([wsRule(), delayRule()]).map((s) => s.key);
    const second = compileBootstrapScripts([wsRule(), delayRule()]).map((s) => s.key);
    expect(first).toEqual(second);
  });

  it('a rule edit changes a wrapper source but keeps its key (re-add, not duplicate)', () => {
    const before = compileBootstrapScripts([delayRule({ action: { delayMs: 100 } })]);
    const after = compileBootstrapScripts([delayRule({ action: { delayMs: 900 } })]);
    expect(before[1]!.key).toBe(after[1]!.key);
    expect(before[1]!.source).not.toBe(after[1]!.source);
  });
});

describe('injectionToSource', () => {
  it('wraps a func injection as an IIFE invoked with its single config arg', () => {
    const source = injectionToSource({ kind: 'func', func: (cfg: never) => void cfg, args: [{ a: 1 }] });
    expect(source.startsWith('(')).toBe(true);
    expect(source.endsWith('({"a":1});')).toBe(true);
    expect(source).toContain('void cfg');
  });

  it('passes an inline-script injection through verbatim', () => {
    expect(injectionToSource({ kind: 'inline-script', code: '(function(){})();' })).toBe('(function(){})();');
  });
});
