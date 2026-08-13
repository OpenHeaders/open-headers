/**
 * Workbench tab-mode → feature_used mapping (`TELEMETRY_PLAN.md` §3).
 * Pins which editor tabs count as feature usage — rule tabs stay out
 * (rule_created carries that signal) — and that the per-document guard
 * fires one RPC per feature.
 */

import { type HostBridge, setHostBridge } from '@openheaders/core/bridge';
import { setCurrentHost } from '@openheaders/ui/shared/host-vocabulary';
import { __resetProductTelemetryTrackForTests } from '@openheaders/ui/shared/product-telemetry';
import { noteTabFeatureUsed, noteToolWindowFeatureUsed } from '@openheaders/ui/workbench/feature-usage';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let events: unknown[];

beforeEach(() => {
  __resetProductTelemetryTrackForTests();
  setCurrentHost('extension');
  events = [];
  setHostBridge({
    call: vi.fn(async (_type: string, payload: { event: unknown }) => {
      events.push(payload.event);
      return { success: true };
    }),
  } as unknown as HostBridge);
});

describe('noteTabFeatureUsed', () => {
  it('maps editor tab modes onto their vocabulary features', () => {
    noteTabFeatureUsed('request-edit');
    noteTabFeatureUsed('template-edit');
    noteTabFeatureUsed('live-workflow-create');
    noteTabFeatureUsed('live-vars');
    noteTabFeatureUsed('vault');
    noteTabFeatureUsed('script-packages');
    noteTabFeatureUsed('workspace-vars');
    expect(events).toEqual([
      { name: 'feature_used', feature: 'request-editor' },
      { name: 'feature_used', feature: 'template-editor' },
      { name: 'feature_used', feature: 'workflow-editor' },
      { name: 'feature_used', feature: 'live-sources' },
      { name: 'feature_used', feature: 'vault' },
      { name: 'feature_used', feature: 'devtools-scripts' },
      { name: 'feature_used', feature: 'variables' },
    ]);
  });

  it('collapses same-feature modes and repeats to one RPC per document', () => {
    noteTabFeatureUsed('request-edit');
    noteTabFeatureUsed('request-create');
    noteTabFeatureUsed('collection-vars');
    noteTabFeatureUsed('env-edit');
    expect(events).toEqual([
      { name: 'feature_used', feature: 'request-editor' },
      { name: 'feature_used', feature: 'variables' },
    ]);
  });

  it('rule tabs and chrome tabs are not features', () => {
    noteTabFeatureUsed('edit');
    noteTabFeatureUsed('rule-create');
    noteTabFeatureUsed('settings');
    noteTabFeatureUsed('workspace-manager');
    expect(events).toEqual([]);
  });

  it('maps the S17 surfaces — specs, examples, protocol clients, changelog', () => {
    noteTabFeatureUsed('spec-edit');
    noteTabFeatureUsed('response-example');
    noteTabFeatureUsed('grpc-response-example');
    noteTabFeatureUsed('ws-response-example');
    noteTabFeatureUsed('grpc-edit');
    noteTabFeatureUsed('websocket-edit');
    noteTabFeatureUsed('whats-new');
    expect(events).toEqual([
      { name: 'feature_used', feature: 'api-specs' },
      { name: 'feature_used', feature: 'response-examples' },
      { name: 'feature_used', feature: 'grpc-client' },
      { name: 'feature_used', feature: 'ws-client' },
      { name: 'feature_used', feature: 'whats-new' },
    ]);
  });
});

describe('noteToolWindowFeatureUsed', () => {
  it('maps the working-plane tool windows onto their vocabulary features', () => {
    noteToolWindowFeatureUsed('commit');
    noteToolWindowFeatureUsed('git');
    noteToolWindowFeatureUsed('terminal');
    noteToolWindowFeatureUsed('traffic-monitor');
    noteToolWindowFeatureUsed('activity');
    expect(events).toEqual([
      { name: 'feature_used', feature: 'git-commit' },
      { name: 'feature_used', feature: 'git-log' },
      { name: 'feature_used', feature: 'terminal' },
      { name: 'feature_used', feature: 'traffic-monitor' },
      { name: 'feature_used', feature: 'activity-feed' },
    ]);
  });

  it('ambient inspectors and default-open windows are not features', () => {
    noteToolWindowFeatureUsed('http-rules');
    noteToolWindowFeatureUsed('notifications');
    noteToolWindowFeatureUsed('docs');
    noteToolWindowFeatureUsed('var-scope');
    noteToolWindowFeatureUsed('variables');
    noteToolWindowFeatureUsed('workflow-status');
    expect(events).toEqual([]);
  });
});
