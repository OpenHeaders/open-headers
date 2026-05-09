/**
 * LiveVariableEditor — tab body for editing one LiveVariable OR
 * creating a new one.
 *
 * An LV is a thin namespace projection: `{{live.<name>}}` →
 * `workflow.<stepId>.<captureName>`. The two surfaces users have are:
 *
 *   - **Create workflows** via the Workflows sidebar (or via the
 *     Request editor's "Use response in workflow" action). That flow
 *     creates the workflow + its steps + captures.
 *   - **Bind a capture as `{{live.X}}`** via this editor's Create mode,
 *     reachable from the Live Variables list page's "+ New live
 *     variable" button. The user picks an existing workflow + step +
 *     capture and names the binding.
 *
 * Edit mode covers: rename, rebind (different workflow / step /
 * capture), toggle `enabled`, toggle `requireFreshOnRuleBuild`, set a
 * manual override. Writes route through the sync engine's per-(field)
 * LWW oracle (sync engine §6.3). On external commit while the editor
 * is clean, the draft re-primes from the new persisted state; while
 * dirty the user's typing is preserved and LWW resolves at save time.
 */

import {
  EyeInvisibleOutlined,
  EyeOutlined,
  InfoCircleOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useEnvironments } from '@hooks/useEnvironments';
import { useLiveWorkflowCache } from '@hooks/useLiveCache';
import { useLiveVariables } from '@hooks/useLiveVariables';
import { useLiveWorkflows } from '@hooks/useLiveWorkflows';
import { LIVE_VARIABLE_ENTITY_TYPE } from '@openheaders/core/sync';
import { EntityScopeProvider, LIVE_VARIABLE_FIELD, useSetActiveFieldFocus } from '@/shared/awareness';
import { readFieldPath } from '@/shared/awareness/field-path';
import {
  type ConflictResolution,
  EntityConflictBanner,
  EntityConflictDialog,
  prettyPathMap,
  useAutoMergeForm,
} from '@/shared/conflicts';
import { useEditorShell, useReprime } from '@/shared/editor-shell';
import type { V5 } from '@openheaders/core/types';
import { App, Button, Input, InputNumber, Select, Switch, Tag, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { liveVariableResolveAdapter } from './live-variable-conflict-adapter';
import { projectLiveVariableToForm, useLiveVariableConflicts } from './use-live-variable-conflicts';
import EditorHeader from '../EditorHeader';
import { FieldRow, InlineNameDescription, LIVE_ROW_GAP, LIVE_ROW_LABEL_WIDTH, Section } from './layout';
import {
  classifyRun,
  describeRefreshPolicy,
  formatRelativeMs,
  pickActiveRun,
  readCapture,
  statusColor,
} from './live-display';

const { Text, Title } = Typography;

// ── Shared labels for the Enabled + Wait-for-fresh toggles ──────────
//
// "Enabled" = when off, `{{live.<name>}}` stops resolving (the resolver
// filter skips disabled LVs). The binding stays in storage so toggling
// back on is a one-click restore.
//
// "Wait for fresh value" (persisted as `requireFreshOnRuleBuild`) — when
// on, the DNR rule-compile path BLOCKS on a workflow refresh (up to ~5s)
// so rules always pick up a freshly-fetched value. Off (default) =
// async-warm: rules use the last cached value and a background refresh
// runs. The tradeoff is latency vs staleness on cold start.
const ENABLED_TOOLTIP = 'When off, {{live.NAME}} references stop resolving in rules and requests.';
const FRESH_TOOLTIP =
  'Before applying rules, wait for the backing workflow to finish a refresh (up to ~5s). Off: rules use the last cached value and refresh in the background — faster but can be briefly stale after the extension wakes.';

// ── Create mode ─────────────────────────────────────────────────────

interface CreateProps {
  mode: 'create';
  onDirtyChange?: (dirty: boolean) => void;
  registerSaveRef?: (save: () => void) => void;
  /** Called when a new LV lands — host replaces the create tab with an edit tab. */
  onCreated: (lv: V5.LiveVariable) => void;
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

interface CreateDraft {
  name: string;
  description: string;
  enabled: boolean;
  requireFreshOnRuleBuild: boolean;
  workflowUid: string;
  stepId: string;
  captureName: string;
}

function emptyCreateDraft(): CreateDraft {
  return {
    name: '',
    description: '',
    enabled: true,
    requireFreshOnRuleBuild: false,
    workflowUid: '',
    stepId: '',
    captureName: '',
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

const CreateMode: React.FC<CreateProps> = ({ onDirtyChange, registerSaveRef, onCreated }) => {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const { workflows } = useLiveWorkflows();
  const { createVariable } = useLiveVariables();

  const [draft, setDraft] = useState<CreateDraft>(() => emptyCreateDraft());

  const isDirty = useMemo(() => {
    return (
      draft.name.trim().length > 0 ||
      draft.description.trim().length > 0 ||
      draft.workflowUid !== '' ||
      draft.captureName !== ''
    );
  }, [draft]);

  const handleSave = useCallback(async () => {
    const name = draft.name.trim();
    if (!name) {
      message.error('Name is required');
      return;
    }
    if (!draft.workflowUid || !draft.stepId || !draft.captureName) {
      message.error('Select a workflow, step, and capture');
      return;
    }
    const lv = await createVariable({
      name,
      workflowUid: draft.workflowUid,
      stepId: draft.stepId,
      captureName: draft.captureName,
      description: draft.description.trim() ? draft.description : undefined,
      requireFreshOnRuleBuild: draft.requireFreshOnRuleBuild,
      enabled: draft.enabled,
    });
    if (!lv) {
      message.error('Failed to create live variable');
      return;
    }
    onCreated(lv);
  }, [draft, createVariable, message, onCreated]);

  const handleSaveSync = useCallback(() => void handleSave(), [handleSave]);

  const shell = useEditorShell({
    entityType: LIVE_VARIABLE_ENTITY_TYPE,
    entityId: null,
    isDirty,
    onSave: handleSaveSync,
    onDirtyChange,
    registerSaveRef,
  });

  const selectedWorkflow = workflows.find((w) => w.uid === draft.workflowUid) ?? null;
  const selectedSteps = selectedWorkflow?.steps ?? [];
  const selectedStep = selectedSteps.find((s) => s.id === draft.stepId) ?? null;
  const selectedCaptures = selectedStep?.captures ?? [];

  const createHeaderTitle = (
    <>
      <ThunderboltOutlined style={{ fontSize: 14, color: token.colorPrimary }} />
      <Title level={5} style={{ margin: 0 }}>
        New Live Variable
      </Title>
    </>
  );

  return (
    <EntityScopeProvider shell={shell.scopeProps}>
    <div style={{ display: 'flex', flexDirection: 'column', background: token.colorBgContainer, height: '100%' }}>
      <EditorHeader title={createHeaderTitle} shell={shell.headerProps} />
      <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <InlineNameDescription
              name={draft.name}
              description={draft.description}
              onChangeName={(name) => setDraft({ ...draft, name })}
              onChangeDescription={(description) => setDraft({ ...draft, description })}
              namePlaceholder="Name (e.g. accessToken)"
            />
            <Text type="secondary" style={{ fontSize: 10, marginTop: -4 }}>
              Reference as {'{{'}live.{draft.name.trim() || 'NAME'}
              {'}}'}
            </Text>

            <Section title="Binding">
              <FieldRow label="Workflow">
                <Select
                  size="small"
                  style={{ width: '100%' }}
                  showSearch
                  optionFilterProp="label"
                  placeholder={
                    workflows.length === 0
                      ? 'No workflows yet — create one from the Workflows sidebar'
                      : 'Select a workflow'
                  }
                  value={draft.workflowUid || undefined}
                  onChange={(workflowUid) => setDraft({ ...draft, workflowUid, stepId: '', captureName: '' })}
                  options={workflows.map((w) => ({ value: w.uid, label: w.name }))}
                  notFoundContent={<Text type="secondary">No workflows yet.</Text>}
                />
              </FieldRow>
              <FieldRow label="Step">
                <Select
                  size="small"
                  style={{ width: '100%' }}
                  placeholder="Select a step"
                  disabled={!selectedWorkflow}
                  value={draft.stepId || undefined}
                  onChange={(stepId) => setDraft({ ...draft, stepId, captureName: '' })}
                  options={selectedSteps.map((s) => ({
                    value: s.id,
                    label: `${s.id} (${s.captures.length} captures)`,
                  }))}
                />
              </FieldRow>
              <FieldRow label="Capture">
                <Select
                  size="small"
                  style={{ width: '100%' }}
                  placeholder="Select a capture"
                  disabled={!selectedStep}
                  value={draft.captureName || undefined}
                  onChange={(captureName) => setDraft({ ...draft, captureName })}
                  options={selectedCaptures.map((c) => ({ value: c.name, label: c.name }))}
                />
              </FieldRow>
            </Section>

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
              <div
                data-field-path={LIVE_VARIABLE_FIELD.enabled}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Switch size="small" checked={draft.enabled} onChange={(enabled) => setDraft({ ...draft, enabled })} />
                <Text style={{ fontSize: 12 }}>Enabled</Text>
                <Tooltip title={ENABLED_TOOLTIP}>
                  <InfoCircleOutlined style={{ fontSize: 11, color: token.colorTextTertiary, cursor: 'help' }} />
                </Tooltip>
              </div>
              <div
                data-field-path={LIVE_VARIABLE_FIELD.requireFreshOnRuleBuild}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Switch
                  size="small"
                  checked={draft.requireFreshOnRuleBuild}
                  onChange={(requireFreshOnRuleBuild) => setDraft({ ...draft, requireFreshOnRuleBuild })}
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Wait for fresh value
                </Text>
                <Tooltip title={FRESH_TOOLTIP}>
                  <InfoCircleOutlined style={{ fontSize: 11, color: token.colorTextTertiary, cursor: 'help' }} />
                </Tooltip>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </EntityScopeProvider>
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

  const [revealValue, setRevealValue] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const formFingerprint = useMemo(() => (draft ? fingerprintEdit(draft) : ''), [draft]);

  // Conflict baseline must advance synchronously inside the populate
  // sequence — captured by `onPrimed`, called via a ref so the
  // tracker hook can be declared after `reprime` (its `isDirty` is the
  // tracker's input).
  const setBaselineRef = useRef<(e: V5.LiveVariable) => void>(() => undefined);
  // Snapshot of the canonical entity at the most recent re-prime — feeds
  // the merge-editor preview's Show Base layouts via `baseText`.
  const baselineLiveVariableRef = useRef<V5.LiveVariable | null>(null);

  const reprime = useReprime<V5.LiveVariable>({
    liveEntity: lv,
    scope: { entityType: LIVE_VARIABLE_ENTITY_TYPE, entityId: lv?.uid ?? null },
    enabled: lv != null,
    formFingerprint,
    signature: (e) => fingerprintEdit(editDraftFromVariable(e)),
    populate: (e) => setDraft(editDraftFromVariable(e)),
    onPrimed: (e) => {
      setBaselineRef.current(e);
      baselineLiveVariableRef.current = e;
    },
  });
  const isDirty = reprime.isDirty;

  const conflicts = useLiveVariableConflicts({
    liveEntity: lv,
    isDirty,
    enabled: lv != null,
    entityType: LIVE_VARIABLE_ENTITY_TYPE,
  });
  setBaselineRef.current = conflicts.setBaseline;

  const formProjection = useMemo(
    () =>
      draft
        ? projectLiveVariableToForm({
            name: draft.name,
            description: draft.description,
            enabled: draft.enabled,
            requireFreshOnRuleBuild: draft.requireFreshOnRuleBuild,
            workflowUid: draft.workflowUid,
            stepId: draft.stepId,
            captureName: draft.captureName,
          })
        : null,
    [draft],
  );

  // Per-leaf auto-rebase for §6.2 killer-demo conformance: peer commits
  // to a leaf the user hasn't touched silently catch the draft up.
  const applyAutoMerge = useCallback(
    (path: string, theirs: string) => {
      if (!lv || !draft) return;
      const transient = { ...lv } as V5.LiveVariable;
      if (!liveVariableResolveAdapter.applyResolutionToEntity(transient, path, { base: '', theirs })) return;
      setDraft((d) =>
        d
          ? {
              ...d,
              name: transient.name,
              description: transient.description ?? '',
              enabled: transient.enabled,
              requireFreshOnRuleBuild: Boolean(transient.requireFreshOnRuleBuild),
              workflowUid: transient.workflowUid,
              stepId: transient.stepId,
              captureName: transient.captureName,
            }
          : d,
      );
    },
    [lv, draft],
  );
  useAutoMergeForm({ conflicts, formProjection, applyToForm: applyAutoMerge });

  const allConflicts = useMemo(
    () => (formProjection ? conflicts.getAllConflicts(formProjection) : new Map()),
    [conflicts, formProjection],
  );
  const [isConflictDialogOpen, setConflictDialogOpen] = useState(false);

  const projectWithResolutions = useCallback(
    (resolutions: ReadonlyMap<string, ConflictResolution>): V5.LiveVariable | null => {
      if (!lv || !draft) return null;
      const transient: V5.LiveVariable = {
        ...lv,
        name: draft.name,
        description: draft.description,
        enabled: draft.enabled,
        requireFreshOnRuleBuild: draft.requireFreshOnRuleBuild,
        workflowUid: draft.workflowUid,
        stepId: draft.stepId,
        captureName: draft.captureName,
      };
      for (const [path, choice] of resolutions) {
        if (choice !== 'theirs') continue;
        const conflict = allConflicts.get(path);
        if (!conflict) continue;
        liveVariableResolveAdapter.applyResolutionToEntity(transient, path, conflict);
      }
      return transient;
    },
    [allConflicts, draft, lv],
  );

  const adoptProjected = useCallback((projected: V5.LiveVariable) => {
    setDraft((d) =>
      d
        ? {
            ...d,
            name: projected.name,
            description: projected.description ?? '',
            enabled: projected.enabled,
            requireFreshOnRuleBuild: Boolean(projected.requireFreshOnRuleBuild),
            workflowUid: projected.workflowUid,
            stepId: projected.stepId,
            captureName: projected.captureName,
          }
        : d,
    );
  }, []);

  const handleKeepAllMine = useCallback(() => {
    for (const path of allConflicts.keys()) conflicts.dismiss(path);
  }, [allConflicts, conflicts]);

  const handleUseAllSaved = useCallback(() => {
    if (!lv) return;
    const all = new Map<string, ConflictResolution>();
    for (const path of allConflicts.keys()) all.set(path, 'theirs');
    const projected = projectWithResolutions(all);
    if (!projected) return;
    adoptProjected(projected);
    for (const [path, conflict] of allConflicts) conflicts.acceptTheirs(path, conflict.theirs);
  }, [allConflicts, conflicts, lv, projectWithResolutions, adoptProjected]);

  // Phase 6 commit seam — parse the merge-editor's result text back to
  // the projection, adopt to draft, dismiss every conflict path. Save
  // re-prime advances the tracker baseline. Throws on malformed JSON.
  const handleResolveText = useCallback(
    (text: string) => {
      if (!lv) return;
      const raw = JSON.parse(text) as Partial<{
        name: string;
        description: string;
        enabled: boolean;
        requireFreshOnRuleBuild: boolean;
        workflowUid: string;
        stepId: string;
        captureName: string;
      }>;
      setDraft((d) =>
        d
          ? {
              ...d,
              name: typeof raw.name === 'string' ? raw.name : d.name,
              description: typeof raw.description === 'string' ? raw.description : d.description,
              enabled: typeof raw.enabled === 'boolean' ? raw.enabled : d.enabled,
              requireFreshOnRuleBuild: Boolean(raw.requireFreshOnRuleBuild ?? d.requireFreshOnRuleBuild),
              workflowUid: typeof raw.workflowUid === 'string' ? raw.workflowUid : d.workflowUid,
              stepId: typeof raw.stepId === 'string' ? raw.stepId : d.stepId,
              captureName: typeof raw.captureName === 'string' ? raw.captureName : d.captureName,
            }
          : d,
      );
      for (const path of allConflicts.keys()) conflicts.dismiss(path);
    },
    [lv, allConflicts, conflicts],
  );

  const applyResolutions = useCallback(
    (resolutions: Map<string, ConflictResolution>) => {
      const projected = projectWithResolutions(resolutions);
      if (projected) adoptProjected(projected);
      for (const [path, choice] of resolutions) {
        const conflict = allConflicts.get(path);
        if (!conflict) continue;
        if (choice === 'theirs') conflicts.acceptTheirs(path, conflict.theirs);
        else conflicts.dismiss(path);
      }
    },
    [allConflicts, conflicts, projectWithResolutions, adoptProjected],
  );

  const conflictPathLabels = useMemo(
    () => (lv ? prettyPathMap(liveVariableResolveAdapter, lv, allConflicts.keys()) : new Map<string, string>()),
    [lv, allConflicts],
  );

  const savedText = useMemo(() => {
    if (!isConflictDialogOpen || !lv) return '';
    return JSON.stringify(
      {
        name: lv.name,
        description: lv.description ?? '',
        enabled: lv.enabled,
        requireFreshOnRuleBuild: Boolean(lv.requireFreshOnRuleBuild),
        workflowUid: lv.workflowUid,
        stepId: lv.stepId,
        captureName: lv.captureName,
      },
      null,
      2,
    );
  }, [isConflictDialogOpen, lv]);

  // Baseline JSON for the merge-editor preview's Show Base layouts.
  const baseText = useMemo(() => {
    if (!isConflictDialogOpen) return undefined;
    const baseline = baselineLiveVariableRef.current;
    if (!baseline) return undefined;
    return JSON.stringify(
      {
        name: baseline.name,
        description: baseline.description ?? '',
        enabled: baseline.enabled,
        requireFreshOnRuleBuild: Boolean(baseline.requireFreshOnRuleBuild),
        workflowUid: baseline.workflowUid,
        stepId: baseline.stepId,
        captureName: baseline.captureName,
      },
      null,
      2,
    );
  }, [isConflictDialogOpen]);

  const mineText = useMemo(() => {
    if (!isConflictDialogOpen || !draft) return '';
    return JSON.stringify(
      {
        name: draft.name,
        description: draft.description,
        enabled: draft.enabled,
        requireFreshOnRuleBuild: Boolean(draft.requireFreshOnRuleBuild),
        workflowUid: draft.workflowUid,
        stepId: draft.stepId,
        captureName: draft.captureName,
      },
      null,
      2,
    );
  }, [isConflictDialogOpen, draft]);

  // Per-field focus path. Live editors don't use antd Form, so focus
  // mapping rides `data-field-path` attributes on FieldRow wrappers;
  // a focus-capture ancestor walk reads the path off the focused
  // element and routes it through `useSetActiveFieldFocus` — the same
  // central context the workspace-level publisher reads. Same pattern
  // RequestEditor uses.
  const setActiveFieldFocus = useSetActiveFieldFocus();
  const handleFocusCapture = useCallback(
    (e: React.FocusEvent<HTMLDivElement>) => {
      if (!lv) return;
      const path = readFieldPath(e.target);
      if (!path) return;
      setActiveFieldFocus({ entityType: LIVE_VARIABLE_ENTITY_TYPE, entityId: lv.uid, path });
    },
    [lv, setActiveFieldFocus],
  );
  const handleBlurCapture = useCallback(
    (e: React.FocusEvent<HTMLDivElement>) => {
      const next = e.relatedTarget as HTMLElement | null;
      if (next && e.currentTarget.contains(next)) return;
      setActiveFieldFocus(null);
    },
    [setActiveFieldFocus],
  );

  const handleSave = useCallback(async () => {
    if (!lv || !draft) return;
    const result = await updateVariable(lv.uid, {
      name: draft.name,
      description: draft.description.trim() ? draft.description : undefined,
      enabled: draft.enabled,
      requireFreshOnRuleBuild: draft.requireFreshOnRuleBuild,
      workflowUid: draft.workflowUid,
      stepId: draft.stepId,
      captureName: draft.captureName,
    });
    if (result.success) {
      // Dirty derives from form-vs-canonical equality; broadcast echo
      // brings live in line with form, useReprime auto-rebase clears.
      conflicts.clearDismissed();
      return;
    }
    if (result.reason === 'not-found') {
      message.error('Source was deleted from another tab');
      return;
    }
    message.error('Failed to save live variable');
  }, [lv, draft, updateVariable, message, conflicts]);

  const handleSaveSync = useCallback(() => void handleSave(), [handleSave]);

  const shell = useEditorShell({
    entityType: LIVE_VARIABLE_ENTITY_TYPE,
    entityId: lv?.uid ?? null,
    isDirty,
    onSave: handleSaveSync,
    onDirtyChange,
    registerSaveRef,
  });

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
      const resp = await setOverride(lv.uid, payload);
      if (!resp.success) {
        message.error('Override save failed.');
        return;
      }
      message.success(override ? 'Override applied' : 'Override cleared');
    },
    [lv, setOverride, message],
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

  const editHeaderTitle = (
    <>
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
    </>
  );

  const editHeaderActions = (
    <Button size="small" icon={<ReloadOutlined spin={refreshing} />} onClick={() => void handleRefreshNow()}>
      Refresh
    </Button>
  );

  return (
    <EntityScopeProvider shell={shell.scopeProps}>
      <div
        style={{ display: 'flex', flexDirection: 'column', background: token.colorBgContainer, height: '100%' }}
        onFocusCapture={handleFocusCapture}
        onBlurCapture={handleBlurCapture}
      >
        <EditorHeader title={editHeaderTitle} actions={editHeaderActions} shell={shell.headerProps} />
        <EntityConflictBanner
          count={allConflicts.size}
          onReview={() => setConflictDialogOpen(true)}
          onKeepAllMine={handleKeepAllMine}
          onUseAllSaved={handleUseAllSaved}
        />
      <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
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
              fieldPath={LIVE_VARIABLE_FIELD.name}
              hint={
                <>
                  Reference as {'{{'}live.NAME{'}}'}
                </>
              }
            >
              <Input size="small" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </FieldRow>

            <FieldRow label="Description" center={false} fieldPath={LIVE_VARIABLE_FIELD.description}>
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
              <FieldRow label="Workflow" fieldPath={LIVE_VARIABLE_FIELD.workflowUid}>
                <Select
                  size="small"
                  style={{ width: '100%' }}
                  value={draft.workflowUid || undefined}
                  onChange={(workflowUid) => setDraft({ ...draft, workflowUid, stepId: '', captureName: '' })}
                  options={workflows.map((w) => ({ value: w.uid, label: w.name }))}
                  placeholder="Select a workflow"
                />
              </FieldRow>
              <FieldRow label="Step" fieldPath={LIVE_VARIABLE_FIELD.stepId}>
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
              <FieldRow label="Capture" fieldPath={LIVE_VARIABLE_FIELD.captureName}>
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
                  <FieldRow label="Value" fieldPath={LIVE_VARIABLE_FIELD.manualOverrideValue}>
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
                  <FieldRow
                    label="Expires (ms)"
                    fieldPath={LIVE_VARIABLE_FIELD.manualOverrideUntil}
                    hint="Wall-clock epoch ms — leave blank for permanent override"
                  >
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
                  <div style={{ paddingLeft: LIVE_ROW_LABEL_WIDTH + LIVE_ROW_GAP, display: 'flex', gap: 8 }}>
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
                <div style={{ paddingLeft: LIVE_ROW_LABEL_WIDTH + LIVE_ROW_GAP }}>
                  <Button
                    size="small"
                    onClick={() => setDraft({ ...draft, manualOverride: { value: '', until: null } })}
                  >
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
              <div
                data-field-path={LIVE_VARIABLE_FIELD.enabled}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Switch size="small" checked={draft.enabled} onChange={(enabled) => setDraft({ ...draft, enabled })} />
                <Text style={{ fontSize: 12 }}>Enabled</Text>
                <Tooltip title={ENABLED_TOOLTIP}>
                  <InfoCircleOutlined style={{ fontSize: 11, color: token.colorTextTertiary, cursor: 'help' }} />
                </Tooltip>
              </div>
              <div
                data-field-path={LIVE_VARIABLE_FIELD.requireFreshOnRuleBuild}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Switch
                  size="small"
                  checked={draft.requireFreshOnRuleBuild}
                  onChange={(requireFreshOnRuleBuild) => setDraft({ ...draft, requireFreshOnRuleBuild })}
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Wait for fresh value
                </Text>
                <Tooltip title={FRESH_TOOLTIP}>
                  <InfoCircleOutlined style={{ fontSize: 11, color: token.colorTextTertiary, cursor: 'help' }} />
                </Tooltip>
              </div>
            </div>
          </div>
        </div>
      </div>
        <EntityConflictDialog
          open={isConflictDialogOpen}
          savedText={savedText}
          mineText={mineText}
          baseText={baseText}
          language="json"
          onResolveText={handleResolveText}
          onClose={() => setConflictDialogOpen(false)}
        />
    </div>
    </EntityScopeProvider>
  );
};
