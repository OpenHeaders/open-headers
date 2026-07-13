import { describe, expect, it } from 'vitest';
import type {
  BlockRule,
  DelayRule,
  HeaderRule,
  InjectRule,
  QueryParamRule,
  RedirectRule,
  RequestBodyRule,
  ResponseRule,
  Rule,
  RuleCondition,
  SseRule,
  WsRule,
} from '../../src/types';
import { validateActionValues } from '../../src/utils';

const baseFields = {
  schemaVersion: 1,
  uid: 'rule-1',
  path: 'test/rule.json',
  name: 'test',
  enabled: true,
  conditions: [{ uid: 'cnd00001', type: 'request-domains', values: ['openheaders.io'] } satisfies RuleCondition],
  version: 1,
};

function header(action: HeaderRule['action']): HeaderRule {
  return { ...baseFields, type: 'header', action } as HeaderRule;
}

function redirect(action: RedirectRule['action'], conditions?: RuleCondition[]): RedirectRule {
  return { ...baseFields, type: 'redirect', action, conditions: conditions ?? baseFields.conditions } as RedirectRule;
}

function block(action: BlockRule['action']): BlockRule {
  return { ...baseFields, type: 'block', action } as BlockRule;
}

function delayRule(action: DelayRule['action']): DelayRule {
  return { ...baseFields, type: 'delay', action } as DelayRule;
}

function inject(action: InjectRule['action']): InjectRule {
  return { ...baseFields, type: 'inject', action } as InjectRule;
}

function response(action: ResponseRule['action']): ResponseRule {
  return { ...baseFields, type: 'response', action } as ResponseRule;
}

function requestBody(action: RequestBodyRule['action']): RequestBodyRule {
  return { ...baseFields, type: 'request-body', action } as RequestBodyRule;
}

function queryParam(action: QueryParamRule['action']): QueryParamRule {
  return { ...baseFields, type: 'query-param', action } as QueryParamRule;
}

function ws(action: WsRule['action']): WsRule {
  return { ...baseFields, type: 'ws', action } as WsRule;
}

function sse(action: SseRule['action']): SseRule {
  return { ...baseFields, type: 'sse', action } as SseRule;
}

describe('validateActionValues — header', () => {
  it('accepts a canonical override', () => {
    expect(
      validateActionValues(
        header({
          requestHeaders: [{ uid: 'hmd00001', operation: 'override', headerName: 'X-Custom', value: '1' }],
          responseHeaders: [],
        }),
      ),
    ).toEqual([]);
  });

  it('flags an invalid header name (RFC 7230 token violation)', () => {
    const issues = validateActionValues(
      header({
        requestHeaders: [{ uid: 'hmd00002', operation: 'override', headerName: 'Bad Name', value: '1' }],
        responseHeaders: [],
      }),
    );
    expect(issues.some((i) => i.kind === 'invalid-header-name' && i.severity === 'error')).toBe(true);
  });

  it('flags an invalid header value (CRLF injection attempt)', () => {
    const issues = validateActionValues(
      header({
        requestHeaders: [{ uid: 'hmd00003', operation: 'override', headerName: 'X-Custom', value: 'a\r\nInjected: yes' }],
        responseHeaders: [],
      }),
    );
    expect(issues.some((i) => i.kind === 'invalid-header-value' && i.severity === 'error')).toBe(true);
  });

  it('flags a forbidden operation/header combination via capability check', () => {
    // `append` on a non-allowlisted custom header is rejected by Chrome DNR.
    const issues = validateActionValues(
      header({
        requestHeaders: [{ uid: 'hmd00004', operation: 'add', headerName: 'X-Custom-Random', value: '1' }],
        responseHeaders: [],
      }),
    );
    expect(issues.some((i) => i.kind === 'invalid-header-operation' && i.severity === 'error')).toBe(true);
  });

  it('does not flag value when operation is remove', () => {
    expect(
      validateActionValues(
        header({
          requestHeaders: [{ uid: 'hmd00005', operation: 'remove', headerName: 'X-Custom', value: undefined }],
          responseHeaders: [],
        }),
      ),
    ).toEqual([]);
  });

  it('skips template-laced names and values', () => {
    expect(
      validateActionValues(
        header({
          requestHeaders: [{ uid: 'hmd00006', operation: 'override', headerName: '{{HEADER_NAME}}', value: '{{HEADER_VALUE}}' }],
          responseHeaders: [],
        }),
      ),
    ).toEqual([]);
  });

  it('reports issues with stable paths', () => {
    const issues = validateActionValues(
      header({
        requestHeaders: [
          { uid: 'hmd00007', operation: 'override', headerName: 'X-Custom', value: '1' },
          { uid: 'hmd00008', operation: 'override', headerName: 'Bad Name', value: '1' },
        ],
        responseHeaders: [],
      }),
    );
    const nameIssue = issues.find((i) => i.kind === 'invalid-header-name');
    expect(nameIssue?.path).toBe('requestHeaders[1].headerName');
    expect(nameIssue?.index).toBe(1);
  });
});

