import type { InspectorHarEntry } from '@openheaders/core/types';

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

function InitiatorChain({ initiator, requestUrl }: { initiator: Initiator; requestUrl: string }) {
  const urls: string[] = [];

  if (initiator.url) urls.push(initiator.url);

  const stack = initiator.stack;
  if (stack?.callFrames) {
    for (const frame of stack.callFrames) {
      if (frame.url && !urls.includes(frame.url)) urls.push(frame.url);
    }
  }

  if (urls.length === 0) return null;

  return (
    <details className="dt-section" open>
      <summary>Request initiator chain</summary>
      <div className="dt-initiator-chain">
        {urls.map((url, i) => (
          <div key={`${url}-${i}`} className="dt-initiator-chain-item">
            <span className="dt-initiator-chain-arrow">{i === 0 ? '' : '\u2193 '}</span>
            <span className="dt-initiator-chain-url" title={url}>
              {url}
            </span>
          </div>
        ))}
        <div className="dt-initiator-chain-item dt-initiator-chain-item--target">
          <span className="dt-initiator-chain-arrow">{'\u2193 '}</span>
          <span className="dt-initiator-chain-url" title={requestUrl}>
            <strong>{requestUrl}</strong>
          </span>
        </div>
      </div>
    </details>
  );
}

interface InitiatorViewProps {
  har: InspectorHarEntry;
  requestUrl: string;
}

export default function InitiatorView({ har, requestUrl }: InitiatorViewProps) {
  const raw = har._initiator as Initiator | undefined;

  if (!raw) {
    return (
      <span className="dt-col-muted" style={{ padding: 12 }}>
        No initiator data available.
      </span>
    );
  }

  return (
    <div className="dt-initiator-view">
      {raw.stack && <CallStack stack={raw.stack} />}

      {!raw.stack && raw.url && (
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

      {!raw.stack && !raw.url && (
        <details className="dt-section" open>
          <summary>Initiator</summary>
          <div className="dt-kv">
            <span className="dt-kv-key">Type:</span>
            <span className="dt-kv-val">{raw.type ?? 'unknown'}</span>
          </div>
        </details>
      )}

      <InitiatorChain initiator={raw} requestUrl={requestUrl} />
    </div>
  );
}
