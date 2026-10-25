/**
 * gRPC executor — the TOTP cooldown plane over an injected resolution
 * and an injected plane: the invoke's codes (a metadata pair here) are
 * ONE batch gated before the wire (a refusal is the structured error
 * snapshot in the HTTP send's wording, nothing invoked) and recorded
 * once the exchange answered; a transport failure records nothing.
 */

import { createTotpUsageTracker, type TotpCooldownPlane, type TotpUsage } from '@openheaders/core/totp';
import type { GrpcRequest, Spec, Vault } from '@openheaders/core/types';
import { executeGrpcInvoke } from '@openheaders/oracle/live/grpc-exec/execute';
import type {
  GrpcTransport,
  GrpcTransportRequest,
  GrpcTransportResponse,
} from '@openheaders/oracle/live/grpc-exec/transport';
import type { SessionResolve } from '@openheaders/oracle/live/request-exec/session-resolution';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/entity/trusted-roots-store', () => ({
  getTrustedRootPemsForWorkspace: () => [],
}));
vi.mock('../../../src/entity/device-trust-store', () => ({
  getDeviceTrustPems: () => [],
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

const vault: Vault = {
  schemaVersion: 5,
  secrets: [
    { uid: 'totp0001', kind: 'totp', name: 'otp', seed: 'JBSWY3DPEHPK3PXP', algorithm: 'SHA1', digits: 6, period: 30 },
  ],
};

const REFUSAL = "TOTP 'otp' code can't be reused — wait 20s for the next window.";

function makeGrpcRequest(overrides: Partial<GrpcRequest> = {}): GrpcRequest {
  return {
    schemaVersion: 5,
    uid: 'grpc-totp-1',
    path: 'requests/api-rcol0001/note-grpc0001',
    name: 'GetNote',
    url: 'grpc.openheaders.io:443',
    tls: true,
    method: { service: 'library.v1.Library', rpc: 'GetNote' },
    message: '{"text":"hi"}',
    metadata: [{ uid: 'm1', key: 'x-otp', value: '{{vault.otp}}' }],
    specLink: { specUid: SPEC.uid },
    ...overrides,
  };
}

function resolutionAnsweringCode(code: string): SessionResolve {
  return (template, _unresolved, totp) =>
    template.replace(/\{\{([^}]+)\}\}/g, (whole, name: string) => {
      if (name.trim() !== 'vault.otp') return whole;
      totp?.observe([{ name: 'vault.otp', resolved: true, value: code, scope: 'vault' }]);
      return code;
    });
}

function scriptedPlane(refusals: Record<string, string | null> = {}) {
  const gated: TotpUsage[][] = [];
  const recorded: TotpUsage[][] = [];
  const plane: TotpCooldownPlane = {
    tracker: () => createTotpUsageTracker(vault),
    refusal: async (usages) => {
      if (usages.length === 0) return null;
      gated.push([...usages]);
      for (const usage of usages) {
        const refusal = refusals[usage.code];
        if (refusal !== undefined && refusal !== null) return refusal;
      }
      return null;
    },
    record: (usages) => {
      if (usages.length === 0) return;
      recorded.push([...usages]);
    },
  };
  return { plane, gated, recorded };
}

const OK_REPLY: GrpcTransportResponse = {
  httpStatus: 200,
  headers: [{ key: 'content-type', value: 'application/grpc+proto' }],
  trailers: [{ key: 'grpc-status', value: '0' }],
  body: new Uint8Array([0, 0, 0, 0, 4, 10, 2, 104, 105]),
  bodyTruncated: false,
};

function unaryTransport(answer: () => Promise<GrpcTransportResponse>) {
  const invoked: GrpcTransportRequest[] = [];
  const transport: GrpcTransport = {
    invoke: async (request) => {
      invoked.push(request);
      return answer();
    },
  };
  return { transport, invoked };
}

describe('executeGrpcInvoke — TOTP cooldown', () => {
  it('gates the invoke before the wire: a code in cooldown is the error snapshot in the HTTP wording, nothing invoked', async () => {
    const rig = unaryTransport(async () => OK_REPLY);
    const { plane, gated, recorded } = scriptedPlane({ '111111': REFUSAL });
    const snapshot = await executeGrpcInvoke(makeGrpcRequest(), {
      workspaceId: 'ws-1',
      environmentId: undefined,
      transport: rig.transport,
      spec: SPEC,
      resolution: resolutionAnsweringCode('111111'),
      totp: plane,
    });
    expect(snapshot.error).toBe(REFUSAL);
    expect(rig.invoked).toHaveLength(0);
    expect(gated).toEqual([[{ name: 'otp', code: '111111', period: 30 }]]);
    expect(recorded).toEqual([]);
  });

  it('records the codes once the exchange answered; a transport failure records nothing', async () => {
    const { plane, recorded } = scriptedPlane();
    const failing = unaryTransport(async () => {
      throw new Error('ECONNREFUSED');
    });
    const failed = await executeGrpcInvoke(makeGrpcRequest(), {
      workspaceId: 'ws-1',
      environmentId: undefined,
      transport: failing.transport,
      spec: SPEC,
      resolution: resolutionAnsweringCode('222222'),
      totp: plane,
    });
    expect(failed.error).toBe('ECONNREFUSED');
    expect(failing.invoked[0]?.metadata).toEqual([{ key: 'x-otp', value: '222222' }]);
    expect(recorded).toEqual([]);

    const answering = unaryTransport(async () => OK_REPLY);
    const snapshot = await executeGrpcInvoke(makeGrpcRequest(), {
      workspaceId: 'ws-1',
      environmentId: undefined,
      transport: answering.transport,
      spec: SPEC,
      resolution: resolutionAnsweringCode('333333'),
      totp: plane,
    });
    expect(snapshot.error).toBeNull();
    expect(recorded).toEqual([[{ name: 'otp', code: '333333', period: 30 }]]);
  });
});
