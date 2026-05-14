import { useMemo, useState } from 'react';
import { isTextMime } from '../data/mime';
import { classifyBodyState } from '../data/response-body-state';
import type { InspectorRequest } from '../data/types';
import HexViewer from './detail/HexViewer';
import ResponseViewerToolbar, { type ViewMode } from './detail/ResponseViewerToolbar';
import Skeleton from './detail/Skeleton';
import TextBodyViewer from './detail/TextBodyViewer';

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

interface ResponseBodyViewProps {
  request: InspectorRequest;
  searchHighlight?: string;
  searchLineNumber?: number;
  /** N-th occurrence of `searchHighlight` in this body (0-based). */
  searchMatchIndex?: number;
}

/**
 * Center a short explanatory message when the response body is
 * deliberately absent or unreachable. Matches Chrome's
 * "Failed to load response data / <reason>" layout.
 */
function ResponseNotice({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="dt-response-notice">
      <strong>{title}</strong>
      <span className="dt-col-muted">{detail}</span>
    </div>
  );
}

export function ResponseBodyView({ request, searchHighlight, searchMatchIndex }: ResponseBodyViewProps) {
  const declaredMime = request.mimeType ?? request.harEntry?.response?.content?.mimeType ?? '';
  const state = useMemo(() => classifyBodyState(request), [request]);
  const highlight = searchHighlight ?? '';

  const [viewMode, setViewMode] = useState<ViewMode>('hex');

  const bytes = useMemo(() => {
    if (state.kind !== 'binary') return null;
    try {
      return base64ToBytes(state.base64);
    } catch {
      return null;
    }
  }, [state]);

  const binaryAsText = useMemo(() => {
    if (state.kind !== 'binary' || !bytes) return null;
    // Some servers return text with a binary-looking mime (e.g.
    // application/octet-stream carrying JSON). Try a strict UTF-8
    // decode; on failure we stay in hex mode.
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      return null;
    }
  }, [state, bytes]);

  // ── Non-body states ──────────────────────────────────────
  if (state.kind === 'loading') {
    return (
      <div className="dt-response-view">
        <div className="dt-response-view-content">
          <Skeleton />
        </div>
      </div>
    );
  }
  if (state.kind === 'not-applicable') {
    return <ResponseNotice title="No response body" detail={state.message} />;
  }
  if (state.kind === 'unavailable') {
    return <ResponseNotice title="Failed to load response data" detail={state.message} />;
  }
  if (state.kind === 'empty') {
    return <ResponseNotice title="(empty response body)" detail="The server returned an empty body." />;
  }

  // ── Binary content ─────────────────────────────────────────
  if (state.kind === 'binary') {
    let content: React.ReactNode;
    if (viewMode === 'base64') {
      content = <pre className="dt-body-pre dt-body-pre--base64">{state.base64}</pre>;
    } else if (viewMode === 'utf8' && bytes) {
      const lossy = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
      content = <pre className="dt-body-pre">{lossy}</pre>;
    } else if (bytes) {
      content = <HexViewer data={bytes} />;
    } else {
      content = <span className="dt-col-muted">Binary payload ({request.responseSize ?? 0} bytes).</span>;
    }

    // Binary bodies whose MIME is text-ish (e.g. base64-encoded JSON)
    // can still be offered as text — route through `TextBodyViewer`
    // when we have a clean UTF-8 decode and a text-shaped mime.
    if (viewMode === 'utf8' && binaryAsText && isTextMime(declaredMime)) {
      return (
        <TextBodyViewer
          text={binaryAsText}
          declaredMime={declaredMime}
          searchQuery={highlight || undefined}
          searchMatchIndex={searchMatchIndex}
        />
      );
    }

    return (
      <div className="dt-response-view">
        <div className="dt-response-view-content">{content}</div>
        <ResponseViewerToolbar mode={viewMode} onModeChange={setViewMode} />
      </div>
    );
  }

  // ── Text content ───────────────────────────────────────────
  return (
    <TextBodyViewer
      text={state.content}
      declaredMime={declaredMime}
      searchQuery={highlight || undefined}
      searchMatchIndex={searchMatchIndex}
    />
  );
}
