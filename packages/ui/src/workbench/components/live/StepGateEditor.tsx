/**
 * StepGateEditor — the Run condition card of a step's panel (the
 * workflows redesign, Step panel): the AND-of-clauses predicate editor
 * for a workflow step's optional `runIf` gate, as a table — the step a
 * clause reads, what it checks, what it expects, and whether it held in
 * the last run. The card's foot reads the logic back in a sentence.
 *
 * Surfaces the full architectural capability (match mode + 4 v1 clause
 * kinds + 3 future clause kinds + OR future) with a show-but-disable
 * policy on unimplemented features; see the live-orchestration plan
 * §UI — show-but-disable catalog.
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

import { CloseOutlined, InfoCircleOutlined } from '@ant-design/icons';
import type { MessageKey } from '@openheaders/i18n';
import type { StructuralError } from '@openheaders/core/live';
import type { StatusMatch, StepGate, StepGateClause, StepGateClauseKind } from '@openheaders/core/types';
import { generateUid } from '@openheaders/core/utils';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Button, ConfigProvider, Input, InputNumber, Segmented, Select, Tooltip, theme } from 'antd';
import type React from 'react';
import { useCallback, useMemo } from 'react';
import { clauseWords, type LabelTruth } from './graph-lines';
import WorkflowCard from './WorkflowCard';

// ── Clause-kind catalog (enabled + future) ────────────────────────

// Regex format example shown in the capture-pattern placeholder — raw
// by design, like the JSON body examples across the rule editors.
const GATE_PATTERN_EXAMPLE = '^Bearer .+$';

interface ClauseKindDef {
  value: StepGateClauseKind | FutureClauseKind;
  labelKey: MessageKey;
  disabled?: boolean;
  tooltipKey?: MessageKey;
}

/**
 * Sentinel values for clause kinds that don't exist in v1 schemas yet.
 * Rendered as disabled options to preview the architectural shape; the
 * user never picks these so they never need to round-trip through the
 * valibot schema.
 */
type FutureClauseKind = 'capture-numeric-compare' | 'capture-in-list' | 'header-contains';

const CLAUSE_KINDS: ClauseKindDef[] = [
  { value: 'status', labelKey: 'workbench.editors.live.gate.kindStatus' },
  { value: 'capture-exists', labelKey: 'workbench.editors.live.gate.kindCaptureExists' },
  { value: 'capture-equals', labelKey: 'workbench.editors.live.gate.kindCaptureEquals' },
  { value: 'capture-matches', labelKey: 'workbench.editors.live.gate.kindCaptureMatches' },
  {
    value: 'capture-numeric-compare',
    labelKey: 'workbench.editors.live.gate.kindNumericCompare',
    disabled: true,
    tooltipKey: 'workbench.editors.live.gate.futureNumericCompare',
  },
  {
    value: 'capture-in-list',
    labelKey: 'workbench.editors.live.gate.kindInList',
    disabled: true,
    tooltipKey: 'workbench.editors.live.gate.futureInList',
  },
  {
    value: 'header-contains',
    labelKey: 'workbench.editors.live.gate.kindHeaderContains',
    disabled: true,
    tooltipKey: 'workbench.editors.live.gate.futureHeaderContains',
  },
];

// ── Status-match mode catalog ─────────────────────────────────────

type StatusMatchMode = '2xx' | '3xx' | '4xx' | '5xx' | 'eq' | 'ne' | 'in';

const STATUS_MATCH_OPTIONS: { value: StatusMatchMode; labelKey: MessageKey }[] = [
  { value: '2xx', labelKey: 'workbench.editors.live.gate.status2xx' },
  { value: '3xx', labelKey: 'workbench.editors.live.gate.status3xx' },
  { value: '4xx', labelKey: 'workbench.editors.live.gate.status4xx' },
  { value: '5xx', labelKey: 'workbench.editors.live.gate.status5xx' },
  { value: 'eq', labelKey: 'workbench.editors.live.gate.statusEquals' },
  { value: 'ne', labelKey: 'workbench.editors.live.gate.statusNotEquals' },
  { value: 'in', labelKey: 'workbench.editors.live.gate.statusOneOf' },
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
  /** Whether a clause held in the last run, by its uid — absent where no run judged the step. */
  clauseTruth?: (clauseUid: string) => LabelTruth;
  /** The step waits for no other: with no clause it runs as the workflow starts. */
  root?: boolean;
  testId?: string;
  /** Canonical schema path of the gate — read by field-focus awareness. */
  fieldPath?: string;
}

