/**
 * Command execution — the glue between argv, the config store, and the
 * RPC client. `runReadCommand` drives every table entry; `status` and
 * `connect` are the two local commands (probe + persist) that exist
 * outside the tool catalog.
 */

import { parseArgs } from 'node:util';
import { mergeCliConnection } from '@openheaders/core/cli-config';
import type { CommandOptionValues, CommandSpec } from './command-spec';
import { cliConfigPath, readCliConfig, type UpdateChannel, writeCliConfig } from './config-store';
import { type Connection, resolveConnection, TOKEN_ENV } from './connection';
import { OperationFailedError, UsageError } from './exit-codes';
import { commandTokenCount, type ReadCommandSpec } from './read-commands';
import { callTool, initialize, listTools } from './rpc';

const CONNECTION_OPTIONS = {
  daemon: { type: 'string' },
  token: { type: 'string' },
  workspace: { type: 'string' },
  json: { type: 'boolean' },
} as const;

interface ParsedCommon {
  values: {
    daemon?: string;
    token?: string;
    workspace?: string;
    json?: boolean;
    limit?: string;
  } & CommandOptionValues;
  positionals: string[];
}

function parseCommandArgs(
  argv: readonly string[],
  extraOptions: Record<string, { readonly type: 'string' | 'boolean' }>,
): ParsedCommon {
  try {
    return parseArgs({
      args: [...argv],
      options: { ...CONNECTION_OPTIONS, ...extraOptions },
      allowPositionals: true,
    }) as ParsedCommon;
  } catch (err) {
    throw new UsageError(err instanceof Error ? err.message : String(err));
  }
}

async function connectionFor(values: ParsedCommon['values']): Promise<Connection> {
  const config = await readCliConfig(cliConfigPath());
  return resolveConnection({ daemon: values.daemon, token: values.token }, process.env, config);
}

export async function runReadCommand(spec: ReadCommandSpec, argv: readonly string[]): Promise<string[]> {
  const { values, positionals } = parseCommandArgs(
    argv.slice(commandTokenCount(spec)),
    spec.limitOption === true ? { limit: { type: 'string' } } : {},
  );

  const toolArgs: Record<string, unknown> = {};
  if (values.workspace !== undefined) toolArgs.workspaceId = values.workspace;
  if (spec.positional) {
    const [value] = positionals;
    if (value === undefined && spec.positional.required) {
      throw new UsageError(`usage: oh ${spec.group}${spec.verb ? ` ${spec.verb}` : ''} <${spec.positional.name}>`);
    }
    if (value !== undefined) toolArgs[spec.positional.toolArg] = value;
  } else if (positionals.length > 0) {
    throw new UsageError(`unexpected argument: ${positionals[0]}`);
  }
  if (values.limit !== undefined) {
    const limit = Number.parseInt(values.limit, 10);
    if (!Number.isInteger(limit) || limit <= 0) throw new UsageError('--limit must be a positive integer');
    toolArgs.limit = limit;
  }

  const conn = await connectionFor(values);
  const payloadText = await callTool(conn, spec.tool, toolArgs);
  if (values.json === true) return [payloadText];
  return spec.format(JSON.parse(payloadText), payloadText);
}

/**
 * Drive one spec-table entry (write or execute/diff): positionals +
 * flags → tool args (the `--workspace` default first, so a spec-built
 * `workspaceId` wins where the tool takes one positionally, e.g.
 * `workspace switch`), optional daemon-side resolution, one
 * `tools/call`. An in-band unsuccessful outcome (`checkFailure`)
 * throws exit-1, carrying the `--json` payload for scripting.
 */
export async function runToolCommand(spec: CommandSpec, argv: readonly string[]): Promise<string[]> {
  const { values, positionals } = parseCommandArgs(argv.slice(2), spec.extraOptions ?? {});
  let toolArgs: Record<string, unknown> = {
    ...(values.workspace !== undefined ? { workspaceId: values.workspace } : {}),
    ...spec.buildArgs(positionals, values),
  };
  const conn = await connectionFor(values);
  if (spec.resolveArgs) {
    toolArgs = await spec.resolveArgs(toolArgs, conn);
  }
  const payloadText = await callTool(conn, spec.tool, toolArgs);
  const payload: unknown = JSON.parse(payloadText);
  const failure = spec.checkFailure?.(payload);
  if (failure !== undefined) {
    throw new OperationFailedError(failure, values.json === true ? [payloadText] : undefined);
  }
  if (values.json === true) return [payloadText];
  return spec.format(payload);
}

