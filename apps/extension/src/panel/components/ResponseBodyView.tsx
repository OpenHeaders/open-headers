import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import type { InspectorRequest } from '../data/types';
import HexViewer from './detail/HexViewer';
import { prettyPrintCode } from './detail/pretty-print';
import ResponseViewerToolbar, { type ViewMode } from './detail/ResponseViewerToolbar';
import Skeleton from './detail/Skeleton';

const CodeMirrorViewer = lazy(() => import('./detail/CodeMirrorViewer'));

function isJsonMime(mime: string): boolean {
  return /\bjson\b/i.test(mime);
}

function isXmlMime(mime: string): boolean {
  return /\b(xml|xhtml)\b/i.test(mime);
}

function isTextMime(mime: string): boolean {
  return /^text\//i.test(mime) || isJsonMime(mime) || isXmlMime(mime);
}

function isCssMime(mime: string): boolean {
  return /\bcss\b/i.test(mime);
}

function isJsMime(mime: string): boolean {
  return /\b(javascript|ecmascript)\b/i.test(mime);
}

function isHtmlMime(mime: string): boolean {
  return /\bhtml\b/i.test(mime);
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function detectLanguage(mime: string): 'json' | 'css' | 'javascript' | 'html' | null {
  if (isJsonMime(mime)) return 'json';
  if (isCssMime(mime)) return 'css';
  if (isJsMime(mime)) return 'javascript';
  if (isHtmlMime(mime) || isXmlMime(mime)) return 'html';
  return null;
}

function canPrettyPrint(mime: string): boolean {
  return isJsonMime(mime) || isCssMime(mime) || isJsMime(mime) || isHtmlMime(mime) || isXmlMime(mime);
}

interface ResponseBodyViewProps {
  request: InspectorRequest;
  searchHighlight?: string;
  searchLineNumber?: number;
}

export function ResponseBodyView({ request, searchHighlight }: ResponseBodyViewProps) {
  const mime = request.mimeType ?? request.harEntry?.response?.content?.mimeType ?? '';
  const body = request.responseBody;
  const encoding = request.responseBodyEncoding;
  const highlight = searchHighlight ?? '';
  const isBase64 = encoding === 'base64';
  const isText = isTextMime(mime) || !isBase64;
  const lang = detectLanguage(mime);
  const isBinary = isBase64 && !isText;

  const [viewMode, setViewMode] = useState<ViewMode>('hex');
  const [prettyPrint, setPrettyPrint] = useState(canPrettyPrint(mime));
  const [formattedText, setFormattedText] = useState<string | null>(null);
  const [formatting, setFormatting] = useState(false);
  const [cursorInfo, setCursorInfo] = useState<string | null>(null);
  const togglePrettyPrint = useCallback(() => setPrettyPrint((p) => !p), []);
  const handleCursorChange = useCallback(
    (line: number, col: number) => setCursorInfo(`Line ${line}, Column ${col}`),
    [],
  );

  const bytes = useMemo(() => {
    if (!body || !isBase64) return null;
    try {
      return base64ToBytes(body);
    } catch {
      return null;
    }
  }, [body, isBase64]);

  const textContent = useMemo(() => {
    if (!body) return null;
    if (!isBase64) return body;
    if (bytes) {
      try {
        return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      } catch {
        return null;
      }
    }
    return null;
  }, [body, isBase64, bytes]);

  // Run prettier asynchronously when pretty print is enabled
  useEffect(() => {
    if (!prettyPrint || !lang) {
      setFormattedText(null);
      setFormatting(false);
      return;
    }
    const raw = textContent ?? body;
    if (!raw) return;
    let cancelled = false;
    setFormatting(true);
    prettyPrintCode(raw, lang).then((result) => {
      if (!cancelled) {
        setFormattedText(result);
        setFormatting(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [prettyPrint, lang, textContent, body]);

  if (body == null) {
    return (
      <div className="dt-body-info">
        Body not yet fetched. Chrome fetches response bodies asynchronously; it should arrive shortly.
      </div>
    );
  }

  if (body === '') {
    return (
      <div className="dt-body-info">
        Body not captured. Chrome&apos;s <code>entry.getContent</code> returned empty &mdash; the response was likely
        served from disk cache, streamed without buffering, or was opaque cross-origin content.
      </div>
    );
  }

  let content: React.ReactNode;
  let lineInfo: string | undefined;

  // ── Binary content ─────────────────────────────────────────
  if (isBinary) {
    if (viewMode === 'base64') {
      content = <pre className="dt-body-pre dt-body-pre--base64">{body}</pre>;
    } else if (viewMode === 'utf8' && bytes) {
      const lossy = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
      content = <pre className="dt-body-pre">{lossy}</pre>;
    } else if (bytes) {
      content = <HexViewer data={bytes} />;
    } else {
      content = <span className="dt-col-muted">Binary payload ({request.responseSize ?? 0} bytes).</span>;
    }

    return (
      <div className="dt-response-view">
        <div className="dt-response-view-content">{content}</div>
        <ResponseViewerToolbar mode={viewMode} onModeChange={setViewMode} />
      </div>
    );
  }

  // ── Text content ───────────────────────────────────────────
  const rawText = textContent ?? body;

  // Show skeleton while prettier is running
  if (prettyPrint && formatting) {
    content = <Skeleton />;
  } else {
    const displayText = prettyPrint && formattedText ? formattedText : rawText;
    lineInfo = cursorInfo ?? `${displayText.split('\n').length} lines`;

    if (lang) {
      content = (
        <Suspense fallback={<Skeleton />}>
          <CodeMirrorViewer
            value={displayText}
            language={lang}
            onCursorChange={handleCursorChange}
            searchQuery={highlight || undefined}
          />
        </Suspense>
      );
    } else {
      content = <pre className="dt-body-pre">{displayText}</pre>;
    }
  }

  const showPrettyPrint = canPrettyPrint(mime);

  return (
    <div className="dt-response-view">
      <div className="dt-response-view-content">{content}</div>
      <ResponseViewerToolbar
        lineInfo={lineInfo}
        prettyPrint={showPrettyPrint ? prettyPrint : undefined}
        onTogglePrettyPrint={showPrettyPrint ? togglePrettyPrint : undefined}
      />
    </div>
  );
}
