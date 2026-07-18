/**
 * gRPC response-example tab derivations — the response-example-tab
 * suite mirrored onto the gRPC family:
 *   - grpc-example-draft projections: capture → draft → capture
 *     roundtrip, uid-free fingerprint stability across populates,
 *     capture-from-snapshot verbatim facts, stream-capture detection
 *   - tabDisplayLabel resolves the live example name by uid and falls
 *     back to the seed label when the example is gone
 *   - computeBreadcrumbs extends the parent gRPC request's trail with
 *     the example label, degrading gracefully when the request is gone
 *   - the prefill bus delivers to a live subscriber and parks pending
 *     payloads for the next one
 */

import type { CollectionTree, ExecutedGrpcSnapshot, GrpcResponseExample } from '@openheaders/core/types';
import { buildEmptyGrpcRequest } from '@openheaders/core/utils';
import { DEFAULT_LOCALE, getTranslator } from '@openheaders/i18n';
import { computeBreadcrumbs } from '@openheaders/ui/workbench/breadcrumbs';
import {
  publishGrpcPrefill,
  subscribeGrpcPrefill,
} from '@openheaders/ui/workbench/components/grpc-request-editor/grpc-prefill-bus';
import {
  capturedGrpcRequestFromDraft,
  capturedGrpcResponseFromSnapshot,
  grpcExampleDraftFingerprint,
  grpcExampleSignature,
  grpcExampleToDraft,
  headPositionOf,
  isStreamCapture,
} from '@openheaders/ui/workbench/components/grpc-response-example/grpc-example-draft';
import { type TabDisplayLookups, tabDisplayLabel } from '@openheaders/ui/workbench/tab-display';
import type { WorkbenchTab } from '@openheaders/ui/workbench/types';
import { describe, expect, it } from 'vitest';

const parentRequest = buildEmptyGrpcRequest({
  uid: 'grq00001',
  name: 'GetBook',
  path: 'requests/api-c0000001/library-f0000001/get-book-grq00001',
});

const example: GrpcResponseExample = {
  schemaVersion: 5,
  uid: 'gex00001',
  path: `${parentRequest.path}/examples/ok-gex00001`,
  grpcRequestUid: parentRequest.uid,
  name: 'GetBook',
  capturedAt: '2026-07-17T10:00:00.000Z',
  request: {
    url: 'grpc.openheaders.io:443',
    tls: true,
    sslVerification: true,
    method: { service: 'library.v1.Library', rpc: 'GetBook' },
    metadata: [{ uid: 'md000001', key: 'x-trace', value: 'abc', enabled: true }],
    message: '{"name":"books/1"}',
    timeoutMs: 30_000,
  },
  response: {
    grpcStatus: 0,
    statusSource: 'trailers',
    metadata: [{ key: 'content-type', value: 'application/grpc+proto' }],
    trailers: [{ key: 'x-books-checksum', value: 'c1' }],
    messages: [{ dataBase64: 'Cgdib29rcy8x', compressed: false }],
    bodyTruncated: false,
    bodyBytes: 14,
    durationMs: 42,
  },
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
        name: 'Library',
        path: 'requests/api-c0000001/library-f0000001',
        children: [
          {
            type: 'grpc-request',
            uid: parentRequest.uid,
            name: parentRequest.name,
            path: parentRequest.path,
          },
        ],
      },
    ],
  },
];

