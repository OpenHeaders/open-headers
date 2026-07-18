/**
 * Response-example editor tab derivations:
 *   - example-draft projections: capture → draft → capture roundtrip,
 *     uid-free fingerprint stability across populates, body-meta
 *     recompute on edit
 *   - tabDisplayLabel resolves the live example name by uid and falls
 *     back to the seed label when the example is gone
 *   - computeBreadcrumbs extends the parent request's trail with the
 *     example label, degrading gracefully when the request is missing
 */

import type {
  CapturedResponse,
  CollectionTree,
  ExecutedRequestSnapshot,
  ResponseExample,
} from '@openheaders/core/types';
import { buildEmptyRequest } from '@openheaders/core/utils';
import { DEFAULT_LOCALE, getTranslator } from '@openheaders/i18n';
import { computeBreadcrumbs } from '@openheaders/ui/workbench/breadcrumbs';
import {
  capturedRequestFromDraft,
  capturedResponseFromDraft,
  capturedResponseFromSnapshot,
  exampleDraftFingerprint,
  exampleSignature,
  exampleToDraft,
  parseStatusInput,
} from '@openheaders/ui/workbench/components/response-example/example-draft';
import { type TabDisplayLookups, tabDisplayLabel } from '@openheaders/ui/workbench/tab-display';
import type { WorkbenchTab } from '@openheaders/ui/workbench/types';
import { describe, expect, it } from 'vitest';

const capturedResponse: CapturedResponse = {
  status: 200,
  statusText: 'OK',
  url: 'https://api.openheaders.io/users',
  headers: [{ key: 'content-type', value: 'application/json' }],
  body: '{"ok":true}',
  bodyTruncated: false,
  bodyBytes: 11,
  durationMs: 42,
};

const parentRequest = buildEmptyRequest({
  uid: 'req00001',
  name: 'Get users',
  path: 'requests/api-c0000001/tokens-f0000001/get-users-req00001',
});

const example: ResponseExample = {
  schemaVersion: 5,
  uid: 'ex000001',
  path: `${parentRequest.path}/examples/ok-ex000001`,
  requestUid: parentRequest.uid,
  name: '200 OK',
  capturedAt: '2026-07-09T10:00:00.000Z',
  request: { method: 'GET', url: 'https://api.openheaders.io/users', headers: [], params: [], body: { type: 'none' } },
  response: capturedResponse,
};

const requestCollectionTrees: CollectionTree[] = [
  {
    schemaVersion: 5,
    uid: 'c0000001',
    path: 'requests/api-c0000001',
    name: 'API',
    variables: [],
    pinnedEnvironmentIds: [],
    defaultEnvironmentId: null,
    tree: [
      {
        type: 'folder',
        uid: 'f0000001',
        name: 'Tokens',
        path: 'requests/api-c0000001/tokens-f0000001',
        children: [
          {
            type: 'request',
            uid: parentRequest.uid,
            name: parentRequest.name,
            path: parentRequest.path,
            method: 'GET',
          },
        ],
      },
    ],
  },
];

const exampleTab: WorkbenchTab = {
  id: `resp-example-${example.uid}`,
  label: example.name,
  ruleType: '',
  dirty: false,
  mode: 'response-example',
  responseExampleUid: example.uid,
  requestUid: parentRequest.uid,
};

const emptyLookups: TabDisplayLookups = {
  rules: [],
  templates: [],
  environments: [],
  requests: [],
  localCollectionTrees: [],
  requestCollectionTrees: [],
  templateCollectionTrees: [],
  liveVariables: [],
  liveWorkflows: [],
  responseExamples: [],
  grpcResponseExamples: [],
  wsResponseExamples: [],
  specs: [],
};

