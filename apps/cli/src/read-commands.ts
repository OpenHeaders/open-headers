/**
 * The Phase 1 read-command table — `oh <group> <verb>` → one
 * `tools/call`. Mapping is 1:1 with the shipped tool catalog; the CLI
 * adds no verbs the catalog doesn't have. Every workspace-scoped
 * command takes `--workspace <id>` and defaults to the daemon's active
 * workspace, same as the tools themselves.
 */

import {
  formatActivity,
  formatEnvironments,
  formatPayloadJson,
  formatRequests,
  formatRules,
  formatVariables,
  formatWorkflowRuns,
  formatWorkflows,
  formatWorkspaces,
} from './format';

export interface ReadCommandSpec {
  readonly group: string;
  readonly verb: string;
  readonly tool: string;
  readonly summary: string;
  /** Positional argument mapped into the tool args (e.g. `rules get <uid>`). */
  readonly positional?: { name: string; toolArg: string; required: boolean };
  /** Accepts `--limit <n>` (activity). */
  readonly limitOption?: boolean;
  /**
   * Render the payload for humans. Receives the parsed payload and its
   * verbatim JSON text (detail commands print the text — the full
   * definition is the honest human view).
   */
  readonly format: (payload: unknown, payloadText: string) => string[];
}

export const READ_COMMANDS: readonly ReadCommandSpec[] = [
  {
    group: 'workspace',
    verb: 'list',
    tool: 'workspaces_list',
    summary: 'List workspaces on the daemon host',
    format: (payload) => formatWorkspaces(payload),
  },
  {
    group: 'rules',
    verb: 'list',
    tool: 'rules_list',
    summary: 'List the traffic rules in a workspace',
    format: (payload) => formatRules(payload),
  },
  {
    group: 'rules',
    verb: 'get',
    tool: 'rules_get',
    summary: 'Fetch one rule by uid (full definition)',
    positional: { name: 'uid', toolArg: 'uid', required: true },
    format: (_payload, payloadText) => formatPayloadJson(payloadText),
  },
  {
    group: 'env',
    verb: 'list',
    tool: 'environments_list',
    summary: 'List environments and their variables',
    format: (payload) => formatEnvironments(payload),
  },
  {
    group: 'vars',
    verb: 'list',
    tool: 'variables_list',
    summary: 'List every variable scope (vault names only, secrets masked)',
    format: (payload) => formatVariables(payload),
  },
  {
    group: 'request',
    verb: 'list',
    tool: 'requests_list',
    summary: 'List saved API requests',
    format: (payload) => formatRequests(payload),
  },
  {
    group: 'workflow',
    verb: 'list',
    tool: 'workflows_list',
    summary: 'List live workflows',
    format: (payload) => formatWorkflows(payload),
  },
  {
    group: 'workflow',
    verb: 'history',
    tool: 'workflows_history',
    summary: 'Cached workflow run records (capture names, never values)',
    positional: { name: 'uid', toolArg: 'uid', required: false },
    format: (payload) => formatWorkflowRuns(payload),
  },
  {
    group: 'activity',
    verb: '',
    tool: 'activity_list',
    summary: 'Recent change activity in a workspace (newest first)',
    limitOption: true,
    format: (payload) => formatActivity(payload),
  },
];

export function findReadCommand(group: string | undefined, verb: string | undefined): ReadCommandSpec | undefined {
  if (group === undefined) return undefined;
  const groupSpecs = READ_COMMANDS.filter((spec) => spec.group === group);
  if (groupSpecs.length === 0) return undefined;
  return groupSpecs.find((spec) => spec.verb === (verb ?? '')) ?? groupSpecs.find((spec) => spec.verb === '');
}

/** How many argv tokens the matched command consumed (group, or group + verb). */
export function commandTokenCount(spec: ReadCommandSpec): number {
  return spec.verb === '' ? 1 : 2;
}
