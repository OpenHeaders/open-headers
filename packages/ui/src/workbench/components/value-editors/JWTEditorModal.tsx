/**
 * JWTEditorModal — decode-edit-reencode editor for JWT values.
 *
 * Left pane: the decoded header + payload as editable JSON (Monaco via
 * the shared CodeEditor), or the raw encoded token in Encoded mode.
 * Right pane: live re-encoded preview with per-segment coloring,
 * expiration status, and recognized-claim tags.
 *
 * The original signature is carried over unchanged — editing header or
 * payload therefore invalidates it, and the modal says so inline
 * instead of re-signing (deferred until a key-entry flow exists).
 */

import { CheckCircleOutlined, CloseCircleOutlined, CodeOutlined, CopyOutlined, FileTextOutlined } from '@ant-design/icons';
import type { JsonObject } from '@openheaders/core/types';
import { Alert, App, Button, Input, Modal, Segmented, Space, Tag, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import CodeEditor from '../shared/CodeEditor';
import { EditorModalFooter } from './EditorModalFooter';
import { decodeJWT, encodeJWT, formatJSON, getJWTExpiration, JWT_CLAIM_DESCRIPTIONS, type JWTExpirationInfo, validateJSON } from './jwt';

const { TextArea } = Input;
const { Text } = Typography;

type EditMode = 'decoded' | 'encoded';

interface JWTEditorModalProps {
  open: boolean;
  /** The bare token (no `Bearer ` prefix — the caller strips/restores it). */
  token: string;
  onSave: (token: string) => void;
  onCancel: () => void;
}

const JWTEditorModal: React.FC<JWTEditorModalProps> = ({ open, token: initialToken, onSave, onCancel }) => {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const [decodedHeader, setDecodedHeader] = useState('');
  const [decodedPayload, setDecodedPayload] = useState('');
  const [signature, setSignature] = useState('');
  const [encodedToken, setEncodedToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [headerError, setHeaderError] = useState<string | null>(null);
  const [payloadError, setPayloadError] = useState<string | null>(null);
  const [expirationInfo, setExpirationInfo] = useState<JWTExpirationInfo | null>(null);
  const [originalToken, setOriginalToken] = useState('');
  // Canonical re-encode of the original token (same header/payload
  // objects, same signature). The original's own base64 may carry
  // padding or JSON-formatting differences that our encoder
  // normalizes away — an edit-then-revert lands on THIS string, not
  // necessarily the verbatim original, so dirtiness compares against
  // both. Null when the original doesn't decode.
  const [canonicalBaseline, setCanonicalBaseline] = useState<string | null>(null);
  const [editMode, setEditMode] = useState<EditMode>('decoded');
  const [encodedInput, setEncodedInput] = useState('');
  const [encodedInputError, setEncodedInputError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !initialToken) return;
    setOriginalToken(initialToken);
    setEncodedToken(initialToken);
    setEncodedInput(initialToken);
    setHeaderError(null);
    setPayloadError(null);
    setEncodedInputError(null);
    try {
      const decoded = decodeJWT(initialToken);
      setDecodedHeader(formatJSON(decoded.header));
      setDecodedPayload(formatJSON(decoded.payload));
      setSignature(decoded.signature);
      setCanonicalBaseline(encodeJWT(decoded.header, decoded.payload, decoded.signature));
      setExpirationInfo(getJWTExpiration(decoded.payload));
      setError(null);
      setEditMode('decoded');
    } catch (err) {
      // Undecodable value — fall back to raw token editing.
      setCanonicalBaseline(null);
      setError(err instanceof Error ? err.message : String(err));
      setEditMode('encoded');
    }
  }, [open, initialToken]);

  const applyEdit = useCallback(
    (headerObj: JsonObject, payloadObj: JsonObject) => {
      setEncodedToken(encodeJWT(headerObj, payloadObj, signature));
    },
    [signature],
  );

  const handleHeaderChange = useCallback(
    (next: string) => {
      setDecodedHeader(next);
      try {
        applyEdit(validateJSON(next), validateJSON(decodedPayload));
        setHeaderError(null);
      } catch (err) {
        setHeaderError(err instanceof Error ? err.message : String(err));
      }
    },
    [applyEdit, decodedPayload],
  );

  const handlePayloadChange = useCallback(
    (next: string) => {
      setDecodedPayload(next);
      try {
        const payloadObj = validateJSON(next);
        applyEdit(validateJSON(decodedHeader), payloadObj);
        setPayloadError(null);
        setExpirationInfo(getJWTExpiration(payloadObj));
      } catch (err) {
        setPayloadError(err instanceof Error ? err.message : String(err));
      }
    },
    [applyEdit, decodedHeader],
  );

  const handleEncodedInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const next = e.target.value;
      setEncodedInput(next);
      setEncodedToken(next);
      try {
        const decoded = decodeJWT(next);
        setDecodedHeader(formatJSON(decoded.header));
        setDecodedPayload(formatJSON(decoded.payload));
        setSignature(decoded.signature);
        setExpirationInfo(getJWTExpiration(decoded.payload));
        setEncodedInputError(null);
        setHeaderError(null);
        setPayloadError(null);
        setError(null);
      } catch (err) {
        setEncodedInputError(err instanceof Error ? err.message : String(err));
      }
    },
    [],
  );

  const handleModeSwitch = useCallback(
    (mode: EditMode) => {
      setEditMode(mode);
      if (mode === 'encoded') {
        setEncodedInput(encodedToken);
        setEncodedInputError(null);
      }
    },
    [encodedToken],
  );

  const displayToken = editMode === 'encoded' ? encodedInput : encodedToken;

  const copyToClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(displayToken);
      message.success('JWT copied to clipboard');
    } catch {
      message.error('Failed to copy to clipboard');
    }
  }, [displayToken, message]);

  const hasErrors = editMode === 'decoded' ? Boolean(headerError || payloadError) : Boolean(encodedInputError);

  // Derived dirtiness — the current encoded form differs from the
  // original (and from its canonical re-encode, so edit-then-revert
  // reads clean again). Never tracked imperatively.
  const isDirty =
    Boolean(displayToken) && displayToken !== originalToken && (!canonicalBaseline || displayToken !== canonicalBaseline);
  const isModified = isDirty || hasErrors;
  const saveDisabled = !isDirty || hasErrors || !displayToken;

  const handleSave = useCallback(() => {
    if (saveDisabled) return;
    onSave(displayToken);
  }, [saveDisabled, displayToken, onSave]);

  // ⌘S / Ctrl+S saves from anywhere inside the modal — matches the
  // shortcut hint on the Save button's tooltip.
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSave();
      }
    },
    [handleSave],
  );

  const segmentColors = [token.colorError, token.colorSuccess, token.colorPrimary];
  const previewParts = displayToken.split('.');

  const recognizedClaims = (() => {
    try {
      const payload = validateJSON(decodedPayload);
      return Object.keys(payload).filter((key) => JWT_CLAIM_DESCRIPTIONS[key]);
    } catch {
      return [];
    }
  })();

  return (
    <Modal
      title={
        <Space>
          <span>JWT Editor</span>
          {isModified && <Tag color="orange">Modified</Tag>}
        </Space>
      }
      open={open}
      onCancel={onCancel}
      width={980}
      footer={<EditorModalFooter saveDisabled={saveDisabled} onSave={handleSave} onCancel={onCancel} />}
      centered
      destroyOnHidden
    >
      {error && (
        <Alert type="error" showIcon message="Could not decode token" description={error} style={{ marginBottom: 12 }} />
      )}

      <div style={{ display: 'flex', gap: 16 }} onKeyDown={handleKeyDown}>
        {/* Left pane — editors */}
        <div style={{ flex: 11, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Segmented
            value={editMode}
            onChange={(mode) => handleModeSwitch(mode as EditMode)}
            options={[
              { label: 'Decoded', value: 'decoded', icon: <CodeOutlined /> },
              { label: 'Encoded', value: 'encoded', icon: <FileTextOutlined /> },
            ]}
            style={{ alignSelf: 'flex-start' }}
          />

          {editMode === 'decoded' ? (
            <>
              <div>
                <Space style={{ marginBottom: 4 }}>
                  <Text strong style={{ fontSize: 12 }}>
                    Header
                  </Text>
                  {headerError && (
                    <Text type="danger" style={{ fontSize: 12 }}>
                      {headerError}
                    </Text>
                  )}
                </Space>
                <CodeEditor value={decodedHeader} onChange={handleHeaderChange} language="json" minHeight={92} variableAutoComplete={false} />
              </div>
              <div>
                <Space style={{ marginBottom: 4 }}>
                  <Text strong style={{ fontSize: 12 }}>
                    Payload
                  </Text>
                  {payloadError && (
                    <Text type="danger" style={{ fontSize: 12 }}>
                      {payloadError}
                    </Text>
                  )}
                </Space>
                <CodeEditor
                  value={decodedPayload}
                  onChange={handlePayloadChange}
                  language="json"
                  minHeight={240}
                  variableAutoComplete={false}
                />
                {recognizedClaims.length > 0 && (
                  // Explicit flex gap — a Tooltip-wrapped Tag loses the
                  // Tag's own end margin, so without it the tags butt
                  // up against each other.
                  <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Claims:
                    </Text>
                    {recognizedClaims.map((claim) => (
                      <Tooltip key={claim} title={JWT_CLAIM_DESCRIPTIONS[claim]}>
                        <Tag color="blue" style={{ margin: 0 }}>
                          {claim}
                        </Tag>
                      </Tooltip>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Text strong style={{ fontSize: 12 }}>
                Paste or edit the raw token
              </Text>
              <TextArea
                value={encodedInput}
                onChange={handleEncodedInputChange}
                placeholder="header.payload.signature"
                autoSize={{ minRows: 10, maxRows: 16 }}
                style={{ fontFamily: 'monospace', fontSize: 12 }}
                status={encodedInputError ? 'error' : undefined}
              />
              {encodedInputError && (
                <Alert type="error" showIcon message="Not a decodable JWT" description={encodedInputError} />
              )}
            </div>
          )}
        </div>

        {/* Right pane — preview + status */}
        <div style={{ flex: 9, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text strong style={{ fontSize: 12 }}>
              Encoded preview
            </Text>
            <Button size="small" icon={<CopyOutlined />} onClick={() => void copyToClipboard()}>
              Copy
            </Button>
          </div>
          <div
            style={{
              maxHeight: 180,
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
            {previewParts.length === 3 ? (
              previewParts.map((part, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: fixed 3-segment structure
                <span key={i}>
                  {i > 0 && <span>.</span>}
                  <span style={{ color: segmentColors[i] }}>{part}</span>
                </span>
              ))
            ) : (
              <span>{displayToken}</span>
            )}
          </div>
          <div style={{ fontSize: 12, fontFamily: 'monospace' }}>
            <Text type="secondary" style={{ fontSize: 12, marginRight: 8 }}>
              Structure:
            </Text>
            <Text style={{ color: segmentColors[0] }}>header</Text>
            <Text>.</Text>
            <Text style={{ color: segmentColors[1] }}>payload</Text>
            <Text>.</Text>
            <Text style={{ color: segmentColors[2] }}>signature</Text>
          </div>

          {expirationInfo?.hasExpiration && (
            <Alert
              type={expirationInfo.isExpired ? 'error' : 'success'}
              showIcon
              icon={expirationInfo.isExpired ? <CloseCircleOutlined /> : <CheckCircleOutlined />}
              message={expirationInfo.isExpired ? 'Token expired' : 'Token not expired'}
              description={`${expirationInfo.isExpired ? 'Expired' : 'Expires'} on ${expirationInfo.expiresAt?.toLocaleString()}`}
            />
          )}

          {isModified && (
            <Alert
              type="warning"
              showIcon
              message="Signature no longer valid"
              description="The original signature is kept as-is, so servers that verify it will reject the edited token. Re-signing with your own key is not supported yet."
            />
          )}
        </div>
      </div>
    </Modal>
  );
};

export default JWTEditorModal;
