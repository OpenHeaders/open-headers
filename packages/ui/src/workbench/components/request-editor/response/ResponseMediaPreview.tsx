/**
 * ResponseMediaPreview — the captured audio/video bytes rendered via a
 * blob `<audio>`/`<video>` with the browser's native controls. The
 * blob carries the response's own media type so the browser picks the
 * decoder. Requires `media-src blob:` in the hosting page's CSP —
 * added alongside this feature, never wider.
 *
 * Bytes that don't decode (a lying Content-Type, an unsupported codec,
 * a truncated capture) surface a quiet hint instead of a dead player —
 * the byte views stay the ground truth.
 */

import { Typography, theme } from 'antd';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';

const { Text } = Typography;

const ResponseMediaPreview: React.FC<{
  bytes: Uint8Array<ArrayBuffer>;
  mimeType: string;
  kind: 'audio' | 'video';
}> = ({ bytes, mimeType, kind }) => {
  const { token } = theme.useToken();
  const t = useT();
  const url = useMemo(() => URL.createObjectURL(new Blob([bytes], { type: mimeType })), [bytes, mimeType]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
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
        overflow: 'hidden',
        background: token.colorBgLayout,
        padding: 12,
      }}
    >
      {failed ? (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {t('workbench.editors.request.response.body.mediaPreviewFailed')}
        </Text>
      ) : kind === 'audio' ? (
        // biome-ignore lint/a11y/useMediaCaption: captured wire bytes have no caption track to offer
        <audio
          data-testid="oh-response-media-preview"
          aria-label={t('workbench.editors.request.response.body.mediaPreviewAria')}
          src={url}
          controls
          onError={() => setFailedUrl(url)}
          style={{ width: '100%', maxWidth: 480 }}
        />
      ) : (
        // biome-ignore lint/a11y/useMediaCaption: captured wire bytes have no caption track to offer
        <video
          data-testid="oh-response-media-preview"
          aria-label={t('workbench.editors.request.response.body.mediaPreviewAria')}
          src={url}
          controls
          onError={() => setFailedUrl(url)}
          style={{ maxWidth: '100%', maxHeight: '100%' }}
        />
      )}
    </div>
  );
};

export default ResponseMediaPreview;
