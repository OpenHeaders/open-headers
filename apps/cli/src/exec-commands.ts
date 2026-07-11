/**
 * The Phase 3 table — execute-tier verbs (`request send`, `workflow
 * run`: real network egress, gated behind the daemon's execute opt-in)
 * plus `workspace diff` (read-tier, but its two-positional shape rides
 * the same {@link CommandSpec}). Sends and runs address their target by
 * name or uid, like `env switch`; a failed send/run is an in-band
 * outcome the tool returns as a value, classified here → exit 1.
 */

import type { CommandOptionValues, CommandSpec } from './command-spec';
import type { Connection } from './connection';
import { UsageError } from './exit-codes';
import { formatRequestSend, formatWorkflowRun, formatWorkspaceDiff } from './format';
import { resolveEnvironmentTarget, resolveRequestTarget, resolveWorkflowTarget } from './resolvers';

const ENV_OPTION = { env: { type: 'string' } } as const;

/** `--env <name-or-uid>` → the tools' environmentId (omitted = the active environment). */
function withEnvArg(base: Record<string, unknown>, values: CommandOptionValues): Record<string, unknown> {
  return { ...base, ...(typeof values.env === 'string' ? { environmentId: values.env } : {}) };
}

interface SendOutcome {
  sent: boolean;
  error?: string;
}

interface RunOutcome {
  ok: boolean;
  failedStepId?: string;
  failedPhase?: string;
  message?: string;
}

export const EXEC_COMMANDS: readonly CommandSpec[] = [
  {
    group: 'request',
    verb: 'send',
    tool: 'requests_send',
    summary: 'Execute a saved request (status/size/timing; --json for the body)',
    argsHelp: '<name-or-uid>',
    extraOptions: ENV_OPTION,
    buildArgs: (positionals, values) => {
      const [target, extra] = positionals;
      if (target === undefined || extra !== undefined) {
        throw new UsageError('usage: oh request send <name-or-uid> [--env <name-or-uid>]');
      }
      return withEnvArg({ uid: target }, values);
    },
    resolveArgs: async (args: Record<string, unknown>, conn: Connection) =>
      resolveRequestTarget(await resolveEnvironmentTarget(args, conn), conn),
    checkFailure: (payload) => {
      const outcome = payload as SendOutcome;
      return outcome.sent === false ? `send failed — ${outcome.error ?? 'no error detail'}` : undefined;
    },
    format: formatRequestSend,
  },
  {
    group: 'workflow',
    verb: 'run',
    tool: 'workflows_run',
    summary: 'Run a live workflow once, now (publishes exposed {{live.*}} vars)',
    argsHelp: '<name-or-uid>',
    extraOptions: ENV_OPTION,
    buildArgs: (positionals, values) => {
      const [target, extra] = positionals;
      if (target === undefined || extra !== undefined) {
        throw new UsageError('usage: oh workflow run <name-or-uid> [--env <name-or-uid>]');
      }
      return withEnvArg({ uid: target }, values);
    },
    resolveArgs: async (args: Record<string, unknown>, conn: Connection) =>
      resolveWorkflowTarget(await resolveEnvironmentTarget(args, conn), conn),
    checkFailure: (payload) => {
      const outcome = payload as RunOutcome;
      return outcome.ok === false
        ? `run failed at step ${outcome.failedStepId} (${outcome.failedPhase}): ${outcome.message}`
        : undefined;
    },
    format: formatWorkflowRun,
  },
  {
    group: 'workspace',
    verb: 'diff',
    tool: 'workspaces_diff',
    summary: 'Diff two workspaces (one id = against the active workspace)',
    argsHelp: '[base] <other>',
    buildArgs: (positionals) => {
      const [first, second, extra] = positionals;
      if (first === undefined || extra !== undefined) {
        throw new UsageError('usage: oh workspace diff [<base-id>] <other-id>');
      }
      if (second === undefined) return { otherWorkspaceId: first };
      return { workspaceId: first, otherWorkspaceId: second };
    },
    format: formatWorkspaceDiff,
  },
];

export function findExecCommand(group: string | undefined, verb: string | undefined): CommandSpec | undefined {
  return EXEC_COMMANDS.find((spec) => spec.group === group && spec.verb === verb);
}
