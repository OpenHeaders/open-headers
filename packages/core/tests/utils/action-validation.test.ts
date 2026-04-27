import { describe, expect, it } from 'vitest';
import type {
  BlockRule,
  BodyRule,
  DelayRule,
  HeaderRule,
  InjectRule,
  MockRule,
  QueryParamRule,
  RedirectRule,
  Rule,
  RuleCondition,
} from '../../src/types/v5';
import { validateActionValues } from '../../src/utils';

const baseFields = {
  schemaVersion: 1,
  uid: 'rule-1',
  path: 'test/rule.json',
  name: 'test',
  enabled: true,
  conditions: [{ type: 'request-domains', values: ['openheaders.io'] } satisfies RuleCondition],
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

function mock(action: MockRule['action']): MockRule {
  return { ...baseFields, type: 'mock', action } as MockRule;
}

function body(action: BodyRule['action']): BodyRule {
  return { ...baseFields, type: 'body', action } as BodyRule;
}

function queryParam(action: QueryParamRule['action']): QueryParamRule {
  return { ...baseFields, type: 'query-param', action } as QueryParamRule;
}

describe('validateActionValues — header', () => {
  it('accepts a canonical override', () => {
    expect(
      validateActionValues(
        header({
          requestHeaders: [{ operation: 'override', headerName: 'X-Custom', value: '1' }],
          responseHeaders: [],
        }),
      ),
    ).toEqual([]);
  });

  it('flags an invalid header name (RFC 7230 token violation)', () => {
    const issues = validateActionValues(
      header({
        requestHeaders: [{ operation: 'override', headerName: 'Bad Name', value: '1' }],
        responseHeaders: [],
      }),
    );
    expect(issues.some((i) => i.kind === 'invalid-header-name' && i.severity === 'error')).toBe(true);
  });

  it('flags an invalid header value (CRLF injection attempt)', () => {
    const issues = validateActionValues(
      header({
        requestHeaders: [{ operation: 'override', headerName: 'X-Custom', value: 'a\r\nInjected: yes' }],
        responseHeaders: [],
      }),
    );
    expect(issues.some((i) => i.kind === 'invalid-header-value' && i.severity === 'error')).toBe(true);
  });

  it('flags a forbidden operation/header combination via capability check', () => {
    // `append` on a non-allowlisted custom header is rejected by Chrome DNR.
    const issues = validateActionValues(
      header({
        requestHeaders: [{ operation: 'add', headerName: 'X-Custom-Random', value: '1' }],
        responseHeaders: [],
      }),
    );
    expect(issues.some((i) => i.kind === 'invalid-header-operation' && i.severity === 'error')).toBe(true);
  });

  it('does not flag value when operation is remove', () => {
    expect(
      validateActionValues(
        header({
          requestHeaders: [{ operation: 'remove', headerName: 'X-Custom', value: undefined }],
          responseHeaders: [],
        }),
      ),
    ).toEqual([]);
  });

  it('skips template-laced names and values', () => {
    expect(
      validateActionValues(
        header({
          requestHeaders: [{ operation: 'override', headerName: '{{HEADER_NAME}}', value: '{{HEADER_VALUE}}' }],
          responseHeaders: [],
        }),
      ),
    ).toEqual([]);
  });

  it('reports issues with stable paths', () => {
    const issues = validateActionValues(
      header({
        requestHeaders: [
          { operation: 'override', headerName: 'X-Custom', value: '1' },
          { operation: 'override', headerName: 'Bad Name', value: '1' },
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
    expect(issues[0]).toMatchObject({ kind: 'invalid-url', severity: 'error' });
  });

  it('flags an unparseable URL when no regex condition is present', () => {
    const issues = validateActionValues(redirect({ redirectTo: 'not-a-url' }));
    expect(issues[0]).toMatchObject({ kind: 'invalid-url', severity: 'error' });
  });

  it('accepts a regex-substitution-style target when paired with url-regex condition', () => {
    const r = redirect({ redirectTo: 'https://api.openheaders.io/v2/\\1' }, [
      { type: 'url-regex', values: ['^https://api\\.openheaders\\.io/v1/(.*)'] },
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
    expect(issues[0]).toMatchObject({ kind: 'delay-out-of-range', severity: 'warning' });
    expect(issues[0].message).toContain('5000');
  });

  it('warns when over the DNR cap', () => {
    const issues = validateActionValues(delayRule({ delayMs: 60_000 }));
    expect(issues[0]).toMatchObject({ kind: 'delay-out-of-range', severity: 'warning' });
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
    expect(issues[0]).toMatchObject({ kind: 'invalid-url', severity: 'error' });
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
    expect(issues[0]).toMatchObject({ kind: 'invalid-url', severity: 'error' });
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

describe('validateActionValues — mock', () => {
  it('accepts a canonical mock', () => {
    expect(
      validateActionValues(
        mock({
          statusCode: 200,
          responseHeaders: { 'X-Custom': '1' },
          responseBody: '{"ok":true}',
          contentType: 'application/json',
          bodyType: 'static',
        }),
      ),
    ).toEqual([]);
  });

  it('errors on out-of-range status', () => {
    const issues = validateActionValues(
      mock({
        statusCode: 99,
        responseHeaders: {},
        responseBody: '',
        contentType: 'text/plain',
        bodyType: 'static',
      }),
    );
    expect(issues[0]).toMatchObject({ kind: 'invalid-status-code', severity: 'error' });
  });

  it('warns on a malformed content-type', () => {
    const issues = validateActionValues(
      mock({
        statusCode: 200,
        responseHeaders: {},
        responseBody: '',
        contentType: 'json',
        bodyType: 'static',
      }),
    );
    expect(issues[0]).toMatchObject({ kind: 'invalid-content-type', severity: 'warning' });
  });

  it('errors on a bad response header name', () => {
    const issues = validateActionValues(
      mock({
        statusCode: 200,
        responseHeaders: { 'Bad Name': '1' },
        responseBody: '',
        contentType: 'application/json',
        bodyType: 'static',
      }),
    );
    expect(issues.some((i) => i.kind === 'invalid-header-name' && i.severity === 'error')).toBe(true);
  });

  it('errors when graphqlFilter is incomplete on a graphql mock', () => {
    const issues = validateActionValues(
      mock({
        statusCode: 200,
        responseHeaders: {},
        responseBody: '',
        contentType: 'application/json',
        bodyType: 'static',
        resourceType: 'graphql',
        graphqlFilter: { key: '', operator: 'Equals', value: 'X' },
      }),
    );
    expect(issues.some((i) => i.kind === 'invalid-graphql-filter')).toBe(true);
  });
});

describe('validateActionValues — body', () => {
  it('accepts a static body without graphql filter', () => {
    expect(validateActionValues(body({ bodyType: 'static', body: '{"ok":1}', resourceType: 'rest' }))).toEqual([]);
  });

  it('errors when graphql filter has empty key', () => {
    const issues = validateActionValues(
      body({
        bodyType: 'static',
        body: '{"ok":1}',
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
            { param: 'utm_source', operation: 'add', value: 'demo' },
            { param: 'region', operation: 'override', value: 'eu' },
            { param: 'tracking', operation: 'remove' },
          ],
        }),
      ),
    ).toEqual([]);
  });

  it('flags reserved characters on override too (param-name rules apply to all op types)', () => {
    const issues = validateActionValues(
      queryParam({ params: [{ param: 'has space', operation: 'override', value: 'x' }] }),
    );
    expect(issues[0]).toMatchObject({ kind: 'invalid-param-name', severity: 'error' });
  });

  it('flags param names with reserved characters', () => {
    const issues = validateActionValues(
      queryParam({ params: [{ param: 'has=equals', operation: 'add', value: 'x' }] }),
    );
    expect(issues[0]).toMatchObject({ kind: 'invalid-param-name', severity: 'error' });
  });

  it('flags param names with whitespace', () => {
    const issues = validateActionValues(queryParam({ params: [{ param: 'has space', operation: 'add', value: 'x' }] }));
    expect(issues[0]).toMatchObject({ kind: 'invalid-param-name', severity: 'error' });
  });

  it('skips remove-all entries (no key)', () => {
    expect(validateActionValues(queryParam({ params: [{ param: '', operation: 'remove-all' }] }))).toEqual([]);
  });

  it('skips template param names', () => {
    expect(validateActionValues(queryParam({ params: [{ param: '{{KEY}}', operation: 'add', value: 'x' }] }))).toEqual(
      [],
    );
  });
});

describe('validateActionValues — dispatch', () => {
  it('returns no issues for a rule type without action validation rules', () => {
    const r: Rule = baseFields as unknown as Rule;
    expect(validateActionValues({ ...r, type: 'block', action: {} } as BlockRule)).toEqual([]);
  });
});
