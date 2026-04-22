/**
 * LiveVariableEditor — tab body for editing one LiveVariable OR
 * creating a new one.
 *
 * The LV is a thin namespace projection (`{{live.<name>}}` →
 * `workflow.<stepId>.<captureName>`), so this editor owns the binding
 * form. Create mode supports three source shapes:
 *   - Single request  — seed a 1-step workflow from a request + one capture.
 *   - New workflow    — create an empty workflow and open its editor.
 *   - Existing bind   — point at an existing workflow's step capture.
 *
 * Edit mode is the rebind-or-tweak surface: change the LV's name,
 * point it at a different (step, capture) inside the same or a
 * different workflow, toggle `requireFreshOnRuleBuild`, set a manual
 * override.
 *
 * Phase 10 stale-draft discipline matches every other editor tab.
 */

import { EyeInvisibleOutlined, EyeOutlined, ReloadOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useEnvironments } from '@hooks/useEnvironments';
import { useLiveWorkflowCache } from '@hooks/useLiveCache';
import { useLiveVariables } from '@hooks/useLiveVariables';
import { useLiveWorkflows } from '@hooks/useLiveWorkflows';
import { useRequests } from '@hooks/useRequests';
import type { V5 } from '@openheaders/core/types';
import { App, Button, Input, InputNumber, Radio, Select, Switch, Tag, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import StaleDraftBanner from '../StaleDraftBanner';
import ExtractorEditor, { defaultExtractorFor } from './ExtractorEditor';
import {
  classifyRun,
  describeRefreshPolicy,
  formatRelativeMs,
  pickActiveRun,
  readCapture,
  statusColor,
} from './live-display';
import RefreshPolicyEditor from './RefreshPolicyEditor';

const { Text, Title } = Typography;

// ── Shared compact layout primitives ───────────────────────────────
//
// Label-left two-column grid; single source of truth for row rhythm
// so Create + Edit stay visually aligned and tight. The label column
// is fixed width so every input starts on the same vertical rule —
// cheaper to scan than stacked CAPS labels above full-width fields.

const ROW_LABEL_WIDTH = 108;
const ROW_GAP = 12;

const FieldRow: React.FC<{
  label: string;
  /** Tiny text shown under the label — e.g. reference syntax hint. */
  hint?: React.ReactNode;
  /** Vertically center the input against the label (default). Set to
   *  `false` when the input is multi-line and should start-align. */
  center?: boolean;
  children: React.ReactNode;
}> = ({ label, hint, center = true, children }) => {
  const { token } = theme.useToken();
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `${ROW_LABEL_WIDTH}px 1fr`,
        gap: ROW_GAP,
        alignItems: center ? 'center' : 'start',
        minHeight: 28,
      }}
    >
      <div style={{ paddingTop: center ? 0 : 6 }}>
        <Text style={{ fontSize: 12 }}>{label}</Text>
        {hint && (
          <div style={{ fontSize: 10, color: token.colorTextTertiary, lineHeight: 1.3, marginTop: 1 }}>{hint}</div>
        )}
      </div>
      <div style={{ minWidth: 0 }}>{children}</div>
    </div>
  );
};

/** Section group — a titled rule with a labelled child stack. Replaces
 *  the prior bordered boxes; the title sits inline with a thin bottom
 *  divider instead of a full 1px border, which cuts ~12px padding and
 *  still visually groups the rows. */
const Section: React.FC<{ title: React.ReactNode; children: React.ReactNode }> = ({ title, children }) => {
  const { token } = theme.useToken();
  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          paddingBottom: 6,
          marginBottom: 8,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          fontSize: 11,
          fontWeight: 500,
          color: token.colorTextSecondary,
          textTransform: 'uppercase',
          letterSpacing: 0.4,
        }}
      >
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
    </div>
  );
};

// ── Create mode ─────────────────────────────────────────────────────

interface CreateProps {
  mode: 'create';
  seedRequestUid?: string;
  onDirtyChange?: (dirty: boolean) => void;
  registerSaveRef?: (save: () => void) => void;
  /** Called when a new LV lands — host replaces the create tab with an edit tab. */
  onCreated: (lv: V5.LiveVariable) => void;
  /** Host-supplied way to open the workflow editor after a "New workflow" seed. */
  openWorkflowTab?: (uid: string, name: string) => void;
}

