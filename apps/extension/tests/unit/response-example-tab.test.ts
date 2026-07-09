/**
 * Response-example viewer tab derivations:
 *   - capturedResponseToSnapshot adapts the frozen capture to the
 *     executed-snapshot shape (error: null; no wire/timing/scripts —
 *     the capture never held them, nothing may be synthesized)
 *   - tabDisplayLabel resolves the live example name by uid and falls
 *     back to the seed label when the example is gone
 *   - computeBreadcrumbs extends the parent request's trail with the
 *     example label, degrading gracefully when the request is missing
 */

import type { CapturedResponse, CollectionTree, ResponseExample } from '@openheaders/core/types';
import { buildEmptyRequest } from '@openheaders/core/utils';
import { computeBreadcrumbs } from '@openheaders/ui/workbench/breadcrumbs';
import { capturedResponseToSnapshot } from '@openheaders/ui/workbench/components/response-example/captured-snapshot';
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
};

describe('capturedResponseToSnapshot', () => {
  it('maps the captured fields and marks the snapshot as non-error', () => {
    const snapshot = capturedResponseToSnapshot(capturedResponse);
    expect(snapshot.status).toBe(200);
    expect(snapshot.statusText).toBe('OK');
    expect(snapshot.url).toBe('https://api.openheaders.io/users');
    expect(snapshot.headers).toEqual([{ key: 'content-type', value: 'application/json' }]);
    expect(snapshot.body).toBe('{"ok":true}');
    expect(snapshot.bodyTruncated).toBe(false);
    expect(snapshot.bodyBytes).toBe(11);
    expect(snapshot.durationMs).toBe(42);
    expect(snapshot.error).toBeNull();
  });

  it('never synthesizes execution internals the capture excluded', () => {
    const snapshot = capturedResponseToSnapshot(capturedResponse);
    expect(snapshot.timing).toBeUndefined();
    expect(snapshot.wire).toBeUndefined();
    expect(snapshot.scripts).toBeUndefined();
    expect(snapshot.requestSize).toBeUndefined();
  });

  it('carries the truncation cap through', () => {
    const snapshot = capturedResponseToSnapshot({
      ...capturedResponse,
      bodyTruncated: true,
      bodyCapBytes: 1024,
      bodyBytes: 4096,
    });
    expect(snapshot.bodyTruncated).toBe(true);
    expect(snapshot.bodyCapBytes).toBe(1024);
    expect(snapshot.bodyBytes).toBe(4096);
  });

  it('returns fresh header rows, not references into the frozen capture', () => {
    const snapshot = capturedResponseToSnapshot(capturedResponse);
    expect(snapshot.headers[0]).not.toBe(capturedResponse.headers[0]);
  });
});

describe('tabDisplayLabel — response-example tabs', () => {
  it('resolves the live example name by uid', () => {
    const label = tabDisplayLabel(exampleTab, { ...emptyLookups, responseExamples: [{ ...example, name: 'Renamed' }] });
    expect(label).toBe('Renamed');
  });

  it('falls back to the seed label when the example is gone', () => {
    expect(tabDisplayLabel(exampleTab, emptyLookups)).toBe('200 OK');
  });
});

describe('computeBreadcrumbs — response-example tabs', () => {
  it('extends the parent request trail with the example label', () => {
    const crumbs = computeBreadcrumbs(exampleTab, '200 OK', [], [], requestCollectionTrees, [parentRequest], []);
    expect(crumbs).toEqual(['API Requests', 'API', 'Tokens', 'Get users', '200 OK']);
  });

  it('degrades to the request name when the tree has no trail for it', () => {
    const crumbs = computeBreadcrumbs(exampleTab, '200 OK', [], [], [], [parentRequest], []);
    expect(crumbs).toEqual(['API Requests', 'Get users', '200 OK']);
  });

  it('degrades to the family root when the parent request is gone', () => {
    const crumbs = computeBreadcrumbs(exampleTab, '200 OK', [], [], requestCollectionTrees, [], []);
    expect(crumbs).toEqual(['API Requests', '200 OK']);
  });
});
