/**
 * The place a "Synced with" row names (the Backup and Sync UX plan D3:
 * places, never URLs). Precedence: the user's own label; a loopback
 * address dialed from a browser host is the desktop app on this
 * computer; a server is named by the workspace group it provides (one
 * group per server, its name is the server's); with nothing else, the
 * address's host. The URL itself is the row's tertiary line, never the
 * place.
 */

import { isLoopbackBackendUrl } from '@openheaders/core/backends';
import type { BackendConnection } from '@openheaders/core/types';
import type { Host } from '../../../shared/host-vocabulary';

export type BackendPlace = { kind: 'named'; name: string } | { kind: 'desktop-app' };

export function backendPlace(
  host: Host,
  record: Pick<BackendConnection, 'label' | 'url'>,
  providedGroupNames: readonly string[],
): BackendPlace {
  const label = record.label.trim();
  if (label.length > 0) return { kind: 'named', name: label };
  if (host !== 'desktop' && isLoopbackBackendUrl(record.url)) return { kind: 'desktop-app' };
  const group = providedGroupNames[0]?.trim();
  if (group) return { kind: 'named', name: group };
  return { kind: 'named', name: urlHost(record.url) };
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
