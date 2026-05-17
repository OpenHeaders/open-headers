import type { InspectorHarEntry } from '@openheaders/core/types';
import { resolveInitiatorRootUrl } from '@openheaders/ui/panel/data/initiator-graph';
import { describe, expect, it } from 'vitest';

function har(initiator: unknown): InspectorHarEntry {
  return {
    startedDateTime: '2026-01-01T00:00:00.000Z',
    time: 0,
    request: { method: 'GET', url: 'https://openheaders.io/x', headers: [], cookies: [], queryString: [], headersSize: -1, bodySize: -1, httpVersion: 'HTTP/1.1' },
    response: { status: 200, statusText: 'OK', httpVersion: 'HTTP/1.1', headers: [], cookies: [], content: { size: 0, mimeType: 'text/plain' }, redirectURL: '', headersSize: -1, bodySize: 0 },
    cache: {},
    timings: { send: 0, wait: 0, receive: 0 },
    _initiator: initiator,
  } as unknown as InspectorHarEntry;
}

describe('resolveInitiatorRootUrl', () => {
  it('returns null when _initiator is missing', () => {
    expect(resolveInitiatorRootUrl(har(undefined))).toBeNull();
  });

  it('returns null for top-level navigations (type: other, no url, no stack)', () => {
    expect(resolveInitiatorRootUrl(har({ type: 'other' }))).toBeNull();
  });

  it('returns initiator.url for parser-initiated requests', () => {
    expect(resolveInitiatorRootUrl(har({ type: 'parser', url: 'https://openheaders.io/' }))).toBe('https://openheaders.io/');
  });

  it('falls back to the first script frame URL when no top-level url is present', () => {
    const init = {
      type: 'script',
      stack: {
        callFrames: [
          { functionName: 'inner', url: 'https://openheaders.io/app.js', lineNumber: 10 },
          { functionName: 'outer', url: 'https://openheaders.io/runtime.js', lineNumber: 20 },
        ],
      },
    };
    expect(resolveInitiatorRootUrl(har(init))).toBe('https://openheaders.io/app.js');
  });

  it('walks into stack.parent when no callFrame in the current stack carries a url', () => {
    const init = {
      type: 'script',
      stack: {
        callFrames: [{ functionName: 'native', url: '' }],
        parent: {
          callFrames: [{ functionName: 'origin', url: 'https://openheaders.io/origin.js' }],
        },
      },
    };
    expect(resolveInitiatorRootUrl(har(init))).toBe('https://openheaders.io/origin.js');
  });

  it('prefers top-level url over stack frames when both are present', () => {
    const init = {
      type: 'script',
      url: 'https://openheaders.io/owner.js',
      stack: { callFrames: [{ url: 'https://openheaders.io/inner.js' }] },
    };
    expect(resolveInitiatorRootUrl(har(init))).toBe('https://openheaders.io/owner.js');
  });

  it('returns null when no url is recoverable from the stack chain', () => {
    const init = {
      type: 'script',
      stack: { callFrames: [{ functionName: 'eval' }], parent: { callFrames: [] } },
    };
    expect(resolveInitiatorRootUrl(har(init))).toBeNull();
  });
});
