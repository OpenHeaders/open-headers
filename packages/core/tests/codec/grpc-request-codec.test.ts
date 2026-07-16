import { describe, expect, it } from 'vitest';
import * as YAML from 'yaml';
import { parseGrpcRequest, serializeGrpcRequest } from '../../src/codec/yaml';
import { freshDocument, mergePatch } from '../../src/schemas/document';
import type { GrpcRequest } from '../../src/types';

const MESSAGE = '{\n  "title": "The Library",\n  "pageCount": 320\n}';

const grpcRequest = (overrides: Partial<GrpcRequest> = {}): GrpcRequest => ({
  schemaVersion: 5,
  uid: 'grpc0001',
  path: 'requests/library-grpc0001',
  name: 'Create Book',
  url: 'grpc.openheaders.io:443',
  tls: true,
  method: { service: 'library.v1.Library', rpc: 'CreateBook' },
  message: MESSAGE,
  metadata: [{ uid: 'meta0001', key: 'x-api-key', value: '{{vault.api_key}}', enabled: true }],
  specLink: { specUid: 'spec0001' },
  timeoutMs: 30_000,
  ...overrides,
});

describe('serializeGrpcRequest', () => {
  it('keeps the message out of the manifest and fans it out to message.json', () => {
    const out = serializeGrpcRequest(freshDocument(grpcRequest()));
    expect(out.grpcYaml).not.toContain('pageCount');
    expect(out.grpcYaml).toContain('url: grpc.openheaders.io:443');
    expect(out.grpcYaml).toContain('service: library.v1.Library');
    expect(out.messageFile).toEqual({ fileName: 'message.json', content: MESSAGE });
  });

  it('emits no message sibling for an empty message', () => {
    const out = serializeGrpcRequest(freshDocument(grpcRequest({ message: '' })));
    expect(out.messageFile).toBeNull();
  });

  it('strips the runtime-only path from the manifest', () => {
    const out = serializeGrpcRequest(freshDocument(grpcRequest()));
    expect(out.grpcYaml).not.toContain('requests/library-grpc0001');
  });

  it('orders manifest fields metadata-top (invariant #6)', () => {
    const out = serializeGrpcRequest(freshDocument(grpcRequest({ description: 'ordered' })));
    const keys = Object.keys(YAML.parse(out.grpcYaml) as Record<string, unknown>);
    expect(keys).toEqual([
      'schemaVersion',
      'uid',
      'name',
      'description',
      'url',
      'tls',
      'method',
      'metadata',
      'specLink',
      'timeoutMs',
    ]);
  });
});

describe('parseGrpcRequest', () => {
  it('round-trips serialize → parse byte-identically', () => {
    const entity = grpcRequest({ description: 'round trip' });
    const out = serializeGrpcRequest(freshDocument(entity));
    const parsed = parseGrpcRequest(out.grpcYaml, {
      path: entity.path,
      siblings: out.messageFile ? [out.messageFile] : [],
    });
    expect(parsed.value).toEqual(entity);
  });

  it('round-trips a minimal request (no method, no spec link, no message)', () => {
    const entity = grpcRequest({
      tls: undefined,
      method: undefined,
      message: '',
      metadata: [],
      specLink: undefined,
      timeoutMs: undefined,
    });
    const out = serializeGrpcRequest(freshDocument(entity));
    const parsed = parseGrpcRequest(out.grpcYaml, { path: entity.path, siblings: [] });
    expect(parsed.value).toEqual(entity);
  });

  it('parses a missing message sibling as the empty message', () => {
    const out = serializeGrpcRequest(freshDocument(grpcRequest()));
    const parsed = parseGrpcRequest(out.grpcYaml, { path: 'requests/library-grpc0001', siblings: [] });
    expect(parsed.value.message).toBe('');
  });

  it('ignores unrecognized siblings', () => {
    const out = serializeGrpcRequest(freshDocument(grpcRequest()));
    const parsed = parseGrpcRequest(out.grpcYaml, {
      path: 'requests/library-grpc0001',
      siblings: [{ fileName: 'notes.txt', content: 'scratch' }, ...(out.messageFile ? [out.messageFile] : [])],
    });
    expect(parsed.value.message).toBe(MESSAGE);
  });

  it('preserves unknown manifest keys through a round-trip (invariant #4)', () => {
    const out = serializeGrpcRequest(freshDocument(grpcRequest()));
    const doc = YAML.parseDocument(out.grpcYaml);
    doc.set('futureKey', 'kept');
    const parsed = parseGrpcRequest(doc.toString(), {
      path: 'requests/library-grpc0001',
      siblings: out.messageFile ? [out.messageFile] : [],
    });
    const reserialized = serializeGrpcRequest(mergePatch(parsed, () => {}));
    expect(reserialized.grpcYaml).toContain('futureKey: kept');
  });

  it('normalizes metadata row key order (canonicalize)', () => {
    const entity = grpcRequest({
      metadata: [
        { enabled: false, value: 'v', key: 'k', uid: 'meta0002' } as GrpcRequest['metadata'][number],
        { uid: 'meta0003', key: 'k2', value: 'v2', description: 'note' },
      ],
    });
    const out = serializeGrpcRequest(freshDocument(entity));
    const parsed = YAML.parse(out.grpcYaml) as { metadata: Array<Record<string, unknown>> };
    expect(Object.keys(parsed.metadata[0])).toEqual(['uid', 'key', 'value', 'enabled']);
    expect(Object.keys(parsed.metadata[1])).toEqual(['uid', 'key', 'value', 'description']);
  });
});
