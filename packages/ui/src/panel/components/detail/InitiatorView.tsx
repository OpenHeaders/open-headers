/**
 * InitiatorView — the Initiator section of the inspector. Composes
 * four sub-views: the upstream call stack (V8 frames), the upstream
 * request chain (cross-request initiator), the downstream initiator
 * tree (this request's descendants, with sticky-ancestor scrolling),
 * and a fallback for requests whose only initiator data is a bare
 * `{ type, url }` pair.
 *
 * Heavy lifting lives in:
 *   - initiator/CallStack        (V8 frames + source-map resolution)
 *   - initiator/UpstreamChain    (cross-request parents)
 *   - initiator/InitiatorTree    (downstream tree + sticky stack)
 *   - panel/data/                (cascade summary, insights, filter)
 */

import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import { useCallback, useMemo } from 'react';
import {
  currentHarEntry,
  type InspectorRowWithFires,
} from '../../data/inspector-row-projection';
import { computeUpstreamChain } from '../../data/upstream-chain';
import { CallStack, type StackTrace } from './initiator/CallStack';
import { InitiatorTreeView } from './initiator/InitiatorTree';
import { UpstreamChain } from './initiator/UpstreamChain';
import { extractFilename } from './initiator/utils';

interface Initiator {
  type?: string;
  url?: string;
  lineNumber?: number;
  stack?: StackTrace;
}

interface InitiatorViewProps {
  row: InspectorRowWithFires;
  getInitiatorChildren: (url: string) => readonly InspectorRowWithFires[];
  getRowByUrl: (url: string) => InspectorRowWithFires | null;
  pageOrigin: string | null;
  onOpenRequest?: (requestId: string) => void;
}

export default function InitiatorView({
  row,
  getInitiatorChildren,
  getRowByUrl,
  pageOrigin,
  onOpenRequest,
}: InitiatorViewProps) {
  const lc = row.lifecycle;
  const raw = currentHarEntry(lc)?._initiator as Initiator | undefined;
  const hasChildren = getInitiatorChildren(lc.url).length > 0;

  // Computed here (not inside UpstreamChain) so the empty-state gate below
  // reflects it — an in-flight row with no HAR `_initiator` but a resolvable
  // chain (via `lc.initiator`) must still render the chain, not "No data".
  const lookupLifecycle = useCallback(
    (url: string): RequestLifecycle | null => getRowByUrl(url)?.lifecycle ?? null,
    [getRowByUrl],
  );
  const upstreamChain = useMemo(() => computeUpstreamChain(lc, lookupLifecycle), [lc, lookupLifecycle]);
  const hasUpstream = upstreamChain.length > 1;

  if (!raw && !hasChildren && !hasUpstream) {
    return (
      <span className="dt-col-muted" style={{ padding: 12 }}>
        No initiator data available.
      </span>
    );
  }

  return (
    <div className="dt-initiator-view">
      {raw?.stack && <CallStack stack={raw.stack} pageOrigin={pageOrigin} />}

      <UpstreamChain row={row} chain={upstreamChain} pageOrigin={pageOrigin} onOpenRequest={onOpenRequest} />

      {hasChildren && (
        <InitiatorTreeView
          row={row}
          getChildren={getInitiatorChildren}
          pageOrigin={pageOrigin}
          onOpenRequest={onOpenRequest}
        />
      )}

      {raw && !raw.stack && raw.url && (
        <details className="dt-section" open>
          <summary>Initiator</summary>
          <div className="dt-initiator-frame">
            <span className="dt-initiator-fn">{raw.type ?? 'other'}</span>
            <span className="dt-initiator-loc" title={raw.url}>
              @ {extractFilename(raw.url)}
              {raw.lineNumber != null ? `:${raw.lineNumber + 1}` : ''}
            </span>
          </div>
        </details>
      )}

      {raw && !raw.stack && !raw.url && !hasChildren && (
        <details className="dt-section" open>
          <summary>Initiator</summary>
          <div className="dt-kv">
            <span className="dt-kv-key">Type:</span>
            <span className="dt-kv-val">{raw.type ?? 'unknown'}</span>
          </div>
        </details>
      )}
    </div>
  );
}
