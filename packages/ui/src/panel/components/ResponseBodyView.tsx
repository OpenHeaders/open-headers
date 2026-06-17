import { useMemo, useState } from 'react';
import {
  currentHarEntry,
  type InspectorRowWithFires,
  lifecycleMimeType,
  lifecycleTransferredBytes,
} from '../data/inspector-row-projection';
import { base64ToBytes } from '../data/base64';
import { isTextMime } from '../data/mime';
import { classifyBodyState } from '../data/response-body-state';
import HexViewer from './detail/HexViewer';
import OverrideBodyButton from './detail/OverrideBodyButton';
import ResponseViewerToolbar, { type ViewMode } from './detail/ResponseViewerToolbar';
import Skeleton from './detail/Skeleton';
import TextBodyViewer from './detail/TextBodyViewer';

interface ResponseBodyViewProps {
  row: InspectorRowWithFires;
  searchHighlight?: string;
  searchLineNumber?: number;
  /** N-th occurrence of `searchHighlight` in this body (0-based). */
  searchMatchIndex?: number;
  /** Open the create-rule editor pre-filled to mock this response. */
  onOverrideResponse?: () => void;
}

/**
 * Center a short explanatory message when the response body is
 * deliberately absent or unreachable.
 */
function ResponseNotice({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="dt-response-notice">
      <strong>{title}</strong>
      <span className="dt-col-muted">{detail}</span>
    </div>
  );
}

export function ResponseBodyView({
  row,
  searchHighlight,
  searchMatchIndex,
  onOverrideResponse,
}: ResponseBodyViewProps) {
  const lc = row.lifecycle;
  const declaredMime =
    lifecycleMimeType(lc) ?? currentHarEntry(lc)?.response?.content?.mimeType ?? '';
  const state = useMemo(() => classifyBodyState(lc), [lc]);
  const highlight = searchHighlight ?? '';
  const overrideAction = onOverrideResponse ? (
    <OverrideBodyButton
      label="Override Response"
      title="Create a rule that serves this response as an editable mock"
      onClick={onOverrideResponse}
    />
  ) : undefined;

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

  // Every state carries the override footer — even with no body to show,
  // the user may want to mock one (the CTA is a rule scaffold, not a
  // mirror of the captured response).
  const shell = (content: React.ReactNode) => (
    <div className="dt-response-view">
      <div className="dt-response-view-content">{content}</div>
      {overrideAction && <div className="dt-response-toolbar">{overrideAction}</div>}
    </div>
  );

  // ── Non-body states ──────────────────────────────────────
  if (state.kind === 'loading') {
    return shell(<Skeleton />);
  }
  if (state.kind === 'not-applicable') {
    return shell(<ResponseNotice title="No response body" detail={state.message} />);
  }
  if (state.kind === 'no-response') {
    return shell(<ResponseNotice title="Nothing to preview" detail="This request has no response data available" />);
  }
  if (state.kind === 'unavailable') {
    return shell(<ResponseNotice title="Failed to load response data" detail={state.message} />);
  }
  if (state.kind === 'empty') {
    return shell(<ResponseNotice title="(empty response body)" detail="The server returned an empty body." />);
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
      content = (
        <span className="dt-col-muted">Binary payload ({lifecycleTransferredBytes(lc) ?? 0} bytes).</span>
      );
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
          toolbarAction={overrideAction}
        />
      );
    }

    return (
      <div className="dt-response-view">
        <div className="dt-response-view-content">{content}</div>
        <ResponseViewerToolbar mode={viewMode} onModeChange={setViewMode} action={overrideAction} />
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
      toolbarAction={overrideAction}
    />
  );
}
