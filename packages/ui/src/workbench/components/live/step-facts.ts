/**
 * What a step says of itself wherever the workflow view names it — on
 * its node, in its panel's header, in a row that stands for it: the kind
 * of request it speaks, its kind in a word, what it does, what opens its
 * request, and its mark from the last run. Pure.
 */

import type { LiveWorkflowRunSnapshot } from '@openheaders/core/bridge';
import {
  type DraftStep,
  isExpectStep,
  isListenStep,
  isSendStep,
  isSessionStep,
  isUnknownStep,
  type WorkflowRunStepRow,
} from '@openheaders/core/live';
import type { MqttRequest, SessionWorkflowStep, WorkflowStep } from '@openheaders/core/types';
import type { MessageKey } from '@openheaders/i18n';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
import type { RequestKind } from '../../request-kind-menu';
import {
  describeRunRow,
  type RunRowContext,
  type RunRowDisplay,
  type RunStepAction,
  sessionOfRow,
} from './run-display';
import { sessionRequestOf } from './step-action';
import { idleMark, markOfCacheRow, markOfRunRow, type StepMark } from './step-mark';
import type { StepRequests } from './use-step-requests';
import type { ShownWorkflowRun } from './use-workflow-run';

/** A step's kind in the design's words: an `expect` is a Wait. */
export const STEP_KIND_WORD: Record<RunStepAction, MessageKey> = {
  call: 'workbench.editors.live.run.action.call',
  listen: 'workbench.editors.live.run.action.listen',
  send: 'workbench.editors.live.run.action.send',
  expect: 'workbench.editors.live.graph.kindWait',
};

/** What a step does, in a line. */
export interface StepDoes {
  /** A call's method, ahead of its request's name. */
  lead?: string;
  text: string;
  /** An address is code; a name is not. */
  mono?: boolean;
  /** The line stands for something missing. */
  muted?: boolean;
}

/** A step's action; `undefined` for a step of an action the model does not know. */
export function actionOfStep(step: WorkflowStep): RunStepAction | undefined {
  if (isSessionStep(step)) return step.action;
  return isUnknownStep(step) ? undefined : 'call';
}

/** What a session step acts on, by name: the request a listen opens, the message a send sends, where an expect's message lands. */
export function sessionTargetOf(
  step: SessionWorkflowStep,
  steps: readonly DraftStep[],
  mqttRequests: readonly MqttRequest[],
): string {
  if (isListenStep(step)) return mqttRequests.find((request) => request.uid === step.sessionRequestUid)?.name ?? '';
  if (isSendStep(step)) {
    const saved = sessionRequestOf(steps, step.on, mqttRequests)?.savedMessages;
    return saved?.find((message) => message.uid === step.messageUid)?.name ?? '';
  }
  return step.address ?? '';
}

/** The kind of request a step speaks: a call's own request, a session step's listen. */
export function protocolOfStep(
  step: WorkflowStep,
  steps: readonly DraftStep[],
  requests: StepRequests,
): RequestKind | null {
  if (isSessionStep(step)) {
    const listenId = isListenStep(step) ? step.id : step.on;
    return sessionRequestOf(steps, listenId, requests.mqttRequests) !== undefined ? 'mqtt' : null;
  }
  if (isUnknownStep(step)) return null;
  if (requests.requestsByUid.has(step.requestUid)) return 'http';
  return requests.graphqlByUid.has(step.requestUid) ? 'graphql' : null;
}

export function doesOfStep(
  step: WorkflowStep,
  steps: readonly DraftStep[],
  requests: StepRequests,
  t: Translate,
): StepDoes {
  if (isSessionStep(step)) {
    return { text: sessionTargetOf(step, steps, requests.mqttRequests), mono: isExpectStep(step) };
  }
  if (isUnknownStep(step)) return { text: t('workbench.editors.live.step.needsUpdate'), muted: true };
  const http = requests.requestsByUid.get(step.requestUid);
  if (http !== undefined) return { lead: http.method, text: http.name };
  const graphql = requests.graphqlByUid.get(step.requestUid);
  if (graphql !== undefined) return { text: graphql.name };
  return {
    text:
      requests.ready && step.requestUid !== ''
        ? t('workbench.editors.live.graph.requestNotFound')
        : t('workbench.editors.live.graph.noRequestSelected'),
    muted: true,
  };
}

/** What opens a request's own tab, by the kind of request — handed down from where the workbench binds its tabs. */
export interface StepRequestOpeners {
  http: (uid: string, name: string, method: string) => void;
  graphql: (uid: string, name: string) => void;
  mqtt: (uid: string, name: string) => void;
}

/**
 * Opens the tab of the request a step names: a call's own, the one a
 * listen opens. `undefined` where it names none the workspace holds.
 */
export function requestOpenOf(
  step: WorkflowStep,
  requests: StepRequests,
  openers: StepRequestOpeners,
): (() => void) | undefined {
  if (isSessionStep(step)) {
    if (!isListenStep(step)) return undefined;
    const session = requests.mqttRequests.find((request) => request.uid === step.sessionRequestUid);
    return session !== undefined ? () => openers.mqtt(session.uid, session.name) : undefined;
  }
  if (isUnknownStep(step)) return undefined;
  const http = requests.requestsByUid.get(step.requestUid);
  if (http !== undefined) return () => openers.http(http.uid, http.name, http.method);
  const graphql = requests.graphqlByUid.get(step.requestUid);
  return graphql !== undefined ? () => openers.graphql(graphql.uid, graphql.name) : undefined;
}

/** Where a step's mark is read from: the run the page keeps, or the cache row where it keeps none. */
export interface StepMarkSources {
  run: ShownWorkflowRun | null | undefined;
  cacheRun: LiveWorkflowRunSnapshot | null | undefined;
  /** The clock, for a wait that says how far into its deadline it is. */
  now: number;
}

/** A step's row in the run the page keeps, with what its words need — `undefined` where the run holds no row for it. */
function runRowOfStep(
  step: WorkflowStep,
  sources: StepMarkSources,
): { row: WorkflowRunStepRow; context: RunRowContext } | undefined {
  const { run, now } = sources;
  const row = run?.record.steps.find((each) => each.uid === step.uid);
  if (run == null || row === undefined) return undefined;
  const action = actionOfStep(step);
  const session = sessionOfRow(row, run.record);
  return {
    row,
    context: {
      now,
      ...(action !== undefined ? { action } : {}),
      ...(session !== undefined ? { session } : {}),
    },
  };
}

export function markOfStep(step: WorkflowStep, sources: StepMarkSources, t: Translate): StepMark {
  if (sources.run == null) return markOfCacheRow(sources.cacheRun, step.id, t);
  const found = runRowOfStep(step, sources);
  return found === undefined ? idleMark(t) : markOfRunRow(found.row, t, found.context);
}

/** The words of a step's row in the run the page keeps — `undefined` where it keeps none, or none for this step. */
export function runRowDisplayOfStep(
  step: WorkflowStep,
  sources: StepMarkSources,
  t: Translate,
): RunRowDisplay | undefined {
  const found = runRowOfStep(step, sources);
  return found === undefined ? undefined : describeRunRow(found.row, t, found.context);
}
