/**
 * CompactValueEditor — the popover-safe sibling of `EncodedValueModal`.
 * Renders INLINE below the field it edits (no portal, no Monaco), so it
 * can live inside nested popovers like the panel's rule quick-editor:
 * a plain decoded textarea, the encoded preview only once the text
 * diverges (it also carries the cannot-encode error state), and the
 * modal footer's Cancel / accent-Save pair in small. Save hands the
 * DECODED text back — the caller owns the encoding semantics, same
 * split as the modal. Mounted by `useValueEditAction` in its `compact`
 * variant; dirty derives from text-vs-decoded equality.
 */

import { ExportOutlined, SaveOutlined } from '@ant-design/icons';
import { ShortcutHintTitle } from '@openheaders/ui/components/ShortcutKbd';
import { claimEscape } from '@openheaders/ui/shared/popover';
import { Button, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SAVE_ACCENT, SAVE_SHORTCUT } from './EditorModalFooter';

const { Text } = Typography;

interface CompactValueEditorProps {
  /** Card title, e.g. "Base64 value". */
  title: string;
  /** The decoded text to edit. */
  decoded: string;
  /** Re-encode for the live preview — same function the caller applies
   *  on save. Null signals the text can't encode for this value type;
   *  Save is disabled while it holds. */
  encode: (text: string) => string | null;
  onSave: (decodedText: string) => void;
  onCancel: () => void;
  /** Escalate to a dedicated document tab — offered in the footer when
   *  the host can open one (the panel's quick-editor on a persisted
   *  rule field). The caller owns closing its popover; unsaved text in
   *  THIS editor dies with it, so the affordance sits with Cancel on
   *  the uncommitted side of the footer. */
  onOpenDocument?: () => void;
}

export const CompactValueEditor: React.FC<CompactValueEditorProps> = ({
  title,
  decoded,
  encode,
  onSave,
  onCancel,
  onOpenDocument,
}) => {
  const { token } = theme.useToken();
  const [text, setText] = useState(decoded);

  // Hold the Escape claim while mounted: the quick-editor popover's
  // dismiss listener runs at window CAPTURE phase, so this component's
  // own onKeyDown (bubble) can't stop it — the claim stack is how a
  // later-mounted layer tells the popover to stand down. The claim
  // comes with its own capture listener so Escape cancels THIS editor
  // wherever focus sits, and only the next press closes the popover.
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;
  useEffect(() => {
    const claim = claimEscape();
    const onWindowKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !claim.owns()) return;
      e.stopPropagation();
      onCancelRef.current();
    };
    window.addEventListener('keydown', onWindowKeyDown, true);
    return () => {
      claim.release();
      window.removeEventListener('keydown', onWindowKeyDown, true);
    };
  }, []);

  const encoded = useMemo(() => encode(text), [encode, text]);
  const isDirty = text !== decoded;
  const saveDisabled = !isDirty || !text || encoded === null;

  const handleSave = useCallback(() => {
    if (saveDisabled) return;
    onSave(text);
  }, [saveDisabled, text, onSave]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSave();
      } else if (e.key === 'Escape') {
        e.stopPropagation();
        onCancel();
      }
    },
    [handleSave, onCancel],
  );

  return (
    <div
      role="group"
      aria-label={title}
      onKeyDown={handleKeyDown}
      style={{
        marginTop: 6,
        border: `1px solid ${token.colorBorder}`,
        borderRadius: token.borderRadius,
        background: token.colorBgContainer,
        padding: 8,
      }}
    >
      <Text strong style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>
        {title}
      </Text>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        autoFocus
        rows={Math.min(8, Math.max(3, text.split('\n').length))}
        spellCheck={false}
        className="dt-scrollbar"
        aria-label={`${title} decoded text`}
        style={{
          display: 'block',
          width: '100%',
          boxSizing: 'border-box',
          resize: 'vertical',
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: token.borderRadius,
          background: token.colorBgContainer,
          color: token.colorText,
          fontFamily: token.fontFamilyCode,
          fontSize: 12,
          lineHeight: 1.5,
          padding: 6,
          outline: 'none',
        }}
      />
      {isDirty && (
        <div style={{ marginTop: 6 }}>
          <Text strong style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>
            Encoded preview
          </Text>
          <div
            style={{
              maxHeight: 64,
              overflowY: 'auto',
              border: `1px solid ${token.colorBorderSecondary}`,
              borderRadius: token.borderRadius,
              padding: 6,
              background: token.colorFillAlter,
              fontFamily: token.fontFamilyCode,
              fontSize: 11,
              wordBreak: 'break-all',
              lineHeight: 1.5,
            }}
            className="dt-scrollbar"
          >
            {encoded === null ? (
              <Text type="danger" italic style={{ fontSize: 11 }}>
                Cannot encode — the edited value is not valid for this type
              </Text>
            ) : (
              encoded
            )}
          </div>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
        {onOpenDocument && (
          <Button
            type="link"
            size="small"
            icon={<ExportOutlined />}
            onClick={onOpenDocument}
            style={{ fontSize: 11, padding: 0, height: 'auto' }}
          >
            Open as document
          </Button>
        )}
        <span style={{ flex: 1 }} />
        <Button size="small" onClick={onCancel} style={{ fontSize: 11 }}>
          Cancel
        </Button>
        <Tooltip title={<ShortcutHintTitle label={SAVE_SHORTCUT}>Save</ShortcutHintTitle>} placement="top">
          <Button
            size="small"
            type="primary"
            icon={<SaveOutlined />}
            disabled={saveDisabled}
            onClick={handleSave}
            style={{
              fontSize: 11,
              ...(saveDisabled ? {} : { background: SAVE_ACCENT, borderColor: SAVE_ACCENT }),
            }}
          >
            Save
          </Button>
        </Tooltip>
      </div>
    </div>
  );
};