describe('validateActionValues — redirect', () => {
  it('accepts a full http(s) URL', () => {
    expect(validateActionValues(redirect({ redirectTo: 'https://openheaders.io/' }))).toEqual([]);
  });

  it('accepts a path starting with /', () => {
    expect(validateActionValues(redirect({ redirectTo: '/local-path' }))).toEqual([]);
  });

  it('flags whitespace inside the target', () => {
    const issues = validateActionValues(redirect({ redirectTo: 'https://example.com/with space' }));
    expect(issues[0]).toMatchObject({ kind: 'redirect-url-whitespace', severity: 'error' });
  });

  it('flags an unparseable URL when no regex condition is present', () => {
    const issues = validateActionValues(redirect({ redirectTo: 'not-a-url' }));
    expect(issues[0]).toMatchObject({ kind: 'invalid-redirect-url', severity: 'error' });
  });

  it('accepts a regex-substitution-style target when paired with url-regex condition', () => {
    const r = redirect({ redirectTo: 'https://api.openheaders.io/v2/\\1' }, [
      { uid: 'cnd00002', type: 'url-regex', values: ['^https://api\\.openheaders\\.io/v1/(.*)'] },
    ]);
    expect(validateActionValues(r)).toEqual([]);
  });

  it('passes empty target through (gated structurally elsewhere)', () => {
    expect(validateActionValues(redirect({ redirectTo: '' }))).toEqual([]);
  });

  it('skips template targets', () => {
    expect(validateActionValues(redirect({ redirectTo: '{{TARGET}}' }))).toEqual([]);
  });
});

describe('validateActionValues — block', () => {
  it('returns no issues — block has no action fields to validate', () => {
    expect(validateActionValues(block({}))).toEqual([]);
  });
});

describe('validateActionValues — delay', () => {
  it('accepts delays in scriptable range', () => {
    expect(validateActionValues(delayRule({ delayMs: 1000 }))).toEqual([]);
  });

  it('warns when between scriptable cap and DNR cap', () => {
    const issues = validateActionValues(delayRule({ delayMs: 10_000 }));
    expect(issues[0]).toMatchObject({ kind: 'delay-above-fetch-cap', severity: 'warning' });
    expect(issues[0].message).toContain('5000');
  });

  it('warns when over the DNR cap', () => {
    const issues = validateActionValues(delayRule({ delayMs: 60_000 }));
    expect(issues[0]).toMatchObject({ kind: 'delay-above-navigation-cap', severity: 'warning' });
    expect(issues[0].message).toContain('30000');
  });

  it('does not flag zero or negative delays (structural — gated by isRuleComplete)', () => {
    expect(validateActionValues(delayRule({ delayMs: 0 }))).toEqual([]);
    expect(validateActionValues(delayRule({ delayMs: -1 }))).toEqual([]);
  });
});

