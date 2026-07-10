/**
 * EncodedValueModal — decode-edit-reencode editor for simple encoded
 * values (base64 text, %XX URL-encoding). Left: the decoded text as an
 * editable buffer (JSON-highlighted when it parses). Right: live
 * re-encoded preview through the caller's `encode`. Save hands the
 * DECODED text back — the caller owns the encoding semantics, same
 * split as the rail hook. Like every value-editor modal it is
 * lazy-loaded; import it only through `useValueEditAction`.
 */

import { CopyOutlined } from '@ant-design/icons';
import { App, Button, Modal, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import CodeEditor from '../shared/CodeEditor';
import { EditorModalFooter } from './EditorModalFooter';
import { validateJSON } from './jwt';

const { Text } = Typography;

interface EncodedValueModalProps {
  open: boolean;
  /** Dialog title, e.g. "Base64 value". */
  title: string;
  /** The decoded text to edit. */
  decoded: string;
  /** Re-encode for the live preview — same function the caller applies
   *  on save. */
  encode: (text: string) => string;
  onSave: (decodedText: string) => void;
  onCancel: () => void;
}

const EncodedValueModal: React.FC<EncodedValueModalProps> = ({ open, title, decoded, encode, onSave, onCancel }) => {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const [text, setText] = useState(decoded);

  useEffect(() => {
    if (open) setText(decoded);
  }, [open, decoded]);

  // Decoded JSON payloads (a common base64 case) get JSON highlighting;
  // decided once per open so a mid-edit parse failure doesn't flicker
  // the language.
  const language = useMemo(() => {
    try {
      validateJSON(decoded);
      return 'json' as const;
    } catch {
      return 'text' as const;
    }
  }, [decoded]);

  const encoded = useMemo(() => encode(text), [encode, text]);
  const isDirty = text !== decoded;
  const saveDisabled = !isDirty || !text;

  const handleSave = useCallback(() => {
    if (saveDisabled) return;
    onSave(text);
  }, [saveDisabled, text, onSave]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSave();
      }
    },
    [handleSave],
  );

  const copyEncoded = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(encoded);
      message.success('Encoded value copied to clipboard');
    } catch {
      message.error('Failed to copy to clipboard');
    }
  }, [encoded, message]);

  return (
    <Modal
      title={title}
      open={open}
      onCancel={onCancel}
      width={760}
      footer={<EditorModalFooter saveDisabled={saveDisabled} onSave={handleSave} onCancel={onCancel} />}
      centered
      destroyOnHidden
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }} onKeyDown={handleKeyDown}>
        <div>
          <Text strong style={{ fontSize: 12, display: 'inline-block', marginBottom: 4 }}>
            Decoded
          </Text>
          <CodeEditor value={text} onChange={setText} language={language} minHeight={220} variableAutoComplete={false} />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text strong style={{ fontSize: 12 }}>
              Encoded preview
            </Text>
            <Button size="small" icon={<CopyOutlined />} onClick={() => void copyEncoded()}>
              Copy
            </Button>
          </div>
          <div
            style={{
              maxHeight: 120,
              overflowY: 'auto',
              border: `1px solid ${token.colorBorder}`,
              borderRadius: 4,
              padding: 8,
              background: token.colorFillAlter,
              fontFamily: 'monospace',
              fontSize: 12,
              wordBreak: 'break-all',
              lineHeight: 1.5,
            }}
          >
            {encoded}
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default EncodedValueModal;
