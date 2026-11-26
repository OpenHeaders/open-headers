/**
 * WorkflowStepEditor — draft-level editor for a single step of an action
 * the model knows: a call, or a `listen`, a `send` or an `expect` on a
 * session (a step of any other action has its own card,
 * `UnknownStepCard`).
 *
 * Used inside the workflow's step panel, for the selected step. The
 * step-id chip is editable because `{{step.<id>.<capture>}}` references
 * are stable identifiers users might reference from later steps.
 *
 * The card is a shell every action shares — its id, its type selector,
 * its place among the steps, the sections `Depends on`, `Run condition`
 * and `Priority`, and a foot for an issue no field owns — around the
 * fields of the step's own action:
 *   - a call: `CallStepFields`, and the sections `Retry policy`,
 *     `Timeout`, `Success criteria`, `Poll` and `Scripts`;
 *   - a session step: `SessionStepFields`.
 *
 * The type selector is the action (the workflow runs plan, Decisions
 * log, S16). Foreach and Composite stay the show-but-disable catalog
 * entry, with a tooltip naming the future capability.
 */

import { DeleteOutlined, DownOutlined, UpOutlined } from '@ant-design/icons';
import {
  type DraftCallStep,
  type DraftKnownStep,
  type DraftStep,
  isExpectStep,
  isListenStep,
  isSendStep,
  isSessionStep,
  type StructuralError,
  type StructuralIssue,
} from '@openheaders/core/live';
import type { Criterion, MqttRequest, PriorityRef, StepGate, StepPoll, StepRetryPolicy } from '@openheaders/core/types';
import type { MessageKey } from '@openheaders/i18n';
import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import { LIVE_WORKFLOW_FIELD } from '@openheaders/ui/shared/awareness/live-paths';
import { noteFeatureUsed } from '@openheaders/ui/shared/product-telemetry';
import {
  Button,
  Collapse,
  type CollapseProps,
  ConfigProvider,
  Input,
  Select,
  Space,
  Tag,
  Tooltip,
  Typography,
  theme,
} from 'antd';
import type { GlobalToken } from 'antd/es/theme/interface';
import type React from 'react';
import { useMemo } from 'react';
import CallStepFields from './CallStepFields';
import type { DependencyRow } from './dependencies-view';
import { ExpectStepFields, ListenStepFields, SendStepFields } from './SessionStepFields';
import { STEP_ACTIONS, type StepAction, stepActionOf } from './step-action';
import type { StepRequestChoice } from './workflow-step-request-options';
import { buildCallStepSections, buildSharedStepSections } from './workflow-step-sections';

const { Text } = Typography;

/** The issues a field of the card shows where it sits — every other one is said at the card's foot. */
const FIELD_OWNED_ISSUES: ReadonlySet<StructuralIssue> = new Set([
  'duplicate-step-id',
  'step-unknown-dep',
  'depends-on-cycle',
  'step-request-missing',
  'gate-unknown-stepid',
  'gate-unreachable-stepid',
  'gate-unknown-capture',
  'gate-invalid-regex',
  'priority-unknown-stepid',
  'priority-unreachable-stepid',
  'priority-unknown-capture',
  'criterion-invalid-regex',
  'poll-without-criteria',
  'poll-exceeds-limit',
  'listen-request-missing',
  'session-step-unknown-listen',
  'session-step-unreachable-listen',
  'send-without-message',
  'expect-unknown-trigger',
  'expect-unreachable-trigger',
  'expect-unarmed-trigger',
  'expect-address-reads-trigger',
]);

/** The selector's word for each action — the Run view's own. */
const ACTION_LABEL: Record<StepAction, MessageKey> = {
  call: 'workbench.editors.live.run.action.call',
  listen: 'workbench.editors.live.run.action.listen',
  send: 'workbench.editors.live.run.action.send',
  expect: 'workbench.editors.live.run.action.expect',
};

interface Props {
  step: DraftKnownStep;
  index: number;
  totalSteps: number;
  /** Requests a call's Request picker can choose from. */
  availableRequests: StepRequestChoice[];
  onChange: (next: DraftKnownStep) => void;
  /** The type selector picked another action — the owner rebuilds the step under it. */
  onActionChange?: (action: StepAction) => void;
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
  // ── Session context (the workflow runs plan, Decisions log, S16) ──
  /** The draft's steps in order — the listens a step can be on, the steps an expect can wait after. */
  steps?: readonly DraftStep[];
  /** The workspace's MQTT requests — what a listen opens, and whose saved messages a send picks from. */
  mqttRequests?: readonly MqttRequest[];
  /** The MQTT requests as the request picker shows them. */
  sessionRequests?: StepRequestChoice[];
  /** The selector offers Listen, Send and Expect. A step that already is one keeps its own. */
  sessionAuthoring?: boolean;
  /** The workflow publishes live variables — a call's captures carry the exposure row. */
  exposable?: boolean;
}

