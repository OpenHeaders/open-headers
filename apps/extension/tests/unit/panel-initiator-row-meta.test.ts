import { computeInitiatorRowMeta } from '@openheaders/ui/panel/data/initiator-row-meta';
import type { InspectorRequest } from '@openheaders/ui/panel/data/types';
import { describe, expect, it } from 'vitest';

let _arrival = 0;
function entry(
  url: string,
  opts: {
    bodySize?: number;
    duration?: number;
    status?: number;
    resourceType?: string;
    initiatorType?: string;
  } = {},
): InspectorRequest {
  const t = ++_arrival * 100;
  return {
    id: `GET|${url}|${t}`,
    method: 'GET',
    url,
    timestamp: t,
    duration: opts.duration,
    statusCode: opts.status ?? 200,
    resourceType: opts.resourceType,
    fires: [],
    arrivalIndex: _arrival,
    displayId: _arrival,
    harEntry: {
      response: { status: opts.status ?? 200, bodySize: opts.bodySize ?? 0 },
      _initiator: opts.initiatorType ? { type: opts.initiatorType } : undefined,
    } as InspectorRequest['harEntry'],
  } as InspectorRequest;
}

describe('computeInitiatorRowMeta', () => {
  it('extracts resource type lowercased', () => {
    const m = computeInitiatorRowMeta(entry('https://openheaders.io/a', { resourceType: 'Script' }), null);
    expect(m.resourceType).toBe('script');
  });

  it('normalizes initiator type (xmlhttprequest → xhr)', () => {
    const m = computeInitiatorRowMeta(entry('https://openheaders.io/a', { initiatorType: 'xmlhttprequest' }), null);
    expect(m.initiatorType).toBe('xhr');
  });

  it('passes through known initiator types', () => {
    expect(computeInitiatorRowMeta(entry('x', { initiatorType: 'parser' }), null).initiatorType).toBe('parser');
    expect(computeInitiatorRowMeta(entry('x', { initiatorType: 'preload' }), null).initiatorType).toBe('preload');
    expect(computeInitiatorRowMeta(entry('x', { initiatorType: 'redirect' }), null).initiatorType).toBe('redirect');
  });

  it('falls back to "other" for unknown initiator types', () => {
    expect(computeInitiatorRowMeta(entry('x', { initiatorType: 'magic' }), null).initiatorType).toBe('other');
  });

  it('marks third-party when origin differs from pageOrigin', () => {
    expect(
      computeInitiatorRowMeta(entry('https://cdn.example.com/a'), 'https://openheaders.io').isThirdParty,
    ).toBe(true);
    expect(
      computeInitiatorRowMeta(entry('https://openheaders.io/a'), 'https://openheaders.io').isThirdParty,
    ).toBe(false);
  });

  it('treats requests as same-origin when pageOrigin is unknown', () => {
    expect(computeInitiatorRowMeta(entry('https://cdn.example.com/a'), null).isThirdParty).toBe(false);
  });

  it('flags failure for 4xx/5xx statuses', () => {
    expect(computeInitiatorRowMeta(entry('x', { status: 500 }), null).isFailed).toBe(true);
    expect(computeInitiatorRowMeta(entry('x', { status: 200 }), null).isFailed).toBe(false);
  });

  it('picks bodySize over content size when available', () => {
    const m = computeInitiatorRowMeta(entry('https://openheaders.io/a', { bodySize: 4096 }), null);
    expect(m.sizeBytes).toBe(4096);
  });
});
