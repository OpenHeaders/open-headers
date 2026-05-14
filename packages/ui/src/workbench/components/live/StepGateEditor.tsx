/**
 * StepGateEditor — AND-of-clauses predicate editor for a workflow step's
 * optional `runIf` gate. Surfaces the full architectural capability
 * (match mode + 4 v1 clause kinds + 3 future clause kinds + OR future)
 * with a show-but-disable policy on unimplemented features; see
 * `docs/LIVE_ORCHESTRATION_PLAN.md` §UI — show-but-disable catalog.
 *
 * Validation errors flow in through `errors`; every clause row that
 * matches an error kind (`gate-unknown-stepid` / `gate-unreachable-stepid`
 * / `gate-unknown-capture` / `gate-invalid-regex`) renders with an inline
 * red tooltip. Parent runs `validateWorkflowShape` on the whole draft and
 * passes the subset relevant to this step.
 *
 * Pure controlled component — owns no state. An empty clause list +
 * `value={undefined}` both render the "no conditions" state; callers
 * pass `undefined` when the step has no gate at all vs `{ all: [] }` for
 * an explicit empty one. The component never produces `{ all: [] }`:
 * when the list empties, `onChange(undefined)` clears the gate entirely.
 */

import { CloseOutlined, InfoCircleOutlined, PlusOutlined } from '@ant-design/icons';
import type { StructuralError } from '@openheaders/core/live';
import type { StatusMatch, StepGate, StepGateClause, StepGateClauseKind } from '@openheaders/core/types';
import { generateUid } from '@openheaders/core/utils';
import { Button, Input, InputNumber, Segmented, Select, Tag, Tooltip, theme } from 'antd';
import type React from 'react';
import { useCallback, useMemo } from 'react';

// ── Clause-kind catalog (enabled + future) ────────────────────────

interface ClauseKindDef {
  value: StepGateClauseKind | FutureClauseKind;
  label: string;
  disabled?: boolean;
  tooltip?: string;
}

/**
 * Sentinel values for clause kinds that don't exist in v1 schemas yet.
 * Rendered as disabled options to preview the architectural shape; the
 * user never picks these so they never need to round-trip through the
 * valibot schema.
 */
type FutureClauseKind = 'capture-numeric-compare' | 'capture-in-list' | 'header-contains';

const CLAUSE_KINDS: ClauseKindDef[] = [
  { value: 'status', label: 'Status' },
  { value: 'capture-exists', label: 'Capture exists' },
  { value: 'capture-equals', label: 'Capture equals' },
  { value: 'capture-matches', label: 'Capture matches' },
  {
    value: 'capture-numeric-compare',
    label: 'Capture numeric compare',
    disabled: true,
    tooltip: 'Numeric compare — coming in a future release.',
  },
  {
    value: 'capture-in-list',
    label: 'Capture in list',
    disabled: true,
    tooltip: 'In-list match — coming in a future release.',
  },
  {
    value: 'header-contains',
    label: 'Header contains',
    disabled: true,
    tooltip: 'Header contains — coming in a future release.',
  },
];

// ── Status-match mode catalog ─────────────────────────────────────

type StatusMatchMode = '2xx' | '3xx' | '4xx' | '5xx' | 'eq' | 'ne' | 'in';

const STATUS_MATCH_OPTIONS: { value: StatusMatchMode; label: string }[] = [
  { value: '2xx', label: '2xx (any success)' },
  { value: '3xx', label: '3xx (redirect)' },
  { value: '4xx', label: '4xx (client error)' },
  { value: '5xx', label: '5xx (server error)' },
  { value: 'eq', label: 'equals…' },
  { value: 'ne', label: 'not equals…' },
  { value: 'in', label: 'one of…' },
];

function statusMatchMode(match: StatusMatch): StatusMatchMode {
  if (typeof match === 'string') return match;
  return match[0];
}

function defaultStatusMatch(mode: StatusMatchMode): StatusMatch {
  switch (mode) {
    case '2xx':
    case '3xx':
    case '4xx':
    case '5xx':
      return mode;
    case 'eq':
      return ['eq', 200];
    case 'ne':
      return ['ne', 200];
    case 'in':
      return ['in', [200]];
  }
}

// ── Component ─────────────────────────────────────────────────────

