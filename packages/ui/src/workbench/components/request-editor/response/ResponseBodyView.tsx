/**
 * ResponseBodyView — the response body pane.
 *
 * One view picker (dropdown) + a Preview toggle:
 *   • Languages above the picker's divider — choosing one renders the
 *     highlighted (Pretty) view: read-only Monaco, language
 *     auto-detected from Content-Type, JSON re-indented.
 *   • Below the divider, byte-level views of the same body:
 *     Raw — the wire text verbatim in a plain <pre>, cheap for large
 *     bodies and the element e2e reads (`oh-response-body`);
 *     Hex — offset / byte / ASCII dump of the UTF-8 bytes, capped (a
 *     full dump of the body cap would be a ~10 MB string);
 *     Base64 — the same bytes base64-encoded.
 *   • Preview — separate toggle, offered when the body is HTML (fully
 *     sandboxed iframe: no scripts, no same-origin access) or
 *     parseable JSON (collapsible key/value tree).
 */

import { CheckOutlined, CopyOutlined, DownOutlined, DownloadOutlined, EyeOutlined } from '@ant-design/icons';
import type { ExecutedRequestSnapshot } from '@openheaders/core/types';
import { Button, ConfigProvider, Dropdown, type MenuProps, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { getLanguage, LANGUAGE_LIST, type LanguageId } from '../../../languages/registry';
import CodeEditor from '../../shared/CodeEditor';
import ResponseJsonPreview from './ResponseJsonPreview';
import { ViewPickerIcon } from './ViewPickerIcons';
import { buildHexDump, encodeBodyBytes, toBase64 } from './response-encoding';
import { detectBodyLanguage, formatBytes, prettyBody } from './response-format';
import { deriveSaveFilename } from './response-save';

const { Text } = Typography;

/** Body cap the runner applies before truncating — surfaced in the
 *  truncation notice. */
const BODY_CAP_BYTES = 2 * 1024 * 1024;

type ViewMode = 'pretty' | 'raw' | 'hex' | 'base64' | 'preview';

/** Language half of the picker — every registry language a response
 *  body can plausibly be, i.e. all but graphql (no response media type
 *  and no Monaco grammar). */
const LANGUAGE_OPTIONS = LANGUAGE_LIST.filter((l) => l.id !== 'graphql').map((l) => ({
  value: l.id,
  label: l.label,
}));

const LANGUAGE_BY_KEY = new Map(LANGUAGE_OPTIONS.map((l) => [`lang:${l.value}`, l.value]));

const ENCODING_VIEWS: ReadonlyArray<{ mode: 'raw' | 'hex' | 'base64'; label: string }> = [
  { mode: 'raw', label: 'Raw' },
  { mode: 'hex', label: 'Hex' },
  { mode: 'base64', label: 'Base64' },
];

function PickerLabel({ icon, text }: { icon: string; text: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <span style={{ opacity: 0.75, display: 'inline-flex' }}>
        <ViewPickerIcon id={icon} size={14} />
      </span>
      {text}
    </span>
  );
}

const ResponseBodyView: React.FC<{ response: ExecutedRequestSnapshot }> = ({ response }) => {
  const { token } = theme.useToken();
  const [mode, setMode] = useState<ViewMode>('pretty');
  const [langOverride, setLangOverride] = useState<LanguageId | null>(null);
  const [copied, setCopied] = useState(false);

  // Each new response re-detects: a JSON override on the previous send
  // must not stick to the HTML page the next send returned.
  useEffect(() => {
    setMode('pretty');
    setLangOverride(null);
  }, [response]);

  const language = langOverride ?? detectBodyLanguage(response.headers);
  const pretty = useMemo(() => prettyBody(response.body, language), [response.body, language]);

  // Parsed body for the JSON tree preview — `undefined` when the viewer
  // language isn't JSON or the body doesn't parse.
  const parsedJson = useMemo<unknown>(() => {
    if (language !== 'json') return undefined;
    try {
      return JSON.parse(response.body);
    } catch {
      return undefined;
    }
  }, [response.body, language]);

  const previewKind: 'html' | 'json' | null = language === 'html' ? 'html' : parsedJson !== undefined ? 'json' : null;

  // A language override can take Preview away while it's the active
  // mode (e.g. HTML body overridden to Text) — fall back to Pretty.
  useEffect(() => {
    if (mode === 'preview' && !previewKind) setMode('pretty');
  }, [mode, previewKind]);

  // Byte views are computed only while active — encoding is linear in
  // body size and wasted on every other mode.
  const hexDump = useMemo(
    () => (mode === 'hex' ? buildHexDump(encodeBodyBytes(response.body)) : null),
    [mode, response.body],
  );
  const base64Body = useMemo(
    () => (mode === 'base64' ? toBase64(encodeBodyBytes(response.body)) : null),
    [mode, response.body],
  );

  const pickerItems: MenuProps['items'] = [
    ...LANGUAGE_OPTIONS.map((opt) => ({
      key: `lang:${opt.value}`,
      label: <PickerLabel icon={opt.value} text={opt.label} />,
    })),
    { type: 'divider' as const },
    ...ENCODING_VIEWS.map((view) => ({
      key: `view:${view.mode}`,
      label: <PickerLabel icon={view.mode} text={view.label} />,
    })),
  ];

  const onPickView: MenuProps['onClick'] = ({ key }) => {
    const lang = LANGUAGE_BY_KEY.get(key);
    if (lang) {
      setLangOverride(lang);
      setMode('pretty');
      return;
    }
    const view = ENCODING_VIEWS.find((v) => key === `view:${v.mode}`);
    if (view) setMode(view.mode);
  };

  // The picker reads as "how the body is rendered": the language while
  // in Pretty (or Preview, which sits on top of it), the encoding view
  // otherwise.
  const activeEncoding = ENCODING_VIEWS.find((v) => v.mode === mode);
  const pickerKey = activeEncoding ? `view:${activeEncoding.mode}` : `lang:${language}`;
  const pickerIcon = activeEncoding ? activeEncoding.mode : language;
  const pickerLabel = activeEncoding ? activeEncoding.label : getLanguage(language).label;

  const copyBody = () => {
    void navigator.clipboard.writeText(response.body).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  };

  // The workbench is an extension page, so a plain anchor download
  // works — no downloads permission. Saves the body text we hold: a
  // truncated body saves truncated (labeled in the tooltip), never
  // re-fetched.
  const saveBody = () => {
    const blob = new Blob([response.body], { type: 'text/plain;charset=utf-8' });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = deriveSaveFilename(response.url, language);
    anchor.click();
    URL.revokeObjectURL(objectUrl);
  };

  if (!response.body) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          Empty body
        </Text>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', paddingBottom: 8 }}>
      {response.bodyTruncated && (
        <Text type="warning" style={{ fontSize: 11, display: 'block', marginTop: 6 }}>
          Response truncated at {formatBytes(BODY_CAP_BYTES)} (original {formatBytes(response.bodyBytes)}).
        </Text>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
        <ConfigProvider theme={{ token: { fontSize: 12 }, components: { Dropdown: { paddingBlock: 3 } } }}>
          <Dropdown
            menu={{ items: pickerItems, onClick: onPickView, selectable: true, selectedKeys: [pickerKey] }}
            trigger={['click']}
          >
            <Button size="small" data-testid="oh-response-view-picker" aria-label="Body view">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ opacity: 0.75, display: 'inline-flex' }}>
                  <ViewPickerIcon id={pickerIcon} size={13} />
                </span>
                {pickerLabel}
                <DownOutlined style={{ fontSize: 9, opacity: 0.65 }} />
              </span>
            </Button>
          </Dropdown>
        </ConfigProvider>
        {previewKind && (
          <Button
            size="small"
            type={mode === 'preview' ? 'primary' : 'text'}
            icon={<EyeOutlined />}
            onClick={() => setMode(mode === 'preview' ? 'pretty' : 'preview')}
          >
            Preview
          </Button>
        )}
        <Tooltip title={copied ? 'Copied' : 'Copy body'} placement="bottom">
          <Button
            size="small"
            type="text"
            icon={copied ? <CheckOutlined /> : <CopyOutlined />}
            onClick={copyBody}
            aria-label="Copy body"
            style={{ marginLeft: 'auto' }}
          />
        </Tooltip>
        <Tooltip
          title={response.bodyTruncated ? 'Save body to file (truncated body — saves what was kept)' : 'Save body to file'}
          placement="bottom"
        >
          <Button size="small" type="text" icon={<DownloadOutlined />} onClick={saveBody} aria-label="Save body" />
        </Tooltip>
      </div>
      {mode === 'pretty' && (
        <div style={{ flex: 1, minHeight: 0 }}>
          <CodeEditor value={pretty} language={language} readOnly fill variableAutoComplete={false} />
        </div>
      )}
      {mode === 'raw' && (
        <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          <pre
            // Role-less rendered body — same exception as the status chip:
            // a single inline test id so e2e can read the wire text
            // directly instead of sniffing the DOM for a JSON-shaped <pre>.
            data-testid="oh-response-body"
            style={{
              fontFamily: "'SF Mono', 'Fira Code', monospace",
              fontSize: 12,
              margin: 0,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              color: token.colorText,
            }}
          >
            {response.body}
          </pre>
        </div>
      )}
      {mode === 'hex' && hexDump && (
        <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          {hexDump.capped && (
            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>
              Hex view shows the first {formatBytes(hexDump.shownBytes)} of {formatBytes(hexDump.totalBytes)}.
            </Text>
          )}
          <pre
            data-testid="oh-response-hex"
            style={{
              fontFamily: "'SF Mono', 'Fira Code', monospace",
              fontSize: 12,
              margin: 0,
              whiteSpace: 'pre',
              color: token.colorText,
            }}
          >
            {hexDump.text}
          </pre>
        </div>
      )}
      {mode === 'base64' && base64Body !== null && (
        <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          <pre
            data-testid="oh-response-base64"
            style={{
              fontFamily: "'SF Mono', 'Fira Code', monospace",
              fontSize: 12,
              margin: 0,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              color: token.colorText,
            }}
          >
            {base64Body}
          </pre>
        </div>
      )}
      {mode === 'preview' && previewKind === 'json' && <ResponseJsonPreview value={parsedJson} />}
      {mode === 'preview' && previewKind === 'html' && (
        <iframe
          title="Response preview"
          sandbox=""
          srcDoc={response.body}
          style={{
            flex: 1,
            width: '100%',
            border: `1px solid ${token.colorBorderSecondary}`,
            borderRadius: 6,
            // Pages assume a light canvas; don't paint them on the
            // app's dark background.
            background: '#fff',
          }}
        />
      )}
    </div>
  );
};

export default ResponseBodyView;
