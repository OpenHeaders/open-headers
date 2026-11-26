/**
 * The page's scopes for a workflow run that lives in this page (the
 * workflow runs plan, Laws — "The run lives with its session"): the
 * saved workflows and MQTT requests, the scopes of a session a run
 * opens, and a run's resolver for a template outside a request. The
 * engine's own stores are empty in a page realm, so a run here resolves
 * from the renderer scopes, as a page session an editor connects does.
 *
 * Published by the workbench shell for as long as it is mounted — never
 * by an editor: a run needs neither its workflow's tab nor its request's
 * editor open. Single-publisher module slot (the page-session
 * factories' discipline); a run reads the CURRENT scope as it begins
 * and keeps that snapshot to its end.
 */

import type { ScriptPackageModule } from '@openheaders/core/scripts';
import type { LiveWorkflow, MqttRequest } from '@openheaders/core/types';
import type { ResolutionError } from '@openheaders/core/variables';
import {
  buildRendererResolver,
  type RendererResolverInputs,
} from '@openheaders/ui/shared/hooks/variables/useVariableResolver';
import {
  type MqttPageSessionScope,
  makeMqttPageResolutionFactory,
  type PageSessionRun,
} from '../mqtt-request-editor/mqtt-page-session';
import type { RequestAncestryInputs } from '../request-container/ancestry';

export interface WorkflowRunScope {
  workspaceId: string;
  workflows: readonly LiveWorkflow[];
  mqttRequests: readonly MqttRequest[];
  /** The scopes of a session `run` opens on `request`. */
  mqttSession(request: MqttRequest, run: PageSessionRun): Promise<MqttPageSessionScope>;
  /**
   * A run's resolver for a template outside a request — an `expect`'s
   * address, a criterion's value. A workflow lives in no collection, so
   * no collection scope answers; nothing is asked of a secret manager.
   */
  templates(run: PageSessionRun): (template: string) => { result: string; errors: ResolutionError[] };
}

export interface WorkflowRunScopeInputs {
  workspaceId: string;
  resolver: RendererResolverInputs;
  ancestry: RequestAncestryInputs;
  workflows: readonly LiveWorkflow[];
  mqttRequests: readonly MqttRequest[];
  /** The workspace's Package Library — a session hook's `oh.require`. */
  packages: readonly ScriptPackageModule[];
}

export function makeWorkflowRunScope(inputs: WorkflowRunScopeInputs): WorkflowRunScope {
  const { workspaceId, workflows, mqttRequests } = inputs;
  const mqttSession = makeMqttPageResolutionFactory(inputs.resolver, inputs.ancestry, workspaceId, inputs.packages);
  return {
    workspaceId,
    workflows,
    mqttRequests,
    mqttSession,
    templates: (run) => {
      const resolver = buildRendererResolver({ ...inputs.resolver, activeEnvironmentId: run.environmentId });
      resolver.setStepCaptures(run.stepCaptures);
      return (template) => {
        const { result, errors } = resolver.resolveTemplate(template);
        return { result, errors };
      };
    },
  };
}

let current: WorkflowRunScope | null = null;

/** `null` — the shell is gone, or shows no workspace: nothing runs in this page. */
export function publishWorkflowRunScope(scope: WorkflowRunScope | null): void {
  current = scope;
}

export function getWorkflowRunScope(): WorkflowRunScope | null {
  return current;
}
