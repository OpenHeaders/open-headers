/**
 * WorkflowStepEditor — the fields of a single step of an action the
 * model knows, under its panel's head: a call, or a `listen`, a `send`
 * or an `expect` on a session (a step of any other action has its own
 * card, `UnknownStepCard`).
 *
 * First the cards every step has: where it stands among the others
 * (`StepDependencyCards`) and its run condition (`StepGateEditor`). Then
 * the cards of the step's own action — a call's Request
 * (`CallStepFields`) and its Success criteria, Poll, Retry policy and
 * Timeout (`CallPolicyCards`), a session step's Connection, Send
 * message, or Expect message with Match criteria (`SessionStepFields`).
 * Under them, what is not a card yet: the step's captures and the
 * `Priority` section every step has.
 */

import {
  type DraftKnownStep,
  type DraftStep,
  isExpectStep,
  isListenStep,
  isSendStep,
  type StructuralError,
} from '@openheaders/core/live';
import type { MqttRequest, PriorityRef, StepGate } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { LIVE_WORKFLOW_FIELD } from '@openheaders/ui/shared/awareness/live-paths';
import { Collapse, ConfigProvider, Space, theme } from 'antd';
import type React from 'react';
import { useMemo } from 'react';
import CallPolicyCards from './CallPolicyCards';
import { CallRequestCard, CallStepCaptures } from './CallStepFields';
import type { LabelTruth } from './graph-lines';
import { ExpectStepFields, ListenStepFields, SendStepFields, SessionStepCaptures } from './SessionStepFields';
import StepDependencyCards from './StepDependencyCards';
import StepGateEditor from './StepGateEditor';
import type { StepMiniFacts } from './StepMiniRow';
import type { StepMarkKind } from './step-mark';
import type { StepRequestChoice } from './workflow-step-request-options';
import { buildSharedStepSections } from './workflow-step-sections';

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
  /** How the last run left the step — absent where the step is not shown beside a run. */
  runState?: StepMarkKind;
  /** Opens the tab of the request the step names — absent where it names none the workspace holds. */
  onOpenRequest?: () => void;
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
  runState,
  onOpenRequest,
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
      {isListenStep(step) ? (
        <ListenStepFields
          step={step}
          onChange={onChange}
          sessionRequests={sessionRequests}
          onOpenRequest={onOpenRequest}
          {...session}
        />
      ) : isSendStep(step) ? (
        <SendStepFields step={step} onChange={onChange} {...session} />
      ) : isExpectStep(step) ? (
        <ExpectStepFields step={step} onChange={onChange} runState={runState} {...session} />
      ) : (
        <>
          <CallRequestCard
            step={step}
            index={index}
            onChange={onChange}
            availableRequests={availableRequests}
            requestError={requestError}
            onOpenRequest={onOpenRequest}
          />
          <CallPolicyCards step={step} index={index} onChange={onChange} errors={errors} />
        </>
      )}
      {/* What is not a card yet: the captures, and the one section of the old step card. */}
      <div style={{ border: `1px solid ${token.colorBorderSecondary}`, borderRadius: 6, padding: 12 }}>
        <Space orientation="vertical" size={8} style={{ width: '100%' }}>
          {isListenStep(step) ? null : isSendStep(step) || isExpectStep(step) ? (
            <SessionStepCaptures step={step} index={index} onChange={onChange} />
          ) : (
            <CallStepCaptures step={step} index={index} onChange={onChange} exposable={exposable} />
          )}

          <Collapse size="small" ghost defaultActiveKey={[]} items={sharedSections} />
        </Space>
      </div>
    </>
  );
};

export default WorkflowStepEditor;