describe('example-draft projections', () => {
  it('roundtrips capture → draft → capture', () => {
    const withRows: ResponseExample = {
      ...example,
      request: {
        ...example.request,
        headers: [{ uid: 'h0000001', key: 'Accept', value: 'application/json', enabled: true }],
        params: [{ uid: 'p0000001', key: 'active', value: '1', enabled: true }],
        body: { type: 'json', content: '{"q":1}' },
      },
    };
    const draft = exampleToDraft(withRows);
    expect(capturedRequestFromDraft(draft.request)).toEqual(withRows.request);
    expect(capturedResponseFromDraft(draft.response, withRows.response)).toEqual(withRows.response);
  });

  it('keeps the fingerprint stable across populates despite freshly-minted row uids', () => {
    expect(exampleDraftFingerprint(exampleToDraft(example))).toBe(exampleDraftFingerprint(exampleToDraft(example)));
    expect(exampleSignature(example)).toBe(exampleDraftFingerprint(exampleToDraft(example)));
  });

  it('changes the fingerprint on a content edit', () => {
    const draft = exampleToDraft(example);
    const edited = { ...draft, response: { ...draft.response, status: 404 } };
    expect(exampleDraftFingerprint(edited)).not.toBe(exampleSignature(example));
  });

  it('recomputes body meta when the response body was edited', () => {
    const truncated: CapturedResponse = {
      ...example.response,
      bodyTruncated: true,
      bodyCapBytes: 1024,
      bodyBytes: 4096,
    };
    const draft = exampleToDraft({ ...example, response: truncated });
    const saved = capturedResponseFromDraft({ ...draft.response, body: '{"edited":true}' }, truncated);
    expect(saved.body).toBe('{"edited":true}');
    expect(saved.bodyBytes).toBe(15);
    expect(saved.bodyTruncated).toBe(false);
    expect(saved.bodyCapBytes).toBeUndefined();
    expect(saved.durationMs).toBe(truncated.durationMs);
  });

  it('carries the binary marker through draft and save while the body is untouched', () => {
    const binary: CapturedResponse = {
      ...example.response,
      headers: [{ key: 'content-type', value: 'application/pdf' }],
      body: 'JVBERi0xLjQK/w==',
      bodyEncoding: 'base64',
      bodyBytes: 10,
    };
    const draft = exampleToDraft({ ...example, response: binary });
    expect(draft.response.bodyEncoding).toBe('base64');
    expect(capturedResponseFromDraft(draft.response, binary)).toEqual(binary);
  });

  it('drops the binary marker when the body was edited', () => {
    const binary: CapturedResponse = {
      ...example.response,
      body: 'JVBERi0xLjQK/w==',
      bodyEncoding: 'base64',
      bodyBytes: 10,
    };
    const draft = exampleToDraft({ ...example, response: binary });
    const saved = capturedResponseFromDraft({ ...draft.response, body: 'plain text now' }, binary);
    expect(saved.bodyEncoding).toBeUndefined();
    expect(saved.body).toBe('plain text now');
    expect(saved.bodyBytes).toBe(14);
  });

  it('preserves captured body meta when the body is untouched', () => {
    const truncated: CapturedResponse = {
      ...example.response,
      bodyTruncated: true,
      bodyCapBytes: 1024,
      bodyBytes: 4096,
    };
    const draft = exampleToDraft({ ...example, response: truncated });
    const saved = capturedResponseFromDraft(draft.response, truncated);
    expect(saved.bodyTruncated).toBe(true);
    expect(saved.bodyCapBytes).toBe(1024);
    expect(saved.bodyBytes).toBe(4096);
  });
});

