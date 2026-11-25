/**
 * "Needs update" around the editor (the workflow runs plan, Laws — "A
 * workflow with a step this build does not know is read-only here"):
 * the sidebar row's badge and the footer's lifecycle chip say it where
 * an unfinished workflow reads "incomplete" and "Draft".
 */

import { LiveWorkflowSchema } from '@openheaders/core/schemas';
import { LIVE_WORKFLOW_ENTITY_TYPE } from '@openheaders/core/sync';
import type { LiveWorkflow } from '@openheaders/core/types';
import { ActiveEditorDirtyProvider } from '@openheaders/ui/shared/awareness/ActiveEditorDirty';
import {
  ActiveEditorLifecycleProvider,
  useActiveEditorLifecycle,
} from '@openheaders/ui/shared/awareness/ActiveEditorLifecycle';
import { ActiveFieldFocusProvider } from '@openheaders/ui/shared/awareness/ActiveFieldFocus';
import { ActiveTabEntityProvider, useSetActiveTabEntity } from '@openheaders/ui/shared/awareness/ActiveTabEntity';
import { LifecyclePill, useEditorShell } from '@openheaders/ui/shared/editor-shell';
import { useWorkflowNodes } from '@openheaders/ui/workbench/components/sidebar/useWorkflowNodes';
import { cleanup, render, renderHook, screen } from '@testing-library/react';
import { type ReactNode, useEffect } from 'react';
import * as v from 'valibot';
import { afterEach, describe, expect, it, vi } from 'vitest';

const CALL = { uid: 'stpcall0', id: 'reboot', requestUid: 'httpreq1', captures: [] };
const LISTEN = { uid: 'stplistn', id: 'probe', action: 'watch', session: 'mqttreq1' };

function workflow(steps: unknown[], overrides: Record<string, unknown> = {}): LiveWorkflow {
  return v.parse(LiveWorkflowSchema, {
    schemaVersion: 5,
    uid: 'wfdevice',
    path: 'live-workflows/reboot-wfdevice',
    name: 'Reboot',
    steps,
    refresh: { kind: 'manual' },
    enabled: true,
    published: true,
    ...overrides,
  });
}

afterEach(cleanup);

describe('the sidebar row of a workflow', () => {
  function badgeOf(wf: LiveWorkflow): string {
    const { result } = renderHook(() =>
      useWorkflowNodes({
        liveWorkflows: [wf],
        liveVariables: [],
        liveCaches: {},
        activeEnvironmentId: null,
        filterText: '',
        refreshLiveWorkflow: vi.fn(),
        renameWorkflow: vi.fn(),
        deleteWorkflow: vi.fn(),
        confirmDelete: vi.fn(),
      }),
    );
    const [node] = result.current;
    return render(node.badge).container.textContent ?? '';
  }

  it('reads "needs update" when a step is one this build does not know', () => {
    expect(badgeOf(workflow([LISTEN, CALL]))).toBe('needs update');
  });

  it('keeps that word ahead of draft and off', () => {
    expect(badgeOf(workflow([LISTEN, CALL], { published: false, enabled: false }))).toBe('needs update');
  });

  it('still reads "incomplete" for a workflow whose step has no request yet', () => {
    const unfinished = { ...workflow([CALL]), steps: [{ ...CALL, requestUid: '' }] };
    expect(badgeOf(unfinished)).toBe('incomplete');
  });

  it('carries no badge on a published, enabled workflow it knows whole', () => {
    expect(badgeOf(workflow([CALL]))).toBe('');
  });

  it('can still be renamed and deleted from the row', () => {
    const { result } = renderHook(() =>
      useWorkflowNodes({
        liveWorkflows: [workflow([LISTEN, CALL])],
        liveVariables: [],
        liveCaches: {},
        activeEnvironmentId: null,
        filterText: '',
        refreshLiveWorkflow: vi.fn(),
        renameWorkflow: vi.fn(),
        deleteWorkflow: vi.fn(),
        confirmDelete: vi.fn(),
      }),
    );
    expect(result.current[0]).toMatchObject({ canRename: true, canDelete: true });
  });
});

describe('the lifecycle chip', () => {
  const scope = { entityType: LIVE_WORKFLOW_ENTITY_TYPE, entityId: 'wfdevice' };

  function ActiveTabSeeder(): null {
    const set = useSetActiveTabEntity();
    useEffect(() => {
      set(scope);
    }, [set]);
    return null;
  }

  function Wrapper({ children }: { children: ReactNode }): ReactNode {
    return (
      <ActiveFieldFocusProvider>
        <ActiveTabEntityProvider>
          <ActiveTabSeeder />
          <ActiveEditorDirtyProvider>
            <ActiveEditorLifecycleProvider>{children}</ActiveEditorLifecycleProvider>
          </ActiveEditorDirtyProvider>
        </ActiveTabEntityProvider>
      </ActiveFieldFocusProvider>
    );
  }

  function statusOf(input: { needsUpdate?: boolean; isComplete?: boolean; isPublished?: boolean }) {
    const { result } = renderHook(
      () => {
        useEditorShell({ ...scope, isDirty: false, onSave: () => undefined, ...input });
        return useActiveEditorLifecycle();
      },
      { wrapper: Wrapper },
    );
    return result.current?.status;
  }

  it('is "needs-update" for such a workflow, ahead of the draft it would otherwise read', () => {
    expect(statusOf({ needsUpdate: true, isComplete: false, isPublished: false })).toBe('needs-update');
  });

  it('is unchanged for every other entity', () => {
    expect(statusOf({ isComplete: false })).toBe('draft');
    expect(statusOf({ isComplete: true, isPublished: true })).toBeNull();
  });

  it('reads "Needs update"', () => {
    render(<LifecyclePill status="needs-update" />);
    expect(screen.getByText('Needs update')).toBeTruthy();
  });
});
