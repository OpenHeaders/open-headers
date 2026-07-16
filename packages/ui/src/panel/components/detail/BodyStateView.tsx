import { useT } from '@openheaders/ui/context/LocaleContext';
import { useMemo, useState } from 'react';
import { base64ToBytes } from '../../data/base64';
import { isTextMime } from '../../data/mime';
import { type BodyState, notApplicableMessage, unavailableMessage } from '../../data/response-body-state';
import HexViewer from './HexViewer';
import ResponseViewerToolbar, { type ViewMode } from './ResponseViewerToolbar';
import Skeleton from './Skeleton';
import TextBodyViewer from './TextBodyViewer';

interface BodyStateViewProps {
  /** Classified body — `served` or `original` side of an exchange. */
  readonly state: BodyState;
  /** MIME for syntax highlight / text-vs-hex routing of a binary body. */
  readonly declaredMime: string;
  readonly searchHighlight?: string;
  readonly searchMatchIndex?: number;
  /** Bottom-toolbar action (the Override Response CTA); omitted on the
   *  read-only original pane of a split. */
  readonly toolbarAction?: React.ReactNode;
  /** Far-right toolbar controls (e.g. dual-view mode buttons). */
  readonly toolbarTrailing?: React.ReactNode;
  /** Byte count to show when a binary body cannot be decoded. */
  readonly fallbackByteCount?: number;
}

/** Center a short explanatory message for a deliberately-absent body. */
function ResponseNotice({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="dt-response-notice">
      <strong>{title}</strong>
      <span className="dt-col-muted">{detail}</span>
    </div>
  );
}

/**
 * Render one classified {@link BodyState} into the response body pane — the
 * shared renderer behind the Response tab and each half of the split
 * Served | Original view. Owns only its own binary view-mode toggle; the
 * row-level classification (which body, served vs original) is the caller's.
 */
export default function BodyStateView({
  state,
  declaredMime,
  searchHighlight,
  searchMatchIndex,
  toolbarAction,
  toolbarTrailing,
  fallbackByteCount,
}: BodyStateViewProps) {
  const t = useT();
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
    // Some servers return text under a binary-looking mime (octet-stream
    // carrying JSON). Try a strict UTF-8 decode; on failure stay in hex.
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      return null;
    }
  }, [state, bytes]);

  const shell = (content: React.ReactNode) => (
    <div className="dt-response-view">
      <div className="dt-response-view-content">{content}</div>
      {(toolbarAction || toolbarTrailing) && (
        <div className="dt-response-toolbar">
          <div className="dt-response-toolbar-left">{toolbarAction}</div>
          {toolbarTrailing}
        </div>
      )}
    </div>
  );

  // ── Non-body states ──────────────────────────────────────
  if (state.kind === 'loading') return shell(<Skeleton />);
  if (state.kind === 'not-applicable') {
    return shell(
      <ResponseNotice
        title={t('panel.inspector.bodyState.noResponseBodyTitle')}
        detail={notApplicableMessage(t, state.reason)}
      />,
    );
  }
  if (state.kind === 'no-response') {
    return shell(
      <ResponseNotice
        title={t('panel.inspector.bodyState.nothingToPreviewTitle')}
        detail={t('panel.inspector.bodyState.noResponseDetail')}
      />,
    );
  }
  if (state.kind === 'unavailable') {
    return shell(
      <ResponseNotice
        title={t('panel.inspector.bodyState.failedTitle')}
        detail={unavailableMessage(t, state.reason)}
      />,
    );
  }
  if (state.kind === 'empty') {
    return shell(
      <ResponseNotice
        title={t('panel.inspector.bodyState.emptyTitle')}
        detail={t('panel.inspector.bodyState.emptyDetail')}
      />,
    );
  }

  // ── Binary content ─────────────────────────────────────────
  if (state.kind === 'binary') {
    let content: React.ReactNode;
    if (viewMode === 'base64') {
      content = <pre className="dt-body-pre dt-body-pre--base64">{state.base64}</pre>;
    } else if (viewMode === 'utf8' && bytes) {
      content = <pre className="dt-body-pre">{new TextDecoder('utf-8', { fatal: false }).decode(bytes)}</pre>;
    } else if (bytes) {
      content = <HexViewer data={bytes} />;
    } else {
      content = (
        <span className="dt-col-muted">
          {t('panel.inspector.bodyState.binaryPayloadBytes', { count: fallbackByteCount ?? 0 })}
        </span>
      );
    }

    // A binary body under a text-ish mime (base64-encoded JSON) can still be
    // offered as text once it decodes cleanly.
    if (viewMode === 'utf8' && binaryAsText && isTextMime(declaredMime)) {
      return (
        <TextBodyViewer
          text={binaryAsText}
          declaredMime={declaredMime}
          searchQuery={highlight || undefined}
          searchMatchIndex={searchMatchIndex}
          toolbarAction={toolbarAction}
          toolbarTrailing={toolbarTrailing}
        />
      );
    }

    return (
      <div className="dt-response-view">
        <div className="dt-response-view-content">{content}</div>
        <ResponseViewerToolbar
          mode={viewMode}
          onModeChange={setViewMode}
          action={toolbarAction}
          trailing={toolbarTrailing}
        />
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
      toolbarAction={toolbarAction}
      toolbarTrailing={toolbarTrailing}
    />
  );
}
