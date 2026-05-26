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

import {
  currentHarEntry,
  type InspectorRowWithFires,
} from '../../data/inspector-row-projection';
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

  if (!raw && !hasChildren) {
    return (
      <span className="dt-col-muted" style={{ padding: 12 }}>
        No initiator data available.
      </span>
    );
  }

  return (
    <div className="dt-initiator-view">
      {raw?.stack && <CallStack stack={raw.stack} pageOrigin={pageOrigin} />}

      <UpstreamChain
        row={row}
        getRowByUrl={getRowByUrl}
        pageOrigin={pageOrigin}
        onOpenRequest={onOpenRequest}
      />

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
