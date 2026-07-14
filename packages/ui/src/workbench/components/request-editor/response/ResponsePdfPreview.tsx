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
 */

import { theme } from 'antd';
import type React from 'react';
import { useEffect, useMemo } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';

const ResponsePdfPreview: React.FC<{ bytes: Uint8Array<ArrayBuffer> }> = ({ bytes }) => {
  const { token } = theme.useToken();
  const t = useT();
  const url = useMemo(() => URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' })), [bytes]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return (
    <iframe
      title={t('workbench.editors.request.response.body.pdfPreviewIframeTitle')}
      data-testid="oh-response-pdf-preview"
      src={url}
      style={{
        flex: 1,
        width: '100%',
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: 6,
        // The viewer paints its own chrome; the light canvas matches the
        // HTML preview's posture on the app's dark background.
        background: '#fff',
      }}
    />
  );
};

export default ResponsePdfPreview;
