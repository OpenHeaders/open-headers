/**
 * The place a joined backend reads as (the Backup and Sync UX plan D3:
 * places, never URLs) — the one rule behind the Sync page's "Synced
 * with" rows and the workspace switcher's group headers. The kind is
 * core's `providingBackendKind` (the desktop app's own loopback port from a
 * browser host = the desktop app on this computer, anything else a
 * server — a loopback daemon on another port included); the name is
 * the user's own label first, then — for a server — the workspace
 * group it provides (one group per server, its name is the server's),
 * then the address's host. An unlabelled desktop app carries no name:
 * it IS this computer. The URL itself is a tertiary line, never the
 * place.
 */

import { type ProvidingBackendKind, providingBackendKind } from '@openheaders/core/identity';
import type { BackendConnection } from '@openheaders/core/types';
import { type Host, viewerHostKind } from '../host-vocabulary';

export interface BackendPlace {
  kind: ProvidingBackendKind;
  /** Null for the unlabelled desktop app — the place is this computer. */
  name: string | null;
}

/** `record` is null for a backend present by construction — the web tab's serving daemon. */
export function backendPlace(
  host: Host,
  record: Pick<BackendConnection, 'label' | 'url'> | null,
  providedGroupNames: readonly string[],
): BackendPlace {
  const kind = providingBackendKind(viewerHostKind(host), record?.url ?? null);
  const label = record?.label.trim() ?? '';
  if (kind === 'desktop-app') return { kind, name: label || null };
  const group = providedGroupNames[0]?.trim();
  return { kind, name: label || group || (record ? urlHost(record.url) : null) };
}

/** The address's host for a nameless server — the raw string when it doesn't parse. */
export function urlHost(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.length > 0 ? parsed.hostname : url;
  } catch {
    return url;
  }
}
