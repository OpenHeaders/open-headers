/**
 * The web tab's own workflow runs — the tab's seam into the shared
 * workflow route (the workflow runs plan, Decisions log, S13 and S15):
 * the tab owns exactly the four workflow channels; a `call` step sends
 * over the delegating request transport the tab's Send rides, with the
 * tab's jar; a `listen` step's stream opens over the tab's socket wire
 * toward the serving daemon, the run's workspace as the gate's subject;
 * every channel reaches the shared route with a runner bound to the
 * tab's seam; a cache change and a run's step events fan out on the
 * in-tab broadcast.
 */

import type { LiveWorkflowRunEventWire } from '@openheaders/core/bridge';
import { DELEGATE_MQTT_OPEN_CHANNEL } from '@openheaders/core/protocol';
import type { LiveWorkflow } from '@openheaders/core/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  transports: [] as unknown[],
  runs: [] as { args: unknown; host: unknown }[],
  routed: [] as { type: string; message: unknown; run: (args: unknown) => Promise<unknown> }[],
}));

vi.mock('@openheaders/oracle/live/request-exec/delegating-transport', () => ({
  createDelegatingRequestTransport: (options: unknown) => {
    h.transports.push(options);
    return { send: async () => ({}) };
  },
}));
vi.mock('@openheaders/oracle/live/workflow-route/run', () => ({
  runWorkflowRefresh: async (args: unknown, host: unknown) => {
    h.runs.push({ args, host });
    return { ok: true, skippedStepIds: [] };
  },
}));
vi.mock('@openheaders/oracle/live/workflow-route/route', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@openheaders/oracle/live/workflow-route/route')>()),
  handleLiveWorkflowRpc: async (type: string, message: unknown, run: (args: unknown) => Promise<unknown>) => {
    h.routed.push({ type, message, run });
    return { success: true };
  },
}));

import { notifyChange } from '@openheaders/oracle/live/live-cache-store/listeners';
import { cookieJarFor } from '@openheaders/oracle/live/request-exec/cookie-jar';
import { openWorkflowRunFeed } from '@openheaders/oracle/live/workflow-run-feed';
import { webDelegatedWire } from '@/host/delegated-wire';
import {
  dispatchTabWorkflowsRpc,
  installTabWorkflowBroadcasts,
  isTabWorkflowsChannel,
  webWorkflowRouteHost,
} from '@/host/tab-workflows-rpc';
import { subscribeLocal } from '@/host/web-broadcast';
import { setWireRpcSender } from '@/host/wire-rpc';

const MQTT_REQUEST = { url: 'mqtt://broker.openheaders.io:1883' };

const WORKFLOW: LiveWorkflow = {
  schemaVersion: 5,
  uid: 'wf-1',
  path: 'live/wf-1',
  name: 'Reboot and confirm',
  steps: [],
  refresh: { kind: 'manual' },
  enabled: true,
  published: true,
};

const noop = (): void => {};

describe('tab-workflows-rpc', () => {
  let sent: Record<string, unknown>[];

  beforeEach(() => {
    sent = [];
    h.transports = [];
    h.runs = [];
    h.routed = [];
    setWireRpcSender((message) => {
      sent.push(message);
      return true;
    });
  });

  it('owns exactly the four workflow channels', () => {
    for (const type of [
      'refreshLiveWorkflowNow',
      'getLiveCacheForWorkflow',
      'resetLiveWorkflowCircuit',
      'getLiveWorkflowRunProduct',
    ]) {
      expect(isTabWorkflowsChannel(type)).toBe(true);
    }
    expect(isTabWorkflowsChannel('executeRequest')).toBe(false);
    expect(isTabWorkflowsChannel('executeMqttRequest')).toBe(false);
    expect(isTabWorkflowsChannel(undefined)).toBe(false);
  });

  it('sends a call over the delegating request transport the tab Send rides, with the tab jar', () => {
    webWorkflowRouteHost.requestTransportFor('ws-tab');
    expect(h.transports).toEqual([{ wire: webDelegatedWire, workspaceId: 'ws-tab', jars: cookieJarFor }]);
  });

  it('opens a listen over the socket wire toward the serving daemon, an mqtt:// dial included', async () => {
    const transport = webWorkflowRouteHost.mqttTransportFor('ws-tab');
    transport.connect(MQTT_REQUEST, { onConnect: noop, onData: noop, onEnd: noop });
    await Promise.resolve();
    expect(sent[0]).toMatchObject({ type: DELEGATE_MQTT_OPEN_CHANNEL, workspaceId: 'ws-tab', request: MQTT_REQUEST });
  });

  it('routes every channel to the shared route with a runner bound to the tab seam', async () => {
    const press = { type: 'refreshLiveWorkflowNow', workflowUid: 'wf-1', environmentId: null, runId: 'run-1' };
    await dispatchTabWorkflowsRpc('refreshLiveWorkflowNow', press);
    await dispatchTabWorkflowsRpc('getLiveWorkflowRunProduct', { type: 'getLiveWorkflowRunProduct' });
    expect(h.routed.map((r) => r.type)).toEqual(['refreshLiveWorkflowNow', 'getLiveWorkflowRunProduct']);
    expect(h.routed[0].message).toBe(press);

    const args = { workspaceId: 'ws-tab', workflow: WORKFLOW, environmentId: null, bypass: false, runId: 'run-1' };
    await expect(h.routed[0].run(args)).resolves.toEqual({ ok: true, skippedStepIds: [] });
    expect(h.runs).toEqual([{ args, host: webWorkflowRouteHost }]);
  });

  it('fans a cache change and a run step event out on the in-tab broadcast', () => {
    const changed: unknown[] = [];
    const facts: LiveWorkflowRunEventWire[] = [];
    const releaseCache = subscribeLocal('liveCacheChanged', (payload) => changed.push(payload));
    const releaseRun = subscribeLocal('liveWorkflowRunEvent', (payload) =>
      facts.push(payload as LiveWorkflowRunEventWire),
    );
    installTabWorkflowBroadcasts();

    notifyChange('ws-tab', 'wf-1', []);
    // A value the server's run synced down names no workflow.
    notifyChange('ws-tab', null, []);
    expect(changed).toEqual([{ workflowUid: 'wf-1' }, { workflowUid: null }]);

    const feed = openWorkflowRunFeed({ workspaceId: 'ws-tab', workflowUid: 'wf-1', environmentId: null, runId: 'r1' });
    feed({ type: 'begin', at: 1_000, steps: [{ id: 'probe', uid: 'step-1' }] });
    expect(facts).toHaveLength(1);
    expect(facts[0]).toMatchObject({
      workspaceId: 'ws-tab',
      workflowUid: 'wf-1',
      environmentId: null,
      runId: 'r1',
      seq: 0,
      fact: { type: 'begin' },
    });
    releaseCache();
    releaseRun();
  });
});
