import { describe, expect, it } from 'vitest';
import * as YAML from 'yaml';
import { parseWebSocketRequest, serializeWebSocketRequest } from '../../src/codec/yaml';
import { freshDocument, mergePatch } from '../../src/schemas/document';
import type { WebSocketRequest } from '../../src/types';

const MESSAGE = '{\n  "event": "subscribe",\n  "channel": "lightingMeasured"\n}';

const websocketRequest = (overrides: Partial<WebSocketRequest> = {}): WebSocketRequest => ({
  schemaVersion: 5,
  uid: 'wsrq0001',
  path: 'requests/live-events-wsrq0001',
  name: 'Live Events',
  url: 'wss://events.openheaders.io/live',
  flavor: 'raw',
  subprotocols: ['graphql-ws'],
  headers: [{ uid: 'wshd0001', key: 'x-api-key', value: '{{vault.api_key}}', enabled: true }],
  params: [{ uid: 'wspm0001', key: 'tenant', value: 'openheaders', enabled: true }],
  message: MESSAGE,
  messageFormat: 'json',
  specLink: { specUid: 'spec0001' },
  timeoutMs: 30_000,
  ...overrides,
});

describe('serializeWebSocketRequest', () => {
  it('keeps the message out of the manifest and fans it out to a format-matched sibling', () => {
    const out = serializeWebSocketRequest(freshDocument(websocketRequest()));
    expect(out.websocketYaml).not.toContain('lightingMeasured');
    expect(out.websocketYaml).toContain('url: wss://events.openheaders.io/live');
    expect(out.websocketYaml).toContain('flavor: raw');
    expect(out.messageFile).toEqual({ fileName: 'message.json', content: MESSAGE });
  });

  it('fans the text-format draft out to message.txt', () => {
    const out = serializeWebSocketRequest(
      freshDocument(websocketRequest({ message: 'ping', messageFormat: undefined })),
    );
    expect(out.messageFile).toEqual({ fileName: 'message.txt', content: 'ping' });
  });

  it('emits no message sibling for an empty compose draft', () => {
    const out = serializeWebSocketRequest(freshDocument(websocketRequest({ message: '' })));
    expect(out.messageFile).toBeNull();
  });

  it('strips the runtime-only path from the manifest', () => {
    const out = serializeWebSocketRequest(freshDocument(websocketRequest()));
    expect(out.websocketYaml).not.toContain('requests/live-events-wsrq0001');
  });

  it('orders manifest fields metadata-top (invariant #6)', () => {
    const out = serializeWebSocketRequest(freshDocument(websocketRequest({ description: 'ordered' })));
    const keys = Object.keys(YAML.parse(out.websocketYaml) as Record<string, unknown>);
    expect(keys).toEqual([
      'schemaVersion',
      'uid',
      'name',
      'description',
      'url',
      'flavor',
      'subprotocols',
      'headers',
      'params',
      'messageFormat',
      'specLink',
      'timeoutMs',
    ]);
  });
});

describe('parseWebSocketRequest', () => {
  it('round-trips serialize → parse byte-identically', () => {
    const entity = websocketRequest({ description: 'round trip' });
    const out = serializeWebSocketRequest(freshDocument(entity));
    const parsed = parseWebSocketRequest(out.websocketYaml, {
      path: entity.path,
      siblings: out.messageFile ? [out.messageFile] : [],
    });
    expect(parsed.value).toEqual(entity);
  });

  it('round-trips a minimal request (no rows, no spec link, no message)', () => {
    const entity = websocketRequest({
      subprotocols: [],
      headers: [],
      params: [],
      message: '',
      messageFormat: undefined,
      specLink: undefined,
      timeoutMs: undefined,
    });
    const out = serializeWebSocketRequest(freshDocument(entity));
    const parsed = parseWebSocketRequest(out.websocketYaml, { path: entity.path, siblings: [] });
    expect(parsed.value).toEqual(entity);
  });

  it('round-trips the socketio flavor', () => {
    const entity = websocketRequest({ flavor: 'socketio' });
    const out = serializeWebSocketRequest(freshDocument(entity));
    const parsed = parseWebSocketRequest(out.websocketYaml, {
      path: entity.path,
      siblings: out.messageFile ? [out.messageFile] : [],
    });
    expect(parsed.value.flavor).toBe('socketio');
  });

  it('parses a missing message sibling as the empty draft', () => {
    const out = serializeWebSocketRequest(freshDocument(websocketRequest()));
    const parsed = parseWebSocketRequest(out.websocketYaml, { path: 'requests/live-events-wsrq0001', siblings: [] });
    expect(parsed.value.message).toBe('');
  });

  it('splices the text sibling into the runtime shape', () => {
    const entity = websocketRequest({ message: 'ping', messageFormat: 'text' });
    const out = serializeWebSocketRequest(freshDocument(entity));
    const parsed = parseWebSocketRequest(out.websocketYaml, {
      path: entity.path,
      siblings: out.messageFile ? [out.messageFile] : [],
    });
    expect(parsed.value.message).toBe('ping');
  });

  it('ignores unrecognized siblings', () => {
    const out = serializeWebSocketRequest(freshDocument(websocketRequest()));
    const parsed = parseWebSocketRequest(out.websocketYaml, {
      path: 'requests/live-events-wsrq0001',
      siblings: [{ fileName: 'notes.txt', content: 'scratch' }, ...(out.messageFile ? [out.messageFile] : [])],
    });
    expect(parsed.value.message).toBe(MESSAGE);
  });

  it('preserves unknown manifest keys through a round-trip (invariant #4)', () => {
    const out = serializeWebSocketRequest(freshDocument(websocketRequest()));
    const doc = YAML.parseDocument(out.websocketYaml);
    doc.set('futureKey', 'kept');
    const parsed = parseWebSocketRequest(doc.toString(), {
      path: 'requests/live-events-wsrq0001',
      siblings: out.messageFile ? [out.messageFile] : [],
    });
    const reserialized = serializeWebSocketRequest(mergePatch(parsed, () => {}));
    expect(reserialized.websocketYaml).toContain('futureKey: kept');
  });

  it('normalizes header and param row key order (canonicalize)', () => {
    const entity = websocketRequest({
      headers: [{ enabled: false, value: 'v', key: 'k', uid: 'wshd0002' } as WebSocketRequest['headers'][number]],
      params: [
        {
          hasEquals: true,
          value: '',
          key: 'flag',
          uid: 'wspm0002',
          description: 'note',
        } as WebSocketRequest['params'][number],
      ],
    });
    const out = serializeWebSocketRequest(freshDocument(entity));
    const parsed = YAML.parse(out.websocketYaml) as {
      headers: Array<Record<string, unknown>>;
      params: Array<Record<string, unknown>>;
    };
    expect(Object.keys(parsed.headers[0])).toEqual(['uid', 'key', 'value', 'enabled']);
    expect(Object.keys(parsed.params[0])).toEqual(['uid', 'key', 'value', 'description', 'hasEquals']);
  });
});
