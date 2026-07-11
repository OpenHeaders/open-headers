/**
 * The Phase 2 write-command table — `oh <group> <verb>` → one write-tier
 * `tools/call`, same 1:1 catalog mapping as the read table. Writes get
 * the {@link CommandSpec} shape instead of the read table's: multi-
 * positional argument mapping, per-command flags, and (for `env
 * switch`) the name → uid pre-resolution — hooks reads never need.
 */

import type { CommandSpec } from './command-spec';
import { UsageError } from './exit-codes';
import { formatEnvironmentSwitch, formatRuleToggle, formatVariableSet, formatWorkspaceSwitch } from './format';
import { resolveEnvironmentTarget } from './resolvers';

export const WRITE_COMMANDS: readonly CommandSpec[] = [
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

export function findWriteCommand(group: string | undefined, verb: string | undefined): CommandSpec | undefined {
  return WRITE_COMMANDS.find((spec) => spec.group === group && spec.verb === verb);
}
