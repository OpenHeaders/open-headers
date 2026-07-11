/**
 * Name → uid pre-resolution — the one sanctioned deviation from
 * one-call-per-command: the north-star diagram addresses entities by
 * name (`oh env switch staging`, `oh request send login`) while the
 * tools take uids, so these run one list-tool read before the main
 * call. Resolution is uid-first (a uid is never reinterpreted as a
 * name), then unique exact name; an ambiguous name is a usage error
 * naming the candidate uids, a miss is a plain failure (exit 1).
 */

import type { Connection } from './connection';
import { UsageError } from './exit-codes';
import { callTool } from './rpc';

interface NamedRow {
  uid: string;
  name: string;
}

interface ResolverTarget {
  readonly listTool: string;
  readonly payloadKey: string;
  readonly argName: string;
  readonly kind: string;
  readonly listHint: string;
}

async function resolveUidTarget(
  args: Record<string, unknown>,
  conn: Connection,
  target: ResolverTarget,
): Promise<Record<string, unknown>> {
  const raw = args[target.argName];
  if (typeof raw !== 'string') return args;
  const listArgs = typeof args.workspaceId === 'string' ? { workspaceId: args.workspaceId } : {};
  const payload = JSON.parse(await callTool(conn, target.listTool, listArgs)) as Record<string, NamedRow[]>;
  const rows = payload[target.payloadKey] ?? [];
  if (rows.some((row) => row.uid === raw)) return args;
  const byName = rows.filter((row) => row.name === raw);
  const [match] = byName;
  if (match !== undefined && byName.length === 1) return { ...args, [target.argName]: match.uid };
  if (byName.length > 1) {
    throw new UsageError(
      `${target.kind} name '${raw}' is ambiguous — use a uid: ${byName.map((row) => row.uid).join(', ')}`,
    );
  }
  throw new Error(`no ${target.kind} named '${raw}' — see ${target.listHint}`);
}

export function resolveEnvironmentTarget(
  args: Record<string, unknown>,
  conn: Connection,
): Promise<Record<string, unknown>> {
  return resolveUidTarget(args, conn, {
    listTool: 'environments_list',
    payloadKey: 'environments',
    argName: 'environmentId',
    kind: 'environment',
    listHint: 'oh env list',
  });
}

export function resolveRequestTarget(
  args: Record<string, unknown>,
  conn: Connection,
): Promise<Record<string, unknown>> {
  return resolveUidTarget(args, conn, {
    listTool: 'requests_list',
    payloadKey: 'requests',
    argName: 'uid',
    kind: 'request',
    listHint: 'oh request list',
  });
}

export function resolveWorkflowTarget(
  args: Record<string, unknown>,
  conn: Connection,
): Promise<Record<string, unknown>> {
  return resolveUidTarget(args, conn, {
    listTool: 'workflows_list',
    payloadKey: 'workflows',
    argName: 'uid',
    kind: 'workflow',
    listHint: 'oh workflow list',
  });
}
