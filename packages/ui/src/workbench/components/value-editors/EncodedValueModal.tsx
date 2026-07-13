/**
 * EncodedValueModal — decode-edit-reencode editor for simple encoded
 * values (base64/hex text, %XX URL-encoding, timestamps, JSON values
 * and quoted strings, data URIs, cookie/CSP lists). Left: the
 * decoded text as an editable buffer (JSON-highlighted when it
 * parses). Right: live re-encoded preview through the caller's
 * `encode`; a null encode means the edited text is invalid for the
 * value type (e.g. an unparsable date) and disables Save. Save hands
 * the DECODED text back — the caller owns the encoding semantics, same
 * split as the rail hook. Like every value-editor modal it is
 * lazy-loaded; import it only through `useValueEditAction`.
 */

import { CopyOutlined } from '@ant-design/icons';
import { type PairGridType, validateJSON } from '@openheaders/ui/shared/value-detection';
import { App, Button, Modal, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import CodeEditor from '../shared/CodeEditor';
import { EditorModalFooter } from './EditorModalFooter';
import { PairGridEditor } from './PairGridEditor';

const { Text } = Typography;

interface EncodedValueModalProps {
  open: boolean;
  /** Dialog title, e.g. "Base64 value". */
  title: string;
  /** The decoded text to edit. */
  decoded: string;
  /** Re-encode for the live preview — same function the caller applies
   *  on save. Null signals the text can't encode for this value type;
   *  Save is disabled while it holds. */
  encode: (text: string) => string | null;
  onSave?: (decodedText: string) => void;
  onCancel: () => void;
  /** Pair-shaped values (cookie, query-string) edit as a name/value
   *  grid instead of the text buffer — the grid serializes back to the
   *  same decoded line format, so `encode` and Save are untouched. */
  gridType?: PairGridType | null;
  /** Viewer mode for surfaces with nothing to write back (captured
   *  bodies, stored responses): the decoded pane is read-only and the
   *  footer is a single Close. */
  readOnly?: boolean;
}

const EncodedValueModal: React.FC<EncodedValueModalProps> = ({
  open,
  title,
  decoded,
  encode,
  onSave,
  onCancel,
  gridType,
  readOnly = false,
}) => {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const t = useT();
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
  const saveDisabled = readOnly || !isDirty || !text || encoded === null;

  const handleSave = useCallback(() => {
    if (saveDisabled) return;
    onSave?.(text);
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
    if (encoded === null) return;
    try {
      await navigator.clipboard.writeText(encoded);
      message.success(t('shared.valueEditors.encodedCopied'));
    } catch {
      message.error(t('shared.valueEditors.copyFailed'));
    }
  }, [encoded, message]);

  return (
    <Modal
      title={title}
      open={open}
      onCancel={onCancel}
      width={760}
      footer={
        readOnly ? (
          <Button onClick={onCancel}>{t('shared.action.close')}</Button>
        ) : (
          <EditorModalFooter saveDisabled={saveDisabled} onSave={handleSave} onCancel={onCancel} />
        )
      }
      centered
      destroyOnHidden
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }} onKeyDown={handleKeyDown}>
        <div>
          <Text strong style={{ fontSize: 12, display: 'inline-block', marginBottom: 4 }}>
            {t('shared.valueEditors.decoded')}
          </Text>
          {gridType ? (
            <div style={{ maxHeight: 320, overflowY: 'auto', overscrollBehavior: 'none' }} className="dt-scrollbar">
              <PairGridEditor gridType={gridType} value={text} onChange={setText} readOnly={readOnly} />
            </div>
          ) : (
            <CodeEditor
              value={text}
              onChange={setText}
              language={language}
              minHeight={220}
              variableAutoComplete={false}
              readOnly={readOnly}
            />
          )}
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text strong style={{ fontSize: 12 }}>
              {t('shared.valueEditors.encodedPreview')}
            </Text>
            <Button size="small" icon={<CopyOutlined />} disabled={encoded === null} onClick={() => void copyEncoded()}>
              {t('shared.action.copy')}
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
            {encoded === null ? (
              <Text type="danger" italic style={{ fontSize: 12 }}>
                {t('shared.valueEditors.cannotEncode')}
              </Text>
            ) : (
              encoded
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default EncodedValueModal;
