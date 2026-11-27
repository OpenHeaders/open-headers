/**
 * WorkflowStepEditor — the fields of a single step of an action the
 * model knows, under its panel's head: a call, or a `listen`, a `send`
 * or an `expect` on a session (a step of any other action has its own
 * card, `UnknownStepCard`).
 *
 * First the cards every step has: where it stands among the others
 * (`StepDependencyCards`) and its run condition (`StepGateEditor`). Then
 * the fields of the step's own action:
 *   - a call: `CallStepFields`, and the sections `Retry policy`,
 *     `Timeout`, `Success criteria`, `Poll` and `Scripts`;
 *   - a session step: `SessionStepFields`;
 * with the `Priority` section every step has.
 */

import {
  type DraftCallStep,
  type DraftKnownStep,
  type DraftStep,
  isExpectStep,
  isListenStep,
  isSendStep,
  isSessionStep,
  type StructuralError,
} from '@openheaders/core/live';
import type { Criterion, MqttRequest, PriorityRef, StepGate, StepPoll, StepRetryPolicy } from '@openheaders/core/types';
import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import { LIVE_WORKFLOW_FIELD } from '@openheaders/ui/shared/awareness/live-paths';
import { noteFeatureUsed } from '@openheaders/ui/shared/product-telemetry';
import { Collapse, type CollapseProps, ConfigProvider, Space, theme } from 'antd';
import type { GlobalToken } from 'antd/es/theme/interface';
import type React from 'react';
import { useMemo } from 'react';
import CallStepFields from './CallStepFields';
import type { LabelTruth } from './graph-lines';
import { ExpectStepFields, ListenStepFields, SendStepFields } from './SessionStepFields';
import StepDependencyCards from './StepDependencyCards';
import StepGateEditor from './StepGateEditor';
import type { StepMiniFacts } from './StepMiniRow';
import type { StepRequestChoice } from './workflow-step-request-options';
import { buildCallStepSections, buildSharedStepSections } from './workflow-step-sections';

/** Where a step stands among the others, and the edits its Depends on card makes — each one the graph's own. */
export interface StepDependencies {
  /** The steps it waits for, as resolved: the step before it where it names none. */
  parents: readonly StepMiniFacts[];
  /** The steps that wait for it. */
  dependents: readonly StepMiniFacts[];
  /** Every other step it does not wait for yet, by id. */
  addable: readonly string[];
  onAdd: (parentId: string) => void;
  onRemove: (parentId: string) => void;
  onGoToStep: (stepUid: string) => void;
}

interface Props {
  step: DraftKnownStep;
  index: number;
  /** Requests a call's Request picker can choose from. */
  availableRequests: StepRequestChoice[];
  onChange: (next: DraftKnownStep) => void;
  // ── Phase I context (optional — editor works without them) ──────
  /** Where the step stands among the others — absent, its two dependency cards are not shown. */
  dependencies?: StepDependencies;
  /** Transitive ancestors (legal ref targets) for runIf + priorityFrom. */
  reachableSteps?: { id: string; label: string }[];
  /** Map of stepId → declared capture names for runIf + priorityFrom. */
  capturesByStepId?: Map<string, string[]>;
  /** Structural errors scoped to this step (stepId matches) — inline badging. */
  errors?: StructuralError[];
  /** Whether a run-condition clause held in the last run, by its uid. */
  clauseTruth?: (clauseUid: string) => LabelTruth;
  // ── Session context (the workflow runs plan, Decisions log, S16) ──
  /** The draft's steps in order — the listens a step can be on, the steps an expect can wait after. */
  steps?: readonly DraftStep[];
  /** The workspace's MQTT requests — what a listen opens, and whose saved messages a send picks from. */
  mqttRequests?: readonly MqttRequest[];
  /** The MQTT requests as the request picker shows them. */
  sessionRequests?: StepRequestChoice[];
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
  availableRequests,
  onChange,
  dependencies,
  reachableSteps = [],
  capturesByStepId = new Map(),
  errors = [],
  clauseTruth,
  steps = [],
  mqttRequests = [],
  sessionRequests = [],
  exposable = true,
}) => {
  const { token } = theme.useToken();
  const t = useT();
  // A read-only form switches every control off through the provider;
  // the controls below that set their own `disabled` must agree with it.
  const readOnly = ConfigProvider.useConfig().componentDisabled === true;

  // ── Derived error subsets ───────────────────────────────────────
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

  // ── dependsOn helpers ───────────────────────────────────────────
  // `undefined` = implicit prior-step dep; `[]` = explicit root; array
  // of ids = explicit DAG. The card's Add and × write the list out, as
  // the graph's gestures do; Reset is the one edit made here.
  const clearExplicitDependsOn = () => {
    // Remove explicit dependsOn entirely — falls back to implicit
    // prior-step dep (linear-chain default).
    const next = { ...step };
    delete next.dependsOn;
    onChange(next);
  };

  // ── runIf helpers ───────────────────────────────────────────────
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
    priorityError,
    priority,
    priorityStepOptions,
    priorityCaptureOptions,
    readOnly,
    setPriority,
  });

  const session = { index, steps, mqttRequests, errors };

  return (
    <>
      {dependencies !== undefined && (
        <StepDependencyCards
          index={index}
          parents={dependencies.parents}
          dependents={dependencies.dependents}
          explicit={step.dependsOn !== undefined}
          addable={dependencies.addable}
          error={dependsOnError}
          onAdd={dependencies.onAdd}
          onRemove={dependencies.onRemove}
          onReset={clearExplicitDependsOn}
          onGoToStep={dependencies.onGoToStep}
        />
      )}
      <StepGateEditor
        testId={`wf-step-${index}-runif`}
        fieldPath={LIVE_WORKFLOW_FIELD.step(index, 'gate')}
        value={step.runIf}
        onChange={handleRunIfChange}
        reachableSteps={reachableSteps}
        capturesByStepId={capturesByStepId}
        errors={gateErrors}
        clauseTruth={clauseTruth}
        root={dependencies !== undefined && dependencies.parents.length === 0}
      />
      <div
        style={{
          border: `1px solid ${requestError ? token.colorError : token.colorBorderSecondary}`,
          borderRadius: 6,
          padding: 12,
        }}
      >
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
        </Space>
      </div>
    </>
  );
};

export default WorkflowStepEditor;
