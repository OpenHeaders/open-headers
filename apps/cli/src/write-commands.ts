/**
 * The Phase 2 write-command table — `oh <group> <verb>` → one write-tier
 * `tools/call`, same 1:1 catalog mapping as the read table. Writes get
 * their own spec shape: multi-positional argument mapping, per-command
 * flags, and (for `env switch`) a name → uid pre-resolution against
 * `environments_list` — hooks the read table never needs.
 */

import type { Connection } from './connection';
import { UsageError } from './exit-codes';
import { formatEnvironmentSwitch, formatRuleToggle, formatVariableSet, formatWorkspaceSwitch } from './format';
import { callTool } from './rpc';

export type WriteOptionValues = Record<string, string | boolean | undefined>;

export interface WriteCommandSpec {
  readonly group: string;
  readonly verb: string;
  readonly tool: string;
  readonly summary: string;
  /** Positional/flag shape shown in help and usage errors (after `oh <group> <verb>`). */
  readonly argsHelp: string;
  /** Per-command flags beyond the shared connection options. */
  readonly extraOptions?: Record<string, { readonly type: 'string' | 'boolean' }>;
  /** Map positionals + flags onto tool args; throws {@link UsageError} on shape mistakes. */
  readonly buildArgs: (positionals: readonly string[], values: WriteOptionValues) => Record<string, unknown>;
  /** Pre-call resolution that needs the daemon (env name → uid). */
  readonly resolveArgs?: (args: Record<string, unknown>, conn: Connection) => Promise<Record<string, unknown>>;
  readonly format: (payload: unknown) => string[];
}

interface EnvironmentsListPayload {
  environments: { uid: string; name: string }[];
}

/**
 * `oh env switch staging` — the tool takes a uid, the north-star diagram
 * shows a name. Resolve uid-first (a uid is never reinterpreted as a
 * name), then unique exact name; an ambiguous name is a usage error
 * naming the candidate uids. The `--none` path (environmentId null)
 * needs no lookup.
 */
export async function resolveEnvironmentTarget(
  args: Record<string, unknown>,
  conn: Connection,
): Promise<Record<string, unknown>> {
  const target = args.environmentId;
  if (typeof target !== 'string') return args;
  const listArgs = typeof args.workspaceId === 'string' ? { workspaceId: args.workspaceId } : {};
  const payload = JSON.parse(await callTool(conn, 'environments_list', listArgs)) as EnvironmentsListPayload;
  if (payload.environments.some((env) => env.uid === target)) return args;
  const byName = payload.environments.filter((env) => env.name === target);
  const [match] = byName;
  if (match !== undefined && byName.length === 1) return { ...args, environmentId: match.uid };
  if (byName.length > 1) {
    throw new UsageError(
      `environment name '${target}' is ambiguous — use a uid: ${byName.map((env) => env.uid).join(', ')}`,
    );
  }
  throw new Error(`no environment named '${target}' — see oh env list`);
}

export const WRITE_COMMANDS: readonly WriteCommandSpec[] = [
  {
    group: 'rules',
    verb: 'toggle',
    tool: 'rules_toggle',
    summary: "Set a rule's enabled flag (explicit state — CI-safe)",
    argsHelp: '<uid> on|off',
    buildArgs: (positionals) => {
      const [uid, state, extra] = positionals;
      if (uid === undefined || (state !== 'on' && state !== 'off') || extra !== undefined) {
        throw new UsageError('usage: oh rules toggle <uid> on|off');
      }
      return { uid, enabled: state === 'on' };
    },
    format: formatRuleToggle,
  },
  {
    group: 'env',
    verb: 'switch',
    tool: 'environments_switch',
    summary: 'Switch the active environment by uid or name',
    argsHelp: '<name-or-uid>',
    extraOptions: { none: { type: 'boolean' } },
    buildArgs: (positionals, values) => {
      const [target, extra] = positionals;
      if (extra !== undefined || (values.none === true) === (target !== undefined)) {
        throw new UsageError('usage: oh env switch <name-or-uid> (or --none for "No environment")');
      }
      return { environmentId: target ?? null };
    },
    resolveArgs: resolveEnvironmentTarget,
    format: formatEnvironmentSwitch,
  },
  {
    group: 'vars',
    verb: 'set',
    tool: 'variables_set',
    summary: 'Upsert a variable in workspace scope (or a collection scope)',
    argsHelp: '<name> <value>',
    extraOptions: { collection: { type: 'string' }, secret: { type: 'boolean' } },
    buildArgs: (positionals, values) => {
      const [name, value, extra] = positionals;
      if (name === undefined || value === undefined || extra !== undefined) {
        throw new UsageError('usage: oh vars set <name> <value> [--collection <uid>] [--secret]');
      }
      // No --secret ⇒ no type arg: the server keeps an existing row's type.
      return {
        name,
        value,
        ...(values.secret === true ? { type: 'secret' } : {}),
        ...(typeof values.collection === 'string' ? { collectionId: values.collection } : {}),
      };
    },
    format: formatVariableSet,
  },
  {
    group: 'workspace',
    verb: 'switch',
    tool: 'workspaces_switch',
    summary: 'Make a workspace the active one on the daemon host',
    argsHelp: '<id>',
    buildArgs: (positionals) => {
      const [id, extra] = positionals;
      if (id === undefined || extra !== undefined) {
        throw new UsageError('usage: oh workspace switch <id>');
      }
      return { workspaceId: id };
    },
    format: formatWorkspaceSwitch,
  },
];

export function findWriteCommand(group: string | undefined, verb: string | undefined): WriteCommandSpec | undefined {
  return WRITE_COMMANDS.find((spec) => spec.group === group && spec.verb === verb);
}