describe('capturedResponseFromSnapshot', () => {
  const snapshot: ExecutedRequestSnapshot = {
    status: 200,
    statusText: 'OK',
    url: 'https://api.openheaders.io/users',
    headers: [{ key: 'content-type', value: 'application/json' }],
    body: '{"ok":true}',
    bodyTruncated: false,
    bodyBytes: 11,
    durationMs: 42,
    error: null,
  };

  it('pretty-prints a JSON text body and keeps the wire meta', () => {
    const captured = capturedResponseFromSnapshot(snapshot);
    expect(captured.body).toBe('{\n  "ok": true\n}');
    expect(captured.bodyEncoding).toBeUndefined();
    expect(captured.bodyBytes).toBe(11);
    expect(captured).not.toHaveProperty('bodyCapBytes');
  });

  it('pretty-prints an ndjson body record-wise', () => {
    const captured = capturedResponseFromSnapshot({
      ...snapshot,
      headers: [{ key: 'content-type', value: 'application/x-ndjson' }],
      body: '{"a":1}\n{"b":2}\n',
      bodyBytes: 16,
    });
    expect(captured.body).toBe('{\n  "a": 1\n}\n{\n  "b": 2\n}');
    expect(captured.bodyBytes).toBe(16);
  });

  it('stores a binary body verbatim with its marker', () => {
    const captured = capturedResponseFromSnapshot({
      ...snapshot,
      headers: [{ key: 'content-type', value: 'application/pdf' }],
      body: 'JVBERi0xLjQK/w==',
      bodyEncoding: 'base64',
      bodyBytes: 10,
    });
    expect(captured.body).toBe('JVBERi0xLjQK/w==');
    expect(captured.bodyEncoding).toBe('base64');
    expect(captured.bodyBytes).toBe(10);
  });

  it('pretty-prints without corrupting numbers beyond double precision', () => {
    const captured = capturedResponseFromSnapshot({
      ...snapshot,
      body: '{"resourceVersion":9007199254740993}',
      bodyBytes: 36,
    });
    expect(captured.body).toBe('{\n  "resourceVersion": 9007199254740993\n}');
  });

  it('keeps the truncation stamp and cap', () => {
    const captured = capturedResponseFromSnapshot({
      ...snapshot,
      bodyTruncated: true,
      bodyCapBytes: 1024,
      bodyBytes: 4096,
    });
    expect(captured.bodyTruncated).toBe(true);
    expect(captured.bodyCapBytes).toBe(1024);
    expect(captured.bodyBytes).toBe(4096);
  });
});

describe('parseStatusInput', () => {
  it('fills the canonical phrase for a bare curated code', () => {
    expect(parseStatusInput('404')).toEqual({ status: 404, statusText: 'Not Found' });
  });

  it('accepts a picker option verbatim', () => {
    expect(parseStatusInput('201 Created')).toEqual({ status: 201, statusText: 'Created' });
  });

  it('keeps a typed custom phrase', () => {
    expect(parseStatusInput('299 Custom Thing')).toEqual({ status: 299, statusText: 'Custom Thing' });
  });

  it('clears the phrase for an unknown bare code', () => {
    expect(parseStatusInput('599')).toEqual({ status: 599, statusText: '' });
  });

  it('rejects input without a three-digit code', () => {
    expect(parseStatusInput('OK')).toBeNull();
    expect(parseStatusInput('20')).toBeNull();
    expect(parseStatusInput('')).toBeNull();
  });
});

describe('tabDisplayLabel — response-example tabs', () => {
  const t = getTranslator(DEFAULT_LOCALE);

  it('resolves the live example name by uid', () => {
    const label = tabDisplayLabel(
      exampleTab,
      { ...emptyLookups, responseExamples: [{ ...example, name: 'Renamed' }] },
      t,
    );
    expect(label).toBe('Renamed');
  });

  it('falls back to the seed label when the example is gone', () => {
    expect(tabDisplayLabel(exampleTab, emptyLookups, t)).toBe('200 OK');
  });
});

describe('computeBreadcrumbs — response-example tabs', () => {
  const t = getTranslator(DEFAULT_LOCALE);

  it('extends the parent request trail with the example label', () => {
    const crumbs = computeBreadcrumbs(exampleTab, '200 OK', [], [], requestCollectionTrees, [parentRequest], [], t);
    expect(crumbs).toEqual(['API Requests', 'API', 'Tokens', 'Get users', '200 OK']);
  });

  it('degrades to the request name when the tree has no trail for it', () => {
    const crumbs = computeBreadcrumbs(exampleTab, '200 OK', [], [], [], [parentRequest], [], t);
    expect(crumbs).toEqual(['API Requests', 'Get users', '200 OK']);
  });

  it('degrades to the family root when the parent request is gone', () => {
    const crumbs = computeBreadcrumbs(exampleTab, '200 OK', [], [], requestCollectionTrees, [], [], t);
    expect(crumbs).toEqual(['API Requests', '200 OK']);
  });
});
