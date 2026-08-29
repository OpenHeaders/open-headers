import { describe, expect, it } from 'vitest';
import {
  encodeConnectPacket,
  encodeEventPacket,
  isValidNamespace,
  normalizeHandshakePath,
  normalizeNamespace,
  parseEngineIoFrame,
  parseSocketIoPacket,
  resolveSocketIoTarget,
  SOCKET_IO_PACKET_TYPES,
} from '../../src/socketio';

describe('resolveSocketIoTarget', () => {
  const plain = { namespace: '', handshakePath: '' };

  it('mounts the default /socket.io/ path on a bare authority and joins the root namespace', () => {
    expect(resolveSocketIoTarget('ws://events.openheaders.io:3000', plain)).toEqual({
      url: 'ws://events.openheaders.io:3000/socket.io/?EIO=4&transport=websocket',
      namespace: '/',
    });
  });

  it('reads the URL path as the namespace, never as the mount', () => {
    expect(resolveSocketIoTarget('wss://events.openheaders.io/admin', plain)).toEqual({
      url: 'wss://events.openheaders.io/socket.io/?EIO=4&transport=websocket',
      namespace: '/admin',
    });
  });

  it('mounts the handshake path setting, trailing slash normalized', () => {
    expect(
      resolveSocketIoTarget('ws://events.openheaders.io', { namespace: '', handshakePath: '/net/sio-probe' }),
    ).toEqual({ url: 'ws://events.openheaders.io/net/sio-probe/?EIO=4&transport=websocket', namespace: '/' });
  });

  it('lets the namespace setting override the URL path', () => {
    expect(resolveSocketIoTarget('ws://events.openheaders.io/admin', { namespace: 'chat', handshakePath: '' })).toEqual(
      {
        url: 'ws://events.openheaders.io/socket.io/?EIO=4&transport=websocket',
        namespace: '/chat',
      },
    );
  });

  it('dials EIO=3 on socket.io protocol v4 and EIO=4 on v5', () => {
    expect(resolveSocketIoTarget('ws://events.openheaders.io', { ...plain, protocol: 4 }).url).toBe(
      'ws://events.openheaders.io/socket.io/?EIO=3&transport=websocket',
    );
    expect(resolveSocketIoTarget('ws://events.openheaders.io', { ...plain, protocol: 5 }).url).toBe(
      'ws://events.openheaders.io/socket.io/?EIO=4&transport=websocket',
    );
  });

  it('keeps user query params ahead of the engine.io ones', () => {
    expect(resolveSocketIoTarget('ws://events.openheaders.io/?room=alpha', plain).url).toBe(
      'ws://events.openheaders.io/socket.io/?room=alpha&EIO=4&transport=websocket',
    );
  });
});

describe('normalizeHandshakePath', () => {
  it('defaults empty and root to the stock mount', () => {
    expect(normalizeHandshakePath('')).toBe('/socket.io/');
    expect(normalizeHandshakePath(' / ')).toBe('/socket.io/');
  });

  it('adds the missing leading and trailing slashes', () => {
    expect(normalizeHandshakePath('net/sio')).toBe('/net/sio/');
    expect(normalizeHandshakePath('/net/sio/')).toBe('/net/sio/');
  });
});

describe('namespace helpers', () => {
  it('normalizes empty and slashless namespaces', () => {
    expect(normalizeNamespace('')).toBe('/');
    expect(normalizeNamespace('  ')).toBe('/');
    expect(normalizeNamespace('/')).toBe('/');
    expect(normalizeNamespace('chat')).toBe('/chat');
    expect(normalizeNamespace('/chat')).toBe('/chat');
  });

  it('rejects the reserved comma', () => {
    expect(isValidNamespace('/chat')).toBe(true);
    expect(isValidNamespace('/a,b')).toBe(false);
  });
});

describe('encodeConnectPacket', () => {
  it('encodes the root namespace bare', () => {
    expect(encodeConnectPacket('/')).toBe('40');
    expect(encodeConnectPacket('')).toBe('40');
  });

  it('encodes a named namespace with the comma terminator', () => {
    expect(encodeConnectPacket('/probe')).toBe('40/probe,');
    expect(encodeConnectPacket('probe')).toBe('40/probe,');
  });

  it('appends the auth payload verbatim after the header', () => {
    expect(encodeConnectPacket('/', '{"token":"tok-123"}')).toBe('40{"token":"tok-123"}');
    expect(encodeConnectPacket('/probe', '{"token":"tok-123"}')).toBe('40/probe,{"token":"tok-123"}');
  });
});

