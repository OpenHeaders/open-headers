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

import { CheckOutlined, CopyOutlined, DownOutlined, EyeOutlined, FilterOutlined } from '@ant-design/icons';
import type { ExecutedRequestSnapshot } from '@openheaders/core/types';
import { Button, ConfigProvider, Dropdown, type MenuProps, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { getLanguage, LANGUAGE_LIST, type LanguageId } from '../../../languages/registry';
import CodeEditor from '../../shared/CodeEditor';
import ResponseFilterInput from './ResponseFilterInput';
import ResponseJsonPreview from './ResponseJsonPreview';
import { ViewPickerIcon, WrapLinesIcon } from './ViewPickerIcons';
import { buildHexDump, encodeBodyBytes, toBase64 } from './response-encoding';
import {
  evaluateJsonPath,
  evaluateXPath,
  suggestJsonPathCompletions,
  suggestXPathCompletions,
} from './response-filter';
import { detectBodyLanguage, formatBytes, prettyBody } from './response-format';

const { Text } = Typography;

/** Fallback for snapshots that predate the cap stamp — the executor's
 *  default body cap (the `requests.responseBodyCapMB` setting). */
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
  const [pickerOpen, setPickerOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  // Wrap survives across sends (a viewing preference); the filter does
  // not (a path typed against the previous body).
  const [wrapLines, setWrapLines] = useState(true);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');

  // Each new response re-detects: a JSON override on the previous send
  // must not stick to the HTML page the next send returned.
  useEffect(() => {
    setMode('pretty');
    setLangOverride(null);
    setFilterOpen(false);
    setFilterQuery('');
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

  // Structural filter: JSONPath for parseable JSON, XPath for markup,
  // nothing for languages without a query form (Find covers those).
  const filterKind: 'jsonpath' | 'xpath' | null =
    language === 'json' && parsedJson !== undefined
      ? 'jsonpath'
      : language === 'xml' || language === 'html'
        ? 'xpath'
        : null;

  // A language override can take the filter away — close the bar.
  useEffect(() => {
    if (!filterKind && filterOpen) setFilterOpen(false);
  }, [filterKind, filterOpen]);

  const filterApplied = filterOpen && filterKind !== null && filterQuery.trim() !== '';
  const filterResult = useMemo(() => {
    if (!filterApplied || !filterKind) return null;
    const query = filterQuery.trim();
    if (filterKind === 'jsonpath') return evaluateJsonPath(parsedJson, query);
    return evaluateXPath(response.body, query, language === 'xml' ? 'xml' : 'html');
  }, [filterApplied, filterKind, filterQuery, parsedJson, response.body, language]);

  // What Pretty shows while the filter matches: the single match, or
  // the match list (JSON as an array, markup joined line-wise).
  const filteredDisplay = useMemo(() => {
    if (!filterResult?.ok) return null;
    if (filterKind === 'jsonpath') {
      const m = filterResult.matches;
      return JSON.stringify(m.length === 1 ? m[0] : m, null, 2) ?? '';
    }
    return filterResult.matches.join('\n');
  }, [filterResult, filterKind]);

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

  // Picker and Preview act as a two-way toggle: the active side carries
  // a quiet selected fill, the other renders as plain text. While
  // Preview holds the selection, the picker's first click only takes it
  // back (no menu); the menu opens on a click while already selected.
  const pickerSelected = mode !== 'preview';
  const onPickerOpenChange = (next: boolean) => {
    if (next && !pickerSelected) {
      setMode('pretty');
      return;
    }
    setPickerOpen(next);
  };

  // Copies what the pane is showing: the filtered result while the
  // filter matches, the wire body otherwise.
  const copyBody = () => {
    void navigator.clipboard.writeText(filteredDisplay ?? response.body).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
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
          Response truncated at {formatBytes(response.bodyCapBytes ?? BODY_CAP_BYTES)} (original{' '}
          {formatBytes(response.bodyBytes)}). The limit is adjustable in Settings → Requests.
        </Text>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
        <ConfigProvider theme={{ token: { fontSize: 12 }, components: { Dropdown: { paddingBlock: 3 } } }}>
          <Dropdown
            menu={{ items: pickerItems, onClick: onPickView, selectable: true, selectedKeys: [pickerKey] }}
            trigger={['click']}
            open={pickerOpen}
            onOpenChange={onPickerOpenChange}
          >
            <Button
              size="small"
              type="text"
              data-testid="oh-response-view-picker"
              aria-label="Body view"
              style={pickerSelected ? { background: token.colorBgTextActive } : undefined}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ opacity: 0.75, display: 'inline-flex' }}>
                  <ViewPickerIcon id={pickerIcon} size={13} />
                </span>
                {pickerLabel}
                {pickerSelected && <DownOutlined style={{ fontSize: 9, opacity: 0.65 }} />}
              </span>
            </Button>
          </Dropdown>
        </ConfigProvider>
        {previewKind && (
          <Button
            size="small"
            type="text"
            icon={<EyeOutlined />}
            style={mode === 'preview' ? { background: token.colorBgTextActive } : undefined}
            onClick={() => setMode(mode === 'preview' ? 'pretty' : 'preview')}
          >
            Preview
          </Button>
        )}
        <Tooltip title={wrapLines ? 'Unwrap lines' : 'Wrap lines'} placement="bottom">
          <Button
            size="small"
            type="text"
            icon={<WrapLinesIcon />}
            onClick={() => setWrapLines((prev) => !prev)}
            aria-label="Wrap lines"
            style={{ marginLeft: 'auto', ...(wrapLines ? { background: token.colorBgTextActive } : {}) }}
          />
        </Tooltip>
        {filterKind && (
          <Tooltip title={filterKind === 'jsonpath' ? 'Filter body (JSONPath)' : 'Filter body (XPath)'} placement="bottom">
            <Button
              size="small"
              type="text"
              icon={<FilterOutlined />}
              aria-label="Filter body"
              style={filterOpen ? { background: token.colorBgTextActive } : undefined}
              onClick={() => {
                if (!filterOpen && mode !== 'pretty') setMode('pretty');
                setFilterOpen((prev) => !prev);
              }}
            />
          </Tooltip>
        )}
        <span
          aria-hidden="true"
          style={{ width: 1, height: 16, background: token.colorBorderSecondary, margin: '0 2px' }}
        />
        <Tooltip title={copied ? 'Copied' : 'Copy body'} placement="bottom">
          <Button
            size="small"
            type="text"
            icon={copied ? <CheckOutlined /> : <CopyOutlined />}
            onClick={copyBody}
            aria-label="Copy body"
          />
        </Tooltip>
      </div>
      {filterOpen && filterKind && (
        <div style={{ paddingBottom: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <ResponseFilterInput
            value={filterQuery}
            onChange={setFilterQuery}
            placeholder={
              filterKind === 'jsonpath'
                ? "Filter with JSONPath — $.headers['content-type'], $.items[0], $..url"
                : 'Filter with XPath — //item/name, /html/head/title'
            }
            hasError={filterResult !== null && !filterResult.ok}
            getSuggestions={(query) =>
              filterKind === 'jsonpath'
                ? suggestJsonPathCompletions(parsedJson, query)
                : suggestXPathCompletions(response.body, language === 'xml' ? 'xml' : 'html', query)
            }
          />
          {filterResult && !filterResult.ok && (
            <Text type="danger" style={{ fontSize: 11 }}>
              {filterKind === 'jsonpath'
                ? 'Invalid JSONPath expression.'
                : 'Invalid XPath expression, or the document does not parse.'}
            </Text>
          )}
          {filterResult?.ok && filterResult.matches.length === 0 && (
            <Text type="secondary" style={{ fontSize: 11 }}>
              No matches for this path.
            </Text>
          )}
        </div>
      )}
      {mode === 'pretty' && (
        <div style={{ flex: 1, minHeight: 0 }}>
          <CodeEditor
            value={filteredDisplay ?? pretty}
            language={language}
            readOnly
            fill
            variableAutoComplete={false}
            wordWrapOverride={wrapLines ? 'on' : 'off'}
          />
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
              whiteSpace: wrapLines ? 'pre-wrap' : 'pre',
              wordBreak: wrapLines ? 'break-word' : 'normal',
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
              whiteSpace: wrapLines ? 'pre-wrap' : 'pre',
              wordBreak: wrapLines ? 'break-all' : 'normal',
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
