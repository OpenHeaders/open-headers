import { describe, expect, it } from 'vitest';

import { widensScope } from '../../../src/sync';

describe('widensScope', () => {
  it('returns false for non-rule entity types', () => {
    expect(widensScope('environment', { conditions: [] }, { conditions: [] })).toBe(false);
  });

  it('flags a removed condition (AND surface relaxed)', () => {
    const prior = {
      conditions: [
        { uid: 'c1', type: 'url-filter', values: ['*.openheaders.io'] },
        { uid: 'c2', type: 'request-methods', values: ['GET'] },
      ],
    };
    const next = {
      conditions: [{ uid: 'c1', type: 'url-filter', values: ['*.openheaders.io'] }],
    };
    expect(widensScope('rule', prior, next)).toBe(true);
  });

  it('flags an added value on the same condition', () => {
    const prior = {
      conditions: [{ uid: 'c1', type: 'request-domains', values: ['api.openheaders.io'] }],
    };
    const next = {
      conditions: [{ uid: 'c1', type: 'request-domains', values: ['api.openheaders.io', 'admin.openheaders.io'] }],
    };
    expect(widensScope('rule', prior, next)).toBe(true);
  });

  it('flags a removed value on the same condition (exclude-list shrunk OR include-list shrunk)', () => {
    const prior = {
      conditions: [{ uid: 'c1', type: 'exclude-request-domains', values: ['admin.openheaders.io'] }],
    };
    const next = {
      conditions: [{ uid: 'c1', type: 'exclude-request-domains', values: [] }],
    };
    expect(widensScope('rule', prior, next)).toBe(true);
  });

  it('returns false when conditions array is unchanged', () => {
    const prior = {
      conditions: [{ uid: 'c1', type: 'url-filter', values: ['*.openheaders.io'] }],
    };
    const next = {
      conditions: [{ uid: 'c1', type: 'url-filter', values: ['*.openheaders.io'] }],
    };
    expect(widensScope('rule', prior, next)).toBe(false);
  });

  it('returns false when an unrelated field changes', () => {
    const prior = {
      name: 'before',
      conditions: [{ uid: 'c1', type: 'url-filter', values: ['*.openheaders.io'] }],
    };
    const next = {
      name: 'after',
      conditions: [{ uid: 'c1', type: 'url-filter', values: ['*.openheaders.io'] }],
    };
    expect(widensScope('rule', prior, next)).toBe(false);
  });

  it('returns false when prior had no conditions (cannot infer direction)', () => {
    const prior = { conditions: [] };
    const next = { conditions: [{ uid: 'c1', type: 'url-filter', values: ['*'] }] };
    expect(widensScope('rule', prior, next)).toBe(false);
  });

  it('returns false when conditions narrow (added condition)', () => {
    const prior = {
      conditions: [{ uid: 'c1', type: 'url-filter', values: ['*.openheaders.io'] }],
    };
    const next = {
      conditions: [
        { uid: 'c1', type: 'url-filter', values: ['*.openheaders.io'] },
        { uid: 'c2', type: 'request-methods', values: ['GET'] },
      ],
    };
    expect(widensScope('rule', prior, next)).toBe(false);
  });
});
