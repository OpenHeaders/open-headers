/**
 * Response body state — a body left out for its size. The row crossed a
 * wire whose frame limit the body alone was over; the body exists, it is
 * not shown here.
 */

import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import type { InspectorHarBody } from '@openheaders/core/types';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
import {
  classifyBodyState,
  unavailableMessage,
  unavailableTitle,
} from '@openheaders/ui/panel/data/response-body-state';
import { describe, expect, it } from 'vitest';

function makeBody(overrides: Partial<InspectorHarBody> = {}): InspectorHarBody {
  return {
    method: 'GET',
    url: 'https://api.openheaders.io/v2/report',
    startedDateTime: '2026-11-24T00:00:00.000Z',
    content: '',
    encoding: '',
    ...overrides,
  };
}

function makeLifecycle(body: InspectorHarBody | null): RequestLifecycle {
  return {
    tabId: 1,
    requestId: 'req-1',
    url: 'https://api.openheaders.io/v2/report',
    method: 'GET',
    resourceType: 'xmlhttprequest',
    phase: 'completed',
    redirectHopCount: 0,
    redirectHops: [],
    startedAtMs: 0,
    hopStartedAtMs: 0,
    statusCode: 200,
    statusText: 'OK',
    har: [],
    harBodyByHop: [body],
  };
}

const keys: Translate = (key) => key;

describe('classifyBodyState — a body left out for its size', () => {
  it('reads as unavailable for its size, not as an empty or a failed body', () => {
    expect(classifyBodyState(makeLifecycle(makeBody({ omitted: 'too-large' })))).toEqual({
      kind: 'unavailable',
      reason: 'too-large',
    });
  });

  it('states a plain fact: nothing failed', () => {
    expect(unavailableTitle(keys, 'too-large')).toBe('panel.inspector.bodyState.notAvailableTitle');
    expect(unavailableMessage(keys, 'too-large')).toBe('panel.inspector.bodyState.unavailable.tooLarge');
  });

  it('a body delivered whole is untouched by the mark’s absence', () => {
    expect(classifyBodyState(makeLifecycle(makeBody({ content: '{"ok":true}' })))).toEqual({
      kind: 'text',
      content: '{"ok":true}',
    });
  });

  it('an empty body with no mark keeps its earlier reading', () => {
    expect(classifyBodyState(makeLifecycle(makeBody()))).toEqual({ kind: 'unavailable', reason: 'unknown' });
  });
});