const StepGateEditor: React.FC<StepGateEditorProps> = ({
  value,
  onChange,
  reachableSteps,
  capturesByStepId,
  errors = [],
  clauseTruth,
  root = false,
  testId,
  fieldPath,
}) => {
  const { token } = theme.useToken();
  const t = useT();
  // A read-only form switches every control off through the provider;
  // the match-mode switch does not hear it and is told here.
  const readOnly = ConfigProvider.useConfig().componentDisabled === true;
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

  // The logic read back: what the clauses say together, or what having none means.
  const summary =
    clauses.length > 0
      ? t('workbench.editors.live.gate.summaryAll', {
          conditions: clauses.map((clause) => `${clause.stepId} ${clauseWords(clause, t)}`).join(' · '),
        })
      : root
        ? t('workbench.editors.live.gate.summaryRoot')
        : t('workbench.editors.live.gate.noConditions');

  return (
    <WorkflowCard
      testId={testId}
      fieldPath={fieldPath}
      title={t('workbench.editors.live.sections.runCondition')}
      description={t('workbench.editors.live.gate.description')}
      extra={
        <>
          <Segmented
            value="all"
            disabled={readOnly}
            options={[
              { value: 'all', label: t('workbench.editors.live.gate.allAnd') },
              { value: 'any', label: t('workbench.editors.live.gate.anyOr'), disabled: true },
            ]}
          />
          {/* Tooltip on an adjacent info icon rather than on the disabled option
           *  itself — AntD applies `pointer-events: none` to disabled Segmented
           *  items which can swallow hover on the option's inner tooltip trigger.
           *  A sibling trigger is keyboard-discoverable (Tab → focus-shown
           *  tooltip) and never relies on the disabled-option hover working. */}
          <Tooltip title={t('workbench.editors.live.gate.orTooltip')}>
            <InfoCircleOutlined
              tabIndex={0}
              aria-label={t('workbench.editors.live.gate.matchModesAria')}
              style={{ fontSize: 11, color: token.colorTextTertiary, cursor: 'help' }}
            />
          </Tooltip>
          <Button onClick={addClause} data-testid="gate-add-condition">
            {t('workbench.editors.live.gate.addCondition')}
          </Button>
        </>
      }
      footer={<span data-testid="gate-summary">{summary}</span>}
    >
      {clauses.length > 0 && (
        <div className="oh-wf-card-columns oh-wf-gate-grid">
          <span>{t('workbench.editors.live.gate.stepPlaceholder')}</span>
          <span>{t('workbench.editors.live.gate.colCheck')}</span>
          <span>{t('workbench.editors.live.gate.colExpected')}</span>
          <span>{t('workbench.editors.live.panel.lastRun')}</span>
        </div>
      )}
      {clauses.map((clause, index) => (
        <ClauseRow
          key={clause.uid}
          index={index}
          clause={clause}
          truth={clauseTruth?.(clause.uid) ?? 'unknown'}
          stepOptions={stepOptions}
          capturesByStepId={capturesByStepId}
          errors={errors}
          onChange={(next) => updateClause(index, next)}
          onKindChange={(kind) => changeClauseKind(index, kind)}
          onRemove={() => removeClause(index)}
        />
      ))}
    </WorkflowCard>
  );
};

// ── Row ───────────────────────────────────────────────────────────

/** Whether a clause held in the last run, as its row says it. A dash where no run judged it. */
const TRUTH_WORD: Record<Exclude<LabelTruth, 'unknown'>, MessageKey> = {
  true: 'workbench.editors.live.gate.truthTrue',
  false: 'workbench.editors.live.gate.truthFalse',
};

