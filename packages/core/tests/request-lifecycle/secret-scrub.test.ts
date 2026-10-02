/**
 * The secret scrub — a secret manager's value is replaced wherever its
 * bytes appear in a capture (a header inside a scheme, a query, a body,
 * a frame, a fire snapshot's resolved value), and an update carrying
 * none of the values comes back as the same object.
 */

import { describe, expect, it } from 'vitest';

import type { RequestLifecycle, RequestLifecycleUpdate } from '../../src/request-lifecycle';
import {
  SECRET_VALUE_PLACEHOLDER,
  scrubLifecycleUpdate,
  scrubRuleSnapshot,
  scrubSecretText,
} from '../../src/request-lifecycle';
import type { RuleSnapshot } from '../../src/types/telemetry';

const TOKEN = 'tok_9f8e7d6c5b4a';
const VALUES: ReadonlySet<string> = new Set([TOKEN]);

function lifecycle(overrides: Partial<RequestLifecycle> = {}): RequestLifecycle {
  return {
    tabId: 1,
    requestId: 'req-1',
    url: 'https://api.openheaders.io/users',
    method: 'GET',
    resourceType: 'xmlhttprequest',
    phase: 'pending',
    redirectHopCount: 0,
    redirectHops: [],
    startedAtMs: 1_000,
    hopStartedAtMs: 1_000,
    har: [],
    harBodyByHop: [],
    ...overrides,
  };
}

describe('scrubSecretText', () => {
  it('replaces every occurrence of every value and leaves other text alone', () => {
    expect(scrubSecretText(`Bearer ${TOKEN}`, VALUES)).toBe(`Bearer ${SECRET_VALUE_PLACEHOLDER}`);
    expect(scrubSecretText(`${TOKEN} and again ${TOKEN}`, VALUES)).toBe(
      `${SECRET_VALUE_PLACEHOLDER} and again ${SECRET_VALUE_PLACEHOLDER}`,
    );
    expect(scrubSecretText('nothing here', VALUES)).toBe('nothing here');
  });

  it('never matches the empty string', () => {
    expect(scrubSecretText('plain', new Set(['']))).toBe('plain');
  });
});

