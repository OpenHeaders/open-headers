/**
 * ResponsePdfPreview — the browser's built-in PDF viewer over the
 * captured wire bytes, via a blob URL.
 *
 * Deliberately NOT sandboxed, unlike the HTML preview iframe: the PDF
 * plugin does not run inside a sandboxed frame at all (there is no
 * sandbox token that re-enables it). The frame stays same-origin and
 * script-free by construction — a blob: document of type
 * `application/pdf` renders the browser's own viewer, never remote
 * content.
 *
 * The iframe holds `opacity: 0` until its load event and fades in from
 * a theme-colored container — mounting it visible flashes a bright
 * empty frame on dark themes before the viewer paints.
 */

import { theme } from 'antd';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';

const ResponsePdfPreview: React.FC<{ bytes: Uint8Array<ArrayBuffer> }> = ({ bytes }) => {
  const { token } = theme.useToken();
  const t = useT();
  const url = useMemo(() => URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' })), [bytes]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const loaded = loadedUrl === url;
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: 6,
        overflow: 'hidden',
        background: token.colorBgLayout,
      }}
    >
      <iframe
        title={t('workbench.editors.request.response.body.pdfPreviewIframeTitle')}
        data-testid="oh-response-pdf-preview"
        src={url}
        onLoad={() => setLoadedUrl(url)}
        style={{
          flex: 1,
          width: '100%',
          border: 'none',
          opacity: loaded ? 1 : 0,
          transition: 'opacity 180ms ease',
        }}
      />
    </div>
  );
};

export default ResponsePdfPreview;
