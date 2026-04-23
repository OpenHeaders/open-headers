/**
 * WorkflowStepEditor — draft-level editor for a single `V5.WorkflowStep`.
 *
 * Used inside `LiveWorkflowEditor` (once per step). The step-id chip is
 * editable because `{{step.<id>.<capture>}}` references are stable
 * identifiers users might reference from later steps.
 *
 * Phase I surface (all optional — the editor degrades gracefully when
 * the parent doesn't wire them through):
 *   - `dependsOn` multi-select: picks ancestor steps by id.
 *   - `runIf` gate section (`StepGateEditor`).
 *   - `priorityFrom` row (step + capture + sort).
 *   - Disabled step-type selector (Request / Foreach / Composite) +
 *     disabled Retry + Timeout rows so the show-but-disable catalog is
 *     complete. Each disabled affordance carries a tooltip naming the
 *     future capability; clicking has no effect.
 */

import {
  BranchesOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  DownOutlined,
  FolderOpenOutlined,
  FolderOutlined,
  InfoCircleOutlined,
  ReloadOutlined,
  UpOutlined,
} from '@ant-design/icons';
import type { DraftCapture, DraftStep, StructuralError } from '@openheaders/core/live';
import { newDraftCapture } from '@openheaders/core/live';
import type { V5 } from '@openheaders/core/types';
import { Button, Collapse, Input, InputNumber, Select, Space, Switch, Tag, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useMemo } from 'react';
import { METHOD_COLORS } from '../sidebar/icons';
import type { DependencyRow } from './dependencies-view';
import ExtractorEditor from './ExtractorEditor';
import StepGateEditor from './StepGateEditor';
import { scopeBadge } from '../shared/scope-colors';

const { Text } = Typography;

interface Props {
  step: DraftStep;
  index: number;
  totalSteps: number;
  /**
   * Requests the step's Request picker can choose from. The structured
   * `collectionName` + `folderTrail` feed the option label's rich
   * breadcrumb render (folder icons + colored method). `null`
   * `collectionName` means the request isn't associated with any
   * collection — the option falls back to `<method> <name>`.
   */
  availableRequests: {
    uid: string;
    name: string;
    method: string;
    collectionName: string | null;
    folderTrail: string[];
  }[];
  onChange: (next: DraftStep) => void;
  onRemove?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  /** Disable the step id input if it would break existing step references. */
  lockStepId?: boolean;
  // ── Phase I context (optional — editor works without them) ──────
  /** All other step ids in the workflow for the dependsOn multi-select. */
  allStepIds?: { id: string; label: string }[];
  /** Transitive ancestors (legal ref targets) for runIf + priorityFrom. */
  reachableSteps?: { id: string; label: string }[];
  /** Map of stepId → declared capture names for runIf + priorityFrom. */
  capturesByStepId?: Map<string, string[]>;
  /** Structural errors scoped to this step (stepId matches) — inline badging. */
  errors?: StructuralError[];
  /** Layout metadata (indent + effective parents) from `buildDependencyRows`. */
  dependencyRow?: DependencyRow;
}

const INDENT_PX = 18;

