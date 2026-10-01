/**
 * Secret-manager connections store — this device's connections to
 * external secret managers (the Secret Providers plan): where each
 * manager is and as whom it is reached, never a credential value.
 *
 * Host posture like the device-trust pins: persisted under the
 * host-local `OH.secretManagerConnections` key (never synced, never
 * exported), held in one in-memory snapshot after
 * `loadSecretManagerConnections()` so the per-send registry build reads
 * it synchronously. Mutations persist first, then swap the snapshot;
 * the host's RPC layer owns the change broadcast — this module knows
 * no bridge.
 */

import { SecretManagerConnectionsSchema } from '@openheaders/core/schemas';
import {
  EMPTY_SECRET_MANAGER_CONNECTIONS,
  type SecretManagerConnection,
  type SecretManagerConnectionConfig,
  type SecretManagerConnections,
} from '@openheaders/core/types';
import { generateUid } from '@openheaders/core/utils';
import { hostStorage, OH } from '@openheaders/oracle/storage';
import * as v from 'valibot';

let snapshot: SecretManagerConnections = EMPTY_SECRET_MANAGER_CONNECTIONS;
let loaded = false;

/** Seed the in-memory snapshot from host storage — once, at host boot. */
export async function loadSecretManagerConnections(): Promise<void> {
  const persisted = await hostStorage.get(OH.secretManagerConnections);
  const parsed = persisted === undefined ? undefined : v.safeParse(SecretManagerConnectionsSchema, persisted);
  snapshot = parsed?.success ? parsed.output : EMPTY_SECRET_MANAGER_CONNECTIONS;
  loaded = true;
}

export function isSecretManagerConnectionsLoaded(): boolean {
  return loaded;
}

export function listSecretManagerConnections(): SecretManagerConnection[] {
  return snapshot.connections;
}

export function getSecretManagerConnection(uid: string): SecretManagerConnection | undefined {
  return snapshot.connections.find((connection) => connection.uid === uid);
}

export interface SecretManagerConnectionInput {
  label: string;
  config: SecretManagerConnectionConfig;
}

export async function addSecretManagerConnection(
  input: SecretManagerConnectionInput,
): Promise<SecretManagerConnection> {
  const connection: SecretManagerConnection = { uid: generateUid(), label: input.label.trim(), config: input.config };
  await commit({ connections: [...snapshot.connections, connection] });
  return connection;
}

/** Replace the label and config in place; the uid stands so every reference to it keeps resolving. */
export async function updateSecretManagerConnection(
  uid: string,
  input: SecretManagerConnectionInput,
): Promise<SecretManagerConnection | undefined> {
  const existing = getSecretManagerConnection(uid);
  if (!existing) return undefined;
  const next: SecretManagerConnection = { uid, label: input.label.trim(), config: input.config };
  await commit({
    connections: snapshot.connections.map((connection) => (connection.uid === uid ? next : connection)),
  });
  return next;
}

export async function removeSecretManagerConnection(uid: string): Promise<boolean> {
  const next = snapshot.connections.filter((connection) => connection.uid !== uid);
  if (next.length === snapshot.connections.length) return false;
  await commit({ connections: next });
  return true;
}

async function commit(next: SecretManagerConnections): Promise<void> {
  await hostStorage.set(OH.secretManagerConnections, next);
  snapshot = next;
}

export function __resetSecretManagerConnectionsForTests(): void {
  snapshot = EMPTY_SECRET_MANAGER_CONNECTIONS;
  loaded = false;
}