interface EditProps {
  mode: 'edit';
  variableUid: string;
  onDirtyChange?: (dirty: boolean) => void;
  registerSaveRef?: (save: () => void) => void;
  /** For the "Open workflow" link. */
  openWorkflowTab?: (uid: string, name: string) => void;
}

type Props = CreateProps | EditProps;

type SourceMode = 'single-request' | 'new-workflow' | 'bind-existing';

interface CreateDraft {
  name: string;
  description: string;
  enabled: boolean;
  requireFreshOnRuleBuild: boolean;
  source: SourceMode;
  // single-request shape
  singleRequestUid: string;
  singleExtractor: V5.Extractor;
  singleRefresh: V5.RefreshPolicy;
  // new-workflow shape
  newWorkflowName: string;
  // bind-existing shape
  bindWorkflowUid: string;
  bindStepId: string;
  bindCaptureName: string;
}

function emptyCreateDraft(seedRequestUid?: string): CreateDraft {
  return {
    name: '',
    description: '',
    enabled: true,
    requireFreshOnRuleBuild: false,
    source: seedRequestUid ? 'single-request' : 'bind-existing',
    singleRequestUid: seedRequestUid ?? '',
    singleExtractor: defaultExtractorFor('json-path'),
    singleRefresh: { kind: 'manual' },
    newWorkflowName: '',
    bindWorkflowUid: '',
    bindStepId: '',
    bindCaptureName: '',
  };
}

// ── Edit mode ───────────────────────────────────────────────────────

interface EditDraft {
  name: string;
  description: string;
  enabled: boolean;
  requireFreshOnRuleBuild: boolean;
  workflowUid: string;
  stepId: string;
  captureName: string;
  manualOverride: { value: string; until: number | null } | null;
}

function editDraftFromVariable(lv: V5.LiveVariable): EditDraft {
  return {
    name: lv.name,
    description: lv.description ?? '',
    enabled: lv.enabled,
    requireFreshOnRuleBuild: Boolean(lv.requireFreshOnRuleBuild),
    workflowUid: lv.workflowUid,
    stepId: lv.stepId,
    captureName: lv.captureName,
    manualOverride: lv.manualOverride
      ? {
          value: lv.manualOverride.value,
          until: typeof lv.manualOverride.until === 'number' ? lv.manualOverride.until : null,
        }
      : null,
  };
}

function fingerprintEdit(d: EditDraft): string {
  return JSON.stringify(d);
}

// ── Unified component ───────────────────────────────────────────────

const LiveVariableEditor: React.FC<Props> = (props) => {
  if (props.mode === 'edit') return <EditMode {...props} />;
  return <CreateMode {...props} />;
};

export default LiveVariableEditor;

// ── Create mode ─────────────────────────────────────────────────────

