/**
 * The workflow draft as its panels edit it: the draft's validation, the
 * choices its pickers offer and the edits a step takes. One model for
 * the step panel and the workflow panel, so neither repeats the other's
 * checks.
 */

import { hasCapability } from '@openheaders/core/capabilities';
import {
  callStepsOf,
  type DraftKnownStep,
  type DraftWorkflow,
  isKnownStep,
  isSessionStep,
  validateSessionRequests,
  validateSessionSteps,
  validateStepRequestsExist,
  validateWorkflowShape,
} from '@openheaders/core/live';
import type { LiveWorkflow } from '@openheaders/core/types';
import { useRequests } from '@openheaders/ui/shared/hooks/readers/useRequests';
import { useMemo } from 'react';
import { computeRequestTrail } from '../../breadcrumbs';
import { buildDependencyRows } from './dependencies-view';
import { addGraphDependency, duplicateDraftStep, removeGraphDependency } from './graph-edit';
import { rebindCaptureReferences } from './rebind-capture-references';
import { rebindStepReferences } from './rebind-step-references';
import { type StepAction, withStepAction } from './step-action';
import type { StepRequestChoice } from './workflow-step-request-options';

export type WorkflowFormModel = ReturnType<typeof useWorkflowFormModel>;

export function useWorkflowFormModel(draft: DraftWorkflow, setDraft: (next: DraftWorkflow) => void) {
  const {
    requests,
    graphqlRequests,
    mqttRequests,
    collectionTrees: requestCollectionTrees,
    isReady: requestsReady,
  } = useRequests();
  // A workflow that holds a session step gives a verdict (the workflow
  // runs plan, Decisions log, S16): it is refreshed by hand and its
  // captures are not exposed as live variables.
  const holdsSession = useMemo(() => draft.steps.some(isSessionStep), [draft.steps]);
  const sessionAuthoring = hasCapability('workflowSessionAuthoring');

  // A full LiveWorkflow shape so the validators and the layout helper see
  // a coherent object. The synthetic `uid` / `path` / `schemaVersion` /
  // `version` are only inspected for cross-reference shape.
  const draftWorkflow = useMemo<LiveWorkflow>(
    () => ({
      schemaVersion: 5,
      version: 1,
      uid: '________',
      path: 'live-workflows/draft',
      name: draft.name,
      description: draft.description.trim() ? draft.description : undefined,
      enabled: draft.enabled,
      steps: draft.steps,
      refresh: draft.refresh,
    }),
    [draft],
  );

  // A step names a request of either kind — a GraphQL request runs
  // through the compile as one POST.
  const knownRequestUids = useMemo(
    () => new Set([...requests.map((r) => r.uid), ...graphqlRequests.map((r) => r.uid)]),
    [requests, graphqlRequests],
  );
  // The cross-request checks need the request registry, and wait on its
  // hydration: a store not read yet never flags every step as naming a
  // deleted request.
  const validationErrors = useMemo(() => {
    const shape = [...validateWorkflowShape(draftWorkflow), ...validateSessionSteps(draftWorkflow)];
    if (!requestsReady) return shape;
    return [
      ...shape,
      ...validateStepRequestsExist(draftWorkflow, knownRequestUids),
      ...validateSessionRequests(draftWorkflow, (uid) => mqttRequests.find((request) => request.uid === uid) ?? null),
    ];
  }, [draftWorkflow, requestsReady, knownRequestUids, mqttRequests]);

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

  const dependencyRows = useMemo(() => buildDependencyRows(draftWorkflow), [draftWorkflow]);

  const capturesByStepId = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const step of draft.steps) {
      if (!isKnownStep(step)) continue;
      map.set(
        step.id,
        step.captures.map((c) => c.name),
      );
    }
    return map;
  }, [draft.steps]);

  const availableCaptures = useMemo(
    () =>
      callStepsOf(draft).flatMap((s) =>
        s.captures.map((c) => ({ stepId: s.id, captureName: c.name, label: `${s.id}.${c.name}` })),
      ),
    [draft],
  );

  // Requests with their structured `Collection > Folder[...]` trail: the
  // step's picker builds a rich option label from the segments.
  const availableRequests = useMemo<StepRequestChoice[]>(
    () => [
      ...requests.map((r): StepRequestChoice => {
        const trail = computeRequestTrail(r.uid, requestCollectionTrees);
        return {
          uid: r.uid,
          name: r.name,
          method: r.method,
          collectionName: trail?.collectionName ?? null,
          folderTrail: trail?.folderTrail ?? [],
        };
      }),
      ...graphqlRequests.map((r): StepRequestChoice => {
        const trail = computeRequestTrail(r.uid, requestCollectionTrees);
        return {
          uid: r.uid,
          name: r.name,
          method: 'GQL',
          kind: 'graphql',
          collectionName: trail?.collectionName ?? null,
          folderTrail: trail?.folderTrail ?? [],
        };
      }),
    ],
    [requests, graphqlRequests, requestCollectionTrees],
  );

  // The session requests a listen step can open — MQTT, the one kind a
  // run's session speaks today.
  const sessionRequests = useMemo<StepRequestChoice[]>(
    () =>
      mqttRequests.map((r): StepRequestChoice => {
        const trail = computeRequestTrail(r.uid, requestCollectionTrees);
        return {
          uid: r.uid,
          name: r.name,
          method: 'MQTT',
          kind: 'mqtt',
          collectionName: trail?.collectionName ?? null,
          folderTrail: trail?.folderTrail ?? [],
        };
      }),
    [mqttRequests, requestCollectionTrees],
  );

  const updateStep = (idx: number, next: DraftKnownStep) => {
    const prev = draft.steps[idx];
    const nextSteps = draft.steps.slice();
    nextSteps[idx] = next;
    let nextDraft: DraftWorkflow = { ...draft, steps: nextSteps };
    // A step-id rename follows into dependsOn / runIf clauses /
    // priorityFrom / refresh.stepId. Same step.uid + changed id is the
    // rename signature.
    if (prev && prev.uid === next.uid && prev.id !== next.id && prev.id.length > 0 && next.id.length > 0) {
      nextDraft = rebindStepReferences({
        draft: nextDraft,
        targetUid: next.uid,
        oldId: prev.id,
        newId: next.id,
      });
    }
    // A capture rename follows into every `(stepId, captureName)`
    // reference. Captures are matched by uid across prev / next; the
    // owner is the step's CURRENT id, already shifted by the rename above
    // when both change together.
    if (prev && isKnownStep(prev)) {
      const prevCapByUid = new Map(prev.captures.map((c) => [c.uid, c]));
      for (const nextCap of next.captures) {
        const prevCap = prevCapByUid.get(nextCap.uid);
        if (!prevCap) continue;
        if (prevCap.name === nextCap.name) continue;
        if (prevCap.name.length === 0 || nextCap.name.length === 0) continue;
        nextDraft = rebindCaptureReferences({
          draft: nextDraft,
          ownerStepId: next.id,
          oldName: prevCap.name,
          newName: nextCap.name,
        });
      }
    }
    setDraft(nextDraft);
  };

  const changeStepAction = (idx: number, action: StepAction) => {
    setDraft(withStepAction(draft, idx, action));
  };

  const removeStep = (idx: number) => {
    if (draft.steps.length <= 1) return;
    setDraft({ ...draft, steps: draft.steps.filter((_, i) => i !== idx) });
  };

  // One more step to wait for, or one fewer — the same edits as a line
  // drawn or removed on the graph.
  const addDependency = (idx: number, parentId: string) => {
    const next = addGraphDependency(draft, parentId, draft.steps[idx].id);
    if (next !== null) setDraft(next);
  };

  const removeDependency = (idx: number, parentId: string) => {
    const next = removeGraphDependency(draft, parentId, draft.steps[idx].id);
    if (next !== null) setDraft(next);
  };

  /** The uid of the copy, or `null` where the step takes none. */
  const duplicateStep = (idx: number): string | null => {
    const step = draft.steps[idx];
    const copied = step === undefined ? null : duplicateDraftStep(draft, step.uid);
    if (copied === null) return null;
    setDraft(copied.draft);
    return copied.stepUid;
  };

  const moveStep = (idx: number, delta: -1 | 1) => {
    const target = idx + delta;
    if (target < 0 || target >= draft.steps.length) return;
    const next = draft.steps.slice();
    [next[idx], next[target]] = [next[target], next[idx]];
    setDraft({ ...draft, steps: next });
  };

  return {
    holdsSession,
    sessionAuthoring,
    errorsByStepId,
    workflowLevelErrors,
    dependencyRows,
    capturesByStepId,
    availableCaptures,
    availableRequests,
    sessionRequests,
    mqttRequests,
    updateStep,
    changeStepAction,
    removeStep,
    addDependency,
    removeDependency,
    duplicateStep,
    moveStep,
  };
}