interface StepGateEditorProps {
  /** The gate as it exists today. `undefined` = no gate (always runs). */
  value: StepGate | undefined;
  /** Clearing the last clause emits `undefined`, not `{ all: [] }`. */
  onChange: (next: StepGate | undefined) => void;
  /**
   * Reachable ancestor step ids for the step that owns this gate. Only
   * these show up in the step dropdown — unreachable steps would fail
   * save-time validation so we don't offer them.
   */
  reachableSteps: { id: string; label: string }[];
  /**
   * Map of stepId → declared capture names. Used to populate the capture
   * dropdown per clause and to validate `capture-*` clause shapes.
   */
  capturesByStepId: Map<string, string[]>;
  /**
   * Structural errors relevant to THIS step's runIf clauses. Parent
   * filters the full `validateWorkflowShape` output.
   */
  errors?: StructuralError[];
}

const StepGateEditor: React.FC<StepGateEditorProps> = ({
  value,
  onChange,
  reachableSteps,
  capturesByStepId,
  errors = [],
}) => {
  const { token } = theme.useToken();
  const clauses: StepGateClause[] = useMemo(() => value?.all ?? [], [value]);

  const emitNext = useCallback(
    (next: StepGateClause[]) => {
      if (next.length === 0) {
        onChange(undefined);
        return;
      }
      onChange({ all: next });
    },
    [onChange],
  );

  const updateClause = useCallback(
    (index: number, next: StepGateClause) => {
      emitNext(clauses.map((c, i) => (i === index ? next : c)));
    },
    [clauses, emitNext],
  );

  const removeClause = useCallback(
    (index: number) => {
      emitNext(clauses.filter((_, i) => i !== index));
    },
    [clauses, emitNext],
  );

  const addClause = useCallback(() => {
    // Seed with a harmless `status` 2xx on the first reachable step
    // (if any); otherwise leave stepId empty — the validator will flag
    // it and the tooltip guides the user.
    const firstStep = reachableSteps[0]?.id ?? '';
    const seed: StepGateClause = { uid: generateUid(), kind: 'status', stepId: firstStep, match: '2xx' };
    emitNext([...clauses, seed]);
  }, [clauses, emitNext, reachableSteps]);

  const changeClauseKind = useCallback(
    (index: number, nextKind: StepGateClauseKind | FutureClauseKind) => {
      if (nextKind === 'capture-numeric-compare' || nextKind === 'capture-in-list' || nextKind === 'header-contains') {
        return; // disabled; selection suppressed
      }
      const current = clauses[index];
      const uid = current.uid;
      const stepId = current.stepId;
      const captureName = current.kind !== 'status' ? current.captureName : '';
      switch (nextKind) {
        case 'status':
          updateClause(index, { uid, kind: 'status', stepId, match: '2xx' });
          return;
        case 'capture-exists':
          updateClause(index, { uid, kind: 'capture-exists', stepId, captureName });
          return;
        case 'capture-equals':
          updateClause(index, { uid, kind: 'capture-equals', stepId, captureName, value: '' });
          return;
        case 'capture-matches':
          updateClause(index, { uid, kind: 'capture-matches', stepId, captureName, pattern: '' });
          return;
      }
    },
    [clauses, updateClause],
  );

  const stepOptions = useMemo(() => reachableSteps.map((s) => ({ value: s.id, label: s.label })), [reachableSteps]);

  return (
    <div
      style={{
        border: `1px solid ${token.colorBorder}`,
        borderRadius: 6,
        background: token.colorBgContainer,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 10px',
          borderBottom: clauses.length > 0 ? `1px solid ${token.colorBorderSecondary}` : undefined,
        }}
      >
        <Segmented
          size="small"
          value="all"
          options={[
            { value: 'all', label: 'All (AND)' },
            { value: 'any', label: 'Any (OR)', disabled: true },
          ]}
        />
        {/* Tooltip on an adjacent info icon rather than on the disabled option
         *  itself — AntD applies `pointer-events: none` to disabled Segmented
         *  items which can swallow hover on the option's inner tooltip trigger.
         *  A sibling trigger is keyboard-discoverable (Tab → focus-shown
         *  tooltip) and never relies on the disabled-option hover working. */}
        <Tooltip title="OR logic coming in a future release. Use multiple steps with mutually-exclusive gates for now.">
          <InfoCircleOutlined
            tabIndex={0}
            aria-label="About match modes"
            style={{ fontSize: 11, color: token.colorTextTertiary, cursor: 'help' }}
          />
        </Tooltip>
        <span style={{ fontSize: 11, color: token.colorTextTertiary }}>
          {clauses.length === 0
            ? 'No conditions — step runs whenever its dependencies complete.'
            : `${clauses.length} condition(s)`}
        </span>
      </div>

      {clauses.map((clause, index) => (
        <ClauseRow
          // Clauses don't carry a stable id; position + kind makes the key
          // unique enough for this short-lived list. Adding/removing
          // triggers a re-render anyway.
          key={`${index}-${clause.kind}`}
          index={index}
          clause={clause}
          isFirst={index === 0}
          stepOptions={stepOptions}
          capturesByStepId={capturesByStepId}
          errors={errors}
          onChange={(next) => updateClause(index, next)}
          onKindChange={(kind) => changeClauseKind(index, kind)}
          onRemove={() => removeClause(index)}
        />
      ))}

      <div
        style={{
          padding: '6px 10px',
          borderTop: clauses.length > 0 ? `1px solid ${token.colorBorderSecondary}` : undefined,
        }}
      >
        <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={addClause} style={{ fontSize: 12 }}>
          Add condition
        </Button>
      </div>
    </div>
  );
};

