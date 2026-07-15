/**
 * ResponseImagePreview — the captured image bytes rendered via a blob
 * `<img>` (raster formats and SVG alike; the blob carries the
 * response's own media type so the browser picks the decoder).
 *
 * Same fade-in discipline as the PDF preview: the image holds
 * `opacity: 0` until its load event so a large body never paints in
 * visible chunks. Bytes that don't decode (a lying Content-Type, a
 * truncated capture) surface a quiet hint instead of a broken-image
 * glyph — the byte views stay the ground truth.
 */

import { Typography, theme } from 'antd';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';

const { Text } = Typography;

const ResponseImagePreview: React.FC<{ bytes: Uint8Array<ArrayBuffer>; mimeType: string }> = ({
  bytes,
  mimeType,
}) => {
  const { token } = theme.useToken();
  const t = useT();
  const url = useMemo(() => URL.createObjectURL(new Blob([bytes], { type: mimeType })), [bytes, mimeType]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const loaded = loadedUrl === url;
  const failed = failedUrl === url;
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: 6,
        overflow: 'auto',
        background: token.colorBgLayout,
        padding: 12,
      }}
    >
      {failed ? (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {t('workbench.editors.request.response.body.imagePreviewFailed')}
        </Text>
      ) : (
        <img
          data-testid="oh-response-image-preview"
          src={url}
          alt={t('workbench.editors.request.response.body.imagePreviewAlt')}
          onLoad={() => setLoadedUrl(url)}
          onError={() => setFailedUrl(url)}
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            opacity: loaded ? 1 : 0,
            transition: 'opacity 180ms ease',
          }}
        />
      )}
    </div>
  );
};

export default ResponseImagePreview;