const exampleTab: WorkbenchTab = {
  id: `grpc-example-${example.uid}`,
  label: example.name,
  ruleType: '',
  dirty: false,
  mode: 'grpc-response-example',
  grpcResponseExampleUid: example.uid,
  grpcRequestUid: parentRequest.uid,
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

describe('grpc-example-draft projections', () => {
  it('roundtrips capture → draft → capture', () => {
    const draft = grpcExampleToDraft(example);
    expect(capturedGrpcRequestFromDraft(draft)).toEqual(example.request);
  });

  it('keeps the fingerprint stable across populates despite freshly-minted row uids', () => {
    expect(grpcExampleDraftFingerprint(grpcExampleToDraft(example))).toBe(
      grpcExampleDraftFingerprint(grpcExampleToDraft(example)),
    );
    expect(grpcExampleSignature(example)).toBe(grpcExampleDraftFingerprint(grpcExampleToDraft(example)));
  });

  it('changes the fingerprint on a content edit', () => {
    const draft = grpcExampleToDraft(example);
    const edited = { ...draft, message: '{"name":"books/2"}' };
    expect(grpcExampleDraftFingerprint(edited)).not.toBe(grpcExampleSignature(example));
  });

  it('drops empty metadata rows from the persisted capture', () => {
    const draft = grpcExampleToDraft(example);
    const withBlank = {
      ...draft,
      metadata: [...draft.metadata, { uid: 'blank001', key: '', value: 'x', enabled: true, hasEquals: true }],
    };
    expect(capturedGrpcRequestFromDraft(withBlank)).toEqual(example.request);
  });
});

describe('capturedGrpcResponseFromSnapshot', () => {
  const snapshot: ExecutedGrpcSnapshot = {
    httpStatus: 200,
    headers: [{ key: 'content-type', value: 'application/grpc+proto' }],
    trailers: [{ key: 'x-books-checksum', value: 'c1' }],
    grpcStatus: 0,
    grpcStatusSource: 'trailers',
    messages: [{ dataBase64: 'Cgdib29rcy8x', compressed: false }],
    bodyTruncated: false,
    bodyBytes: 14,
    durationMs: 42,
    error: null,
  };

  it('captures the settled facts verbatim and leaves execution internals behind', () => {
    const captured = capturedGrpcResponseFromSnapshot(snapshot);
    expect(captured).toEqual(example.response);
    expect('httpStatus' in captured).toBe(false);
    expect('error' in captured).toBe(false);
    expect('executedOn' in captured).toBe(false);
  });

  it('keeps the null-status + stopped + truncation facts of a canceled stream', () => {
    const captured = capturedGrpcResponseFromSnapshot({
      ...snapshot,
      grpcStatus: null,
      grpcStatusSource: null,
      messages: [
        { dataBase64: 'CgE=', compressed: false, direction: 'up' },
        { dataBase64: 'CgI=', compressed: true, direction: 'down' },
      ],
      headAtMessage: 1,
      incompleteTail: true,
      bodyTruncated: true,
      bodyCapBytes: 1024,
      bodyBytes: 4096,
      stopped: true,
      executedOn: { kind: 'backend', name: 'desktop-host' },
    });
    expect(captured.grpcStatus).toBeNull();
    expect(captured.statusSource).toBeNull();
    expect(captured.messages).toEqual([
      { dataBase64: 'CgE=', compressed: false, direction: 'up' },
      { dataBase64: 'CgI=', compressed: true, direction: 'down' },
    ]);
    expect(captured.incompleteTail).toBe(true);
    expect(captured.bodyTruncated).toBe(true);
    expect(captured.bodyCapBytes).toBe(1024);
    expect(captured.headAtMessage).toBe(1);
    expect(captured.stopped).toBe(true);
    expect('executedOn' in captured).toBe(false);
  });
});

describe('headPositionOf', () => {
  it('reads the recorded position when the capture carries one', () => {
    expect(headPositionOf({ ...example.response, headAtMessage: 2 })).toBe(2);
  });

  it('derives the first ↓ frame for pre-position captures — head precedes it on the wire', () => {
    expect(
      headPositionOf({
        ...example.response,
        messages: [
          { dataBase64: 'CgE=', compressed: false, direction: 'up' },
          { dataBase64: 'CgI=', compressed: false, direction: 'down' },
        ],
      }),
    ).toBe(1);
    expect(
      headPositionOf({
        ...example.response,
        messages: [{ dataBase64: 'CgE=', compressed: false, direction: 'up' }],
      }),
    ).toBe(1);
  });
});

describe('isStreamCapture', () => {
  it('reads direction-tagged frames as a stream capture', () => {
    expect(
      isStreamCapture({
        ...example.response,
        messages: [{ dataBase64: 'CgE=', compressed: false, direction: 'down' }],
      }),
    ).toBe(true);
  });

  it('reads untagged frames as the unary shape', () => {
    expect(isStreamCapture(example.response)).toBe(false);
  });
});

describe('grpc prefill bus', () => {
  it('delivers to a live subscriber', () => {
    const received: string[] = [];
    const unsubscribe = subscribeGrpcPrefill('grqbus01', (c) => received.push(c.message));
    publishGrpcPrefill('grqbus01', example.request);
    expect(received).toEqual([example.request.message]);
    unsubscribe();
  });

  it('parks a publish with no subscriber and hands it to the next one exactly once', () => {
    publishGrpcPrefill('grqbus02', example.request);
    const first: string[] = [];
    const un1 = subscribeGrpcPrefill('grqbus02', (c) => first.push(c.message));
    expect(first).toEqual([example.request.message]);
    un1();
    const second: string[] = [];
    const un2 = subscribeGrpcPrefill('grqbus02', (c) => second.push(c.message));
    expect(second).toEqual([]);
    un2();
  });
});

describe('tabDisplayLabel — grpc-response-example tabs', () => {
  const t = getTranslator(DEFAULT_LOCALE);

  it('resolves the live example name by uid', () => {
    const label = tabDisplayLabel(
      exampleTab,
      { ...emptyLookups, grpcResponseExamples: [{ ...example, name: 'Renamed' }] },
      t,
    );
    expect(label).toBe('Renamed');
  });

  it('falls back to the seed label when the example is gone', () => {
    expect(tabDisplayLabel(exampleTab, emptyLookups, t)).toBe('GetBook');
  });
});

describe('computeBreadcrumbs — grpc-response-example tabs', () => {
  const t = getTranslator(DEFAULT_LOCALE);

  it('extends the parent gRPC request trail with the example label', () => {
    const crumbs = computeBreadcrumbs(exampleTab, 'GetBook', [], [], requestCollectionTrees, [], [], t, [
      parentRequest,
    ]);
    expect(crumbs).toEqual(['API Requests', 'API', 'Library', 'GetBook', 'GetBook']);
  });

  it('degrades to the request name when the tree has no trail for it', () => {
    const crumbs = computeBreadcrumbs(exampleTab, 'GetBook', [], [], [], [], [], t, [parentRequest]);
    expect(crumbs).toEqual(['API Requests', 'GetBook', 'GetBook']);
  });

  it('degrades to the family root when the parent request is gone', () => {
    const crumbs = computeBreadcrumbs(exampleTab, 'GetBook', [], [], requestCollectionTrees, [], [], t, []);
    expect(crumbs).toEqual(['API Requests', 'GetBook']);
  });
});