// ── Row ───────────────────────────────────────────────────────────

interface ClauseRowProps {
  index: number;
  clause: StepGateClause;
  isFirst: boolean;
  stepOptions: { value: string; label: string }[];
  capturesByStepId: Map<string, string[]>;
  errors: StructuralError[];
  onChange: (next: StepGateClause) => void;
  onKindChange: (kind: StepGateClauseKind | FutureClauseKind) => void;
  onRemove: () => void;
}

const ClauseRow: React.FC<ClauseRowProps> = ({
  index,
  clause,
  isFirst,
  stepOptions,
  capturesByStepId,
  errors,
  onChange,
  onKindChange,
  onRemove,
}) => {
  const { token } = theme.useToken();

  // Extract the errors that target THIS clause's step/capture reference
  // so we can badge the relevant field. The validator currently scopes
  // errors to the step that owns the gate (stepId field on the error
  // object). We filter by clause shape — if the error cites the same
  // referencedStepId + referencedCaptureName, it's about this clause.
  const stepError = errors.find(
    (e) =>
      (e.issue === 'gate-unknown-stepid' || e.issue === 'gate-unreachable-stepid') &&
      e.referencedStepId === clause.stepId,
  );
  const captureError =
    clause.kind !== 'status'
      ? errors.find(
          (e) =>
            (e.issue === 'gate-unknown-capture' || e.issue === 'gate-invalid-regex') &&
            e.referencedStepId === clause.stepId &&
            e.referencedCaptureName === clause.captureName,
        )
      : undefined;

  const captureOptions = useMemo(() => {
    const caps = capturesByStepId.get(clause.stepId) ?? [];
    return caps.map((c) => ({ value: c, label: c }));
  }, [capturesByStepId, clause.stepId]);

  const renderStepSelect = () => (
    <Tooltip open={stepError ? undefined : false} title={stepError?.message}>
      <Select
        size="small"
        style={{ width: 180, flexShrink: 0 }}
        status={stepError ? 'error' : undefined}
        placeholder="Step"
        value={clause.stepId || undefined}
        options={stepOptions}
        onChange={(stepId) => onChange({ ...clause, stepId } as StepGateClause)}
      />
    </Tooltip>
  );

  const renderKindSelect = () => (
    <Select
      size="small"
      style={{ width: 180, flexShrink: 0 }}
      value={clause.kind}
      popupMatchSelectWidth={220}
      options={CLAUSE_KINDS.map((k) => ({
        value: k.value,
        disabled: k.disabled,
        label: k.disabled ? (
          <Tooltip title={k.tooltip} placement="right">
            <span style={{ color: token.colorTextDisabled }}>{k.label}</span>
          </Tooltip>
        ) : (
          k.label
        ),
      }))}
      onChange={(nextKind) => onKindChange(nextKind as StepGateClauseKind | FutureClauseKind)}
    />
  );

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 10px',
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
      }}
    >
      {!isFirst && (
        <Tag
          color="blue"
          style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: 1,
            lineHeight: '18px',
            margin: 0,
            padding: '0 4px',
            flexShrink: 0,
          }}
        >
          AND
        </Tag>
      )}

      {renderStepSelect()}
      {renderKindSelect()}

      {clause.kind === 'status' ? (
        <StatusMatchControls match={clause.match} onChange={(match) => onChange({ ...clause, match })} />
      ) : clause.kind === 'capture-exists' ? (
        <Tooltip open={captureError ? undefined : false} title={captureError?.message}>
          <Select
            size="small"
            style={{ flex: 1, minWidth: 160 }}
            status={captureError ? 'error' : undefined}
            placeholder="Capture name"
            value={clause.captureName || undefined}
            options={captureOptions}
            onChange={(captureName) => onChange({ ...clause, captureName })}
          />
        </Tooltip>
      ) : clause.kind === 'capture-equals' ? (
        <>
          <Tooltip open={captureError ? undefined : false} title={captureError?.message}>
            <Select
              size="small"
              style={{ width: 160, flexShrink: 0 }}
              status={captureError ? 'error' : undefined}
              placeholder="Capture name"
              value={clause.captureName || undefined}
              options={captureOptions}
              onChange={(captureName) => onChange({ ...clause, captureName })}
            />
          </Tooltip>
          <Input
            size="small"
            style={{ flex: 1, minWidth: 100 }}
            placeholder="Equals value"
            value={clause.value}
            onChange={(e) => onChange({ ...clause, value: e.target.value })}
          />
        </>
      ) : (
        // capture-matches
        <>
          <Tooltip open={captureError ? undefined : false} title={captureError?.message}>
            <Select
              size="small"
              style={{ width: 160, flexShrink: 0 }}
              status={captureError ? 'error' : undefined}
              placeholder="Capture name"
              value={clause.captureName || undefined}
              options={captureOptions}
              onChange={(captureName) => onChange({ ...clause, captureName })}
            />
          </Tooltip>
          <Input
            size="small"
            style={{ flex: 1, minWidth: 100, fontFamily: 'monospace' }}
            placeholder="^Bearer .+$"
            status={captureError?.issue === 'gate-invalid-regex' ? 'error' : undefined}
            value={clause.pattern}
            onChange={(e) => onChange({ ...clause, pattern: e.target.value })}
          />
        </>
      )}

      <Button
        type="text"
        size="small"
        icon={<CloseOutlined style={{ fontSize: 10 }} />}
        onClick={onRemove}
        style={{ color: token.colorTextTertiary, flexShrink: 0 }}
        aria-label={`Remove clause ${index + 1}`}
      />
    </div>
  );
};