/** A call's own sections, with the setters that write each back onto the step. */
function callSectionsOf(
  step: DraftCallStep,
  onChange: (next: DraftCallStep) => void,
  context: { token: GlobalToken; t: Translate; index: number; errors: StructuralError[]; readOnly: boolean },
): NonNullable<CollapseProps['items']> {
  const setRetry = (next: StepRetryPolicy | undefined) => {
    const nextStep = { ...step };
    if (next === undefined) {
      delete nextStep.retry;
    } else {
      nextStep.retry = next;
    }
    onChange(nextStep);
  };

  const setTimeoutMs = (next: number | undefined) => {
    const nextStep = { ...step };
    if (next === undefined) {
      delete nextStep.timeoutMs;
    } else {
      nextStep.timeoutMs = next;
    }
    onChange(nextStep);
  };

  // An emptied list deletes the field: absent is "any response that
  // arrived passes", and an empty array would say the same twice.
  const setSuccessCriteria = (next: Criterion[]) => {
    const nextStep = { ...step };
    if (next.length === 0) {
      delete nextStep.successCriteria;
    } else {
      nextStep.successCriteria = next;
    }
    onChange(nextStep);
  };

  const setPoll = (next: StepPoll | undefined) => {
    const nextStep = { ...step };
    if (next === undefined) {
      delete nextStep.poll;
    } else {
      nextStep.poll = next;
    }
    onChange(nextStep);
  };

  // Off deletes the field rather than persisting `false` — absent is
  // the canonical "no scripts" state (schema default, cleaner YAML).
  const setRunScripts = (next: boolean | undefined) => {
    // Step scripts ship default-off, so switching them on is the
    // feature's first meaningful use (S17 product telemetry).
    if (next === true) noteFeatureUsed('workflow-scripts');
    const nextStep = { ...step };
    if (next === undefined) {
      delete nextStep.runScripts;
    } else {
      nextStep.runScripts = next;
    }
    onChange(nextStep);
  };

  return buildCallStepSections({
    token: context.token,
    t: context.t,
    index: context.index,
    retry: step.retry,
    timeoutMs: step.timeoutMs,
    successCriteria: step.successCriteria,
    criteriaErrors: context.errors.filter((e) => e.issue === 'criterion-invalid-regex'),
    poll: step.poll,
    pollError: context.errors.find((e) => e.issue === 'poll-without-criteria' || e.issue === 'poll-exceeds-limit'),
    runScripts: step.runScripts,
    readOnly: context.readOnly,
    setRetry,
    setTimeoutMs,
    setSuccessCriteria,
    setPoll,
    setRunScripts,
  });
}