interface ClauseRowProps {
  index: number;
  clause: StepGateClause;
  truth: LabelTruth;
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
  truth,
  stepOptions,
  capturesByStepId,
  errors,
  onChange,
  onKindChange,
  onRemove,
}) => {
  const { token } = theme.useToken();
  const t = useT();

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
        style={{ minWidth: 0 }}
        status={stepError ? 'error' : undefined}
        data-testid={`gate-clause-${index}-step`}
        placeholder={t('workbench.editors.live.gate.stepPlaceholder')}
        value={clause.stepId || undefined}
        options={stepOptions}
        onChange={(stepId) => onChange({ ...clause, stepId } as StepGateClause)}
      />
    </Tooltip>
  );

  const renderKindSelect = () => (
    <Select
      style={{ minWidth: 0 }}
      data-testid={`gate-clause-${index}-kind`}
      value={clause.kind}
      popupMatchSelectWidth={220}
      options={CLAUSE_KINDS.map((k) => ({
        value: k.value,
        disabled: k.disabled,
        label: k.disabled ? (
          <Tooltip title={k.tooltipKey ? t(k.tooltipKey) : undefined} placement="right">
            <span style={{ color: token.colorTextDisabled }}>{t(k.labelKey)}</span>
          </Tooltip>
        ) : (
          t(k.labelKey)
        ),
      }))}
      onChange={(nextKind) => onKindChange(nextKind as StepGateClauseKind | FutureClauseKind)}
    />
  );

  const captureSelect =
    clause.kind === 'status' ? null : (
      <Tooltip open={captureError ? undefined : false} title={captureError?.message}>
        <Select
          style={{ flex: '1 1 84px', minWidth: 0 }}
          status={captureError ? 'error' : undefined}
          data-testid={`gate-clause-${index}-capture`}
          placeholder={t('workbench.editors.live.gate.capturePlaceholder')}
          value={clause.captureName || undefined}
          options={captureOptions}
          onChange={(captureName) => onChange({ ...clause, captureName })}
        />
      </Tooltip>
    );

  return (
    <div className="oh-wf-card-row oh-wf-gate-grid" data-testid={`gate-clause-${index}`}>
      {renderStepSelect()}
      {renderKindSelect()}
      {/* What the clause expects: its own controls, on a second line where the panel is narrow. */}
      <div className="oh-wf-cell-controls">
        {clause.kind === 'status' ? (
          <StatusMatchControls match={clause.match} onChange={(match) => onChange({ ...clause, match })} />
        ) : (
          captureSelect
        )}
        {clause.kind === 'capture-equals' && (
          <Input
            style={{ flex: '1 1 72px', minWidth: 0 }}
            placeholder={t('workbench.editors.live.gate.equalsPlaceholder')}
            data-testid={`gate-clause-${index}-value`}
            value={clause.value}
            onChange={(e) => onChange({ ...clause, value: e.target.value })}
          />
        )}
        {clause.kind === 'capture-matches' && (
          <Input
            style={{ flex: '1 1 72px', minWidth: 0, fontFamily: 'monospace' }}
            placeholder={GATE_PATTERN_EXAMPLE}
            status={captureError?.issue === 'gate-invalid-regex' ? 'error' : undefined}
            data-testid={`gate-clause-${index}-pattern`}
            value={clause.pattern}
            onChange={(e) => onChange({ ...clause, pattern: e.target.value })}
          />
        )}
      </div>
      <span className="oh-wf-gate-truth" data-testid={`gate-clause-${index}-truth`} data-truth={truth}>
        {truth === 'unknown' ? '—' : t(TRUTH_WORD[truth])}
      </span>
      <Button
        type="text"
        icon={<CloseOutlined style={{ fontSize: 10 }} />}
        onClick={onRemove}
        style={{ color: token.colorTextTertiary }}
        aria-label={t('workbench.editors.live.gate.removeClauseAria', { number: index + 1 })}
      />
    </div>
  );
};

// ── Status-match controls ─────────────────────────────────────────

export const StatusMatchControls: React.FC<{
  match: StatusMatch;
  onChange: (next: StatusMatch) => void;
}> = ({ match, onChange }) => {
  const { token } = theme.useToken();
  const t = useT();
  const mode = statusMatchMode(match);

  const onModeChange = (nextMode: StatusMatchMode) => {
    onChange(defaultStatusMatch(nextMode));
  };

  return (
    <>
      <Select
        size="small"
        style={{ flex: '1 1 96px', minWidth: 0 }}
        value={mode}
        options={STATUS_MATCH_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
        onChange={(v) => onModeChange(v as StatusMatchMode)}
      />
      {(mode === 'eq' || mode === 'ne') && Array.isArray(match) ? (
        <InputNumber
          size="small"
          min={100}
          max={599}
          style={{ width: 64, flexShrink: 0 }}
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
          style={{ flex: '1 1 96px', minWidth: 0 }}
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
        <Tooltip title={t('workbench.editors.live.gate.statusClassTooltip')}>
          <InfoCircleOutlined style={{ fontSize: 11, color: token.colorTextTertiary }} />
        </Tooltip>
      )}
    </>
  );
};

export default StepGateEditor;