// ── Status-match controls ─────────────────────────────────────────

const StatusMatchControls: React.FC<{
  match: StatusMatch;
  onChange: (next: StatusMatch) => void;
}> = ({ match, onChange }) => {
  const mode = statusMatchMode(match);

  const onModeChange = (nextMode: StatusMatchMode) => {
    onChange(defaultStatusMatch(nextMode));
  };

  return (
    <>
      <Select
        size="small"
        style={{ width: 150, flexShrink: 0 }}
        value={mode}
        options={STATUS_MATCH_OPTIONS}
        onChange={(v) => onModeChange(v as StatusMatchMode)}
      />
      {(mode === 'eq' || mode === 'ne') && Array.isArray(match) ? (
        <InputNumber
          size="small"
          min={100}
          max={599}
          style={{ width: 90, flexShrink: 0 }}
          placeholder="200"
          value={typeof match[1] === 'number' ? match[1] : undefined}
          onChange={(n) => {
            if (typeof n !== 'number' || !Number.isFinite(n)) return;
            const clamped = Math.min(599, Math.max(100, Math.round(n)));
            onChange([mode, clamped]);
          }}
        />
      ) : null}
      {mode === 'in' && Array.isArray(match) && match[0] === 'in' ? (
        <Select
          size="small"
          mode="tags"
          style={{ flex: 1, minWidth: 150 }}
          placeholder="200, 201, 204"
          value={(match[1] as number[]).map(String)}
          onChange={(vals: string[]) => {
            const parsed = vals
              .map((v) => Number.parseInt(v, 10))
              .filter((n) => Number.isFinite(n) && n >= 100 && n <= 599);
            onChange(['in', parsed.length > 0 ? parsed : [200]]);
          }}
          tokenSeparators={[',', ' ']}
        />
      ) : null}
      {(mode === '2xx' || mode === '3xx' || mode === '4xx' || mode === '5xx') && (
        <Tooltip title="Matches any status in the class (e.g. 2xx = 200-299).">
          <InfoCircleOutlined style={{ fontSize: 11, color: 'rgba(0,0,0,0.35)' }} />
        </Tooltip>
      )}
    </>
  );
};

export default StepGateEditor;