describe('validateActionValues — inject (URL mode)', () => {
  it('accepts an http(s) URL', () => {
    expect(
      validateActionValues(
        inject({
          injectType: 'script',
          source: 'url',
          sourceUrl: 'https://cdn.openheaders.io/snippet.js',
          code: '',
          position: 'head',
        }),
      ),
    ).toEqual([]);
  });

  it('accepts a chrome-extension URL', () => {
    expect(
      validateActionValues(
        inject({
          injectType: 'script',
          source: 'url',
          sourceUrl: 'chrome-extension://abc/inj.js',
          code: '',
          position: 'head',
        }),
      ),
    ).toEqual([]);
  });

  it('accepts a page-relative URL (the engine resolves it against the page base)', () => {
    expect(
      validateActionValues(
        inject({
          injectType: 'script',
          source: 'url',
          sourceUrl: '/assets/snippet.js',
          code: '',
          position: 'head',
        }),
      ),
    ).toEqual([]);
  });

  it('flags a non-URL', () => {
    const issues = validateActionValues(
      inject({
        injectType: 'script',
        source: 'url',
        sourceUrl: 'not a url',
        code: '',
        position: 'head',
      }),
    );
    expect(issues[0]).toMatchObject({ kind: 'inject-url-invalid', severity: 'error' });
  });

  it('flags a URL with a non-allowed scheme', () => {
    const issues = validateActionValues(
      inject({
        injectType: 'script',
        source: 'url',
        sourceUrl: 'file:///etc/passwd',
        code: '',
        position: 'head',
      }),
    );
    expect(issues[0]).toMatchObject({ kind: 'inject-url-scheme', severity: 'error' });
  });

  it('does not validate sourceUrl when source is code', () => {
    expect(
      validateActionValues(
        inject({
          injectType: 'script',
          source: 'code',
          code: 'console.log(1)',
          position: 'head',
        }),
      ),
    ).toEqual([]);
  });
});

describe('validateActionValues — response', () => {
  it('accepts a canonical mock response', () => {
    expect(
      validateActionValues(
        response({
          responseSource: 'mock',
          bodyType: 'static',
          statusCode: 200,
          responseHeaders: { 'X-Custom': '1' },
          responseBody: '{"ok":true}',
          contentType: 'application/json',
        }),
      ),
    ).toEqual([]);
  });

  it('accepts a network response with keep-original status (0)', () => {
    expect(
      validateActionValues(
        response({
          responseSource: 'network',
          bodyType: 'static',
          statusCode: 0,
          responseHeaders: {},
          responseBody: '{"ok":true}',
          contentType: '',
        }),
      ),
    ).toEqual([]);
  });

  it('errors on out-of-range status', () => {
    const issues = validateActionValues(
      response({
        responseSource: 'mock',
        bodyType: 'static',
        statusCode: 99,
        responseHeaders: {},
        responseBody: '',
        contentType: 'text/plain',
      }),
    );
    expect(issues[0]).toMatchObject({ kind: 'invalid-status-code', severity: 'error' });
  });

  it('warns on a malformed content-type', () => {
    const issues = validateActionValues(
      response({
        responseSource: 'mock',
        bodyType: 'static',
        statusCode: 200,
        responseHeaders: {},
        responseBody: '',
        contentType: 'json',
      }),
    );
    expect(issues[0]).toMatchObject({ kind: 'invalid-content-type', severity: 'warning' });
  });

  it('errors on a bad response header name', () => {
    const issues = validateActionValues(
      response({
        responseSource: 'mock',
        bodyType: 'static',
        statusCode: 200,
        responseHeaders: { 'Bad Name': '1' },
        responseBody: '',
        contentType: 'application/json',
      }),
    );
    expect(issues.some((i) => i.kind === 'invalid-header-name' && i.severity === 'error')).toBe(true);
  });

  it('errors when graphqlFilter is incomplete on a graphql response', () => {
    const issues = validateActionValues(
      response({
        responseSource: 'mock',
        bodyType: 'static',
        statusCode: 200,
        responseHeaders: {},
        responseBody: '',
        contentType: 'application/json',
        resourceType: 'graphql',
        graphqlFilter: { key: '', operator: 'Equals', value: 'X' },
      }),
    );
    expect(issues.some((i) => i.kind === 'invalid-graphql-filter')).toBe(true);
  });
});

describe('validateActionValues — request-body', () => {
  it('accepts a static body without graphql filter', () => {
    expect(
      validateActionValues(requestBody({ bodyType: 'static', requestBody: '{"ok":1}', resourceType: 'rest' })),
    ).toEqual([]);
  });

  it('errors when graphql filter has empty key', () => {
    const issues = validateActionValues(
      requestBody({
        bodyType: 'static',
        requestBody: '{"ok":1}',
        resourceType: 'graphql',
        graphqlFilter: { key: '', operator: 'Equals', value: 'X' },
      }),
    );
    expect(issues[0]).toMatchObject({ kind: 'invalid-graphql-filter', severity: 'error' });
  });
});

