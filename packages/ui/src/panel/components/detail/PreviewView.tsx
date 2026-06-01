import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import {
  currentHarEntry,
  type InspectorRowWithFires,
  lifecycleMimeType,
  lifecycleTransferredBytes,
} from '../../data/inspector-row-projection';
import { classifyBodyState } from '../../data/response-body-state';
import { JsonTree } from '../JsonTree';
import Skeleton from './Skeleton';

// Lazy-loaded — keeps Monaco out of the panel's initial chunk graph.
const CodeViewer = lazy(() => import('./CodeViewer'));

function isJsonMime(mime: string): boolean {
  return /\bjson\b/i.test(mime);
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

function isXmlMime(mime: string): boolean {
  return /\b(xml|xhtml)\b/i.test(mime);
}

function isImageMime(mime: string): boolean {
  return /^image\//i.test(mime);
}

function isSvgMime(mime: string): boolean {
  return /svg/i.test(mime);
}

function isFontMime(mime: string): boolean {
  return /^font\//i.test(mime) || /\b(woff2?|ttf|otf|eot)\b/i.test(mime);
}

function prettyJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function aspectRatio(w: number, h: number): string {
  if (w === 0 || h === 0) return '';
  const d = gcd(w, h);
  return `${w / d}:${h / d}`;
}

function ImageContent({ mime, body }: { mime: string; body: string }) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [dimensions, setDimensions] = useState<{ w: number; h: number } | null>(null);
  const dataUrl = `data:${mime};base64,${body}`;

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    const onLoad = () => setDimensions({ w: img.naturalWidth, h: img.naturalHeight });
    img.addEventListener('load', onLoad);
    if (img.complete && img.naturalWidth > 0) onLoad();
    return () => img.removeEventListener('load', onLoad);
  }, []);

  return { dimensions, node: <img ref={imgRef} src={dataUrl} alt="response preview" className="dt-body-image" /> };
}

function ImagePreview({
  mime,
  body,
  metaBar,
}: {
  mime: string;
  body: string;
  metaBar: (extra: React.ReactNode) => React.ReactNode;
}) {
  const { dimensions, node } = ImageContent({ mime, body });
  return (
    <>
      <div className="dt-preview-image-container">{node}</div>
      {metaBar(
        dimensions && (
          <>
            <span>
              {dimensions.w} {'×'} {dimensions.h}
            </span>
            <span>{aspectRatio(dimensions.w, dimensions.h)}</span>
          </>
        ),
      )}
    </>
  );
}

interface PreviewViewProps {
  row: InspectorRowWithFires;
}

function PreviewNotice({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="dt-response-notice">
      <strong>{title}</strong>
      <span className="dt-col-muted">{detail}</span>
    </div>
  );
}

export default function PreviewView({ row }: PreviewViewProps) {
  const lc = row.lifecycle;
  const har = currentHarEntry(lc);
  const mime = lifecycleMimeType(lc) ?? har?.response?.content?.mimeType ?? '';
  const size = lifecycleTransferredBytes(lc) ?? har?.response?.content?.size ?? 0;
  const state = useMemo(() => classifyBodyState(lc), [lc]);

  const textContent = useMemo(() => {
    if (state.kind === 'text') return state.content;
    if (state.kind === 'binary') {
      try {
        const bin = atob(state.base64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      } catch {
        return null;
      }
    }
    return null;
  }, [state]);

  const metaBar = (extra?: React.ReactNode) => (
    <div className="dt-preview-meta-bar">
      <span>{formatFileSize(size)}</span>
      {extra}
      <span>{mime}</span>
    </div>
  );

  // ── Non-body states — match Response tab messaging ───────
  if (state.kind === 'loading') {
    return (
      <div className="dt-response-view">
        <div className="dt-response-view-content">
          <Skeleton />
        </div>
        {metaBar()}
      </div>
    );
  }
  if (state.kind === 'not-applicable') {
    return <PreviewNotice title="No preview available" detail={state.message} />;
  }
  if (state.kind === 'unavailable') {
    return <PreviewNotice title="Failed to load response data" detail={state.message} />;
  }
  if (state.kind === 'empty') {
    return <PreviewNotice title="(empty response body)" detail="The server returned an empty body." />;
  }

  let content: React.ReactNode;

  if (state.kind === 'text' && isSvgMime(mime)) {
    content = (
      <div
        className="dt-preview-image-container dt-preview-svg"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: SVG rendering from response body
        dangerouslySetInnerHTML={{ __html: state.content }}
      />
    );
  } else if (state.kind === 'binary' && isImageMime(mime)) {
    return (
      <div className="dt-response-view">
        <ImagePreview mime={mime} body={state.base64} metaBar={metaBar} />
      </div>
    );
  } else if (state.kind === 'binary' && isFontMime(mime)) {
    const fontUrl = `data:${mime};base64,${state.base64}`;
    content = (
      <>
        <style>{`@font-face { font-family: 'dt-preview-font'; src: url('${fontUrl}'); }`}</style>
        <div className="dt-font-glyphs" style={{ fontFamily: 'dt-preview-font' }}>
          <div className="dt-font-glyph-row">ABCDEFGHIJKLM</div>
          <div className="dt-font-glyph-row">NOPQRSTUVWXYZ</div>
          <div className="dt-font-glyph-row">abcdefghijklm</div>
          <div className="dt-font-glyph-row">nopqrstuvwxyz</div>
          <div className="dt-font-glyph-row">0123456789</div>
        </div>
      </>
    );
  } else if (isJsonMime(mime) && textContent) {
    try {
      const parsed = JSON.parse(textContent);
      content = (
        <div className="dt-panel-mono" style={{ fontSize: 12, lineHeight: 1.6, padding: '4px 8px' }}>
          <JsonTree value={parsed} defaultExpandedDepth={1} />
        </div>
      );
    } catch {
      content = <pre className="dt-body-pre">{prettyJson(textContent)}</pre>;
    }
  } else {
    const lang = isCssMime(mime)
      ? 'css'
      : isJsMime(mime)
        ? 'javascript'
        : isHtmlMime(mime) || isXmlMime(mime)
          ? 'html'
          : null;

    if (lang && textContent) {
      content = (
        <Suspense fallback={<Skeleton />}>
          <CodeViewer value={textContent} language={lang} />
        </Suspense>
      );
    } else if (textContent) {
      content = <pre className="dt-body-pre">{textContent}</pre>;
    } else {
      content = (
        <span className="dt-col-muted" style={{ padding: 12 }}>
          Preview not available for this content type.
        </span>
      );
    }
  }

  return (
    <div className="dt-response-view">
      <div className="dt-response-view-content">{content}</div>
      {metaBar()}
    </div>
  );
}