const WorkflowStepEditor: React.FC<Props> = ({
  step,
  index,
  totalSteps,
  availableRequests,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  lockStepId,
  allStepIds = [],
  reachableSteps = [],
  capturesByStepId = new Map(),
  errors = [],
  dependencyRow,
}) => {
  const { token } = theme.useToken();

  const addCapture = () => {
    const name = `capture${step.captures.length + 1}`;
    const nextCaptures: DraftCapture[] = [...step.captures, newDraftCapture(name, { kind: 'whole-body' })];
    onChange({ ...step, captures: nextCaptures });
  };

  const updateCapture = (idx: number, next: DraftCapture) => {
    const nextCaptures = step.captures.slice();
    nextCaptures[idx] = next;
    onChange({ ...step, captures: nextCaptures });
  };

  const removeCapture = (idx: number) => {
    onChange({ ...step, captures: step.captures.filter((_, i) => i !== idx) });
  };

  // ── Derived error subsets ───────────────────────────────────────
  const stepLevelError = useMemo(
    () =>
      errors.find(
        (e) => e.issue === 'duplicate-step-id' || e.issue === 'step-unknown-dep' || e.issue === 'depends-on-cycle',
      ),
    [errors],
  );
  const gateErrors = useMemo(
    () =>
      errors.filter(
        (e) =>
          e.issue === 'gate-unknown-stepid' ||
          e.issue === 'gate-unreachable-stepid' ||
          e.issue === 'gate-unknown-capture' ||
          e.issue === 'gate-invalid-regex',
      ),
    [errors],
  );
  const priorityError = useMemo(
    () =>
      errors.find(
        (e) =>
          e.issue === 'priority-unknown-stepid' ||
          e.issue === 'priority-unreachable-stepid' ||
          e.issue === 'priority-unknown-capture',
      ),
    [errors],
  );
  const dependsOnError = useMemo(
    () => errors.find((e) => e.issue === 'step-unknown-dep' || e.issue === 'depends-on-cycle'),
    [errors],
  );

  // ── dependsOn helpers ───────────────────────────────────────────
  // `undefined` = implicit prior-step dep; `[]` = explicit root; array
  // of ids = explicit DAG. The multi-select emits `undefined` when the
  // user clears an explicit list AND the implicit-prior dep matches the
  // declared list; otherwise it persists an explicit `[]` so the user's
  // root intent survives a reorder. We surface both states distinctly
  // so users can see the difference.
  const effectiveParents = dependencyRow?.parents ?? [];
  const dependsOnValue = step.dependsOn;

  const handleDependsOnChange = (next: string[]) => {
    // Dedup + keep order stable by filtering against allStepIds order.
    const ordered = allStepIds.filter((s) => next.includes(s.id)).map((s) => s.id);
    if (ordered.length === 0) {
      // Empty selection = explicit root. Persist `[]` so serialization
      // is unambiguous (absent = implicit prior). This lets users
      // deliberately promote a step to a root vs relying on the
      // canonical-order fallback.
      onChange({ ...step, dependsOn: [] });
      return;
    }
    onChange({ ...step, dependsOn: ordered });
  };

  const clearExplicitDependsOn = () => {
    // Remove explicit dependsOn entirely — falls back to implicit
    // prior-step dep (linear-chain default).
    const next = { ...step };
    delete next.dependsOn;
    onChange(next);
  };

  // ── runIf helpers ───────────────────────────────────────────────
  const runIfCount = step.runIf?.all.length ?? 0;

  const handleRunIfChange = (next: V5.StepGate | undefined) => {
    const nextStep = { ...step };
    if (next === undefined) {
      delete nextStep.runIf;
    } else {
      nextStep.runIf = next;
    }
    onChange(nextStep);
  };

  // ── priorityFrom helpers ────────────────────────────────────────
  const priority = step.priorityFrom;
  const priorityStepOptions = useMemo(
    () => reachableSteps.map((s) => ({ value: s.id, label: s.label })),
    [reachableSteps],
  );
  const priorityCaptureOptions = useMemo(() => {
    if (!priority?.stepId) return [] as { value: string; label: string }[];
    return (capturesByStepId.get(priority.stepId) ?? []).map((c: string) => ({ value: c, label: c }));
  }, [priority, capturesByStepId]);

  const setPriority = (next: V5.PriorityRef | undefined) => {
    const nextStep = { ...step };
    if (next === undefined) {
      delete nextStep.priorityFrom;
    } else {
      nextStep.priorityFrom = next;
    }
    onChange(nextStep);
  };

  const indent = dependencyRow?.indent ?? 0;

  return (
    <div
      style={{
        border: `1px solid ${stepLevelError ? token.colorError : token.colorBorderSecondary}`,
        borderRadius: 6,
        padding: 12,
        marginBottom: 12,
        marginLeft: indent * INDENT_PX,
        background: token.colorBgContainer,
        // Connector rail on the left edge for children — a thin vertical
        // stripe in the primary-color family. Pure visual cue that this
        // step is NOT a root; actual dependency info is in the
        // "Depends on" section.
        borderLeft: indent > 0 ? `3px solid ${token.colorPrimaryBorder}` : `1px solid ${token.colorBorderSecondary}`,
        position: 'relative',
      }}
    >
      {/* Parent-connector chip — tiny textual summary of effective parents.
          Draws the reader's eye to the dependency relationship without
          requiring them to open the Depends-on section. */}
      {indent > 0 && effectiveParents.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: -9,
            left: 8,
            padding: '0 6px',
            fontSize: 10,
            color: token.colorTextTertiary,
            background: token.colorBgContainer,
            lineHeight: 1.4,
          }}
        >
          ↳ after {effectiveParents.join(', ')}
          {step.dependsOn === undefined && (
            <Tooltip title="Implicit prior-step dependency (no explicit dependsOn declared). Set an explicit dependsOn to lock the relationship.">
              <span style={{ marginLeft: 4, fontStyle: 'italic' }}>(implicit)</span>
            </Tooltip>
          )}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Text strong style={{ fontSize: 12 }}>
          Step {index + 1}
        </Text>
        <Tooltip open={stepLevelError ? undefined : false} title={stepLevelError?.message}>
          <Input
            size="small"
            style={{ width: 160 }}
            prefix={<Text type="secondary">id</Text>}
            value={step.id}
            disabled={lockStepId}
            status={stepLevelError?.issue === 'duplicate-step-id' ? 'error' : undefined}
            onChange={(e) => onChange({ ...step, id: e.target.value })}
          />
        </Tooltip>

        {/* Disabled step-type selector — show-but-disable catalog. */}
        <Tooltip title="Step type — Foreach and Composite coming in a future release.">
          <Select
            size="small"
            style={{ width: 110, flexShrink: 0 }}
            value="request"
            options={[
              { value: 'request', label: 'Request' },
              { value: 'foreach', label: 'Foreach', disabled: true },
              { value: 'composite', label: 'Composite', disabled: true },
            ]}
            onChange={() => {
              // Disabled options suppress selection; no-op.
            }}
          />
        </Tooltip>

        <div style={{ flex: 1 }} />
        {runIfCount > 0 && (
          <Tag color="gold" style={{ fontSize: 10, lineHeight: '18px', margin: 0 }}>
            runs if {runIfCount} condition{runIfCount === 1 ? '' : 's'}
          </Tag>
        )}
        {priority && (
          <Tag color="cyan" style={{ fontSize: 10, lineHeight: '18px', margin: 0 }}>
            priority: {priority.stepId}.{priority.captureName}
          </Tag>
        )}
        {onMoveUp && (
          <Button size="small" type="text" icon={<UpOutlined />} disabled={index === 0} onClick={onMoveUp} />
        )}
        {onMoveDown && (
          <Button
            size="small"
            type="text"
            icon={<DownOutlined />}
            disabled={index === totalSteps - 1}
            onClick={onMoveDown}
          />
        )}
        {onRemove && (
          <Button
            size="small"
            type="text"
            danger
            icon={<DeleteOutlined />}
            disabled={totalSteps <= 1}
            onClick={onRemove}
          />
        )}
      </div>

      <Space direction="vertical" size={8} style={{ width: '100%' }}>
        {/* Request picker + optional description — inlined on one row.
         *  Request gets ~60% width, description ~40%. Both `size="small"`
         *  so they render at identical heights (the Select's option label
         *  is single-line). Option label is a structured breadcrumb:
         *
         *    [📂] <Collection>  ›  [📁] <Folder>  ›  [METHOD] <Request>
         *
         *  Method is colored via the shared `METHOD_COLORS` so it matches
         *  the sidebar + tab-bar method tags. Search filters on the full
         *  text breadcrumb via `filterOption` against the option `title`. */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <Select
            size="small"
            style={{ flex: '1 1 60%', minWidth: 0 }}
            showSearch
            filterOption={(input, option) => {
              if (!option) return true;
              const haystack = String(option.title ?? '').toLowerCase();
              return haystack.includes(input.toLowerCase());
            }}
            placeholder="Select a request"
            value={step.requestUid || undefined}
            onChange={(uid) => onChange({ ...step, requestUid: uid })}
            options={availableRequests.map((r) => {
              const methodColor = METHOD_COLORS[r.method] ?? token.colorTextSecondary;
              // String for filterOption + accessibility; stays consistent
              // with the JSX the user sees (same segments, same order).
              const titleSegments = [r.collectionName, ...r.folderTrail, `${r.method} ${r.name}`].filter(
                (s): s is string => s !== null,
              );
              const title = titleSegments.join(' > ');
              const separatorStyle = { color: token.colorTextQuaternary, margin: '0 4px' };
              const iconStyle = { color: token.colorTextTertiary, fontSize: 11, marginRight: 4 };
              return {
                value: r.uid,
                title,
                label: (
                  <span style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'nowrap' }}>
                    {r.collectionName !== null && (
                      <>
                        <FolderOpenOutlined style={iconStyle} />
                        <span>{r.collectionName}</span>
                        <span style={separatorStyle}>›</span>
                      </>
                    )}
                    {r.folderTrail.map((f) => (
                      <span key={f} style={{ display: 'inline-flex', alignItems: 'center' }}>
                        <FolderOutlined style={iconStyle} />
                        <span>{f}</span>
                        <span style={separatorStyle}>›</span>
                      </span>
                    ))}
                    <span
                      style={{
                        fontWeight: 700,
                        color: methodColor,
                        fontFamily: "'SF Mono', monospace",
                        fontSize: 10,
                        marginRight: 4,
                      }}
                    >
                      {r.method}
                    </span>
                    <span>{r.name}</span>
                  </span>
                ),
              };
            })}
          />
          <Input
            size="small"
            style={{ flex: '1 1 40%' }}
            placeholder="Optional step description"
            value={step.description ?? ''}
            onChange={(e) => onChange({ ...step, description: e.target.value || undefined })}
          />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <Text type="secondary" style={{ fontSize: 11 }}>
              CAPTURES ({step.captures.length})
            </Text>
            <Button size="small" onClick={addCapture}>
              + Capture
            </Button>
          </div>
          {step.captures.length === 0 && (
            <Text type="secondary" style={{ fontSize: 11, fontStyle: 'italic' }}>
              At least one capture is required before an LV can bind to this step.
            </Text>
          )}
          {step.captures.map((c, idx) => (
            <div
              // Key on idx ALONE — not idx + name. Including the name
              // (which is the editable field) changes the key on every
              // keystroke, which unmounts/remounts the row and steals
              // focus from the name Input mid-type. Captures have no
              // stable uid today and the list is short + non-reorderable,
              // so idx is the right primary key.
              key={idx}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                border: `1px dashed ${token.colorBorderSecondary}`,
                borderRadius: 4,
                padding: 8,
                marginBottom: 6,
              }}
            >
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <Input
                  size="small"
                  style={{ width: 160, flexShrink: 0 }}
                  prefix={<Text type="secondary">name</Text>}
                  value={c.name}
                  onChange={(e) => updateCapture(idx, { ...c, name: e.target.value })}
                />
                <ExtractorEditor
                  compact
                  value={c.extractor}
                  onChange={(extractor) => updateCapture(idx, { ...c, extractor })}
                />
                <Button
                  size="small"
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => removeCapture(idx)}
                  aria-label={`Remove capture ${c.name || idx + 1}`}
                />
              </div>
              {/* Expose switch — flipping on creates a Live Variable
               *  (on save) that resolves `{{live.<liveName>}}` from
               *  this capture. Off by default for pre-existing captures
               *  without an LV; on by default for newly-added captures.
               *  The live-name defaults to the capture name but can be
               *  overridden inline for alias-style renames. */}
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <Switch
                  size="small"
                  checked={c.exposed}
                  onChange={(exposed) => {
                    const next: DraftCapture = { ...c, exposed };
                    // First-time expose seeds liveName from capture
                    // name so the user sees a sensible default.
                    if (exposed && !c.liveName.trim()) next.liveName = c.name;
                    updateCapture(idx, next);
                  }}
                  aria-label={`Expose capture ${c.name || idx + 1} as live variable`}
                />
                <Text type="secondary" style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {scopeBadge('live', 13)} Expose as
                </Text>
                <span style={{ fontFamily: "'SF Mono', monospace", fontSize: 11, color: token.colorTextTertiary }}>
                  {'{{'}live.
                </span>
                <Input
                  size="small"
                  disabled={!c.exposed}
                  style={{ width: 180 }}
                  placeholder={c.name || 'name'}
                  value={c.liveName}
                  onChange={(e) => updateCapture(idx, { ...c, liveName: e.target.value })}
                />
                <span style={{ fontFamily: "'SF Mono', monospace", fontSize: 11, color: token.colorTextTertiary }}>
                  {'}}'}
                </span>
                <Tooltip title="When on, saving the workflow creates a Live Variable that resolves `{{live.<name>}}` from this capture. Turn off to use the capture only inside this workflow (e.g. via {{step.<stepId>.<captureName>}}).">
                  <InfoCircleOutlined style={{ fontSize: 11, color: token.colorTextTertiary, cursor: 'help' }} />
                </Tooltip>
              </div>
            </div>
          ))}
        </div>

        {/* ── Phase I sections ──────────────────────────────────── */}

        <Collapse
          size="small"
          ghost
          defaultActiveKey={[]}
          items={[
            {
              key: 'deps',
              label: (
                <span style={{ fontSize: 11 }}>
                  <BranchesOutlined style={{ marginRight: 4 }} />
                  <span style={{ textTransform: 'uppercase', letterSpacing: 0.4, color: token.colorTextSecondary }}>
                    Depends on
                  </span>
                  <span style={{ marginLeft: 6, color: token.colorTextTertiary }}>
                    {dependsOnValue === undefined
                      ? '(implicit — prior step)'
                      : dependsOnValue.length === 0
                        ? '(root)'
                        : `(${dependsOnValue.join(', ')})`}
                  </span>
                </span>
              ),
              children: (
                <div style={{ padding: '0 0 4px' }}>
                  <Tooltip open={dependsOnError ? undefined : false} title={dependsOnError?.message}>
                    <Select
                      size="small"
                      mode="multiple"
                      style={{ width: '100%' }}
                      placeholder="Select ancestor step(s) — empty = root step"
                      status={dependsOnError ? 'error' : undefined}
                      value={dependsOnValue ?? []}
                      options={allStepIds.map((s) => ({ value: s.id, label: s.label }))}
                      onChange={handleDependsOnChange}
                    />
                  </Tooltip>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      marginTop: 4,
                      fontSize: 11,
                      color: token.colorTextTertiary,
                    }}
                  >
                    {dependsOnValue === undefined ? (
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        No explicit dependsOn — implicitly depends on the previous step in declared order.
                      </Text>
                    ) : dependsOnValue.length === 0 ? (
                      <>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          Explicit root — runs as soon as the workflow starts.
                        </Text>
                        <Button
                          size="small"
                          type="link"
                          style={{ fontSize: 11, padding: 0 }}
                          onClick={clearExplicitDependsOn}
                        >
                          Use implicit
                        </Button>
                      </>
                    ) : (
                      <>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          Step waits for {dependsOnValue.length} ancestor{dependsOnValue.length === 1 ? '' : 's'} to
                          complete or skip.
                        </Text>
                        <Button
                          size="small"
                          type="link"
                          style={{ fontSize: 11, padding: 0 }}
                          onClick={clearExplicitDependsOn}
                        >
                          Reset
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ),
            },
            {
              key: 'runIf',
              label: (
                <span style={{ fontSize: 11 }}>
                  <span style={{ textTransform: 'uppercase', letterSpacing: 0.4, color: token.colorTextSecondary }}>
                    Run condition
                  </span>
                  <span style={{ marginLeft: 6, color: token.colorTextTertiary }}>
                    {runIfCount === 0 ? '(none)' : `(${runIfCount})`}
                  </span>
                </span>
              ),
              children: (
                <StepGateEditor
                  value={step.runIf}
                  onChange={handleRunIfChange}
                  reachableSteps={reachableSteps}
                  capturesByStepId={capturesByStepId}
                  errors={gateErrors}
                />
              ),
            },
            {
              key: 'priority',
              label: (
                <span style={{ fontSize: 11 }}>
                  <span style={{ textTransform: 'uppercase', letterSpacing: 0.4, color: token.colorTextSecondary }}>
                    Priority
                  </span>
                  <span style={{ marginLeft: 6, color: token.colorTextTertiary }}>
                    {priority ? `(${priority.stepId}.${priority.captureName})` : '(none)'}
                  </span>
                </span>
              ),
              children: (
                <div style={{ padding: '0 0 4px' }}>
                  <Space wrap size={6} style={{ width: '100%' }}>
                    <Tooltip
                      open={priorityError && priorityError.issue !== 'priority-unknown-capture' ? undefined : false}
                      title={priorityError?.message}
                    >
                      <Select
                        size="small"
                        placeholder="Ancestor step"
                        style={{ width: 160 }}
                        status={
                          priorityError && priorityError.issue !== 'priority-unknown-capture' ? 'error' : undefined
                        }
                        value={priority?.stepId}
                        options={priorityStepOptions}
                        onChange={(stepId) => {
                          setPriority({
                            stepId,
                            captureName: priority?.captureName ?? '',
                            sort: priority?.sort,
                          });
                        }}
                      />
                    </Tooltip>
                    <Tooltip
                      open={priorityError?.issue === 'priority-unknown-capture' ? undefined : false}
                      title={priorityError?.message}
                    >
                      <Select
                        size="small"
                        placeholder="Capture name"
                        style={{ width: 160 }}
                        disabled={!priority?.stepId}
                        status={priorityError?.issue === 'priority-unknown-capture' ? 'error' : undefined}
                        value={priority?.captureName}
                        options={priorityCaptureOptions}
                        onChange={(captureName) => {
                          if (!priority) return;
                          setPriority({ ...priority, captureName });
                        }}
                      />
                    </Tooltip>
                    <Select
                      size="small"
                      style={{ width: 140 }}
                      disabled={!priority?.stepId}
                      value={priority?.sort ?? 'numeric'}
                      options={[
                        { value: 'numeric', label: 'Numeric' },
                        { value: 'lexicographic', label: 'Lexicographic' },
                      ]}
                      onChange={(sort) => {
                        if (!priority) return;
                        setPriority({ ...priority, sort });
                      }}
                    />
                    <Tooltip title="When multiple steps can run next, the one with the lowest priority value runs first. Missing values sort last.">
                      <InfoCircleOutlined style={{ fontSize: 12, color: token.colorTextTertiary }} />
                    </Tooltip>
                    {priority && (
                      <Button size="small" type="text" onClick={() => setPriority(undefined)}>
                        Clear
                      </Button>
                    )}
                  </Space>
                </div>
              ),
            },
            // ── Show-but-disable: retry policy ─────────────────────
            {
              key: 'retry',
              label: (
                <Tooltip title="Per-step retry coming in a future release. Whole-workflow retry policy is configured in the workflow's refresh policy.">
                  <span style={{ fontSize: 11, color: token.colorTextDisabled }}>
                    <ReloadOutlined style={{ marginRight: 4 }} />
                    <span style={{ textTransform: 'uppercase', letterSpacing: 0.4 }}>Retry policy</span>
                    <span style={{ marginLeft: 6, fontStyle: 'italic' }}>(coming soon)</span>
                  </span>
                </Tooltip>
              ),
              collapsible: 'disabled',
              children: null,
            },
            // ── Show-but-disable: timeout ──────────────────────────
            {
              key: 'timeout',
              label: (
                <Tooltip title="Per-step timeout coming in a future release. The request executor's global timeout applies today.">
                  <span style={{ fontSize: 11, color: token.colorTextDisabled }}>
                    <ClockCircleOutlined style={{ marginRight: 4 }} />
                    <span style={{ textTransform: 'uppercase', letterSpacing: 0.4 }}>Timeout (ms)</span>
                    <span style={{ marginLeft: 6, fontStyle: 'italic' }}>(coming soon)</span>
                  </span>
                </Tooltip>
              ),
              collapsible: 'disabled',
              extra: (
                <InputNumber size="small" disabled placeholder="—" style={{ width: 120, pointerEvents: 'none' }} />
              ),
              children: null,
            },
          ]}
        />
      </Space>
    </div>
  );
};

export default WorkflowStepEditor;