describe('encodeEventPacket', () => {
  it('encodes an event with arguments on the root namespace', () => {
    const result = encodeEventPacket('/', null, 'echo', '["hello", 2]');
    expect(result).toEqual({ ok: true, frame: '42["echo","hello",2]' });
  });

  it('treats an empty compose as zero arguments', () => {
    expect(encodeEventPacket('/', null, 'ping-me', '')).toEqual({ ok: true, frame: '42["ping-me"]' });
  });

  it('carries namespace and ack id in header order', () => {
    const result = encodeEventPacket('/probe', 7, 'echo', '[{"a":1}]');
    expect(result).toEqual({ ok: true, frame: '42/probe,7["echo",{"a":1}]' });
  });

  it('reports non-JSON and non-array arguments as rider errors', () => {
    expect(encodeEventPacket('/', null, 'echo', '{nope')).toEqual({
      ok: false,
      error: 'Arguments are not valid JSON.',
    });
    expect(encodeEventPacket('/', null, 'echo', '{"a":1}')).toEqual({
      ok: false,
      error: 'Arguments must be a JSON array — one element per argument.',
    });
  });

  it('reports an empty event name', () => {
    expect(encodeEventPacket('/', null, '  ', '[]')).toEqual({ ok: false, error: 'Event name is empty.' });
  });
});

describe('parseEngineIoFrame', () => {
  it('decodes the engine.io control frames', () => {
    expect(parseEngineIoFrame('0{"sid":"abc","pingInterval":25000}')).toEqual({
      kind: 'open',
      dataJson: '{"sid":"abc","pingInterval":25000}',
    });
    expect(parseEngineIoFrame('1')).toEqual({ kind: 'close' });
    expect(parseEngineIoFrame('2')).toEqual({ kind: 'ping' });
    expect(parseEngineIoFrame('3')).toEqual({ kind: 'pong' });
    expect(parseEngineIoFrame('5')).toEqual({ kind: 'upgrade' });
    expect(parseEngineIoFrame('6')).toEqual({ kind: 'noop' });
  });

  it('keeps unknown frames verbatim', () => {
    expect(parseEngineIoFrame('')).toEqual({ kind: 'unknown', raw: '' });
    expect(parseEngineIoFrame('x?')).toEqual({ kind: 'unknown', raw: 'x?' });
  });

  it('decodes a message frame into a socket.io packet', () => {
    expect(parseEngineIoFrame('42["probe:hello",{"sid":"s1"}]')).toEqual({
      kind: 'packet',
      packet: {
        type: SOCKET_IO_PACKET_TYPES.event,
        namespace: '/',
        ackId: null,
        dataJson: '["probe:hello",{"sid":"s1"}]',
        attachments: 0,
      },
    });
  });
});

describe('parseSocketIoPacket', () => {
  it('decodes the connect ack', () => {
    expect(parseSocketIoPacket('0{"sid":"xyz"}')).toEqual({
      type: SOCKET_IO_PACKET_TYPES.connect,
      namespace: '/',
      ackId: null,
      dataJson: '{"sid":"xyz"}',
      attachments: 0,
    });
  });

  it('decodes namespace and ack id together', () => {
    expect(parseSocketIoPacket('2/probe,13["echo","x"]')).toEqual({
      type: SOCKET_IO_PACKET_TYPES.event,
      namespace: '/probe',
      ackId: 13,
      dataJson: '["echo","x"]',
      attachments: 0,
    });
  });

  it('decodes an ack reply with payload', () => {
    expect(parseSocketIoPacket('37[{"acked":true}]')).toEqual({
      type: SOCKET_IO_PACKET_TYPES.ack,
      namespace: '/',
      ackId: 7,
      dataJson: '[{"acked":true}]',
      attachments: 0,
    });
  });

  it('decodes a binary-event header with attachment count', () => {
    expect(parseSocketIoPacket('51-["file",{"_placeholder":true,"num":0}]')).toEqual({
      type: SOCKET_IO_PACKET_TYPES.binaryEvent,
      namespace: '/',
      ackId: null,
      dataJson: '["file",{"_placeholder":true,"num":0}]',
      attachments: 1,
    });
  });

  it('decodes a bare disconnect', () => {
    expect(parseSocketIoPacket('1')).toEqual({
      type: SOCKET_IO_PACKET_TYPES.disconnect,
      namespace: '/',
      ackId: null,
      dataJson: null,
      attachments: 0,
    });
  });

  it('rejects headers that do not scan', () => {
    expect(parseSocketIoPacket('')).toBeNull();
    expect(parseSocketIoPacket('9[]')).toBeNull();
    expect(parseSocketIoPacket('5-[]')).toBeNull();
    expect(parseSocketIoPacket('2/nocomma')).toBeNull();
  });
});