// The catalog is tier-filtered server-side (gated tiers hide their
// tools entirely) — one sentinel tool per gated tier reads the host's
// posture out of a plain tools/list.
const TIER_SENTINELS = [
  ['write', 'rules_toggle'],
  ['execute', 'requests_send'],
  ['secrets', 'variables_reveal_secret'],
] as const;

export async function commandStatus(argv: readonly string[]): Promise<string[]> {
  const { values, positionals } = parseCommandArgs(argv, {});
  if (positionals.length > 0) throw new UsageError(`unexpected argument: ${positionals[0]}`);
  const conn = await connectionFor(values);
  const server = await initialize(conn);
  const tools = await listTools(conn);
  const names = new Set(tools.map((tool) => tool.name));
  const tiers = ['read', ...TIER_SENTINELS.filter(([, sentinel]) => names.has(sentinel)).map(([tier]) => tier)];
  if (values.json === true) {
    return [JSON.stringify({ daemonUrl: conn.daemonUrl, server, toolCount: tools.length, tiers }, null, 2)];
  }
  return [
    `running — ${server.name} v${server.version} at ${conn.daemonUrl}`,
    `${tools.length} tools · tiers: ${tiers.join(' + ')}`,
  ];
}

/**
 * `oh channel [stable|beta]` — show or persist the update channel
 * (`DISTRIBUTION_PLAN.md` §4). Local, no daemon round-trip: the value
 * selects which `versions/<channel>.json` line version checks and the
 * future `oh upgrade` follow. Absent = `stable`.
 */
export async function commandChannel(argv: readonly string[]): Promise<string[]> {
  const { values, positionals } = parseCommandArgs(argv, {});
  if (positionals.length > 1) throw new UsageError(`unexpected argument: ${positionals[1]}`);
  const configPath = cliConfigPath();
  const existing = await readCliConfig(configPath);
  const [next] = positionals;
  if (next === undefined) {
    const channel: UpdateChannel = existing.channel ?? 'stable';
    return values.json === true ? [JSON.stringify({ channel }, null, 2)] : [channel];
  }
  if (next !== 'stable' && next !== 'beta') {
    throw new UsageError('usage: oh channel [stable|beta]');
  }
  // Merge over the existing file — channel owns only its own key, same
  // law as connect with the connection pair.
  await writeCliConfig(configPath, { ...existing, channel: next });
  if (values.json === true) return [JSON.stringify({ channel: next }, null, 2)];
  return [`channel set to ${next}`, `saved to ${configPath}`];
}

/**
 * `oh autoupdate [on|off]` — show or persist background self-update
 * (`DISTRIBUTION_PLAN.md` §5). Absent = on. Only applies to binary
 * installs the CLI owns itself; package-manager installs (npm, brew,
 * system) never auto-update regardless of this switch.
 */
export async function commandAutoUpdate(argv: readonly string[]): Promise<string[]> {
  const { values, positionals } = parseCommandArgs(argv, {});
  if (positionals.length > 1) throw new UsageError(`unexpected argument: ${positionals[1]}`);
  const configPath = cliConfigPath();
  const existing = await readCliConfig(configPath);
  const [next] = positionals;
  if (next === undefined) {
    const enabled = existing.autoUpdate !== false;
    return values.json === true ? [JSON.stringify({ autoUpdate: enabled }, null, 2)] : [enabled ? 'on' : 'off'];
  }
  if (next !== 'on' && next !== 'off') {
    throw new UsageError('usage: oh autoupdate [on|off]');
  }
  // Merge over the existing file — autoupdate owns only its own key,
  // same law as channel and connect.
  await writeCliConfig(configPath, { ...existing, autoUpdate: next === 'on' });
  if (values.json === true) return [JSON.stringify({ autoUpdate: next === 'on' }, null, 2)];
  return [`auto-update turned ${next}`, `saved to ${configPath}`];
}

export async function commandConnect(argv: readonly string[]): Promise<string[]> {
  const { values, positionals } = parseCommandArgs(argv, {});
  if (positionals.length > 0) throw new UsageError(`unexpected argument: ${positionals[0]}`);
  const token = values.token ?? process.env[TOKEN_ENV];
  if (token === undefined || token === '') {
    throw new UsageError(`oh connect needs a token — pass --token <secret> (or set ${TOKEN_ENV})`);
  }
  const existing = await readCliConfig(cliConfigPath());
  const conn = resolveConnection({ daemon: values.daemon, token }, process.env, existing);
  const tools = await listTools(conn);
  const configPath = cliConfigPath();
  // Merge over the existing file — connect owns only the connection pair,
  // never the telemetry keys.
  await writeCliConfig(configPath, mergeCliConnection(existing, conn.daemonUrl, token));
  return [`connected — ${tools.length} tool(s) at ${conn.daemonUrl}`, `saved to ${configPath}`];
}
