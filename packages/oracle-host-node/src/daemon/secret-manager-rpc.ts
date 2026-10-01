/**
 * Secret-manager bridge routes — the node host's answers for
 * `oh.secretManager.*` (the Secret Providers plan): this device's
 * connections to external secret managers (list, add, update, remove),
 * the side-effect-free probe every status chip reads, and the
 * interactive authorization behind the settings list's Test gesture.
 *
 * Mutations go through the oracle store (persist-first, then the
 * in-memory snapshot the per-send registry build reads) and fan the
 * change out as `secretManagerConnectionsChanged` so every surface
 * refetches. A config is validated against the schema before it lands
 * — a malformed record never reaches the store.
 */

import type { BridgeRpcResponse } from '@openheaders/core/bridge';
import { hostBridge } from '@openheaders/core/bridge';
import { SecretManagerConnectionConfigSchema } from '@openheaders/core/schemas';
import { describeSecretConnection, getSecretProvider } from '@openheaders/core/secret-providers';
import type { SecretManagerConnectionConfig } from '@openheaders/core/types';
import {
  addSecretManagerConnection,
  getSecretManagerConnection,
  listSecretManagerConnections,
  removeSecretManagerConnection,
  updateSecretManagerConnection,
} from '@openheaders/oracle/entity/secret-manager-connections-store';
import * as v from 'valibot';

const SECRET_MANAGER_TYPES = new Set([
  'oh.secretManager.list',
  'oh.secretManager.add',
  'oh.secretManager.update',
  'oh.secretManager.remove',
  'oh.secretManager.probe',
  'oh.secretManager.authorize',
]);

export type SecretManagerRpcType =
  | 'oh.secretManager.list'
  | 'oh.secretManager.add'
  | 'oh.secretManager.update'
  | 'oh.secretManager.remove'
  | 'oh.secretManager.probe'
  | 'oh.secretManager.authorize';

export function isSecretManagerRpc(type: unknown): type is SecretManagerRpcType {
  return typeof type === 'string' && SECRET_MANAGER_TYPES.has(type);
}

function broadcastChanged(): void {
  hostBridge.broadcast('secretManagerConnectionsChanged', { count: listSecretManagerConnections().length });
}

function parseConfig(raw: unknown): SecretManagerConnectionConfig | null {
  const parsed = v.safeParse(SecretManagerConnectionConfigSchema, raw);
  return parsed.success ? parsed.output : null;
}

export async function handleSecretManagerList(): Promise<BridgeRpcResponse<'oh.secretManager.list'>> {
  return { connections: listSecretManagerConnections() };
}

export async function handleSecretManagerAdd(
  message: Record<string, unknown>,
): Promise<BridgeRpcResponse<'oh.secretManager.add'>> {
  const config = parseConfig(message.config);
  if (!config) return { ok: false, error: 'Not a valid connection.' };
  const label = typeof message.label === 'string' ? message.label.trim() : '';
  const connection = await addSecretManagerConnection({
    label: label || describeSecretConnection({ uid: '', label: '', config }),
    config,
  });
  broadcastChanged();
  return { ok: true, connection };
}

export async function handleSecretManagerUpdate(
  message: Record<string, unknown>,
): Promise<BridgeRpcResponse<'oh.secretManager.update'>> {
  const uid = typeof message.uid === 'string' ? message.uid : '';
  const config = parseConfig(message.config);
  if (!config) return { ok: false, error: 'Not a valid connection.' };
  const label = typeof message.label === 'string' ? message.label.trim() : '';
  const connection = await updateSecretManagerConnection(uid, {
    label: label || describeSecretConnection({ uid, label: '', config }),
    config,
  });
  if (!connection) return { ok: false, error: 'No such connection on this device.' };
  broadcastChanged();
  return { ok: true, connection };
}

export async function handleSecretManagerRemove(
  message: Record<string, unknown>,
): Promise<BridgeRpcResponse<'oh.secretManager.remove'>> {
  const uid = typeof message.uid === 'string' ? message.uid : '';
  const removed = await removeSecretManagerConnection(uid);
  if (!removed) return { ok: false, error: 'No such connection on this device.' };
  broadcastChanged();
  return { ok: true };
}

export async function handleSecretManagerProbe(
  message: Record<string, unknown>,
): Promise<BridgeRpcResponse<'oh.secretManager.probe'>> {
  const uid = typeof message.uid === 'string' ? message.uid : '';
  const connection = getSecretManagerConnection(uid);
  if (!connection) return { available: false, reason: 'not-installed', detail: 'No such connection on this device.' };
  const provider = getSecretProvider(connection.config.provider);
  if (!provider) return { available: false, reason: 'not-installed' };
  try {
    return await provider.probe(connection);
  } catch (err) {
    return { available: false, reason: 'unreachable', detail: err instanceof Error ? err.message : String(err) };
  }
}

export async function handleSecretManagerAuthorize(
  message: Record<string, unknown>,
): Promise<BridgeRpcResponse<'oh.secretManager.authorize'>> {
  const uid = typeof message.uid === 'string' ? message.uid : '';
  const connection = getSecretManagerConnection(uid);
  if (!connection) return { ok: false, detail: 'No such connection on this device.' };
  const provider = getSecretProvider(connection.config.provider);
  if (!provider) return { ok: false, detail: 'This secret manager is not available on this device.' };
  if (!provider.authorize) {
    // Ambient auth (a credential chain, an OS prompt on read): the
    // probe is the whole answer.
    const probe = await provider.probe(connection);
    return probe.available
      ? { ok: true }
      : { ok: false, reason: probe.reason, ...(probe.detail !== undefined ? { detail: probe.detail } : {}) };
  }
  try {
    return await provider.authorize(connection);
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}

/** Route one bridge message; `undefined` when the type is not ours. */
export async function handleSecretManagerRpc(type: string, message: Record<string, unknown>): Promise<unknown> {
  switch (type) {
    case 'oh.secretManager.list':
      return handleSecretManagerList();
    case 'oh.secretManager.add':
      return handleSecretManagerAdd(message);
    case 'oh.secretManager.update':
      return handleSecretManagerUpdate(message);
    case 'oh.secretManager.remove':
      return handleSecretManagerRemove(message);
    case 'oh.secretManager.probe':
      return handleSecretManagerProbe(message);
    case 'oh.secretManager.authorize':
      return handleSecretManagerAuthorize(message);
    default:
      return undefined;
  }
}
