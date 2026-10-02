/**
 * gRPC invoke executor — the host-injected resolution seam
 * (`ExecuteGrpcInvokeOptions.resolution` + `authChain` +
 * `settingsChain`): the page-realm surfaces' path, where the oracle
 * module mirrors are empty and the caller's closure carries the whole
 * scope. Pins that the injected function resolves the invoke-time
 * templates (target, metadata, message) with no oracle resolver built,
 * that an unresolved reference gates the call as a structured error
 * naming it, that the injected auth chain mints the inherited
 * credential onto the metadata, that the injected settings chain
 * reaches the transport knobs and stamps the snapshot, and that the
 * pinned workspace's trusted roots ride the dial.
 */

import type { GrpcRequest, Spec } from '@openheaders/core/types';
import { buildPostResolveError, type ResolutionError } from '@openheaders/core/variables';
import { executeGrpcInvoke } from '@openheaders/oracle/live/grpc-exec/execute';
import type {
  GrpcTransport,
  GrpcTransportRequest,
  GrpcTransportResponse,
} from '@openheaders/oracle/live/grpc-exec/transport';
import { describe, expect, it, vi } from 'vitest';

const TRUSTED_ROOT = '-----BEGIN CERTIFICATE-----\nROOT\n-----END CERTIFICATE-----\n';
vi.mock('../../../src/entity/trusted-roots-store', () => ({
  getTrustedRootPemsForWorkspace: (workspaceId: string) => (workspaceId === 'ws-1' ? [TRUSTED_ROOT] : []),
}));
vi.mock('../../../src/entity/device-trust-store', () => ({
  getDeviceTrustPems: () => [],
}));
// The oracle-side resolver must never be built on the injected path —
// a page realm has no mirrors to read.
const buildResolver = vi.fn(() => {
  throw new Error('the oracle resolver was built on the injected path');
});
vi.mock('../../../src/live/request-exec/resolver-scope', () => ({
  buildResolver: () => buildResolver(),
}));

const PROTO = `syntax = "proto3";
package library.v1;

service Library {
  rpc GetNote(Note) returns (Note);
}

message Note { string text = 1; }
`;

const SPEC: Spec = {
  schemaVersion: 5,
  uid: 'spec0001',
  path: 'specs/library-spec0001',
  name: 'Library',
  format: 'protobuf',
  rootFileUid: 'file0001',
  files: [{ uid: 'file0001', fileName: 'index.proto', content: PROTO }],
};

function makeGrpcRequest(overrides: Partial<GrpcRequest> = {}): GrpcRequest {
  return {
    schemaVersion: 5,
    uid: 'grpc0001',
    path: 'requests/api-rcol0001/note-grpc0001',
    name: 'GetNote',
    url: '{{host}}:443',
    tls: true,
    method: { service: 'library.v1.Library', rpc: 'GetNote' },
    message: '{"text":"{{greeting}}"}',
    metadata: [{ uid: 'm1', key: 'x-tenant', value: '{{tenant}}' }],
    specLink: { specUid: SPEC.uid },
    ...overrides,
  };
}

/** Scope the injected closure carries — a small vocabulary. */
const SCOPE: Record<string, string> = {
  host: 'grpc.openheaders.io',
  greeting: 'hi',
  tenant: 'acme',
  token: 'tok-123',
};

function scopedResolution(template: string, unresolved: Map<string, ResolutionError>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (whole, name: string) => {
    const value = SCOPE[name.trim()];
    if (value === undefined) {
      unresolved.set(name.trim(), buildPostResolveError(name, 'unresolved', undefined));
      return whole;
    }
    return value;
  });
}

const OK_REPLY: GrpcTransportResponse = {
  httpStatus: 200,
  headers: [{ key: 'content-type', value: 'application/grpc+proto' }],
  trailers: [{ key: 'grpc-status', value: '0' }],
  body: new Uint8Array([0, 0, 0, 0, 4, 10, 2, 104, 105]),
  bodyTruncated: false,
};

function unaryTransport(): { transport: GrpcTransport; wire: () => GrpcTransportRequest } {
  let seen: GrpcTransportRequest | null = null;
  return {
    transport: {
      invoke: async (request) => {
        seen = request;
        return OK_REPLY;
      },
    },
    wire: () => {
      if (seen === null) throw new Error('invoke never reached the transport');
      return seen;
    },
  };
}