const WorkflowStepEditor: React.FC<Props> = ({
  step,
  index,
  totalSteps,
  availableRequests,
  onChange,
  onActionChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  lockStepId,
  allStepIds = [],
  reachableSteps = [],
  capturesByStepId = new Map(),
  errors = [],
  dependencyRow,
  steps = [],
  mqttRequests = [],
  sessionRequests = [],
  sessionAuthoring = false,
  exposable = true,
}) => {
  const { token } = theme.useToken();
  const t = useT();
  // A read-only form switches every control off through the provider;
  // the controls below that set their own `disabled` must agree with it.
  const readOnly = ConfigProvider.useConfig().componentDisabled === true;

  const action = stepActionOf(step);

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
  // The step's backing request was deleted out from under it — the
  // workflow can't run until the user re-points or removes the step.
  const requestError = useMemo(() => errors.find((e) => e.issue === 'step-request-missing'), [errors]);
  // An issue no field of the card owns is said at the card's foot; one
  // that names a criterion row is that row's.
  const footErrors = useMemo(
    () => errors.filter((e) => !FIELD_OWNED_ISSUES.has(e.issue) && e.referencedCriterionUid === undefined),
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

  const handleRunIfChange = (next: StepGate | undefined) => {
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

  const setPriority = (next: PriorityRef | undefined) => {
    const nextStep = { ...step };
    if (next === undefined) {
      delete nextStep.priorityFrom;
    } else {
      nextStep.priorityFrom = next;
    }
    onChange(nextStep);
  };

  const sharedSections = buildSharedStepSections({
    token,
    t,
    index,
    runIf: step.runIf,
    dependsOnValue,
    allStepIds,
    reachableSteps,
    capturesByStepId,
    dependsOnError,
    gateErrors,
    priorityError,
    runIfCount,
    priority,
    priorityStepOptions,
    priorityCaptureOptions,
    readOnly,
    handleDependsOnChange,
    clearExplicitDependsOn,
    handleRunIfChange,
    setPriority,
  });

  const session = { index, steps, mqttRequests, errors };
  const runsScripts = !isSendStep(step) && !isExpectStep(step) && step.runScripts === true;

  const indent = dependencyRow?.indent ?? 0;

  const edgeColor = stepLevelError || requestError ? token.colorError : token.colorBorderSecondary;

  return (
    <div
      data-step-card={step.id}
      data-step-action={action}
      style={{
        border: `1px solid ${edgeColor}`,
        borderRadius: 6,
        padding: 12,
        background: token.colorBgContainer,
        // Connector rail on the left edge for children — a thin vertical
        // stripe in the primary-color family. Pure visual cue that this
        // step is NOT a root; actual dependency info is in the
        // "Depends on" section. All cards sit flush left — depth is
        // conveyed by the rail + "after" chip, never by indentation.
        borderLeft: indent > 0 ? `3px solid ${token.colorPrimaryBorder}` : `1px solid ${edgeColor}`,
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
          {t('workbench.editors.live.step.afterChip', { parents: effectiveParents.join(', ') })}
          {step.dependsOn === undefined && (
            <Tooltip title={t('workbench.editors.live.step.implicitTooltip')}>
              <span style={{ marginLeft: 4, fontStyle: 'italic' }}>
                {t('workbench.editors.live.step.implicitMark')}
              </span>
            </Tooltip>
          )}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Text strong style={{ fontSize: 12, whiteSpace: 'nowrap', flexShrink: 0 }}>
          {t('workbench.editors.live.step.title', { number: index + 1 })}
        </Text>
        <span data-field-path={LIVE_WORKFLOW_FIELD.step(index, 'id')} style={{ display: 'contents' }}>
          <Tooltip open={stepLevelError ? undefined : false} title={stepLevelError?.message}>
            <Input
              size="small"
              style={{ width: 160 }}
              prefix={<Text type="secondary">{t('workbench.editors.live.step.idPrefix')}</Text>}
              value={step.id}
              disabled={lockStepId}
              status={stepLevelError?.issue === 'duplicate-step-id' ? 'error' : undefined}
              onChange={(e) => onChange({ ...step, id: e.target.value })}
            />
          </Tooltip>
        </span>

        {/* The step's action. Foreach and Composite — show-but-disable catalog. */}
        <Tooltip title={t('workbench.editors.live.step.typeTooltip')}>
          <Select<StepAction | 'foreach' | 'composite'>
            size="small"
            style={{ width: 110, flexShrink: 0 }}
            data-testid={`wf-step-${index}-action`}
            value={action}
            options={[
              ...STEP_ACTIONS.filter((each) => each === 'call' || each === action || sessionAuthoring).map((each) => ({
                value: each,
                label: t(ACTION_LABEL[each]),
              })),
              { value: 'foreach', label: t('workbench.editors.live.step.typeForeach'), disabled: true },
              { value: 'composite', label: t('workbench.editors.live.step.typeComposite'), disabled: true },
            ]}
            onChange={(next) => {
              if (next !== 'foreach' && next !== 'composite') onActionChange?.(next);
            }}
          />
        </Tooltip>

        <div style={{ flex: 1 }} />
        {runIfCount > 0 && (
          <Tag color="gold" style={{ fontSize: 10, lineHeight: '18px', margin: 0 }}>
            {t('workbench.editors.live.step.runsIfTag', { count: runIfCount })}
          </Tag>
        )}
        {priority && (
          <Tag color="cyan" style={{ fontSize: 10, lineHeight: '18px', margin: 0 }}>
            {t('workbench.editors.live.step.priorityTag', { ref: `${priority.stepId}.${priority.captureName}` })}
          </Tag>
        )}
        {runsScripts && (
          <Tag color="purple" style={{ fontSize: 10, lineHeight: '18px', margin: 0 }}>
            {t('workbench.editors.live.step.scriptsTag')}
          </Tag>
        )}
        {onMoveUp && (
          <Button size="small" type="text" icon={<UpOutlined />} disabled={readOnly || index === 0} onClick={onMoveUp} />
        )}
        {onMoveDown && (
          <Button
            size="small"
            type="text"
            icon={<DownOutlined />}
            disabled={readOnly || index === totalSteps - 1}
            onClick={onMoveDown}
          />
        )}
        {onRemove && (
          <Button
            size="small"
            type="text"
            danger
            icon={<DeleteOutlined />}
            disabled={readOnly || totalSteps <= 1}
            onClick={onRemove}
          />
        )}
      </div>

      <Space orientation="vertical" size={8} style={{ width: '100%' }}>
        {isListenStep(step) ? (
          <ListenStepFields step={step} onChange={onChange} sessionRequests={sessionRequests} {...session} />
        ) : isSendStep(step) ? (
          <SendStepFields step={step} onChange={onChange} {...session} />
        ) : isExpectStep(step) ? (
          <ExpectStepFields step={step} onChange={onChange} {...session} />
        ) : (
          <CallStepFields
            step={step}
            index={index}
            onChange={onChange}
            availableRequests={availableRequests}
            requestError={requestError}
            exposable={exposable}
          />
        )}

        {/* ── Phase I sections ──────────────────────────────────── */}

        <Collapse
          size="small"
          ghost
          defaultActiveKey={[]}
          items={
            isSessionStep(step)
              ? sharedSections
              : [...sharedSections, ...callSectionsOf(step, onChange, { token, t, index, errors, readOnly })]
          }
        />

        {footErrors.length > 0 && (
          <div data-testid={`wf-step-${index}-issues`} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {footErrors.map((error) => (
              <Text key={`${error.issue}:${error.message}`} type="danger" style={{ fontSize: 11 }}>
                {error.message}
              </Text>
            ))}
          </div>
        )}
      </Space>
    </div>
  );
};

export default WorkflowStepEditor;
