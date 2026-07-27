/**
 * gRPC forwarding in the SW — the extension leg of the Phase F peer
 * posture:
 *   - `executeGrpcRequest` forwards over the backend wire with the
 *     SW's active workspace + tri-state environment stamps (the web
 *     tab's stamping law), honors the draft's timeout plus margin, and
 *     degrades every failure leg (no wire, companion refusal) to an
 *     error SNAPSHOT so the response pane states what happened;
 *   - the upstream riders `sendGrpcStreamMessage` / `endGrpcClientStream`
 *     forward by sendId and answer structured refusals;
 *   - `abortRequestSend` stops a LOCAL send first and forwards the
 *     stop over the wire only on a local miss;
 *   - the stream relay claims `grpcStreamEvent` frames off the backend
 *     wire and re-broadcasts the payload to every open surface.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockBroadcast, mockWsRequest, mockStopActiveSend, mockActiveEnvId } = vi.hoisted(() => ({
  mockBroadcast: vi.fn(),
  mockWsRequest: vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => undefined),
  mockStopActiveSend: vi.fn(() => false),
  mockActiveEnvId: vi.fn((): string | null => null),
}));

vi.mock('@utils/bridge', () => ({
  broadcast: mockBroadcast,
}));
vi.mock('@/background/ws-request', () => ({
  wsRequest: mockWsRequest,
}));
vi.mock('@openheaders/oracle/entity/environment-store', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getActiveEnvironmentId: () => mockActiveEnvId(),
}));
vi.mock('@/background/modules/workspace/workspace-store', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getActiveWorkspaceId: () => 'ws-active',
}));
vi.mock('@openheaders/oracle/live/request-exec/send-stream', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  stopActiveSend: mockStopActiveSend,
}));

import { handleIncomingGrpcStreamFrame, installGrpcStreamRelay } from '@/background/grpc-stream-relay';
import { grpcHandlers } from '@/background/modules/message-handler/handlers/grpc';
import { requestHandlers } from '@/background/modules/message-handler/handlers/requests';
import type { HandlerArgs } from '@/background/modules/message-handler/types';

void installGrpcStreamRelay;

function invoke(handlers: Record<string, unknown>, type: string, extra: Record<string, unknown> = {}) {
  const handler = (handlers as Record<string, (args: HandlerArgs) => boolean | undefined>)[type];
  const respond = vi.fn();
  handler({
    message: { type, ...extra },
    sender: {} as chrome.runtime.MessageSender,
    respond,
    ctx: {},
  } as unknown as HandlerArgs);
  return respond;
}

async function settled(respond: ReturnType<typeof vi.fn>): Promise<unknown> {
  await vi.waitFor(() => expect(respond).toHaveBeenCalled());
  return respond.mock.calls[0][0];
}

beforeEach(() => {
  mockBroadcast.mockReset();
  mockWsRequest.mockReset();
  mockStopActiveSend.mockReset();
  mockStopActiveSend.mockReturnValue(false);
  mockActiveEnvId.mockReset();
  mockActiveEnvId.mockReturnValue(null);
});

describe('executeGrpcRequest forwarding', () => {
  it('forwards the frame with workspace + tri-state environment stamps and the timeout margin', async () => {
    mockWsRequest.mockResolvedValue({ success: true, snapshot: { httpStatus: 200 } });
    mockActiveEnvId.mockReturnValue('env-7');
    const draft = { url: 'grpc.openheaders.io:443', timeoutMs: 30_000 };
    const respond = invoke(grpcHandlers, 'executeGrpcRequest', { draft, sendId: 'send-1' });
    const result = await settled(respond);
    expect(result).toEqual({ success: true, snapshot: { httpStatus: 200 } });
    expect(mockWsRequest).toHaveBeenCalledWith(
      {
        type: 'executeGrpcRequest',
        draft,
        sendId: 'send-1',
        workspaceId: 'ws-active',
        environmentId: 'env-7',
      },
      { timeoutMs: 45_000 },
    );
  });

  it("stamps the explicit null environment — the caller's No-environment state rides verbatim", async () => {
    mockWsRequest.mockResolvedValue({ success: true });
    const respond = invoke(grpcHandlers, 'executeGrpcRequest', { draft: {}, environmentId: null });
    await settled(respond);
    const frame = mockWsRequest.mock.calls[0][0] as Record<string, unknown>;
    expect(frame.environmentId).toBeNull();
  });

  it('degrades a dead wire to an error snapshot naming the companion', async () => {
    mockWsRequest.mockRejectedValue(new Error('not-connected'));
    const respond = invoke(grpcHandlers, 'executeGrpcRequest', { draft: {} });
    const result = (await settled(respond)) as { success: boolean; snapshot?: { error: string | null } };
    expect(result.success).toBe(true);
    expect(result.snapshot?.error).toMatch(/desktop app is not connected/);
  });

  it("degrades the companion's refusal verbatim onto the snapshot", async () => {
    mockWsRequest.mockRejectedValue(new Error("Sending requests from this device's browsers is disabled on this host."));
    const respond = invoke(grpcHandlers, 'executeGrpcRequest', { draft: {} });
    const result = (await settled(respond)) as { snapshot?: { error: string | null } };
    expect(result.snapshot?.error).toMatch(/disabled on this host/);
  });
});

describe('gRPC upstream riders', () => {
  it('forwards sendGrpcStreamMessage by sendId and relays the answer', async () => {
    mockWsRequest.mockResolvedValue({ success: true });
    const respond = invoke(grpcHandlers, 'sendGrpcStreamMessage', { sendId: 's-1', messageText: '{"x":1}' });
    await settled(respond);
    expect(mockWsRequest).toHaveBeenCalledWith({
      type: 'sendGrpcStreamMessage',
      sendId: 's-1',
      messageText: '{"x":1}',
    });
    expect(respond).toHaveBeenCalledWith({ success: true });
  });

  it('answers a structured refusal without touching the wire for malformed frames', () => {
    const respond = invoke(grpcHandlers, 'sendGrpcStreamMessage', { sendId: 's-1' });
    expect(respond).toHaveBeenCalledWith({ success: false, error: 'No stream id or message provided' });
    expect(mockWsRequest).not.toHaveBeenCalled();
  });

  it('forwards endGrpcClientStream and answers false on a dead wire', async () => {
    mockWsRequest.mockRejectedValue(new Error('not-connected'));
    const respond = invoke(grpcHandlers, 'endGrpcClientStream', { sendId: 's-1' });
    await settled(respond);
    expect(respond).toHaveBeenCalledWith({ success: false });
  });
});

describe('abortRequestSend — local first, forward on miss', () => {
  it('stops a local send without touching the wire', () => {
    mockStopActiveSend.mockReturnValue(true);
    const respond = invoke(requestHandlers, 'abortRequestSend', { sendId: 'send-local' });
    expect(respond).toHaveBeenCalledWith({ success: true });
    expect(mockWsRequest).not.toHaveBeenCalled();
  });

  it('forwards the stop over the wire on a local miss', async () => {
    mockWsRequest.mockResolvedValue({ success: true });
    const respond = invoke(requestHandlers, 'abortRequestSend', { sendId: 'send-remote' });
    await settled(respond);
    expect(mockWsRequest).toHaveBeenCalledWith({ type: 'abortRequestSend', sendId: 'send-remote' });
    expect(respond).toHaveBeenCalledWith({ success: true });
  });

  it('answers false when neither the local registry nor the wire has the send', async () => {
    mockWsRequest.mockRejectedValue(new Error('not-connected'));
    const respond = invoke(requestHandlers, 'abortRequestSend', { sendId: 'send-nowhere' });
    await settled(respond);
    expect(respond).toHaveBeenCalledWith({ success: false });
  });
});

describe('grpc stream relay', () => {
  const PAYLOAD = { sendId: 's-1', seq: 0, kind: 'end' };

  it('claims a grpcStreamEvent frame and re-broadcasts the payload to surfaces', () => {
    expect(handleIncomingGrpcStreamFrame({ type: 'grpcStreamEvent', payload: PAYLOAD })).toBe(true);
    expect(mockBroadcast).toHaveBeenCalledWith('grpcStreamEvent', PAYLOAD);
  });

  it('leaves other frame types to the next handler', () => {
    expect(handleIncomingGrpcStreamFrame({ type: 'requestStreamEvent', payload: PAYLOAD })).toBe(false);
    expect(handleIncomingGrpcStreamFrame(null)).toBe(false);
    expect(mockBroadcast).not.toHaveBeenCalled();
  });

  it('claims but drops a malformed frame', () => {
    expect(handleIncomingGrpcStreamFrame({ type: 'grpcStreamEvent', payload: 'junk' })).toBe(true);
    expect(mockBroadcast).not.toHaveBeenCalled();
  });
});
