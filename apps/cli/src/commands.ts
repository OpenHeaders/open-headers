/**
 * Command execution — the glue between argv, the config store, and the
 * RPC client. `runReadCommand` drives every table entry; `status` and
 * `connect` are the two local commands (probe + persist) that exist
 * outside the tool catalog; `request authorize` is the one two-call
 * command (start, then poll the status tool at the provider's cadence).
 */

import { parseArgs } from 'node:util';
import { mergeCliConnection } from '@openheaders/core/cli-config';
import type { CommandOptionValues, CommandSpec } from './command-spec';
import { cliConfigPath, readCliConfig, type UpdateChannel, writeCliConfig } from './config-store';
import { type Connection, resolveConnection, TOKEN_ENV } from './connection';
import { OperationFailedError, UsageError } from './exit-codes';
import { formatRequestAuthorize } from './format';
import { commandTokenCount, type ReadCommandSpec } from './read-commands';
import { resolveRequestTarget } from './resolvers';
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
 * (the distribution plan §4). Local, no daemon round-trip: the value
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
 * (the distribution plan §5). Absent = on. Only applies to binary
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

// ── oh request authorize ─────────────────────────────────────────────

interface AuthorizeApproval {
  userCode: string;
  verificationUri: string;
  verificationUriComplete?: string;
  intervalSeconds: number;
}

type AuthorizeState =
  | { state: 'pending'; approval: AuthorizeApproval }
  | { state: 'granted' }
  | { state: 'denied' | 'expired' | 'failed'; message: string }
  | { state: 'cancelled' };

interface AuthorizePayload {
  request: { uid: string; name: string };
  outcome: 'granted' | 'pending' | 'refused';
  state?: AuthorizeState;
  error?: string;
}

interface AuthorizeStatusPayload {
  state: AuthorizeState | null;
}

/** The waiting UX's seams — stderr for the progress lines (stdout stays
 *  the `--json` payload), the clock for the poll cadence. */
export interface AuthorizeIo {
  progress: (line: string) => void;
  sleep: (ms: number) => Promise<void>;
}

const DEFAULT_AUTHORIZE_IO: AuthorizeIo = {
  progress: (line) => process.stderr.write(`${line}\n`),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

/**
 * `oh request authorize <name-or-uid>` — acquire an OAuth 2.0 token for
 * a saved request without a browser on the daemon: the grants that
 * need none exchange now; the device grant (RFC 8628) prints the
 * one-time code and the verification URL the way gh and az do, then
 * polls `requests_authorize_status` at the provider's interval until
 * the user approves on any device (or refuses, or the code expires).
 * A refusal, a denial, an expiry, or a failure is exit 1 with the
 * daemon's own words; `--json` carries the final payload either way.
 */
export async function commandRequestAuthorize(
  argv: readonly string[],
  io: AuthorizeIo = DEFAULT_AUTHORIZE_IO,
): Promise<string[]> {
  const { values, positionals } = parseCommandArgs(argv, {});
  const [target, extra] = positionals;
  if (target === undefined || extra !== undefined) {
    throw new UsageError('usage: oh request authorize <name-or-uid>');
  }
  const conn = await connectionFor(values);
  const toolArgs = await resolveRequestTarget(
    { ...(values.workspace !== undefined ? { workspaceId: values.workspace } : {}), uid: target },
    conn,
  );
  const startedText = await callTool(conn, 'requests_authorize', toolArgs);
  const started = JSON.parse(startedText) as AuthorizePayload;
  const json = values.json === true;
  if (started.outcome === 'refused') {
    throw new OperationFailedError(
      `authorization refused — ${started.error ?? 'no error detail'}`,
      json ? [startedText] : undefined,
    );
  }
  if (started.outcome === 'granted' || started.state?.state !== 'pending') {
    return json ? [startedText] : formatRequestAuthorize(started);
  }

  const { approval } = started.state;
  io.progress(`! First copy your one-time code: ${approval.userCode}`);
  io.progress(`  Open ${approval.verificationUriComplete ?? approval.verificationUri} in a browser and enter it`);
  io.progress('  Waiting for you to approve…');

  let intervalSeconds = approval.intervalSeconds;
  for (;;) {
    await io.sleep(intervalSeconds * 1000);
    const statusText = await callTool(conn, 'requests_authorize_status', toolArgs);
    const status = JSON.parse(statusText) as AuthorizeStatusPayload;
    const state = status.state;
    if (state === null) {
      throw new OperationFailedError('authorization cancelled on the daemon', json ? [statusText] : undefined);
    }
    if (state.state === 'pending') {
      intervalSeconds = state.approval.intervalSeconds;
      continue;
    }
    if (state.state === 'granted') {
      return json ? [statusText] : formatRequestAuthorize({ ...started, outcome: 'granted', state });
    }
    const detail = state.state === 'cancelled' ? 'authorization cancelled on the daemon' : state.message;
    throw new OperationFailedError(`authorization ${state.state} — ${detail}`, json ? [statusText] : undefined);
  }
}
