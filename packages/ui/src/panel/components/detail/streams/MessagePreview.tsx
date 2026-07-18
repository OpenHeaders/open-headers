/**
 * MessagePreview — the Messages tab's lower pane: the full payload of
 * the selected frame.
 *
 *   - No selection → "No message selected" empty state.
 *   - Text / error frames → a JSON tree when the payload parses as
 *     JSON (Raw mode = the Monaco viewer), the Monaco viewer otherwise.
 *   - Binary frames → Base64 / Hex / UTF-8 viewer with a copy action
 *     (copies the current view's representation).
 *   - A frame a `ws` rule modified → the Original | Modified split
 *     (same {@link SplitBodyView} shell as the Response tab), each side
 *     labeled with its delivery path. The side the capture plane never
 *     saw is either derived from the rule's replacement payload
 *     (receive: the wire holds the original) or honestly absent (send:
 *     only the replacement crossed the wire). An inferred-tier
 *     modification carries an (i) popover on the Modified caption — the
 *     split view never claims more than the fire rail does.
 */

import { useT, type Translate } from '@openheaders/ui/context/LocaleContext';
import { type InfoPopoverContent, InfoTrigger } from '@openheaders/ui/shared/info-popover';
import { lazy, Suspense, useMemo, useState } from 'react';
import { base64ToBytes } from '../../../data/base64';
import type { MessageFrameAttribution } from '../../../data/message-fire-rail';
import { JsonTree } from '../../JsonTree';
import HexViewer from '../HexViewer';
import { overrideLabels } from '../override-labels';
import ResponseViewerToolbar, { type ViewMode } from '../ResponseViewerToolbar';
import Skeleton from '../Skeleton';
import SplitBodyView from '../SplitBodyView';
import { type WsDisplayFrame, WS_OPCODE_BINARY } from './ws-frames';

// Lazy like every Monaco consumer — a static import would pull Monaco
// into the panel's initial chunk.
const CodeViewer = lazy(() => import('../CodeViewer'));

interface MessagePreviewProps {
  frame: WsDisplayFrame | null;
  /** Fire-rail attribution for the frame — a derivable modification
   *  flips the pane into the Original | Modified split. */
  attribution?: MessageFrameAttribution | null;
}

/** The Modified caption's (i) — shown only at the inferred tier, where
 *  the split renders a derived payload rather than a captured one. */
function inferredModifiedInfo(t: Translate): InfoPopoverContent {
  return {
    title: t('panel.inspector.messages.inferredModified.title'),
    kicker: t('panel.inspector.sections.messages'),
    summary: t('panel.inspector.messages.inferredModified.summary'),
    description: t('panel.inspector.messages.inferredModified.description'),
  };
}

/** The Dropped caption's (i) — the drop, like the replacement, happens
 *  inside the page after wire capture, so it is selector-inferred too. */
function inferredDroppedInfo(t: Translate): InfoPopoverContent {
  return {
    title: t('panel.inspector.messages.inferredDropped.title'),
    kicker: t('panel.inspector.sections.messages'),
    summary: t('panel.inspector.messages.inferredDropped.summary'),
    description: t('panel.inspector.messages.inferredDropped.description'),
  };
}

function tryParseJson(text: string): unknown | undefined {
  const trimmed = text.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return undefined;
  try {
    return JSON.parse(trimmed);
  } catch {
    return undefined;
  }
}

function toHexText(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}

function BinaryPreview({ frame }: { frame: WsDisplayFrame }) {
  const t = useT();
  const [mode, setMode] = useState<ViewMode>('hex');
  const [copied, setCopied] = useState(false);

  const bytes = useMemo(() => {
    try {
      return base64ToBytes(frame.data);
    } catch {
      return null;
    }
  }, [frame.data]);

  const copy = async (): Promise<void> => {
    const text =
      mode === 'base64' ? frame.data : bytes ? (mode === 'hex' ? toHexText(bytes) : new TextDecoder().decode(bytes)) : '';
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can fail under permission-restricted iframes; the user
      // can still select the rendered view manually.
    }
  };

  let content: React.ReactNode;
  if (mode === 'base64') {
    content = <pre className="dt-body-pre dt-body-pre--base64">{frame.data}</pre>;
  } else if (mode === 'utf8' && bytes) {
    content = <pre className="dt-body-pre">{new TextDecoder('utf-8', { fatal: false }).decode(bytes)}</pre>;
  } else if (bytes) {
    content = <HexViewer data={bytes} />;
  } else {
    content = <span className="dt-col-muted">{t('panel.inspector.streams.preview.decodeFailed')}</span>;
  }

  return (
    <div className="dt-msg-preview-binary">
      <div className="dt-msg-preview-content">{content}</div>
      <ResponseViewerToolbar
        mode={mode}
        onModeChange={setMode}
        trailing={
          <button
            type="button"
            className="dt-response-toolbar-btn"
            onClick={copy}
            title={t('panel.inspector.streams.preview.copyTitle')}
          >
            {copied ? t('panel.inspector.streams.preview.copied') : t('panel.inspector.streams.preview.copy')}
          </button>
        }
      />
    </div>
  );
}

