/**
 * Plain-English rule summary — pure transform, exercised through the
 * ten rule variants + the targets/caveats edge cases.
 */

import { describe, expect, it } from 'vitest';
import type {
  BlockRule,
  BodyRule,
  DelayRule,
  HeaderRule,
  InjectRule,
  QueryParamRule,
  RedirectRule,
  ResponseRule,
  RuleCondition,
  SseRule,
  WsRule,
} from '../../src/types/index';
import { summarizeRule } from '../../src/workspace-export/rule-summary';

function base(): { uid: string; path: string; name: string; schemaVersion: 5; version: 1; enabled: true } {
  return { uid: 'rul00001', path: 'rules/col/rule', name: 'r', schemaVersion: 5, version: 1, enabled: true };
}

let condCounter = 0;
function cond(type: RuleCondition['type'], values: string[]): RuleCondition {
  return { uid: `tst${(++condCounter).toString().padStart(5, '0')}`, type, values };
}

describe('summarizeRule', () => {
  it('header rule lists operation+name; targets pulled from request-domains', () => {
    const rule: HeaderRule = {
      ...base(),
      type: 'header',
      conditions: [cond('request-domains', ['api.openheaders.io', 'auth.openheaders.io'])],
      action: {
        requestHeaders: [{ uid: 'hmd00001', operation: 'override', headerName: 'Authorization', value: 'Bearer xyz' }],
        responseHeaders: [],
      },
    };
    const s = summarizeRule(rule);
    expect(s.verb).toMatch(/Modify request\/response headers/);
    expect(s.payload).toContain('override Authorization');
    expect(s.targets).toEqual(['api.openheaders.io', 'auth.openheaders.io']);
    expect(s.caveats).toEqual([]);
  });

  it('redirect rule surfaces the target URL', () => {
    const rule: RedirectRule = {
      ...base(),
      type: 'redirect',
      conditions: [cond('url-filter', ['||staging.openheaders.io^'])],
      action: { redirectTo: 'https://prod.openheaders.io/login' },
    };
    expect(summarizeRule(rule).payload).toBe('Redirect to https://prod.openheaders.io/login');
  });

  it('inject rule with source=url surfaces the URL + caveat', () => {
    const rule: InjectRule = {
      ...base(),
      type: 'inject',
      conditions: [cond('request-domains', ['app.openheaders.io'])],
      action: {
        injectType: 'script',
        code: '',
        source: 'url',
        sourceUrl: 'https://cdn.openheaders.io/assets/x.js',
        position: 'head',
      },
    };
    const s = summarizeRule(rule);
    expect(s.payload).toContain('Load JavaScript from https://cdn.openheaders.io/assets/x.js');
    expect(s.caveats.some((c) => /remote URL/.test(c))).toBe(true);
  });

  it('inject rule with bypassCSP surfaces an extra caveat', () => {
    const rule: InjectRule = {
      ...base(),
      type: 'inject',
      conditions: [cond('request-domains', ['x.openheaders.io'])],
      action: {
        injectType: 'script',
        code: 'console.log(1)',
        source: 'code',
        position: 'head',
        bypassCSP: true,
      },
    };
    const s = summarizeRule(rule);
    expect(s.caveats.some((c) => /Content-Security-Policy/.test(c))).toBe(true);
  });

  it('block rule has stable verb and explicit ERR string', () => {
    const rule: BlockRule = {
      ...base(),
      type: 'block',
      conditions: [cond('request-domains', ['ads.openheaders.io'])],
      action: {},
    };
    const s = summarizeRule(rule);
    expect(s.payload).toBe('Net::ERR_BLOCKED_BY_CLIENT');
  });

  it('delay rule reports milliseconds', () => {
    const rule: DelayRule = {
      ...base(),
      type: 'delay',
      conditions: [],
      action: { delayMs: 250 },
    };
    expect(summarizeRule(rule).payload).toBe('Delay 250ms before forwarding');
  });

  it('mock-source response rule reports status + body size', () => {
    const rule: ResponseRule = {
      ...base(),
      type: 'response',
      conditions: [],
      action: {
        responseSource: 'mock',
        bodyType: 'static',
        statusCode: 503,
        responseBody: '{"err":1}',
        responseHeaders: {},
        contentType: 'application/json',
      },
    };
    expect(summarizeRule(rule).payload).toMatch(/Return 503/);
  });

  it('network-source response rule reports it modifies the real response', () => {
    const rule: ResponseRule = {
      ...base(),
      type: 'response',
      conditions: [],
      action: {
        responseSource: 'network',
        bodyType: 'static',
        statusCode: 0,
        responseBody: '{"patched":true}',
        responseHeaders: {},
        contentType: '',
      },
    };
    expect(summarizeRule(rule).payload).toMatch(/Modify the real response/);
  });

  it('body rule (dynamic) carries the dynamic-body caveat', () => {
    const rule: BodyRule = {
      ...base(),
      type: 'body',
      conditions: [],
      action: { bodyType: 'dynamic', body: '${x}', resourceType: 'rest' },
    };
    expect(summarizeRule(rule).caveats.some((c) => /dynamic/.test(c))).toBe(true);
  });

  it('query-param rule lists the first ops + count', () => {
    const rule: QueryParamRule = {
      ...base(),
      type: 'query-param',
      conditions: [],
      action: {
        params: [
          { uid: 'qp000001', param: 'a', value: '1', operation: 'add' },
          { uid: 'qp000002', param: 'b', operation: 'remove' },
          { uid: 'qp000003', param: 'c', operation: 'remove-all' },
        ],
      },
    };
    expect(summarizeRule(rule).payload).toMatch(/(add a|remove b|remove all)/);
  });

  it('ws drop rule names the direction and scope', () => {
    const rule: WsRule = {
      ...base(),
      type: 'ws',
      conditions: [cond('url-filter', ['wss://stream.openheaders.io/*'])],
      action: { operation: 'drop', direction: 'receive' },
    };
    const s = summarizeRule(rule);
    expect(s.verb).toBe('Modify WebSocket messages');
    expect(s.payload).toBe('Drop every incoming frame');
  });

  it('ws inject rule reports trigger + payload size', () => {
    const rule: WsRule = {
      ...base(),
      type: 'ws',
      conditions: [cond('url-filter', ['wss://stream.openheaders.io/*'])],
      action: {
        operation: 'inject',
        direction: 'receive',
        payload: '{"ping":1}',
        injectTrigger: 'message',
        messageFilter: { matchType: 'contains', value: 'ping' },
      },
    };
    expect(summarizeRule(rule).payload).toMatch(/Inject incoming frame .* on matching message/);
  });

  it('sse modify rule names the event when configured', () => {
    const rule: SseRule = {
      ...base(),
      type: 'sse',
      conditions: [cond('request-domains', ['openheaders.io'])],
      action: {
        operation: 'modify',
        eventName: 'price-update',
        payload: '{"px":1}',
        messageFilter: { matchType: 'contains', value: 'AAPL' },
      },
    };
    const s = summarizeRule(rule);
    expect(s.verb).toBe('Modify server-sent events');
    expect(s.payload).toMatch(/Replace matching "price-update" events/);
  });

  it('rule with no scoping conditions reports empty targets (UI shows "fires on every request")', () => {
    const rule: HeaderRule = {
      ...base(),
      type: 'header',
      conditions: [],
      action: { requestHeaders: [], responseHeaders: [] },
    };
    expect(summarizeRule(rule).targets).toEqual([]);
  });
});
