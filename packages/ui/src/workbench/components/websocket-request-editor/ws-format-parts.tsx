/**
 * Compose-bar leaves shared by every raw-flavor WebSocket compose
 * surface — the Message tab and the response example's message tab:
 * the format picker (Text / JSON / XML / HTML over the divider, Binary
 * under it), the byte-spelling picker a binary compose adds beside it
 * (Base64 / Hex), and the editor's empty-state line per mode. Both
 * pickers wear the body viewers' picker dress (`EncodingPicker`). One
 * anatomy, testids by prop.
 */

import type { WebSocketBinaryEncoding, WebSocketMessageFormat } from '@openheaders/core/types';
import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import type React from 'react';
import { EncodingPicker } from '../shared/EncodingPicker';

/** The editor's empty-state line — base64 / hex state the byte
 *  contract, the text modes read the compose prompt. */
export const rawMessagePlaceholder = (
  t: Translate,
  format: WebSocketMessageFormat,
  encoding: WebSocketBinaryEncoding,
): string =>
  format !== 'binary'
    ? t('workbench.editors.websocket.messagePlaceholder')
    : encoding === 'hex'
      ? t('workbench.editors.websocket.messagePlaceholderHex')
      : t('workbench.editors.websocket.messagePlaceholderBase64');

export const MessageFormatSelect: React.FC<{
  value: WebSocketMessageFormat;
  onChange: (format: WebSocketMessageFormat) => void;
  testId: string;
}> = ({ value, onChange, testId }) => {
  const t = useT();
  return (
    <EncodingPicker<WebSocketMessageFormat>
      value={value}
      onChange={onChange}
      divideAfter={4}
      options={[
        { value: 'text', label: t('workbench.editors.websocket.message.formatText'), icon: 'text' },
        { value: 'json', label: t('workbench.editors.websocket.message.formatJson'), icon: 'json' },
        { value: 'xml', label: t('workbench.editors.websocket.message.formatXml'), icon: 'xml' },
        { value: 'html', label: t('workbench.editors.websocket.message.formatHtml'), icon: 'html' },
        { value: 'binary', label: t('workbench.editors.websocket.message.formatBinary'), icon: 'binary' },
      ]}
      testId={testId}
    />
  );
};

export const BinaryEncodingSelect: React.FC<{
  value: WebSocketBinaryEncoding;
  onChange: (encoding: WebSocketBinaryEncoding) => void;
  testId: string;
}> = ({ value, onChange, testId }) => {
  const t = useT();
  return (
    <EncodingPicker<WebSocketBinaryEncoding>
      value={value}
      onChange={onChange}
      options={[
        { value: 'base64', label: t('workbench.editors.websocket.message.encodingBase64'), icon: 'base64' },
        { value: 'hex', label: t('workbench.editors.websocket.message.encodingHex'), icon: 'hex' },
      ]}
      testId={testId}
    />
  );
};
