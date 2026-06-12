/**
 * MessagePreview — the Messages tab's lower pane: the full payload of
 * the selected frame.
 *
 *   - No selection → "No message selected" empty state.
 *   - Text / error frames → a JSON tree when the payload parses as
 *     JSON, the verbatim text otherwise.
 *   - Binary frames → Base64 / Hex / UTF-8 viewer with a copy action
 *     (copies the current view's representation).
 */

import { useMemo, useState } from 'react';
import { base64ToBytes } from '../../../data/base64';
import { JsonTree } from '../../JsonTree';
import HexViewer from '../HexViewer';
import ResponseViewerToolbar, { type ViewMode } from '../ResponseViewerToolbar';
import { type WsDisplayFrame, WS_OPCODE_BINARY } from './ws-frames';

interface MessagePreviewProps {
  frame: WsDisplayFrame | null;
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

export default function MessagePreview({ frame }: MessagePreviewProps) {
  const json = useMemo(
    () => (frame && frame.opcode !== WS_OPCODE_BINARY ? tryParseJson(frame.data) : undefined),
    [frame],
  );

  if (!frame) {
    return (
      <div className="dt-msg-preview-empty">
        <strong>No message selected</strong>
        <span className="dt-col-muted">Select message to browse its content.</span>
      </div>
    );
  }

  if (frame.opcode === WS_OPCODE_BINARY && frame.type !== 'error') {
    return <BinaryPreview frame={frame} />;
  }

  if (json !== undefined) {
    return (
      <div className="dt-msg-preview-content dt-msg-preview-json">
        <JsonTree value={json} defaultExpandedDepth={2} />
      </div>
    );
  }

  return (
    <div className="dt-msg-preview-content">
      <pre className="dt-body-pre">{frame.data}</pre>
    </div>
  );
}
