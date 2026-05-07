import { describe, expect, it } from 'vitest';
import { canonicalizeRequest, canonicalizeTemplate, serializeRequest, serializeTemplate } from '../../src/codec/yaml';
import type { Template } from '../../src/types/v5/template';
import type { Request } from '../../src/types/v5/request';

function makeTemplate(overrides: Partial<Template> = {}): Template {
  return {
    schemaVersion: 5,
    uid: 'tpl-aaaa',
    path: 'templates/tpl-aaaa',
    name: 'Bearer Token',
    ruleType: 'header',
    icon: '',
    description: '',
    includes: { conditions: true, formValues: true },
    conditions: [
      { uid: 'cnd-aaaa', type: 'request-domains', values: ['openheaders.io'] },
    ],
    formValues: {
      requestHeaders: [
        // Insertion-order-shuffled keys — canonicalize must reorder.
        { value: 'Bearer x', headerName: 'Authorization', operation: 'override', uid: 'hdr-aaaa' },
      ],
      responseHeaders: [],
    },
    createdAt: '2026-04-19T00:00:00.000Z',
    updatedAt: '2026-04-19T00:00:00.000Z',
    ...overrides,
  };
}

function makeRequest(overrides: Partial<Request> = {}): Request {
  return {
    schemaVersion: 5,
    uid: 'req-aaaa',
    path: 'requests/req-aaaa',
    name: 'Get Token',
    method: 'GET',
    url: 'https://api.openheaders.io/token',
    headers: [
      // Shuffled insertion order — canonicalize must reorder.
      { value: 'Bearer x', key: 'Authorization', uid: 'hdr-aaaa' },
    ],
    params: [
      { value: '1', key: 'v', uid: 'qp-aaaa' },
    ],
    auth: { type: 'none' },
    body: { type: 'none' },
    ...overrides,
  };
}

describe('canonicalizeTemplate', () => {
  it('normalizes header-mod row key order in formValues', () => {
    const a = makeTemplate();
    const b = makeTemplate({
      formValues: {
        requestHeaders: [
          // Same data, different insertion order.
          { uid: 'hdr-aaaa', operation: 'override', headerName: 'Authorization', value: 'Bearer x' },
        ],
        responseHeaders: [],
      },
    });
    const yamlA = serializeTemplate({ value: canonicalizeTemplate(a), raw: null });
    const yamlB = serializeTemplate({ value: canonicalizeTemplate(b), raw: null });
    expect(yamlA).toBe(yamlB);
  });

  it('normalizes condition row key order', () => {
    const a = makeTemplate();
    const b = makeTemplate({
      conditions: [
        { type: 'request-domains', uid: 'cnd-aaaa', values: ['openheaders.io'] },
      ],
    });
    const yamlA = serializeTemplate({ value: canonicalizeTemplate(a), raw: null });
    const yamlB = serializeTemplate({ value: canonicalizeTemplate(b), raw: null });
    expect(yamlA).toBe(yamlB);
  });
});

describe('canonicalizeRequest', () => {
  it('normalizes header row key order', () => {
    const a = makeRequest();
    const b = makeRequest({
      headers: [{ uid: 'hdr-aaaa', key: 'Authorization', value: 'Bearer x' }],
    });
    const yamlA = serializeRequest({ value: canonicalizeRequest(a), raw: null }).requestYaml;
    const yamlB = serializeRequest({ value: canonicalizeRequest(b), raw: null }).requestYaml;
    expect(yamlA).toBe(yamlB);
  });

  it('normalizes query param row key order', () => {
    const a = makeRequest();
    const b = makeRequest({
      params: [{ uid: 'qp-aaaa', key: 'v', value: '1' }],
    });
    const yamlA = serializeRequest({ value: canonicalizeRequest(a), raw: null }).requestYaml;
    const yamlB = serializeRequest({ value: canonicalizeRequest(b), raw: null }).requestYaml;
    expect(yamlA).toBe(yamlB);
  });

  it('normalizes form-body part key order', () => {
    const a = makeRequest({
      body: { type: 'form', formParts: [{ key: 'x', value: '1', enabled: true }] },
    });
    const b = makeRequest({
      body: { type: 'form', formParts: [{ enabled: true, value: '1', key: 'x' }] },
    });
    const yamlA = serializeRequest({ value: canonicalizeRequest(a), raw: null }).requestYaml;
    const yamlB = serializeRequest({ value: canonicalizeRequest(b), raw: null }).requestYaml;
    expect(yamlA).toBe(yamlB);
  });
});
