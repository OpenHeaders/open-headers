/**
 * Compose-bar leaves shared by every raw-flavor WebSocket compose
 * surface — the Message tab and the response example's message tab:
 * the format dropdown (Text / JSON / XML / HTML / Binary), the byte
 * spelling dropdown a binary compose adds beside it, and the editor's
 * empty-state line per mode. One anatomy, testids by prop.
 */

import type { WebSocketBinaryEncoding, WebSocketMessageFormat } from '@openheaders/core/types';
import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import { Select } from 'antd';
import type React from 'react';

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
    <Select
      size="small"
      style={{ width: 120 }}
      value={value}
      onChange={onChange}
      options={[
        { value: 'text', label: t('workbench.editors.websocket.message.formatText') },
        { value: 'json', label: t('workbench.editors.websocket.message.formatJson') },
        { value: 'xml', label: t('workbench.editors.websocket.message.formatXml') },
        { value: 'html', label: t('workbench.editors.websocket.message.formatHtml') },
        { value: 'binary', label: t('workbench.editors.websocket.message.formatBinary') },
      ]}
      data-testid={testId}
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
    <Select
      size="small"
      style={{ width: 120 }}
      value={value}
      onChange={onChange}
      options={[
        { value: 'base64', label: t('workbench.editors.websocket.message.encodingBase64') },
        { value: 'hex', label: t('workbench.editors.websocket.message.encodingHex') },
      ]}
      data-testid={testId}
    />
  );
};