/**
 * Text payload rendering shared by the captured frame and the derived
 * replacement: a JSON tree when the payload parses (with a bottom
 * `JSON | Raw` mode switch — same toolbar anatomy as the Response
 * viewer, so the parsed view is an offer, not an assumption), the
 * Monaco viewer otherwise (and as the Raw mode) — find-in-payload,
 * folding, the JWT underline plane and the whole-buffer Decode chip,
 * exactly the Response tab's body anatomy. Exported for the
 * EventStream preview twin — SSE payloads are always text, so this is
 * its whole payload story.
 */
export function TextPayload({ text }: { text: string }) {
  const t = useT();
  const json = useMemo(() => tryParseJson(text), [text]);
  const [raw, setRaw] = useState(false);
  const showJson = json !== undefined && !raw;
  return (
    <>
      {showJson ? (
        <div className="dt-msg-preview-content dt-msg-preview-json">
          <JsonTree value={json} defaultExpandedDepth={2} />
        </div>
      ) : (
        <div className="dt-msg-preview-content dt-msg-preview-content--code">
          <Suspense fallback={<Skeleton />}>
            {/* Frames are transient — always a viewer, never write-back.
                CodeViewer's own planes cover the decode ladder: the JWT
                underline owns a wholly-JWT frame, the corner chip the
                other whole-buffer encodings. */}
            <CodeViewer value={text} language={json !== undefined ? 'json' : 'plaintext'} readOnly />
          </Suspense>
        </div>
      )}
      {json !== undefined && (
        <div className="dt-response-toolbar">
          <div className="dt-response-toolbar-left">
            <div className="dt-response-toolbar-modes">
              <button
                type="button"
                className={`dt-response-toolbar-btn ${showJson ? 'active' : ''}`}
                onClick={() => setRaw(false)}
              >
                JSON
              </button>
              <button
                type="button"
                className={`dt-response-toolbar-btn ${raw ? 'active' : ''}`}
                onClick={() => setRaw(true)}
              >
                {t('panel.inspector.streams.preview.raw')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** The single-frame payload rendering (binary viewer / JSON tree / text). */
function FramePayload({ frame }: { frame: WsDisplayFrame }) {
  if (frame.opcode === WS_OPCODE_BINARY && frame.type !== 'error') {
    return <BinaryPreview frame={frame} />;
  }
  return <TextPayload text={frame.data} />;
}

export default function MessagePreview({ frame, attribution = null }: MessagePreviewProps) {
  const t = useT();
  const labels = useMemo(() => overrideLabels(t), [t]);
  if (!frame) {
    return (
      <div className="dt-msg-preview-empty">
        <strong>{t('panel.inspector.streams.preview.noMessageTitle')}</strong>
        <span className="dt-col-muted">{t('panel.inspector.streams.preview.noMessageHint')}</span>
      </div>
    );
  }

  const modification = attribution?.modification ?? null;
  if (modification) {
    const send = frame.type === 'send';
    const inferredInfo =
      attribution?.tier === 'inferred' ? (
        <InfoTrigger content={modification.kind === 'dropped' ? inferredDroppedInfo(t) : inferredModifiedInfo(t)} />
      ) : undefined;

    if (modification.kind === 'dropped') {
      return (
        <div className="dt-msg-preview-dual">
          <SplitBodyView
            startLabel={send ? labels.requestOriginal : labels.responseOriginal}
            start={<FramePayload frame={frame} />}
            endLabel={send ? labels.wsSendDropped : labels.wsRecvDropped}
            end={
              <div className="dt-msg-preview-content">
                <span className="dt-col-muted">
                  {send
                    ? t('panel.inspector.messages.preview.droppedSendPane')
                    : t('panel.inspector.messages.preview.droppedRecvPane')}
                </span>
              </div>
            }
            headerAction={inferredInfo}
          />
        </div>
      );
    }

    const originalPane =
      modification.kind === 'replaced-in-page' ? (
        <FramePayload frame={frame} />
      ) : modification.original !== undefined ? (
        <TextPayload text={modification.original} />
      ) : (
        <div className="dt-msg-preview-content">
          <span className="dt-col-muted">{t('panel.inspector.messages.preview.originalNotCaptured')}</span>
        </div>
      );
    const modifiedPane =
      modification.kind === 'replaced-on-wire' ? (
        <FramePayload frame={frame} />
      ) : (
        <TextPayload text={modification.modified} />
      );
    return (
      <div className="dt-msg-preview-dual">
        <SplitBodyView
          startLabel={send ? labels.requestOriginal : labels.responseOriginal}
          start={originalPane}
          endLabel={send ? labels.requestModified : labels.responseModified}
          end={modifiedPane}
          headerAction={inferredInfo}
        />
      </div>
    );
  }

  // A synthetic injected frame has no two sides to split — the whole
  // payload is rule-authored; the banner carries its provenance.
  if (frame.synthetic) {
    return (
      <>
        <div className="dt-msg-preview-synthetic-note">{t('panel.inspector.messages.preview.syntheticNote')}</div>
        <FramePayload frame={frame} />
      </>
    );
  }

  return <FramePayload frame={frame} />;
}