describe('validateActionValues — query-param', () => {
  it('accepts canonical params', () => {
    expect(
      validateActionValues(
        queryParam({
          params: [
            { uid: 'qp000010', param: 'utm_source', operation: 'add', value: 'demo' },
            { uid: 'qp000011', param: 'region', operation: 'override', value: 'eu' },
            { uid: 'qp000012', param: 'tracking', operation: 'remove' },
          ],
        }),
      ),
    ).toEqual([]);
  });

  it('flags reserved characters on override too (param-name rules apply to all op types)', () => {
    const issues = validateActionValues(
      queryParam({ params: [{ uid: 'qp000020', param: 'has space', operation: 'override', value: 'x' }] }),
    );
    expect(issues[0]).toMatchObject({ kind: 'invalid-param-name', severity: 'error' });
  });

  it('flags param names with reserved characters', () => {
    const issues = validateActionValues(
      queryParam({ params: [{ uid: 'qp000001', param: 'has=equals', operation: 'add', value: 'x' }] }),
    );
    expect(issues[0]).toMatchObject({ kind: 'invalid-param-name', severity: 'error' });
  });

  it('flags param names with whitespace', () => {
    const issues = validateActionValues(
      queryParam({ params: [{ uid: 'qp000002', param: 'has space', operation: 'add', value: 'x' }] }),
    );
    expect(issues[0]).toMatchObject({ kind: 'invalid-param-name', severity: 'error' });
  });

  it('skips remove-all entries (no key)', () => {
    expect(
      validateActionValues(queryParam({ params: [{ uid: 'qp000003', param: '', operation: 'remove-all' }] })),
    ).toEqual([]);
  });

  it('skips template param names', () => {
    expect(
      validateActionValues(
        queryParam({ params: [{ uid: 'qp000004', param: '{{KEY}}', operation: 'add', value: 'x' }] }),
      ),
    ).toEqual([]);
  });
});

describe('validateActionValues — ws/sse', () => {
  it('accepts a plain modify with payload and no filter', () => {
    expect(
      validateActionValues(ws({ operation: 'modify', direction: 'receive', payload: '{"ok":true}' })),
    ).toEqual([]);
  });

  it('accepts a contains filter', () => {
    expect(
      validateActionValues(
        ws({
          operation: 'drop',
          direction: 'send',
          messageFilter: { matchType: 'contains', value: 'heartbeat' },
        }),
      ),
    ).toEqual([]);
  });

  it('flags an empty filter value', () => {
    const issues = validateActionValues(
      ws({ operation: 'drop', direction: 'receive', messageFilter: { matchType: 'contains', value: '  ' } }),
    );
    expect(issues[0]).toMatchObject({
      path: 'messageFilter.value',
      kind: 'message-filter-value-required',
      severity: 'error',
    });
  });

  it('flags an uncompilable regex filter', () => {
    const issues = validateActionValues(
      sse({ operation: 'modify', payload: 'x', messageFilter: { matchType: 'regex', value: '([' } }),
    );
    expect(issues[0]).toMatchObject({
      path: 'messageFilter.value',
      kind: 'message-filter-invalid-regex',
      severity: 'error',
    });
  });

  it('skips regex validation for template values', () => {
    expect(
      validateActionValues(
        sse({ operation: 'modify', payload: 'x', messageFilter: { matchType: 'regex', value: '{{env.PATTERN}}' } }),
      ),
    ).toEqual([]);
  });

  it('flags inject-on-message without a filter', () => {
    const issues = validateActionValues(
      ws({ operation: 'inject', direction: 'receive', payload: 'pong', injectTrigger: 'message' }),
    );
    expect(issues[0]).toMatchObject({ path: 'injectTrigger', kind: 'inject-trigger-requires-filter', severity: 'error' });
  });

  it('accepts inject-on-message with a filter', () => {
    expect(
      validateActionValues(
        ws({
          operation: 'inject',
          direction: 'receive',
          payload: 'pong',
          injectTrigger: 'message',
          messageFilter: { matchType: 'contains', value: 'ping' },
        }),
      ),
    ).toEqual([]);
  });

  it('accepts inject-on-open without a filter', () => {
    expect(
      validateActionValues(sse({ operation: 'inject', payload: 'hello', injectTrigger: 'open' })),
    ).toEqual([]);
  });
});

describe('validateActionValues — dispatch', () => {
  it('returns no issues for a rule type without action validation rules', () => {
    const r: Rule = baseFields as unknown as Rule;
    expect(validateActionValues({ ...r, type: 'block', action: {} } as BlockRule)).toEqual([]);
  });
});
