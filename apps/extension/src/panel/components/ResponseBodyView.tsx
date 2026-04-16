import type { InspectorRequest } from '../data/types';

function isJsonMime(mime: string): boolean {
  return /\bjson\b/i.test(mime);
}

function isXmlMime(mime: string): boolean {
  return /\b(xml|xhtml)\b/i.test(mime);
}

function isTextMime(mime: string): boolean {
  return /^text\//i.test(mime) || isJsonMime(mime) || isXmlMime(mime);
}

function isImageMime(mime: string): boolean {
  return /^image\//i.test(mime);
}

function prettyJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

function highlightText(text: string, query: string): Array<{ text: string; highlight: boolean }> {
  if (!query) return [{ text, highlight: false }];
  const lower = text.toLowerCase();
  const qLower = query.toLowerCase();
  const parts: Array<{ text: string; highlight: boolean }> = [];
  let pos = 0;
  while (pos < text.length) {
    const idx = lower.indexOf(qLower, pos);
    if (idx === -1) {
      parts.push({ text: text.slice(pos), highlight: false });
      break;
    }
    if (idx > pos) parts.push({ text: text.slice(pos, idx), highlight: false });
    parts.push({ text: text.slice(idx, idx + query.length), highlight: true });
    pos = idx + query.length;
  }
  return parts;
}

function HighlightedPre({ text, query, targetLine }: { text: string; query: string; targetLine?: number }) {
  if (!query) return <pre className="dt-body-pre">{text}</pre>;
  if (targetLine != null) {
    const lines = text.split('\n');
    return (
      <pre className="dt-body-pre">
        {lines.map((line, i) => {
          if (i + 1 === targetLine) {
            const parts = highlightText(line, query);
            return (
              <span key={i}>
                {parts.map((p, j) => (p.highlight ? <mark key={j}>{p.text}</mark> : <span key={j}>{p.text}</span>))}
                {'\n'}
              </span>
            );
          }
          return <span key={i}>{`${line}\n`}</span>;
        })}
      </pre>
    );
  }
  const parts = highlightText(text, query);
  return (
    <pre className="dt-body-pre">
      {parts.map((p, i) => (p.highlight ? <mark key={i}>{p.text}</mark> : <span key={i}>{p.text}</span>))}
    </pre>
  );
}

interface ResponseBodyViewProps {
  request: InspectorRequest;
  searchHighlight?: string;
  searchLineNumber?: number;
}

export function ResponseBodyView({ request, searchHighlight, searchLineNumber }: ResponseBodyViewProps) {
  const mime = request.mimeType ?? request.harEntry?.response?.content?.mimeType ?? '';
  const size = request.responseSize ?? request.harEntry?.response?.content?.size ?? 0;
  const body = request.responseBody;
  const encoding = request.responseBodyEncoding;
  const highlight = searchHighlight ?? '';

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

  const header = (
    <div className="dt-body-meta">
      <span className="dt-body-tag">{mime || 'unknown'}</span>
      <span className="dt-body-tag">{size} bytes</span>
      {encoding && <span className="dt-body-tag">{encoding}</span>}
    </div>
  );

  if (isImageMime(mime) && encoding === 'base64') {
    const dataUrl = `data:${mime};base64,${body}`;
    return (
      <>
        {header}
        <img src={dataUrl} alt="response preview" style={{ maxWidth: '100%', maxHeight: 480, display: 'block' }} />
      </>
    );
  }

  if (isJsonMime(mime)) {
    return (
      <>
        {header}
        <HighlightedPre text={prettyJson(body)} query={highlight} targetLine={searchLineNumber} />
      </>
    );
  }

  if (isTextMime(mime) || encoding !== 'base64') {
    return (
      <>
        {header}
        <HighlightedPre text={body} query={highlight} targetLine={searchLineNumber} />
      </>
    );
  }

  return (
    <>
      {header}
      <span className="dt-col-muted">
        Binary payload ({size} bytes, base64-encoded). Preview limited to text and images.
      </span>
    </>
  );
}
