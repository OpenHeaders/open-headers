/**
 * MessagePreview — the Messages tab's lower pane: the full payload of
 * the selected frame.
 *
 *   - No selection → "No message selected" empty state.
 *   - Text / error frames → a JSON tree when the payload parses as
 *     JSON, the verbatim text otherwise.
 *   - Binary frames → Base64 / Hex / UTF-8 viewer with a copy action
 *     (copies the current view's representation).
 *   - A frame a `ws` rule modified → the Original | Modified split
 *     (same {@link SplitBodyView} shell as the Response tab), each side
 *     labeled with its delivery path. The side the capture plane never
 *     saw is either derived from the rule's replacement payload
 *     (receive: the wire holds the original) or honestly absent (send:
 *     only the replacement crossed the wire). An inferred-tier
 *     modification carries a derivation note — the split view never
 *     claims more than the fire rail does.
 */

import { useMemo, useState } from 'react';
import { base64ToBytes } from '../../../data/base64';
import type { MessageFrameAttribution } from '../../../data/message-fire-rail';
import { JsonTree } from '../../JsonTree';
import HexViewer from '../HexViewer';
import {
  WS_RECV_MODIFIED_LABEL,
  WS_RECV_ORIGINAL_LABEL,
  WS_SEND_MODIFIED_LABEL,
  WS_SEND_ORIGINAL_LABEL,
} from '../override-labels';
import ResponseViewerToolbar, { type ViewMode } from '../ResponseViewerToolbar';
import SplitBodyView from '../SplitBodyView';
import { type WsDisplayFrame, WS_OPCODE_BINARY } from './ws-frames';

interface MessagePreviewProps {
  frame: WsDisplayFrame | null;
  /** Fire-rail attribution for the frame — a derivable modification
   *  flips the pane into the Original | Modified split. */
  attribution?: MessageFrameAttribution | null;
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
    content = <span className="dt-col-muted">Binary payload could not be decoded.</span>;
  }

  return (
    <div className="dt-msg-preview-binary">
      <div className="dt-msg-preview-content">{content}</div>
      <ResponseViewerToolbar
        mode={mode}
        onModeChange={setMode}
        trailing={
          <button type="button" className="dt-response-toolbar-btn" onClick={copy} title="Copy to clipboard">
            {copied ? 'Copied' : 'Copy'}
          </button>
        }
      />
    </div>
  );
}

/** JSON tree when the text parses, verbatim `pre` otherwise — the text
 *  rendering shared by the captured frame and the derived replacement. */
function TextPayload({ text }: { text: string }) {
  const json = useMemo(() => tryParseJson(text), [text]);
  if (json !== undefined) {
    return (
      <div className="dt-msg-preview-content dt-msg-preview-json">
        <JsonTree value={json} defaultExpandedDepth={2} />
      </div>
    );
  }
  return (
    <div className="dt-msg-preview-content">
      <pre className="dt-body-pre">{text}</pre>
    </div>
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
  if (!frame) {
    return (
      <div className="dt-msg-preview-empty">
        <strong>No message selected</strong>
        <span className="dt-col-muted">Select message to browse its content.</span>
      </div>
    );
  }

  const modification = attribution?.modification ?? null;
  if (modification) {
    const send = frame.type === 'send';
    const originalPane =
      modification.captured === 'original' ? (
        <FramePayload frame={frame} />
      ) : (
        <div className="dt-msg-preview-content">
          <span className="dt-col-muted">
            The frame the page produced was not captured — only the modified frame crossed the wire.
          </span>
        </div>
      );
    const modifiedPane =
      modification.captured === 'modified' ? (
        <FramePayload frame={frame} />
      ) : (
        <TextPayload text={modification.modified} />
      );
    return (
      <div className="dt-msg-preview-dual">
        <SplitBodyView
          startLabel={send ? WS_SEND_ORIGINAL_LABEL : WS_RECV_ORIGINAL_LABEL}
          start={originalPane}
          endLabel={send ? WS_SEND_MODIFIED_LABEL : WS_RECV_MODIFIED_LABEL}
          end={modifiedPane}
        />
        {attribution?.tier === 'inferred' && (
          <div className="dt-msg-preview-note">
            Modified side derived from the rule's replacement payload — application inferred, not captured.
          </div>
        )}
      </div>
    );
  }

  return <FramePayload frame={frame} />;
}