describe('scrubLifecycleUpdate', () => {
  it('is identity for an empty value set and for an update carrying none of the values', () => {
    const started: RequestLifecycleUpdate = {
      kind: 'started',
      lifecycle: lifecycle({ requestHeaders: [{ name: 'authorization', value: 'Bearer other' }] }),
    };
    expect(scrubLifecycleUpdate(started, new Set())).toBe(started);
    expect(scrubLifecycleUpdate(started, VALUES)).toBe(started);
  });

  it('scrubs the started row — a header inside its scheme and a query carrying the value', () => {
    const started: RequestLifecycleUpdate = {
      kind: 'started',
      lifecycle: lifecycle({
        url: `https://api.openheaders.io/users?key=${TOKEN}`,
        requestHeaders: [
          { name: 'authorization', value: `Bearer ${TOKEN}` },
          { name: 'accept', value: '*/*' },
        ],
      }),
    };
    const scrubbed = scrubLifecycleUpdate(started, VALUES);
    if (scrubbed.kind !== 'started') throw new Error('kind changed');
    expect(scrubbed.lifecycle.url).toBe(`https://api.openheaders.io/users?key=${SECRET_VALUE_PLACEHOLDER}`);
    expect(scrubbed.lifecycle.requestHeaders).toEqual([
      { name: 'authorization', value: `Bearer ${SECRET_VALUE_PLACEHOLDER}` },
      { name: 'accept', value: '*/*' },
    ]);
    // Untouched subtrees keep their identity.
    expect(scrubbed.lifecycle.redirectHops).toBe(started.lifecycle.redirectHops);
  });

  it('scrubs a phase patch, a HAR entry and a response body that echoes the value', () => {
    const phase: RequestLifecycleUpdate = {
      kind: 'phase',
      tabId: 1,
      requestId: 'req-1',
      patch: { requestHeaders: [{ name: 'x-api-key', value: TOKEN }], requestHeadersProvisional: false },
    };
    const scrubbedPhase = scrubLifecycleUpdate(phase, VALUES);
    if (scrubbedPhase.kind !== 'phase') throw new Error('kind changed');
    expect(scrubbedPhase.patch.requestHeaders?.[0]?.value).toBe(SECRET_VALUE_PLACEHOLDER);

    const har: RequestLifecycleUpdate = {
      kind: 'har-attached',
      tabId: 1,
      requestId: 'req-1',
      hopIndex: 0,
      har: {
        startedDateTime: new Date(0).toISOString(),
        request: {
          method: 'POST',
          url: 'https://api.openheaders.io/users',
          headers: [{ name: 'authorization', value: `Bearer ${TOKEN}` }],
          queryString: [{ name: 'key', value: TOKEN }],
          postData: { mimeType: 'application/json', text: `{"token":"${TOKEN}"}` },
        },
        response: {
          status: 200,
          statusText: 'OK',
          headers: [],
          content: { size: 10, mimeType: 'application/json', text: `{"echo":"${TOKEN}"}` },
        },
      },
    };
    const scrubbedHar = scrubLifecycleUpdate(har, VALUES);
    if (scrubbedHar.kind !== 'har-attached') throw new Error('kind changed');
    expect(scrubbedHar.har.request?.headers[0]?.value).toBe(`Bearer ${SECRET_VALUE_PLACEHOLDER}`);
    expect(scrubbedHar.har.request?.queryString[0]?.value).toBe(SECRET_VALUE_PLACEHOLDER);
    expect(scrubbedHar.har.request?.postData?.text).toBe(`{"token":"${SECRET_VALUE_PLACEHOLDER}"}`);
    expect(scrubbedHar.har.response?.content.text).toBe(`{"echo":"${SECRET_VALUE_PLACEHOLDER}"}`);

    const body: RequestLifecycleUpdate = {
      kind: 'body-attached',
      tabId: 1,
      requestId: 'req-1',
      hopIndex: 0,
      body: {
        method: 'GET',
        url: 'https://api.openheaders.io/users',
        startedDateTime: new Date(0).toISOString(),
        content: `echo ${TOKEN}`,
        encoding: '',
      },
    };
    const scrubbedBody = scrubLifecycleUpdate(body, VALUES);
    if (scrubbedBody.kind !== 'body-attached') throw new Error('kind changed');
    expect(scrubbedBody.body.content).toBe(`echo ${SECRET_VALUE_PLACEHOLDER}`);
  });

  it('scrubs a message frame and a request override capture', () => {
    const frame: RequestLifecycleUpdate = {
      kind: 'message-appended',
      tabId: 1,
      requestId: 'ws-1',
      message: { kind: 'ws', type: 'send', atMs: 5, opcode: 1, mask: true, data: `{"auth":"${TOKEN}"}` },
    };
    const scrubbedFrame = scrubLifecycleUpdate(frame, VALUES);
    if (scrubbedFrame.kind !== 'message-appended') throw new Error('kind changed');
    expect(scrubbedFrame.message.data).toBe(`{"auth":"${SECRET_VALUE_PLACEHOLDER}"}`);

    const override: RequestLifecycleUpdate = {
      kind: 'request-override-attached',
      tabId: 1,
      requestId: 'req-1',
      override: {
        ruleUid: 'r1',
        sent: { headers: [{ name: 'authorization', value: TOKEN }] },
        original: { headers: [{ name: 'authorization', value: 'none' }] },
      },
    };
    const scrubbedOverride = scrubLifecycleUpdate(override, VALUES);
    if (scrubbedOverride.kind !== 'request-override-attached') throw new Error('kind changed');
    expect(scrubbedOverride.override.sent.headers?.[0]?.value).toBe(SECRET_VALUE_PLACEHOLDER);
    expect(scrubbedOverride.override.original).toBe(override.override.original);
  });
});

describe('scrubRuleSnapshot', () => {
  it('scrubs the resolved header value a compile baked in and keeps the template', () => {
    const snapshot: RuleSnapshot = {
      ruleUid: 'r1',
      name: 'Auth',
      type: 'header',
      enabled: true,
      headerMods: [
        {
          direction: 'request',
          operation: 'override',
          headerName: 'Authorization',
          valueTemplate: 'Bearer {{vault.ApiToken}}',
          valueResolved: `Bearer ${TOKEN}`,
        },
      ],
    };
    const scrubbed = scrubRuleSnapshot(snapshot, VALUES);
    expect(scrubbed.headerMods?.[0]?.valueResolved).toBe(`Bearer ${SECRET_VALUE_PLACEHOLDER}`);
    expect(scrubbed.headerMods?.[0]?.valueTemplate).toBe('Bearer {{vault.ApiToken}}');
    expect(scrubRuleSnapshot(snapshot, new Set())).toBe(snapshot);
  });
});
