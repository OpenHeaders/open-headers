import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import type {
  StateVector,
  SyncHelloMessage,
  SyncStateVectorMessage,
  SyncSyncedMessage,
  SyncWelcomeAccept,
  SyncWelcomeReject,
} from '../../src/protocol';
import {
  BACKEND_REACH,
  HANDSHAKE_REJECT_REASONS,
  HANDSHAKE_ROLES,
  StateVectorSchema,
  SYNC_HELLO_TYPE,
  SYNC_STATE_VECTOR_TYPE,
  SYNC_SYNCED_TYPE,
  SYNC_WELCOME_TYPE,
  SyncHandshakeMessageSchema,
  SyncHelloMessageSchema,
  SyncStateVectorMessageSchema,
  SyncSyncedMessageSchema,
  SyncWelcomeMessageSchema,
} from '../../src/protocol';

const sampleVector: StateVector = {
  'sw-openheaders': { physicalMs: 1700000000000, logical: 4, nodeId: 'sw-openheaders' },
  'desktop-main': { physicalMs: 1700000000050, logical: 0, nodeId: 'desktop-main' },
};

describe('StateVectorSchema', () => {
  it('parses an empty vector (cold-oracle signal)', () => {
    expect(v.parse(StateVectorSchema, {})).toEqual({});
  });

  it('parses a populated vector', () => {
    expect(v.parse(StateVectorSchema, sampleVector)).toEqual(sampleVector);
  });

  it('rejects a malformed HLC value', () => {
    expect(() => v.parse(StateVectorSchema, { x: { physicalMs: -1, logical: 0, nodeId: 'x' } })).toThrow();
  });
});

describe('SyncHelloMessageSchema', () => {
  const hello: SyncHelloMessage = {
    type: SYNC_HELLO_TYPE,
    protocolVersion: 1,
    role: HANDSHAKE_ROLES.EXTENSION,
    nodeId: 'sw-openheaders',
    workspaceId: '018f1c5e-7b9a-7c4d-9f02-001122334455',
    agent: '@openheaders/extension@5.0.0-pre.42',
  };

  it('round-trips a HELLO', () => {
    expect(v.parse(SyncHelloMessageSchema, hello)).toEqual(hello);
  });

  it('rejects an unknown role', () => {
    expect(() => v.parse(SyncHelloMessageSchema, { ...hello, role: 'phone' })).toThrow();
  });

  it('rejects protocolVersion < 1', () => {
    expect(() => v.parse(SyncHelloMessageSchema, { ...hello, protocolVersion: 0 })).toThrow();
  });

  it('rejects empty workspaceId', () => {
    expect(() => v.parse(SyncHelloMessageSchema, { ...hello, workspaceId: '' })).toThrow();
  });
});

describe('SyncWelcomeMessageSchema', () => {
  const accept: SyncWelcomeAccept = {
    type: SYNC_WELCOME_TYPE,
    accepted: true,
    protocolVersion: 1,
    role: HANDSHAKE_ROLES.DESKTOP,
    nodeId: 'desktop-main',
    workspaceId: '018f1c5e-7b9a-7c4d-9f02-001122334455',
    agent: '@openheaders/desktop@2026.5.0',
  };

  const reject: SyncWelcomeReject = {
    type: SYNC_WELCOME_TYPE,
    accepted: false,
    reason: HANDSHAKE_REJECT_REASONS.WORKSPACE_UNKNOWN,
    protocolVersion: 1,
    detail: 'no workspace by that id on this node',
  };

  it('round-trips an accept', () => {
    expect(v.parse(SyncWelcomeMessageSchema, accept)).toEqual(accept);
  });

  it('round-trips an accept carrying a reach tier', () => {
    const withReach = { ...accept, reach: BACKEND_REACH.LAN };
    expect(v.parse(SyncWelcomeMessageSchema, withReach)).toEqual(withReach);
  });

  it('rejects an unknown reach value', () => {
    expect(() => v.parse(SyncWelcomeMessageSchema, { ...accept, reach: 'mesh' })).toThrow();
  });

  it('round-trips a reject', () => {
    expect(v.parse(SyncWelcomeMessageSchema, reject)).toEqual(reject);
  });

  it('rejects an unknown reason code', () => {
    expect(() => v.parse(SyncWelcomeMessageSchema, { ...reject, reason: 'because' })).toThrow();
  });
});

describe('SyncStateVectorMessageSchema', () => {
  const msg: SyncStateVectorMessage = {
    type: SYNC_STATE_VECTOR_TYPE,
    workspaceId: 'ws-1',
    perNodeMaxHlc: sampleVector,
  };

  it('round-trips a populated vector', () => {
    expect(v.parse(SyncStateVectorMessageSchema, msg)).toEqual(msg);
  });

  it('accepts an empty vector', () => {
    const empty: SyncStateVectorMessage = { ...msg, perNodeMaxHlc: {} };
    expect(v.parse(SyncStateVectorMessageSchema, empty)).toEqual(empty);
  });
});

describe('SyncSyncedMessageSchema', () => {
  const msg: SyncSyncedMessage = {
    type: SYNC_SYNCED_TYPE,
    workspaceId: 'ws-1',
    stateVectorAfter: sampleVector,
  };

  it('round-trips a SYNCED ack', () => {
    expect(v.parse(SyncSyncedMessageSchema, msg)).toEqual(msg);
  });
});

describe('SyncHandshakeMessageSchema (union)', () => {
  it('routes each of the four message types by discriminator', () => {
    const messages = [
      { type: SYNC_HELLO_TYPE, protocolVersion: 1, role: 'extension', nodeId: 'a', workspaceId: 'w', agent: '' },
      {
        type: SYNC_WELCOME_TYPE,
        accepted: true,
        protocolVersion: 1,
        role: 'desktop',
        nodeId: 'b',
        workspaceId: 'w',
        agent: '',
      },
      { type: SYNC_STATE_VECTOR_TYPE, workspaceId: 'w', perNodeMaxHlc: {} },
      { type: SYNC_SYNCED_TYPE, workspaceId: 'w', stateVectorAfter: {} },
    ];
    for (const m of messages) {
      const parsed = v.parse(SyncHandshakeMessageSchema, m);
      expect(parsed.type).toBe(m.type);
    }
  });

  it('rejects unknown message types', () => {
    expect(() => v.parse(SyncHandshakeMessageSchema, { type: 'oh.sync.elsewhere' })).toThrow();
  });
});
