import type { LiveWorkflowRunEventWire } from '@openheaders/core/bridge';
import type { WorkflowRunEvent } from '@openheaders/core/live';
import type { ExecutedRequestSnapshot } from '@openheaders/core/types';
import { afterEach, describe, expect, it } from 'vitest';
import {
  __resetWorkflowRunFeedForTests,
  getWorkflowRunProduct,
  openWorkflowRunFeed,
  setWorkflowRunEventSink,
} from '../../src/live/workflow-run-feed';

function snapshot(body: string): ExecutedRequestSnapshot {
  return {
    status: 200,
    statusText: 'OK',
    url: 'https://api.openheaders.io/',
    headers: [],
    body,
    bodyTruncated: false,
    bodyBytes: body.length,
    durationMs: 10,
    error: null,
  };
}

const BEGIN: WorkflowRunEvent = { type: 'begin', at: 1, steps: [{ id: 'login', uid: 'stplogin' }] };

function settle(stepId: string, body: string): WorkflowRunEvent {
  return {
    type: 'step-settle',
    at: 2,
    stepId,
    settlement: { state: 'skipped' },
    product: { kind: 'response', snapshot: snapshot(body) },
  };
}

function collect(): LiveWorkflowRunEventWire[] {
  const frames: LiveWorkflowRunEventWire[] = [];
  setWorkflowRunEventSink((frame) => frames.push(frame));
  return frames;
}

afterEach(() => __resetWorkflowRunFeedForTests());

describe('a run feed', () => {
  it('tags each fact with the run and its order, and keeps the product off the frame', () => {
    const frames = collect();
    const feed = openWorkflowRunFeed({
      workspaceId: 'ws-1',
      workflowUid: 'wfpins01',
      environmentId: null,
      runId: 'run-1',
    });

    feed(BEGIN);
    feed(settle('login', '{"name":"John Doe"}'));

    expect(frames).toEqual([
      { workspaceId: 'ws-1', workflowUid: 'wfpins01', environmentId: null, runId: 'run-1', seq: 0, fact: BEGIN },
      {
        workspaceId: 'ws-1',
        workflowUid: 'wfpins01',
        environmentId: null,
        runId: 'run-1',
        seq: 1,
        fact: { type: 'step-settle', at: 2, stepId: 'login', settlement: { state: 'skipped' }, hasProduct: true },
      },
    ]);
  });

  it('mints a run id when the caller gave none, one per run', () => {
    const frames = collect();
    const target = { workspaceId: 'ws-1', workflowUid: 'wfpins01', environmentId: null };

    openWorkflowRunFeed(target)(BEGIN);
    openWorkflowRunFeed(target)(BEGIN);

    expect(frames[0].runId).not.toBe('');
    expect(frames[1].runId).not.toBe(frames[0].runId);
  });

  it('holds a product by run and step, with or without a sink', () => {
    const feed = openWorkflowRunFeed({
      workspaceId: 'ws-1',
      workflowUid: 'wfpins01',
      environmentId: null,
      runId: 'r1',
    });

    feed(BEGIN);
    feed(settle('login', 'held'));

    expect(getWorkflowRunProduct('r1', 'login')).toMatchObject({ snapshot: { body: 'held' } });
    expect(getWorkflowRunProduct('r1', 'profile')).toBeNull();
    expect(getWorkflowRunProduct('other', 'login')).toBeNull();
  });

  it("drops a workflow's products when that workflow runs again, and keeps another workflow's", () => {
    const first = openWorkflowRunFeed({
      workspaceId: 'ws-1',
      workflowUid: 'wfone001',
      environmentId: null,
      runId: 'r1',
    });
    first(BEGIN);
    first(settle('login', 'first'));
    const other = openWorkflowRunFeed({
      workspaceId: 'ws-1',
      workflowUid: 'wftwo002',
      environmentId: null,
      runId: 'r2',
    });
    other(BEGIN);
    other(settle('login', 'other'));

    openWorkflowRunFeed({ workspaceId: 'ws-1', workflowUid: 'wfone001', environmentId: null, runId: 'r3' })(BEGIN);

    expect(getWorkflowRunProduct('r1', 'login')).toBeNull();
    expect(getWorkflowRunProduct('r2', 'login')).toMatchObject({ snapshot: { body: 'other' } });
  });

  it('past the budget the oldest run gives its products up, never the one holding', () => {
    const big = 'x'.repeat(20 * 1024 * 1024);
    const oldest = openWorkflowRunFeed({
      workspaceId: 'ws-1',
      workflowUid: 'wfone001',
      environmentId: null,
      runId: 'r1',
    });
    oldest(BEGIN);
    oldest(settle('login', big));
    const newest = openWorkflowRunFeed({
      workspaceId: 'ws-1',
      workflowUid: 'wftwo002',
      environmentId: null,
      runId: 'r2',
    });
    newest(BEGIN);

    newest(settle('login', big));
    newest(settle('profile', big));

    expect(getWorkflowRunProduct('r1', 'login')).toBeNull();
    expect(getWorkflowRunProduct('r2', 'login')).not.toBeNull();
    expect(getWorkflowRunProduct('r2', 'profile')).not.toBeNull();
  });
});
