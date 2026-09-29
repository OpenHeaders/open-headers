/**
 * The worker's `executeRequest` / `executeGraphqlRequest` handlers hand
 * the executor the workspace the send names — the tab's — beside the
 * place, so a send from a tab on a workspace other than this worker's
 * Active one resolves and gates there (the Execution Place plan: the
 * delegated frame's subject is the request's workspace, never the
 * worker's). A send that names none keeps the executor's Active read.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const executor = vi.hoisted(() => ({
  executeRequest: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  executeRequestDraft: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
}));

vi.mock('@/background/modules/request-executor', () => ({
  executeRequest: executor.executeRequest,
  executeRequestDraft: executor.executeRequestDraft,
}));
vi.mock('@/background/modules/request-executor/send-stream', () => ({
  stopActiveSend: vi.fn(),
}));

import { captureSetCookieRows, cookieJarFor, resetCookieJars } from '@openheaders/oracle/live/request-exec/cookie-jar';
import { requestHandlers } from '@/background/modules/message-handler/handlers/requests';
import type { HandlerArgs } from '@/background/modules/message-handler/types';

const SNAPSHOT = { status: 200, error: null };
const WORKSPACE = '01a0393f-f6c9-79e8-a670-6e10870f290f';
const PLACE = { backendId: 'backend-rig' };

const DRAFT = {
  schemaVersion: 5,
  uid: 'req0001',
  path: 'requests/req0001',
  name: 'Login',
  method: 'GET',
  url: 'http://host.docker.internal:3140/login',
  headers: [],
  params: [],
  body: { type: 'none' },
};

const GRAPHQL_DRAFT = {
  schemaVersion: 5,
  uid: 'gql0001',
  path: 'requests/gql0001',
  name: 'Books',
  url: 'http://host.docker.internal:3000/graphql',
  query: '{ books { title } }',
  variables: '{}',
  headers: [],
};

function invoke(type: 'executeRequest' | 'executeGraphqlRequest', message: Record<string, unknown>) {
  const respond = vi.fn();
  requestHandlers[type]({
    message: { type, ...message },
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

describe('the worker send handlers — the workspace the send names', () => {
  beforeEach(() => {
    executor.executeRequest.mockReset().mockResolvedValue(SNAPSHOT);
    executor.executeRequestDraft.mockReset().mockResolvedValue(SNAPSHOT);
  });

  it('executeRequest hands the executor the named workspace beside the place, for a draft and for a uid', async () => {
    const draftRespond = invoke('executeRequest', {
      draft: DRAFT,
      sendId: 'send-1',
      workspaceId: WORKSPACE,
      executionPlace: PLACE,
    });
    await expect(settled(draftRespond)).resolves.toEqual({ success: true, snapshot: SNAPSHOT });
    expect(executor.executeRequestDraft).toHaveBeenCalledWith(DRAFT, {
      environmentId: undefined,
      sendId: 'send-1',
      workspaceId: WORKSPACE,
      executionPlace: PLACE,
    });

    const uidRespond = invoke('executeRequest', { requestUid: 'req0001', workspaceId: WORKSPACE });
    await settled(uidRespond);
    expect(executor.executeRequest).toHaveBeenCalledWith('req0001', {
      environmentId: undefined,
      sendId: undefined,
      workspaceId: WORKSPACE,
    });
  });

  it('a send that names no workspace leaves the executor on its Active read', async () => {
    const respond = invoke('executeRequest', { draft: DRAFT, sendId: 'send-2', workspaceId: '' });
    await settled(respond);
    const options = executor.executeRequestDraft.mock.calls[0][1] as Record<string, unknown>;
    expect('workspaceId' in options).toBe(false);
    expect('executionPlace' in options).toBe(false);
  });

  it('executeGraphqlRequest compiles the draft and hands the executor the named workspace beside the place', async () => {
    const respond = invoke('executeGraphqlRequest', {
      draft: GRAPHQL_DRAFT,
      sendId: 'send-3',
      workspaceId: WORKSPACE,
      executionPlace: PLACE,
    });
    await expect(settled(respond)).resolves.toEqual({ success: true, snapshot: SNAPSHOT });
    expect(executor.executeRequestDraft).toHaveBeenCalledTimes(1);
    const [compiled, options] = executor.executeRequestDraft.mock.calls[0] as [Record<string, unknown>, unknown];
    expect(compiled.method).toBe('POST');
    expect(options).toEqual({
      environmentId: undefined,
      sendId: 'send-3',
      workspaceId: WORKSPACE,
      executionPlace: PLACE,
    });
  });
});

describe("the worker's cookie-jar channels — the context's jar under delegation, per workspace", () => {
  beforeEach(() => {
    resetCookieJars();
  });

  function call(
    type: 'getCookieJarSummary' | 'clearCookieJar' | 'deleteCookieJarEntry',
    message: Record<string, unknown>,
  ) {
    const respond = vi.fn();
    requestHandlers[type]({
      message: { type, ...message },
      sender: {} as chrome.runtime.MessageSender,
      respond,
      ctx: {},
    } as unknown as HandlerArgs);
    return respond.mock.calls[0][0] as Record<string, unknown>;
  }

  it("lists, deletes and clears the named workspace's jar, value-free; an absent jar answers empty", () => {
    expect(call('getCookieJarSummary', { workspaceId: WORKSPACE })).toEqual({ cookies: [] });
    captureSetCookieRows(cookieJarFor(WORKSPACE), 'http://host.docker.internal:3140/login', [
      { key: 'set-cookie', value: 'session=live123; Path=/' },
      { key: 'set-cookie', value: 'theme=dark; Path=/' },
    ]);
    const listed = call('getCookieJarSummary', { workspaceId: WORKSPACE }).cookies as Array<Record<string, unknown>>;
    expect(listed.map((c) => c.name).sort()).toEqual(['session', 'theme']);
    expect(listed.some((c) => 'value' in c)).toBe(false);
    expect(
      call('deleteCookieJarEntry', {
        workspaceId: WORKSPACE,
        name: 'theme',
        domain: 'host.docker.internal',
        path: '/',
      }),
    ).toEqual({ success: true });
    expect((call('getCookieJarSummary', { workspaceId: WORKSPACE }).cookies as unknown[]).length).toBe(1);
    expect(call('clearCookieJar', { workspaceId: WORKSPACE })).toEqual({ success: true });
    expect(call('getCookieJarSummary', { workspaceId: WORKSPACE })).toEqual({ cookies: [] });
    // Another workspace's jar is another jar.
    expect(call('getCookieJarSummary', { workspaceId: 'ws-other' })).toEqual({ cookies: [] });
  });
});
