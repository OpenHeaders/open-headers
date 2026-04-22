/**
 * LiveWorkflowEditor — tab body for editing one LiveWorkflow.
 *
 * Controlled by a local draft; commits via `updateLiveWorkflow`. Same
 * Phase 10 stale-draft discipline as every other editor: snapshots
 * `version` on first arrival, sends it as `expectedVersion` on save,
 * surfaces `StaleDraftBanner` on rejection.
 *
 * Phase I responsibilities, in addition to existing Phase A editing:
 *   - Runs `validateWorkflowShape` against the draft on every change
 *     so per-step inline errors (cycle, unknown dep, unreachable
 *     gate/priority ref, unknown capture) render without a save attempt.
 *   - Threads dependency-layout metadata (`buildDependencyRows`) into
 *     each step editor for indented-tree visualization.
 *   - Surfaces workflow-level structural errors (no-root-step,
 *     depends-on-cycle) as a dedicated alert near the step list.
 *   - Renders the disabled "Run independent steps in parallel" toggle
 *     per the show-but-disable catalog.
 */

import { InfoCircleOutlined, PlayCircleOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { useEnvironments } from '@hooks/useEnvironments';
import { useLiveWorkflowCache } from '@hooks/useLiveCache';
import { useLiveVariables } from '@hooks/useLiveVariables';
import { useLiveWorkflows } from '@hooks/useLiveWorkflows';
import { useRequests } from '@hooks/useRequests';
import { validateWorkflowShape } from '@openheaders/core/live';
import type { V5 } from '@openheaders/core/types';
import { Alert, App, Button, Input, Space, Switch, Tag, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import StaleDraftBanner from '../StaleDraftBanner';
import { buildDependencyRows } from './dependencies-view';
import { classifyRun, describeRefreshPolicy, formatRelativeMs, pickActiveRun, statusColor } from './live-display';
import RefreshPolicyEditor from './RefreshPolicyEditor';
import WorkflowStepEditor from './WorkflowStepEditor';

const { Text, Title } = Typography;

interface LiveWorkflowEditorProps {
  workflowUid: string;
  onDirtyChange?: (dirty: boolean) => void;
  registerSaveRef?: (save: () => void) => void;
}

interface Draft {
  name: string;
  description: string;
  steps: V5.WorkflowStep[];
  refresh: V5.RefreshPolicy;
  enabled: boolean;
}

function draftFromWorkflow(wf: V5.LiveWorkflow): Draft {
  return {
    name: wf.name,
    description: wf.description ?? '',
    steps: wf.steps,
    refresh: wf.refresh,
    enabled: wf.enabled,
  };
}

function fingerprint(d: Draft): string {
  return JSON.stringify({
    name: d.name,
    description: d.description,
    steps: d.steps,
    refresh: d.refresh,
    enabled: d.enabled,
  });
}

const LiveWorkflowEditor: React.FC<LiveWorkflowEditorProps> = ({ workflowUid, onDirtyChange, registerSaveRef }) => {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const { workflows, updateWorkflow, refreshNow } = useLiveWorkflows();
  const { variables } = useLiveVariables();
  const { requests } = useRequests();
  const { activeEnvironmentId } = useEnvironments();
  const { runs } = useLiveWorkflowCache(workflowUid);

  const workflow = useMemo(() => workflows.find((w) => w.uid === workflowUid) ?? null, [workflows, workflowUid]);
  const boundVars = useMemo(() => variables.filter((v) => v.workflowUid === workflowUid), [variables, workflowUid]);

  const [draft, setDraft] = useState<Draft | null>(() => (workflow ? draftFromWorkflow(workflow) : null));
  // State, not a ref — `isDirty` reads it as a memo dep so save's new
  // baseline invalidates the cached value. Ref version left isDirty
  // stuck at `true` when the parent re-rendered with a fresh inline
  // `onDirtyChange` arrow. Same fix as RequestEditor; the
  // `useDirtyDraft` hook file-header comment documents the trap.
  const [persistedFp, setPersistedFp] = useState<string>(workflow ? fingerprint(draftFromWorkflow(workflow)) : '');

  const [loadedVersion, setLoadedVersion] = useState<number | null>(null);
  const [staleDraft, setStaleDraft] = useState<{ serverVersion: number; loadedVersion: number } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!workflow) return;
    if (draft === null) {
      const seeded = draftFromWorkflow(workflow);
      setDraft(seeded);
      setPersistedFp(fingerprint(seeded));
      return;
    }
    const persisted = draftFromWorkflow(workflow);
    const fp = fingerprint(persisted);
    if (fp !== persistedFp) {
      setPersistedFp(fp);
      setDraft(persisted);
    }
  }, [workflow, draft, persistedFp]);

  useEffect(() => {
    if (loadedVersion !== null) return;
    if (!workflow) return;
    setLoadedVersion(workflow.version);
  }, [workflow, loadedVersion]);

  const isDirty = useMemo(() => (draft ? fingerprint(draft) !== persistedFp : false), [draft, persistedFp]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  // ── Draft-as-workflow for validation + dependency layout ────────
  //
  // `validateWorkflowShape` + `buildDependencyRows` need a complete
  // `LiveWorkflow` shape; our draft drops the fields they don't touch
  // (`uid`, `path`, `schemaVersion`, `version`). We splice them in
  // from the persisted workflow so the validator sees a coherent whole
  // without plumbing a narrower "shape snapshot" type.
  const draftWorkflow: V5.LiveWorkflow | null = useMemo(() => {
    if (!workflow || !draft) return null;
    return {
      ...workflow,
      name: draft.name,
      description: draft.description.trim() ? draft.description : undefined,
      steps: draft.steps,
      refresh: draft.refresh,
      enabled: draft.enabled,
    };
  }, [workflow, draft]);

  const validationErrors = useMemo(() => (draftWorkflow ? validateWorkflowShape(draftWorkflow) : []), [draftWorkflow]);

  const errorsByStepId = useMemo(() => {
    const map = new Map<string, typeof validationErrors>();
    for (const err of validationErrors) {
      if (err.stepId === null) continue;
      const bucket = map.get(err.stepId) ?? [];
      bucket.push(err);
      map.set(err.stepId, bucket);
    }
    return map;
  }, [validationErrors]);

  const workflowLevelErrors = useMemo(() => validationErrors.filter((e) => e.stepId === null), [validationErrors]);

  const dependencyRows = useMemo(() => (draftWorkflow ? buildDependencyRows(draftWorkflow) : []), [draftWorkflow]);

  const capturesByStepId = useMemo(() => {
    const map = new Map<string, string[]>();
    if (!draftWorkflow) return map;
    for (const step of draftWorkflow.steps) {
      map.set(
        step.id,
        step.captures.map((c) => c.name),
      );
    }
    return map;
  }, [draftWorkflow]);

  const handleSave = useCallback(async () => {
    if (!workflow || !draft) return;
    const result = await updateWorkflow(
      workflow.uid,
      {
        name: draft.name,
        description: draft.description.trim() ? draft.description : undefined,
        steps: draft.steps,
        refresh: draft.refresh,
        enabled: draft.enabled,
      },
      loadedVersion ?? undefined,
    );
    if (result.success) {
      setPersistedFp(fingerprint(draft));
      setLoadedVersion(result.version);
      setStaleDraft(null);
      onDirtyChange?.(false);
      return;
    }
    if (result.reason === 'stale-draft') {
      setStaleDraft({ serverVersion: result.serverVersion, loadedVersion: loadedVersion ?? 0 });
      return;
    }
    if (result.reason === 'not-found') {
      message.error('Workflow was deleted from another tab');
      return;
    }
    message.error('Failed to save workflow');
  }, [workflow, draft, updateWorkflow, loadedVersion, onDirtyChange, message]);

  const handleSaveSync = useCallback(() => void handleSave(), [handleSave]);
  useEffect(() => {
    registerSaveRef?.(handleSaveSync);
  }, [registerSaveRef, handleSaveSync]);

  const handleStaleReload = useCallback(() => {
    if (!workflow) return;
    const seeded = draftFromWorkflow(workflow);
    setPersistedFp(fingerprint(seeded));
    setDraft(seeded);
    setLoadedVersion(workflow.version);
    setStaleDraft(null);
    onDirtyChange?.(false);
  }, [workflow, onDirtyChange]);

  const handleStaleKeepEditing = useCallback(() => {
    if (!workflow) return;
    setLoadedVersion(workflow.version);
    setStaleDraft(null);
  }, [workflow]);

  const handleRefreshNow = useCallback(async () => {
    if (!workflow) return;
    setRefreshing(true);
    const resp = await refreshNow(workflow.uid, activeEnvironmentId);
    setRefreshing(false);
    if (!resp.success) {
      message.error(`Refresh failed: ${resp.error ?? 'unknown error'}`);
    } else {
      message.success('Refreshed');
    }
  }, [workflow, refreshNow, activeEnvironmentId, message]);

  const availableCaptures = useMemo(() => {
    if (!draft) return [];
    return draft.steps.flatMap((s) =>
      s.captures.map((c) => ({ stepId: s.id, captureName: c.name, label: `${s.id}.${c.name}` })),
    );
  }, [draft]);

  const availableRequests = useMemo(
    () => requests.map((r) => ({ uid: r.uid, name: r.name, method: r.method })),
    [requests],
  );

  const run = useMemo(() => pickActiveRun(runs, activeEnvironmentId ?? null), [runs, activeEnvironmentId]);
  const level = classifyRun(run);

  const updateStep = (idx: number, next: V5.WorkflowStep) => {
    if (!draft) return;
    const nextSteps = draft.steps.slice();
    nextSteps[idx] = next;
    setDraft({ ...draft, steps: nextSteps });
  };

  const addStep = () => {
    if (!draft) return;
    const existingIds = new Set(draft.steps.map((s) => s.id));
    let candidate = `step${draft.steps.length + 1}`;
    let n = draft.steps.length + 1;
    while (existingIds.has(candidate)) {
      n += 1;
      candidate = `step${n}`;
    }
    const next: V5.WorkflowStep = {
      id: candidate,
      requestUid: '',
      captures: [],
    };
    setDraft({ ...draft, steps: [...draft.steps, next] });
  };

  const removeStep = (idx: number) => {
    if (!draft || draft.steps.length <= 1) return;
    setDraft({ ...draft, steps: draft.steps.filter((_, i) => i !== idx) });
  };

  const moveStep = (idx: number, delta: -1 | 1) => {
    if (!draft) return;
    const target = idx + delta;
    if (target < 0 || target >= draft.steps.length) return;
    const next = draft.steps.slice();
    [next[idx], next[target]] = [next[target], next[idx]];
    setDraft({ ...draft, steps: next });
  };

  if (!workflow) {
    return (
      <div style={{ padding: 24, background: token.colorBgContainer }}>
        <Text type="secondary">Workflow not found.</Text>
      </div>
    );
  }

  if (!draft) return null;

  return (
    <div style={{ padding: 24, background: token.colorBgContainer, overflow: 'auto', height: '100%' }}>
      <div style={{ maxWidth: 920, margin: '0 auto' }}>
        {staleDraft && (
          <StaleDraftBanner
            entityLabel="workflow"
            serverVersion={staleDraft.serverVersion}
            loadedVersion={staleDraft.loadedVersion}
            onReload={handleStaleReload}
            onKeepEditing={handleStaleKeepEditing}
          />
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <PlayCircleOutlined style={{ fontSize: 18, color: token.colorPrimary }} />
          <Title level={4} style={{ margin: 0 }}>
            {workflow.name}
          </Title>
          <Tag color="blue">Workflow</Tag>
          <div style={{ flex: 1 }} />
          <Button icon={<ReloadOutlined spin={refreshing} />} onClick={() => void handleRefreshNow()}>
            Refresh now
          </Button>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 16,
            padding: 10,
            background: token.colorFillAlter,
            borderRadius: 6,
            marginBottom: 16,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: statusColor(level),
                display: 'inline-block',
              }}
            />
            <Text type="secondary" style={{ fontSize: 11 }}>
              {level === 'idle' ? 'never refreshed' : level}
            </Text>
          </div>
          <Text type="secondary" style={{ fontSize: 11 }}>
            last: {run ? formatRelativeMs(run.extractedAt) : 'never'}
          </Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            expires: {run?.expiresAt ? formatRelativeMs(run.expiresAt) : '—'}
          </Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {describeRefreshPolicy(draft.refresh)}
          </Text>
          {run?.lastErrorMessage && (
            <Text type="danger" style={{ fontSize: 11 }}>
              error: {run.lastErrorMessage}
              {run.lastErrorStepId ? ` (${run.lastErrorStepId})` : ''}
            </Text>
          )}
          <div style={{ flex: 1 }} />
          <Text type="secondary" style={{ fontSize: 11 }}>
            bound: {boundVars.length} variable{boundVars.length === 1 ? '' : 's'}
          </Text>
        </div>

        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <div>
            <Text type="secondary" style={{ fontSize: 11 }}>
              NAME
            </Text>
            <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </div>
          <div>
            <Text type="secondary" style={{ fontSize: 11 }}>
              DESCRIPTION
            </Text>
            <Input.TextArea
              autoSize={{ minRows: 1, maxRows: 4 }}
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Switch
              aria-label="Workflow enabled"
              checked={draft.enabled}
              onChange={(enabled) => setDraft({ ...draft, enabled })}
            />
            <Text>{draft.enabled ? 'Enabled' : 'Disabled'}</Text>
            <Text type="secondary" style={{ fontSize: 11 }}>
              — disabled workflows skip the refresh scheduler entirely.
            </Text>
            <div style={{ flex: 1 }} />
            <Tooltip title="Sequential only in v1. Parallel execution coming in a future release.">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  opacity: 0.6,
                  cursor: 'not-allowed',
                }}
              >
                <Switch aria-label="Run independent steps in parallel" size="small" checked={false} disabled />
                <Text type="secondary" style={{ fontSize: 11 }}>
                  Run independent steps in parallel
                </Text>
                <InfoCircleOutlined style={{ fontSize: 11, color: token.colorTextTertiary }} />
              </div>
            </Tooltip>
          </div>

          {workflowLevelErrors.length > 0 && (
            <Alert
              type="error"
              showIcon
              message="Workflow has structural issues"
              description={
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {workflowLevelErrors.map((err) => (
                    <li key={`${err.issue}:${err.stepId ?? ''}:${err.referencedStepId ?? ''}`} style={{ fontSize: 12 }}>
                      {err.message}
                    </li>
                  ))}
                </ul>
              }
            />
          )}

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <Text type="secondary" style={{ fontSize: 11 }}>
                STEPS ({draft.steps.length})
              </Text>
              <Button size="small" icon={<PlusOutlined />} onClick={addStep}>
                Step
              </Button>
            </div>
            {draft.steps.map((step, idx) => {
              const row = dependencyRows[idx];
              // Other step ids for the dependsOn multi-select — excluding
              // self (a step can't depend on itself; validator would flag).
              const allStepIds = draft.steps
                .filter((s) => s.id !== step.id && s.id.length > 0)
                .map((s) => ({ id: s.id, label: s.id }));
              // Reachable ancestors — only these can be referenced from
              // runIf / priorityFrom. The transitive set is computed by
              // `buildDependencyRows` via the core validator's helper.
              const reachableSteps = Array.from(row?.reachable ?? []).map((id) => ({ id, label: id }));
              const stepErrors = errorsByStepId.get(step.id) ?? [];
              return (
                <WorkflowStepEditor
                  key={step.id || `step-${idx}`}
                  step={step}
                  index={idx}
                  totalSteps={draft.steps.length}
                  availableRequests={availableRequests}
                  onChange={(next) => updateStep(idx, next)}
                  onRemove={() => removeStep(idx)}
                  onMoveUp={() => moveStep(idx, -1)}
                  onMoveDown={() => moveStep(idx, 1)}
                  allStepIds={allStepIds}
                  reachableSteps={reachableSteps}
                  capturesByStepId={capturesByStepId}
                  errors={stepErrors}
                  dependencyRow={row}
                />
              );
            })}
          </div>

          <div>
            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 6 }}>
              REFRESH POLICY
            </Text>
            <RefreshPolicyEditor
              value={draft.refresh}
              onChange={(refresh) => setDraft({ ...draft, refresh })}
              availableCaptures={availableCaptures}
            />
          </div>
        </Space>
      </div>
    </div>
  );
};

export default LiveWorkflowEditor;
