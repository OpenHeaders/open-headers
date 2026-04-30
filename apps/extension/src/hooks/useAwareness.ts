/**
 * Awareness publisher hook (Phase A A1).
 *
 * Renderer surfaces report `(entityFocus, fieldFocus, dirtyFields)` to
 * the SW awareness store; the SW prunes by HLC TTL and re-broadcasts
 * canonical presence. This hook owns publish-on-change + a heartbeat
 * timer (~10s) so a focused surface keeps its slot alive even when the
 * user is reading rather than typing.
 *
 * The hook does NOT consume the broadcast — that's
 * {@link awareness-mirror.ts}. Splitting publisher and reader keeps a
 * single source of truth for the SW round-trip and prevents loops.
 *
 * Sensitive entities (§14.4): the hook trusts the SW to scrub
 * `fieldFocus` for sensitive types. Surfaces don't need to special-case
 * Vault / OAuth themselves.
 */

import { type HLC } from '@openheaders/core/sync';
import { useEffect, useRef } from 'react';
import { call } from '@utils/bridge';
import { logger } from '@utils/logger';
import { ensureRendererContext } from '@/context/renderer-mutator-context';

export interface UseAwarenessOptions {
  workspaceId: string | null;
  /** Stable per-surface id (`workbench`, `popup`, `devpanel`). */
  surfaceId: string;
  entityFocus: { type: string; id: string } | null;
  fieldFocus: { type: string; id: string; path: string } | null;
  dirtyFields: string[];
  /**
   * Pause the publisher (the surface is unmounted / hidden / paused).
   * Defaults to true. When false the hook neither publishes nor
   * heartbeats; the SW's TTL prunes the surface naturally.
   */
  enabled?: boolean;
  /** Heartbeat cadence in ms. Default 10s; SW TTL is 30s. */
  heartbeatMs?: number;
}

const DEFAULT_HEARTBEAT_MS = 10_000;

function snapshotKey(opts: UseAwarenessOptions): string {
  return JSON.stringify({
    e: opts.entityFocus,
    f: opts.fieldFocus,
    d: [...opts.dirtyFields].sort(),
  });
}

export function useAwareness(opts: UseAwarenessOptions): void {
  const lastSentRef = useRef<string | null>(null);
  const lastWorkspaceRef = useRef<string | null>(null);
  const enabled = opts.enabled !== false;

  // Stash the latest options on a ref so the heartbeat closure picks
  // up the freshest values without a re-bind on every render.
  const liveRef = useRef(opts);
  liveRef.current = opts;

  useEffect(() => {
    if (!enabled) return;
    const { workspaceId, surfaceId } = opts;
    if (!workspaceId) return;

    // Workspace switch resets the cache so the first publish on the
    // new workspace always lands.
    if (lastWorkspaceRef.current !== workspaceId) {
      lastSentRef.current = null;
      lastWorkspaceRef.current = workspaceId;
    }

    const ctx = ensureRendererContext({ workspaceId, surfaceId });

    const publish = (): void => {
      const live = liveRef.current;
      if (live.workspaceId !== workspaceId) return;
      const key = snapshotKey(live);
      // Always re-issue on heartbeat (lastActivityHlc moves), but skip
      // intermediate same-value publishes that fire in dense renders.
      // The heartbeat path resets `lastSentRef` to null so it never
      // dedups a heartbeat against the previous publish.
      if (lastSentRef.current === key) return;
      lastSentRef.current = key;

      const hlc: HLC = ctx.next().hlc;
      void call('oh.awareness.publish', {
        workspaceId,
        state: {
          surfaceId,
          deviceId: ctx.nodeId,
          entityFocus: live.entityFocus,
          fieldFocus: live.fieldFocus,
          dirtyFields: [...live.dirtyFields],
          lastActivityHlc: hlc,
        },
      }).catch((err: Error) => {
        logger.info('useAwareness', `publish failed: ${err.message}`);
      });
    };

    publish();

    const heartbeat = window.setInterval(() => {
      lastSentRef.current = null;
      publish();
    }, opts.heartbeatMs ?? DEFAULT_HEARTBEAT_MS);

    return () => {
      window.clearInterval(heartbeat);
    };
  }, [
    enabled,
    opts.workspaceId,
    opts.surfaceId,
    opts.entityFocus?.type,
    opts.entityFocus?.id,
    opts.fieldFocus?.type,
    opts.fieldFocus?.id,
    opts.fieldFocus?.path,
    opts.dirtyFields.join('\x1f'),
    opts.heartbeatMs,
    // `opts` reference itself isn't a dep — we mirror the relevant
    // fields. `liveRef` always carries the latest copy for callbacks.
  ]);
}
