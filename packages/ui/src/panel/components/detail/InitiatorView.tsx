import type { InspectorHarEntry } from '@openheaders/core/types';
import type { InspectorRequest } from '../../data/types';

interface CallFrame {
  functionName?: string;
  url?: string;
  lineNumber?: number;
  columnNumber?: number;
  scriptId?: string;
}

interface StackTrace {
  callFrames?: CallFrame[];
  parent?: StackTrace;
  description?: string;
}

interface Initiator {
  type?: string;
  url?: string;
  lineNumber?: number;
  stack?: StackTrace;
}

function extractFilename(url: string): string {
  try {
    const path = new URL(url).pathname;
    const segments = path.split('/');
    return segments[segments.length - 1] || path;
  } catch {
    return url;
  }
}

function FrameRow({ frame }: { frame: CallFrame }) {
  const name = frame.functionName || '(anonymous)';
  const file = frame.url ? extractFilename(frame.url) : '';
  const loc = frame.lineNumber != null ? `${file}:${frame.lineNumber + 1}` : file;

  return (
    <div className="dt-initiator-frame">
      <span className="dt-initiator-fn">{name}</span>
      {loc && (
        <span className="dt-initiator-loc" title={frame.url}>
          @ {loc}
        </span>
      )}
    </div>
  );
}

function CallStack({ stack, label }: { stack: StackTrace; label?: string }) {
  const frames = stack.callFrames ?? [];
  if (frames.length === 0 && !stack.parent) return null;

  return (
    <details className="dt-section" open>
      <summary>{label ?? stack.description ?? 'Request call stack'}</summary>
      <div className="dt-initiator-stack">
        {frames.map((frame, i) => (
          <FrameRow key={`${frame.url}-${frame.lineNumber}-${i}`} frame={frame} />
        ))}
      </div>
      {stack.parent && <CallStack stack={stack.parent} label={stack.parent.description ?? 'Async call'} />}
    </details>
  );
}

/**
 * Recursive downstream-initiator tree. `seen` guards against cycles in
 * malformed HARs (a request that nominally initiates one of its own
 * ancestors).
 */
function InitiatorChainTree({
  url,
  getChildren,
  seen,
}: {
  url: string;
  getChildren: (url: string) => readonly InspectorRequest[];
  seen: ReadonlySet<string>;
}) {
  const children = getChildren(url);
  if (children.length === 0) return null;
  const next = new Set(seen);
  next.add(url);
  return (
    <div className="dt-initiator-chain-children">
      {children.map((child) => (
        <div key={child.id} className="dt-initiator-chain-node">
          <div className="dt-initiator-chain-item">
            <span className="dt-initiator-chain-arrow">{'↓ '}</span>
            <span className="dt-initiator-chain-url" title={child.url}>
              {child.url}
            </span>
          </div>
          {!seen.has(child.url) && <InitiatorChainTree url={child.url} getChildren={getChildren} seen={next} />}
        </div>
      ))}
    </div>
  );
}

function InitiatorChain({
  requestUrl,
  getChildren,
}: {
  requestUrl: string;
  getChildren: (url: string) => readonly InspectorRequest[];
}) {
  // Only render the section when the selected request actually initiated
  // something — leaf resources (an image, a JS chunk with no further
  // imports) shouldn't show an empty "chain" affordance.
  if (getChildren(requestUrl).length === 0) return null;
  return (
    <details className="dt-section" open>
      <summary>Request initiator chain</summary>
      <div className="dt-initiator-chain">
        <div className="dt-initiator-chain-item dt-initiator-chain-item--target">
          <span className="dt-initiator-chain-url" title={requestUrl}>
            <strong>{requestUrl}</strong>
          </span>
        </div>
        <InitiatorChainTree url={requestUrl} getChildren={getChildren} seen={new Set()} />
      </div>
    </details>
  );
}

interface InitiatorViewProps {
  har: InspectorHarEntry;
  requestUrl: string;
  getInitiatorChildren: (url: string) => readonly InspectorRequest[];
}

export default function InitiatorView({ har, requestUrl, getInitiatorChildren }: InitiatorViewProps) {
  const raw = har._initiator as Initiator | undefined;
  const hasChildren = getInitiatorChildren(requestUrl).length > 0;

  if (!raw && !hasChildren) {
    return (
      <span className="dt-col-muted" style={{ padding: 12 }}>
        No initiator data available.
      </span>
    );
  }

  return (
    <div className="dt-initiator-view">
      <InitiatorChain requestUrl={requestUrl} getChildren={getInitiatorChildren} />

      {raw?.stack && <CallStack stack={raw.stack} />}

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