const CreateMode: React.FC<CreateProps> = ({
  seedRequestUid,
  onDirtyChange,
  registerSaveRef,
  onCreated,
  openWorkflowTab,
}) => {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const { workflows, createWorkflow } = useLiveWorkflows();
  const { createVariable } = useLiveVariables();
  const { requests } = useRequests();

  const [draft, setDraft] = useState<CreateDraft>(() => emptyCreateDraft(seedRequestUid));

  const isDirty = useMemo(() => {
    return (
      draft.name.trim().length > 0 ||
      draft.description.trim().length > 0 ||
      draft.source !== (seedRequestUid ? 'single-request' : 'bind-existing') ||
      draft.singleRequestUid !== (seedRequestUid ?? '') ||
      draft.bindWorkflowUid !== '' ||
      draft.bindCaptureName !== '' ||
      draft.newWorkflowName !== ''
    );
  }, [draft, seedRequestUid]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const handleSave = useCallback(async () => {
    const name = draft.name.trim();
    if (!name) {
      message.error('Name is required');
      return;
    }

    if (draft.source === 'single-request') {
      if (!draft.singleRequestUid) {
        message.error('Pick a request first');
        return;
      }
      const captureName = name; // reuse the LV name as the capture name
      const wf = await createWorkflow({
        name: `${name} source`,
        steps: [
          {
            id: 'step1',
            requestUid: draft.singleRequestUid,
            captures: [{ name: captureName, extractor: draft.singleExtractor }],
          },
        ],
        refresh: draft.singleRefresh,
        enabled: true,
      });
      if (!wf) {
        message.error('Failed to create workflow');
        return;
      }
      const lv = await createVariable({
        name,
        workflowUid: wf.uid,
        stepId: 'step1',
        captureName,
        description: draft.description.trim() ? draft.description : undefined,
        requireFreshOnRuleBuild: draft.requireFreshOnRuleBuild,
        enabled: draft.enabled,
      });
      if (!lv) {
        message.error('Failed to create live variable');
        return;
      }
      onCreated(lv);
      return;
    }

    if (draft.source === 'new-workflow') {
      const workflowName = draft.newWorkflowName.trim() || `${name} workflow`;
      const wf = await createWorkflow({ name: workflowName, enabled: true });
      if (!wf) {
        message.error('Failed to create workflow');
        return;
      }
      // Open the workflow editor so the user can add steps + captures; no LV
      // is created yet — the user binds after the workflow has captures.
      message.info('Workflow created — add steps + a capture, then re-open the LV editor to bind.');
      openWorkflowTab?.(wf.uid, wf.name);
      return;
    }

    // bind-existing
    if (!draft.bindWorkflowUid || !draft.bindStepId || !draft.bindCaptureName) {
      message.error('Select a workflow, step, and capture');
      return;
    }
    const lv = await createVariable({
      name,
      workflowUid: draft.bindWorkflowUid,
      stepId: draft.bindStepId,
      captureName: draft.bindCaptureName,
      description: draft.description.trim() ? draft.description : undefined,
      requireFreshOnRuleBuild: draft.requireFreshOnRuleBuild,
      enabled: draft.enabled,
    });
    if (!lv) {
      message.error('Failed to create live variable');
      return;
    }
    onCreated(lv);
  }, [draft, createWorkflow, createVariable, message, onCreated, openWorkflowTab]);

  const handleSaveSync = useCallback(() => void handleSave(), [handleSave]);
  useEffect(() => {
    registerSaveRef?.(handleSaveSync);
  }, [registerSaveRef, handleSaveSync]);

  const availableRequests = useMemo(
    () => requests.map((r) => ({ uid: r.uid, name: r.name, method: r.method })),
    [requests],
  );

  const bindWorkflow = workflows.find((w) => w.uid === draft.bindWorkflowUid) ?? null;
  const bindSteps = bindWorkflow?.steps ?? [];
  const bindStep = bindSteps.find((s) => s.id === draft.bindStepId) ?? null;
  const bindCaptures = bindStep?.captures ?? [];

  return (
    <div style={{ padding: '16px 20px', background: token.colorBgContainer, overflow: 'auto', height: '100%' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <ThunderboltOutlined style={{ fontSize: 14, color: token.colorPrimary }} />
          <Title level={5} style={{ margin: 0 }}>
            New Source
          </Title>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <FieldRow
            label="Name"
            hint={
              <>
                Reference as {'{{'}live.NAME{'}}'}
              </>
            }
          >
            <Input
              size="small"
              placeholder="e.g. accessToken"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </FieldRow>

          <FieldRow label="Description" center={false}>
            <Input.TextArea
              size="small"
              autoSize={{ minRows: 1, maxRows: 3 }}
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </FieldRow>

          <FieldRow label="Source">
            <Radio.Group
              size="small"
              value={draft.source}
              onChange={(e) => setDraft({ ...draft, source: e.target.value as SourceMode })}
              optionType="button"
              buttonStyle="solid"
              options={[
                { value: 'single-request', label: 'Single request' },
                { value: 'new-workflow', label: 'New workflow' },
                { value: 'bind-existing', label: 'Bind existing' },
              ]}
            />
          </FieldRow>

          {draft.source === 'single-request' && (
            <>
              <FieldRow label="Request">
                <Select
                  size="small"
                  style={{ width: '100%' }}
                  showSearch
                  optionFilterProp="label"
                  placeholder="Select a request"
                  value={draft.singleRequestUid || undefined}
                  onChange={(singleRequestUid) => setDraft({ ...draft, singleRequestUid })}
                  options={availableRequests.map((r) => ({
                    value: r.uid,
                    label: `${r.method} ${r.name}`,
                  }))}
                />
              </FieldRow>
              <FieldRow label="Extractor" center={false}>
                <ExtractorEditor
                  compact
                  value={draft.singleExtractor}
                  onChange={(singleExtractor) => setDraft({ ...draft, singleExtractor })}
                />
              </FieldRow>
              <FieldRow label="Refresh" center={false}>
                <RefreshPolicyEditor
                  value={draft.singleRefresh}
                  onChange={(singleRefresh) => setDraft({ ...draft, singleRefresh })}
                  availableCaptures={[
                    {
                      stepId: 'step1',
                      captureName: draft.name || 'capture1',
                      label: `step1.${draft.name || 'capture1'}`,
                    },
                  ]}
                />
              </FieldRow>
              <div style={{ paddingLeft: ROW_LABEL_WIDTH + ROW_GAP }}>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  A 1-step workflow is created behind the scenes — edit it later via the sidebar.
                </Text>
              </div>
            </>
          )}

          {draft.source === 'new-workflow' && (
            <>
              <FieldRow label="Workflow name">
                <Input
                  size="small"
                  placeholder="e.g. auth-chain"
                  value={draft.newWorkflowName}
                  onChange={(e) => setDraft({ ...draft, newWorkflowName: e.target.value })}
                />
              </FieldRow>
              <div style={{ paddingLeft: ROW_LABEL_WIDTH + ROW_GAP }}>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  Creates an empty workflow and opens its editor. Add steps + captures, then re-open this editor with
                  "Bind existing" to finish the binding.
                </Text>
              </div>
            </>
          )}

          {draft.source === 'bind-existing' && (
            <>
              <FieldRow label="Workflow">
                <Select
                  size="small"
                  style={{ width: '100%' }}
                  showSearch
                  optionFilterProp="label"
                  placeholder="Select a workflow"
                  value={draft.bindWorkflowUid || undefined}
                  onChange={(bindWorkflowUid) =>
                    setDraft({ ...draft, bindWorkflowUid, bindStepId: '', bindCaptureName: '' })
                  }
                  options={workflows.map((w) => ({ value: w.uid, label: w.name }))}
                  notFoundContent={<Text type="secondary">No workflows yet.</Text>}
                />
              </FieldRow>
              <FieldRow label="Step">
                <Select
                  size="small"
                  style={{ width: '100%' }}
                  placeholder="Select a step"
                  disabled={!bindWorkflow}
                  value={draft.bindStepId || undefined}
                  onChange={(bindStepId) => setDraft({ ...draft, bindStepId, bindCaptureName: '' })}
                  options={bindSteps.map((s) => ({ value: s.id, label: `${s.id} (${s.captures.length} captures)` }))}
                />
              </FieldRow>
              <FieldRow label="Capture">
                <Select
                  size="small"
                  style={{ width: '100%' }}
                  placeholder="Select a capture"
                  disabled={!bindStep}
                  value={draft.bindCaptureName || undefined}
                  onChange={(bindCaptureName) => setDraft({ ...draft, bindCaptureName })}
                  options={bindCaptures.map((c) => ({
                    value: c.name,
                    label: `${c.name} — ${c.extractor.kind}`,
                  }))}
                />
              </FieldRow>
            </>
          )}

          <div
            style={{
              display: 'flex',
              gap: 20,
              alignItems: 'center',
              flexWrap: 'wrap',
              marginTop: 6,
              paddingTop: 10,
              borderTop: `1px solid ${token.colorBorderSecondary}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Switch size="small" checked={draft.enabled} onChange={(enabled) => setDraft({ ...draft, enabled })} />
              <Text style={{ fontSize: 12 }}>Enabled</Text>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Switch
                size="small"
                checked={draft.requireFreshOnRuleBuild}
                onChange={(requireFreshOnRuleBuild) => setDraft({ ...draft, requireFreshOnRuleBuild })}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                Sync-warm
              </Text>
            </div>
            <div style={{ flex: 1 }} />
            <Button type="primary" size="small" onClick={() => void handleSave()} disabled={!draft.name.trim()}>
              Create Source
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Edit mode ───────────────────────────────────────────────────────

const EditMode: React.FC<EditProps> = ({ variableUid, onDirtyChange, registerSaveRef, openWorkflowTab }) => {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const { variables, updateVariable, setOverride } = useLiveVariables();
  const { workflows, refreshNow } = useLiveWorkflows();
  const { activeEnvironmentId } = useEnvironments();

  const lv = useMemo(() => variables.find((v) => v.uid === variableUid) ?? null, [variables, variableUid]);
  const workflow = useMemo(
    () => (lv ? (workflows.find((w) => w.uid === lv.workflowUid) ?? null) : null),
    [workflows, lv],
  );
  const { runs } = useLiveWorkflowCache(lv?.workflowUid);

  const [draft, setDraft] = useState<EditDraft | null>(() => (lv ? editDraftFromVariable(lv) : null));
  // State, not a ref — `isDirty` reads it as a memo dep so save's new
  // baseline invalidates the cached value. Ref version left `isDirty`
  // stuck at `true` when the parent re-rendered with a fresh inline
  // `onDirtyChange` arrow. Same fix as RequestEditor; the
  // `useDirtyDraft` hook file-header comment documents the trap.
  const [persistedFp, setPersistedFp] = useState<string>(lv ? fingerprintEdit(editDraftFromVariable(lv)) : '');

  const [loadedVersion, setLoadedVersion] = useState<number | null>(null);
  const [staleDraft, setStaleDraft] = useState<{ serverVersion: number; loadedVersion: number } | null>(null);
  const [revealValue, setRevealValue] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!lv) return;
    if (draft === null) {
      const seeded = editDraftFromVariable(lv);
      setDraft(seeded);
      setPersistedFp(fingerprintEdit(seeded));
      return;
    }
    const persisted = editDraftFromVariable(lv);
    const fp = fingerprintEdit(persisted);
    if (fp !== persistedFp) {
      setPersistedFp(fp);
      setDraft(persisted);
    }
  }, [lv, draft, persistedFp]);

  useEffect(() => {
    if (loadedVersion !== null) return;
    if (!lv) return;
    setLoadedVersion(lv.version);
  }, [lv, loadedVersion]);

  const isDirty = useMemo(() => (draft ? fingerprintEdit(draft) !== persistedFp : false), [draft, persistedFp]);
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const handleSave = useCallback(async () => {
    if (!lv || !draft) return;
    const result = await updateVariable(
      lv.uid,
      {
        name: draft.name,
        description: draft.description.trim() ? draft.description : undefined,
        enabled: draft.enabled,
        requireFreshOnRuleBuild: draft.requireFreshOnRuleBuild,
        workflowUid: draft.workflowUid,
        stepId: draft.stepId,
        captureName: draft.captureName,
      },
      loadedVersion ?? undefined,
    );
    if (result.success) {
      setPersistedFp(fingerprintEdit(draft));
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
      message.error('Source was deleted from another tab');
      return;
    }
    message.error('Failed to save live variable');
  }, [lv, draft, updateVariable, loadedVersion, onDirtyChange, message]);

  const handleSaveSync = useCallback(() => void handleSave(), [handleSave]);
  useEffect(() => {
    registerSaveRef?.(handleSaveSync);
  }, [registerSaveRef, handleSaveSync]);

  const handleStaleReload = useCallback(() => {
    if (!lv) return;
    const seeded = editDraftFromVariable(lv);
    setPersistedFp(fingerprintEdit(seeded));
    setDraft(seeded);
    setLoadedVersion(lv.version);
    setStaleDraft(null);
    onDirtyChange?.(false);
  }, [lv, onDirtyChange]);

  const handleStaleKeepEditing = useCallback(() => {
    if (!lv) return;
    setLoadedVersion(lv.version);
    setStaleDraft(null);
  }, [lv]);

  const handleRefreshNow = useCallback(async () => {
    if (!lv) return;
    setRefreshing(true);
    const resp = await refreshNow(lv.workflowUid, activeEnvironmentId);
    setRefreshing(false);
    if (!resp.success) message.error(`Refresh failed: ${resp.error ?? 'unknown error'}`);
    else message.success('Refreshed');
  }, [lv, refreshNow, activeEnvironmentId, message]);

  const handleSetOverride = useCallback(
    async (override: { value: string; until: number | null } | null) => {
      if (!lv) return;
      const payload = override ? { value: override.value, until: override.until ?? undefined } : null;
      const resp = await setOverride(lv.uid, payload, loadedVersion ?? undefined);
      if (!resp.success) {
        message.error(
          resp.reason === 'stale-draft' ? 'Override save collided with another tab.' : 'Override save failed.',
        );
        return;
      }
      // Override bumps the LV's version; track it so a follow-up
      // updateVariable doesn't hit stale-draft rejection.
      setLoadedVersion(resp.version);
      message.success(override ? 'Override applied' : 'Override cleared');
    },
    [lv, setOverride, loadedVersion, message],
  );

  if (!lv) {
    return (
      <div style={{ padding: 24, background: token.colorBgContainer }}>
        <Text type="secondary">Source not found.</Text>
      </div>
    );
  }
  if (!draft) return null;

  const selectedWorkflow = workflows.find((w) => w.uid === draft.workflowUid) ?? null;
  const selectedStep = selectedWorkflow?.steps.find((s) => s.id === draft.stepId) ?? null;
  const selectedCaptures = selectedStep?.captures ?? [];

  const run = pickActiveRun(runs, activeEnvironmentId ?? null);
  const liveValue = run ? readCapture(run, lv.stepId, lv.captureName) : null;
  const level = classifyRun(run);

  return (
    <div style={{ padding: '16px 20px', background: token.colorBgContainer, overflow: 'auto', height: '100%' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        {staleDraft && (
          <StaleDraftBanner
            entityLabel="live variable"
            serverVersion={staleDraft.serverVersion}
            loadedVersion={staleDraft.loadedVersion}
            onReload={handleStaleReload}
            onKeepEditing={handleStaleKeepEditing}
          />
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: statusColor(level),
              display: 'inline-block',
            }}
          />
          <Title level={5} style={{ margin: 0, fontFamily: "'SF Mono', monospace" }}>
            {`{{live.${lv.name}}}`}
          </Title>
          <Tag color="purple" style={{ marginInlineEnd: 0 }}>
            Live
          </Tag>
          {!draft.enabled && <Tag style={{ marginInlineEnd: 0 }}>Disabled</Tag>}
          {lv.manualOverride && (
            <Tag color="orange" style={{ marginInlineEnd: 0 }}>
              override
            </Tag>
          )}
          <div style={{ flex: 1 }} />
          <Button size="small" icon={<ReloadOutlined spin={refreshing} />} onClick={() => void handleRefreshNow()}>
            Refresh
          </Button>
        </div>

        {/* Current value — single compact row */}
        <div
          style={{
            display: 'flex',
            gap: 10,
            padding: '6px 10px',
            background: token.colorFillAlter,
            borderRadius: 4,
            marginBottom: 14,
            alignItems: 'center',
            flexWrap: 'wrap',
            fontSize: 11,
          }}
        >
          <Text type="secondary" style={{ fontSize: 11 }}>
            Value
          </Text>
          <Text
            style={{
              fontFamily: "'SF Mono', monospace",
              fontSize: 12,
              wordBreak: 'break-all',
              maxWidth: 320,
            }}
          >
            {liveValue === null ? (
              <Text type="secondary">(never refreshed)</Text>
            ) : revealValue ? (
              liveValue
            ) : (
              '••••••••'
            )}
          </Text>
          {liveValue !== null && (
            <Button
              size="small"
              type="text"
              icon={revealValue ? <EyeInvisibleOutlined /> : <EyeOutlined />}
              onClick={() => setRevealValue((r) => !r)}
            />
          )}
          <div style={{ flex: 1 }} />
          <Text type="secondary" style={{ fontSize: 11 }}>
            last {run ? formatRelativeMs(run.extractedAt) : 'never'}
          </Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            · expires {run?.expiresAt ? formatRelativeMs(run.expiresAt) : '—'}
          </Text>
          {run?.lastErrorMessage && (
            <Text type="danger" style={{ fontSize: 11 }}>
              · {run.lastErrorMessage}
              {run.lastErrorStepId ? ` (${run.lastErrorStepId})` : ''}
            </Text>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <FieldRow
            label="Name"
            hint={
              <>
                Reference as {'{{'}live.NAME{'}}'}
              </>
            }
          >
            <Input size="small" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </FieldRow>

          <FieldRow label="Description" center={false}>
            <Input.TextArea
              size="small"
              autoSize={{ minRows: 1, maxRows: 3 }}
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </FieldRow>

          <Section
            title={
              <>
                <span style={{ flex: 1 }}>Binding</span>
                {workflow && (
                  <>
                    <Text type="secondary" style={{ fontSize: 10, textTransform: 'none', letterSpacing: 0 }}>
                      {describeRefreshPolicy(workflow.refresh)}
                    </Text>
                    {openWorkflowTab && (
                      <Button
                        size="small"
                        type="link"
                        style={{ padding: 0, fontSize: 11, height: 'auto' }}
                        onClick={() => openWorkflowTab(workflow.uid, workflow.name)}
                      >
                        Open flow
                      </Button>
                    )}
                  </>
                )}
              </>
            }
          >
            <FieldRow label="Workflow">
              <Select
                size="small"
                style={{ width: '100%' }}
                value={draft.workflowUid || undefined}
                onChange={(workflowUid) => setDraft({ ...draft, workflowUid, stepId: '', captureName: '' })}
                options={workflows.map((w) => ({ value: w.uid, label: w.name }))}
                placeholder="Select a workflow"
              />
            </FieldRow>
            <FieldRow label="Step">
              <Select
                size="small"
                style={{ width: '100%' }}
                value={draft.stepId || undefined}
                onChange={(stepId) => setDraft({ ...draft, stepId, captureName: '' })}
                options={(selectedWorkflow?.steps ?? []).map((s) => ({
                  value: s.id,
                  label: `${s.id} (${s.captures.length} captures)`,
                }))}
                placeholder="Select a step"
                disabled={!selectedWorkflow}
              />
            </FieldRow>
            <FieldRow label="Capture">
              <Select
                size="small"
                style={{ width: '100%' }}
                value={draft.captureName || undefined}
                onChange={(captureName) => setDraft({ ...draft, captureName })}
                options={selectedCaptures.map((c) => ({
                  value: c.name,
                  label: `${c.name} — ${c.extractor.kind}`,
                }))}
                placeholder="Select a capture"
                disabled={!selectedStep}
              />
            </FieldRow>
          </Section>

          <Section title="Manual override">
            {draft.manualOverride ? (
              <>
                <FieldRow label="Value">
                  <Input
                    size="small"
                    value={draft.manualOverride.value}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        manualOverride: { ...draft.manualOverride!, value: e.target.value },
                      })
                    }
                    placeholder="Fixed override value"
                  />
                </FieldRow>
                <FieldRow label="Expires (ms)" hint="Wall-clock epoch ms — leave blank for permanent override">
                  <InputNumber
                    size="small"
                    style={{ width: 220 }}
                    value={draft.manualOverride.until ?? null}
                    onChange={(until) =>
                      setDraft({
                        ...draft,
                        manualOverride: {
                          ...draft.manualOverride!,
                          until: typeof until === 'number' ? until : null,
                        },
                      })
                    }
                  />
                </FieldRow>
                <div style={{ paddingLeft: ROW_LABEL_WIDTH + ROW_GAP, display: 'flex', gap: 8 }}>
                  <Button size="small" onClick={() => void handleSetOverride(draft.manualOverride)}>
                    Apply override
                  </Button>
                  <Button
                    size="small"
                    danger
                    onClick={() => {
                      setDraft({ ...draft, manualOverride: null });
                      void handleSetOverride(null);
                    }}
                  >
                    Clear
                  </Button>
                  <Text type="secondary" style={{ fontSize: 11, alignSelf: 'center' }}>
                    Resolver serves the pinned value; scheduler still refreshes the underlying workflow.
                  </Text>
                </div>
              </>
            ) : (
              <div style={{ paddingLeft: ROW_LABEL_WIDTH + ROW_GAP }}>
                <Button size="small" onClick={() => setDraft({ ...draft, manualOverride: { value: '', until: null } })}>
                  Set manual override
                </Button>
              </div>
            )}
          </Section>

          <div
            style={{
              display: 'flex',
              gap: 20,
              alignItems: 'center',
              flexWrap: 'wrap',
              marginTop: 4,
              paddingTop: 10,
              borderTop: `1px solid ${token.colorBorderSecondary}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Switch size="small" checked={draft.enabled} onChange={(enabled) => setDraft({ ...draft, enabled })} />
              <Text style={{ fontSize: 12 }}>Enabled</Text>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Switch
                size="small"
                checked={draft.requireFreshOnRuleBuild}
                onChange={(requireFreshOnRuleBuild) => setDraft({ ...draft, requireFreshOnRuleBuild })}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                Sync-warm
              </Text>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