describe('executeGrpcInvoke — injected resolution', () => {
  it('resolves the target, the metadata and the message through the closure and builds no oracle resolver', async () => {
    const rig = unaryTransport();
    const snapshot = await executeGrpcInvoke(makeGrpcRequest(), {
      workspaceId: 'ws-1',
      environmentId: undefined,
      transport: rig.transport,
      spec: SPEC,
      resolution: scopedResolution,
      authChain: [],
      settingsChain: [],
    });
    expect(buildResolver).not.toHaveBeenCalled();
    expect(snapshot.error).toBeNull();
    expect(rig.wire()).toMatchObject({
      authority: 'grpc.openheaders.io:443',
      path: '/library.v1.Library/GetNote',
      metadata: [{ key: 'x-tenant', value: 'acme' }],
      trustedRootsPem: [TRUSTED_ROOT],
    });
    // The message encoded against the spec the caller handed over: field 1, "hi".
    expect(Array.from(rig.wire().message)).toEqual([10, 2, 104, 105]);
  });

  it('stamps the metadata keys whose templates name a secret-manager entry, and leaves the wire as it was', async () => {
    const rig = unaryTransport();
    const snapshot = await executeGrpcInvoke(makeGrpcRequest(), {
      workspaceId: 'ws-1',
      environmentId: undefined,
      transport: rig.transport,
      spec: SPEC,
      resolution: scopedResolution,
      referencesSecret: (templates) => templates.some((template) => template.includes('{{tenant}}')),
      authChain: [],
      settingsChain: [],
    });
    expect(snapshot.error).toBeNull();
    expect(snapshot.secretMetadataKeys).toEqual(['x-tenant']);
    expect(rig.wire()).toMatchObject({ metadata: [{ key: 'x-tenant', value: 'acme' }] });
  });

  it('gates an unresolved reference as a structured error naming it, before the wire', async () => {
    const rig = unaryTransport();
    const snapshot = await executeGrpcInvoke(makeGrpcRequest({ message: '{"text":"{{missing}}"}' }), {
      workspaceId: null,
      environmentId: undefined,
      transport: rig.transport,
      spec: SPEC,
      resolution: scopedResolution,
    });
    // The HTTP gate's wording: every reference with its reason.
    expect(snapshot.error).toBe(
      'Request has unresolved variables. {{missing}}: Not found in vault, environment, collection, or workspace. Define it in one of those scopes.',
    );
    expect(() => rig.wire()).toThrow();
  });

  it('mints the inherited credential off the injected auth chain and reads the knobs off the injected settings chain', async () => {
    const rig = unaryTransport();
    const snapshot = await executeGrpcInvoke(makeGrpcRequest({ auth: { type: 'inherit' } }), {
      workspaceId: null,
      environmentId: undefined,
      transport: rig.transport,
      spec: SPEC,
      resolution: scopedResolution,
      authChain: [
        {
          level: 'collection',
          uid: 'rcol0001',
          name: 'Payments',
          auths: [{ uid: 'key00001', name: 'Partner', config: { type: 'bearer', token: '{{token}}' } }],
          defaultAuthUid: 'key00001',
        },
      ],
      settingsChain: [
        {
          level: 'collection',
          uid: 'rcol0001',
          name: 'Payments',
          settings: { grpc: { timeoutMs: 8_000, keepaliveIntervalMs: 15_000 } },
        },
      ],
    });
    expect(snapshot.error).toBeNull();
    expect(rig.wire().metadata).toEqual([
      { key: 'x-tenant', value: 'acme' },
      { key: 'authorization', value: 'Bearer tok-123' },
    ]);
    expect(rig.wire()).toMatchObject({ timeoutMs: 8_000, keepaliveIntervalMs: 15_000 });
    expect(snapshot.auth).toMatchObject({ type: 'bearer', source: { level: 'collection', uid: 'rcol0001' } });
    expect(snapshot.inheritedSettings).toEqual([
      { key: 'timeoutMs', level: 'collection', uid: 'rcol0001', name: 'Payments' },
      { key: 'keepaliveIntervalMs', level: 'collection', uid: 'rcol0001', name: 'Payments' },
    ]);
  });
});
