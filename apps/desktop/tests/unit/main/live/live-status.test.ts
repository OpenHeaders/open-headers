/**
 * Desktop live Status pill (WS-C C5) — cache-row aggregation → pill color.
 *
 * The cache store + workspace pointer + status sink are mocked: this
 * isolates the aggregation rules (green / yellow / red, the 2×-cadence
 * staleness window, the no-active-workspace + read-fault guards). The
 * color thresholds themselves are the contract under test.
 */

import type { WorkflowRunCache } from '@openheaders/core/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { recomputeDesktopLiveStatus } from '../../../../src/main/live/live-status';

const h = vi.hoisted(() => ({
  listWorkflowRunCaches: vi.fn(),
  getActiveWorkspaceId: vi.fn(),
  report: vi.fn(),
}));

vi.mock('@openheaders/core/utils', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), debug: vi.fn(), error: vi.fn() },
}));
vi.mock('@openheaders/oracle/live/live-cache-store', () => ({
  listWorkflowRunCaches: h.listWorkflowRunCaches,
}));
vi.mock('@openheaders/oracle/workspace/extension-workspace-store', () => ({
  getActiveWorkspaceId: h.getActiveWorkspaceId,
}));
vi.mock('@openheaders/ui/shared/status/store', () => ({
  report: h.report,
}));

/** A fresh, never-failed run row. Overrides tune one axis at a time. */
function makeRun(overrides: Partial<WorkflowRunCache> = {}): WorkflowRunCache {
  return {
    workflowUid: 'wf-1',
    environmentId: null,
    stepCaptures: {},
    extractedAt: 1000,
    expiresAt: 61000,
    stepResponseBytes: {},
    consecutiveFailures: 0,
    lastExtractorOk: true,
    circuit: {
      state: 'closed',
      consecutiveFailures: 0,
      consecutiveOpenings: 0,
      nextAttemptAt: null,
      halfOpenAttempts: 0,
      lastSuccessAt: null,
      lastErrorAt: null,
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(2000); // just past extraction, well inside every window
  h.getActiveWorkspaceId.mockReturnValue('ws-1');
});

afterEach(() => {
  vi.useRealTimers();
});

describe('recomputeDesktopLiveStatus', () => {
  it('leaves the pill alone when there is no active workspace', async () => {
    h.getActiveWorkspaceId.mockReturnValue(null);
    await recomputeDesktopLiveStatus();
    expect(h.listWorkflowRunCaches).not.toHaveBeenCalled();
    expect(h.report).not.toHaveBeenCalled();
  });

  it('reports green "No workflows configured" when no runs are cached', async () => {
    h.listWorkflowRunCaches.mockResolvedValue([]);
    await recomputeDesktopLiveStatus();
    expect(h.report).toHaveBeenCalledWith({
      subsystem: 'live',
      state: 'green',
      message: 'No workflows configured',
    });
  });

  it('reports green with a count when every run is fresh', async () => {
    h.listWorkflowRunCaches.mockResolvedValue([makeRun(), makeRun({ workflowUid: 'wf-2' })]);
    await recomputeDesktopLiveStatus();
    expect(h.report).toHaveBeenCalledWith({
      subsystem: 'live',
      state: 'green',
      message: '2 workflows fresh',
      context: { fresh: 2 },
    });
  });

  it('reports yellow for a run with 1..4 consecutive failures', async () => {
    h.listWorkflowRunCaches.mockResolvedValue([makeRun({ consecutiveFailures: 2 })]);
    await recomputeDesktopLiveStatus();
    expect(h.report).toHaveBeenCalledWith(
      expect.objectContaining({ subsystem: 'live', state: 'yellow', context: { yellow: 1, firstYellow: 'wf-1' } }),
    );
  });

  it('reports yellow when the extractor last failed', async () => {
    h.listWorkflowRunCaches.mockResolvedValue([makeRun({ lastExtractorOk: false })]);
    await recomputeDesktopLiveStatus();
    expect(h.report).toHaveBeenCalledWith(expect.objectContaining({ state: 'yellow' }));
  });

  it('reports yellow when a run is stale beyond 2× its cadence window', async () => {
    // window = 60s; stale at > 120s past extraction.
    vi.setSystemTime(1000 + 120_001);
    h.listWorkflowRunCaches.mockResolvedValue([makeRun()]);
    await recomputeDesktopLiveStatus();
    expect(h.report).toHaveBeenCalledWith(expect.objectContaining({ state: 'yellow' }));
  });

  it('stays green for a never-run row even past the staleness horizon', async () => {
    vi.setSystemTime(10_000_000);
    h.listWorkflowRunCaches.mockResolvedValue([makeRun({ extractedAt: 0, expiresAt: null })]);
    await recomputeDesktopLiveStatus();
    expect(h.report).toHaveBeenCalledWith(expect.objectContaining({ state: 'green' }));
  });

  it('reports red when any run has 5+ consecutive failures, even alongside yellows', async () => {
    h.listWorkflowRunCaches.mockResolvedValue([
      makeRun({ workflowUid: 'wf-yellow', consecutiveFailures: 1 }),
      makeRun({ workflowUid: 'wf-red', consecutiveFailures: 5 }),
    ]);
    await recomputeDesktopLiveStatus();
    expect(h.report).toHaveBeenCalledWith(
      expect.objectContaining({
        subsystem: 'live',
        state: 'red',
        context: { red: 1, yellow: 1, firstRed: 'wf-red' },
      }),
    );
  });

  it('leaves the pill alone when the cache read throws', async () => {
    h.listWorkflowRunCaches.mockRejectedValue(new Error('storage down'));
    await recomputeDesktopLiveStatus();
    expect(h.report).not.toHaveBeenCalled();
  });
});
