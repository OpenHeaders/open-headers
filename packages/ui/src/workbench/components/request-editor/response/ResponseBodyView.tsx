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
 *     sandboxed iframe: no scripts, no same-origin access), parseable
 *     JSON (collapsible key/value tree), or a PDF (the browser's own
 *     viewer over the captured bytes — the default view for PDFs).
 *
 * Binary bodies (`bodyEncoding: 'base64'`) have no wire text, so the
 * language half of the picker and the Raw view stand down: the picker
 * offers Hex (default) and Base64, both decoding the snapshot back to
 * the exact wire bytes.
 */

import { CheckOutlined, CopyOutlined, DownOutlined, EyeOutlined, FilterOutlined } from '@ant-design/icons';
import type { ExecutedRequestSnapshot } from '@openheaders/core/types';
import { Badge, Button, ConfigProvider, Dropdown, type MenuProps, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { useOpenSettings } from '../../../hooks/OpenSettingsContext';
import { getLanguage, LANGUAGE_LIST, type LanguageId } from '../../../languages/registry';
import CodeEditor from '../../shared/CodeEditor';
import ResponseFilterInput from './ResponseFilterInput';
import ResponseJsonPreview from './ResponseJsonPreview';
import ResponsePdfPreview from './ResponsePdfPreview';
import { ViewPickerIcon, WrapLinesIcon } from './ViewPickerIcons';
import { detectMagicSignatures } from './magic-signatures';
import { buildHexDump, encodeBodyBytes, snapshotBodyBytes, toBase64 } from './response-encoding';
import {
  evaluateJsonPath,
  evaluateXPath,
  normalizeFilterQuery,
  suggestJsonPathCompletions,
  suggestXPathCompletions,
} from './response-filter';
import { detectBodyLanguage, formatBytes, isPdfResponse, prettyBody } from './response-format';
import { useFormattedBody } from './use-formatted-body';

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
      <ViewPickerIcon id={icon} size={16} />
      {text}
    </span>
  );
}

/** The view a fresh response opens on: PDFs go straight to Preview
 *  (the rendered document is the answer), other binary bodies to Hex
 *  (the only faithful text-free view), text to Pretty. */
function initialMode(response: ExecutedRequestSnapshot): ViewMode {
  if (isPdfResponse(response.headers)) return 'preview';
  return response.bodyEncoding === 'base64' ? 'hex' : 'pretty';
}

const ResponseBodyView: React.FC<{ response: ExecutedRequestSnapshot }> = ({ response }) => {
  const { token } = theme.useToken();
  const t = useT();
  const openSettings = useOpenSettings();
  const [mode, setMode] = useState<ViewMode>(() => initialMode(response));
  const [langOverride, setLangOverride] = useState<LanguageId | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  // Wrap survives across sends (a viewing preference); the filter does
  // not (a path typed against the previous body).
  const [wrapLines, setWrapLines] = useState(true);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');
  // The last successful filter match — see the sticky display below.
  const [lastMatch, setLastMatch] = useState<string | null>(null);

  // Each new response re-detects: a JSON override on the previous send
  // must not stick to the HTML page the next send returned.
  useEffect(() => {
    setMode(initialMode(response));
    setLangOverride(null);
    setFilterOpen(false);
    setFilterQuery('');
    setLastMatch(null);
  }, [response]);

  const isBinary = response.bodyEncoding === 'base64';
  const language = langOverride ?? detectBodyLanguage(response.headers);
  // JSON re-indents synchronously; markup/code languages swap in the
  // Prettier result when it resolves (wire text paints first).
  const pretty = useFormattedBody(
    useMemo(() => prettyBody(response.body, language), [response.body, language]),
    language,
  );

  // Parsed body for the JSON tree preview — `undefined` when the viewer
  // language isn't JSON or the body doesn't parse. Binary never parses:
  // the body string is base64, whose digit-only edge cases would
  // otherwise "parse" as a JSON number.
  const parsedJson = useMemo<unknown>(() => {
    if (isBinary || language !== 'json') return undefined;
    try {
      return JSON.parse(response.body);
    } catch {
      return undefined;
    }
  }, [response.body, language, isBinary]);

  const previewKind: 'pdf' | 'html' | 'json' | null = isPdfResponse(response.headers)
    ? 'pdf'
    : isBinary
      ? null
      : language === 'html'
        ? 'html'
        : parsedJson !== undefined
          ? 'json'
          : null;

  // A language override can take Preview away while it's the active
  // mode (e.g. HTML body overridden to Text) — fall back to the body's
  // base view (Hex for binary, Pretty otherwise).
  useEffect(() => {
    if (mode === 'preview' && !previewKind) setMode(isBinary ? 'hex' : 'pretty');
  }, [mode, previewKind, isBinary]);

  // Structural filter: JSONPath for parseable JSON, XPath for markup,
  // nothing for languages without a query form (Find covers those) —
  // and nothing for binary, which has no text to query.
  const filterKind: 'jsonpath' | 'xpath' | null = isBinary
    ? null
    : language === 'json' && parsedJson !== undefined
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
    // Normalized: a trailing separator means "descend", not an error.
    const query = normalizeFilterQuery(filterQuery, filterKind);
    if (filterKind === 'jsonpath') return evaluateJsonPath(parsedJson, query);
    return evaluateXPath(response.body, query, language === 'xml' ? 'xml' : 'html');
  }, [filterApplied, filterKind, filterQuery, parsedJson, response.body, language]);

  // What Pretty shows while the filter matches: the single match, or
  // the match list (JSON as an array, markup joined line-wise and
  // pretty-printed — XPath matches serialize single-line). Null while
  // the query is invalid or hits nothing.
  const filteredDisplay = useFormattedBody(
    useMemo(() => {
      if (!filterResult?.ok || filterResult.matches.length === 0) return null;
      if (filterKind === 'jsonpath') {
        const m = filterResult.matches;
        return JSON.stringify(m.length === 1 ? m[0] : m, null, 2) ?? '';
      }
      return filterResult.matches.join('\n');
    }, [filterResult, filterKind]),
    language,
  );

  // The last successful match sticks: mid-edit queries (invalid or
  // matchless) keep showing it — the message under the bar says why —
  // instead of collapsing the pane back to the full body.
  useEffect(() => {
    if (filteredDisplay !== null) setLastMatch(filteredDisplay);
  }, [filteredDisplay]);
  useEffect(() => {
    setLastMatch(null);
  }, [filterKind]);
  const shownFiltered = filterApplied ? (filteredDisplay ?? lastMatch) : null;

  // Byte views are computed only while active — encoding is linear in
  // body size and wasted on every other mode. All derive from the true
  // wire bytes (`snapshotBodyBytes`); a binary body's Base64 view IS
  // the stored string, no round-trip needed.
  const hexDump = useMemo(() => {
    if (mode !== 'hex') return null;
    const bytes = snapshotBodyBytes(response);
    return buildHexDump(bytes, undefined, detectMagicSignatures(bytes));
  }, [mode, response]);
  const base64Body = useMemo(
    () => (mode === 'base64' ? (isBinary ? response.body : toBase64(encodeBodyBytes(response.body))) : null),
    [mode, response.body, isBinary],
  );
  const pdfBytes = useMemo(
    () => (mode === 'preview' && previewKind === 'pdf' ? snapshotBodyBytes(response) : null),
    [mode, previewKind, response],
  );

  // Binary has no wire text: the language half of the picker and the
  // Raw view stand down, leaving the byte-faithful views.
  const encodingViews = isBinary ? ENCODING_VIEWS.filter((v) => v.mode !== 'raw') : ENCODING_VIEWS;
  const pickerItems: MenuProps['items'] = [
    ...(isBinary
      ? []
      : [
          ...LANGUAGE_OPTIONS.map((opt) => ({
            key: `lang:${opt.value}`,
            label: <PickerLabel icon={opt.value} text={opt.label} />,
          })),
          { type: 'divider' as const },
        ]),
    ...encodingViews.map((view) => ({
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
  // otherwise. Binary in Preview shows its base view (Hex) — the one a
  // picker click falls back to.
  const activeEncoding = ENCODING_VIEWS.find((v) => v.mode === mode);
  const pickerKey = activeEncoding ? `view:${activeEncoding.mode}` : isBinary ? 'view:hex' : `lang:${language}`;
  const pickerIcon = activeEncoding ? activeEncoding.mode : isBinary ? 'hex' : language;
  const pickerLabel = activeEncoding ? activeEncoding.label : isBinary ? 'Hex' : getLanguage(language).label;

  // Picker and Preview act as a two-way toggle: the active side carries
  // a quiet selected fill, the other renders as plain text. While
  // Preview holds the selection, the picker's first click only takes it
  // back (no menu); the menu opens on a click while already selected.
  const pickerSelected = mode !== 'preview';
  const onPickerOpenChange = (next: boolean) => {
    if (next && !pickerSelected) {
      setMode(isBinary ? 'hex' : 'pretty');
      return;
    }
    setPickerOpen(next);
  };

  // Copies what the pane is showing: the filtered result while the
  // filter bar is active (the last match while the query is mid-edit),
  // the wire body otherwise.
  const copyBody = () => {
    void navigator.clipboard.writeText(shownFiltered ?? response.body).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  };

  // An empty body renders the normal pane (picker, wrap, copy) with an
  // empty one-line buffer — a 204 or empty POST response is still a
  // response, and a centered "Empty body" placeholder read as if the
  // panel were broken. Preview / filter stay hidden naturally (nothing
  // parses).
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', paddingBottom: 8 }}>
      {response.requestBodyOmitted && (
        <Text type="warning" style={{ fontSize: 11, marginTop: 6 }}>
          {t('workbench.editors.request.response.body.requestBodyOmittedNotice')}
        </Text>
      )}
      {response.bodyTruncated && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
          <Text type="warning" style={{ fontSize: 11 }}>
            {t('workbench.editors.request.response.body.truncatedNotice', {
              cap: formatBytes(response.bodyCapBytes ?? BODY_CAP_BYTES),
              size: formatBytes(response.bodyBytes),
            })}
          </Text>
          {openSettings ? (
            <Button
              size="small"
              type="link"
              style={{ fontSize: 11, padding: 0, height: 'auto' }}
              onClick={() => openSettings({ settingKey: 'requests.responseBodyCapMB' })}
            >
              {t('workbench.editors.request.response.body.increaseLimit')}
            </Button>
          ) : (
            <Text type="secondary" style={{ fontSize: 11 }}>
              {t('workbench.editors.request.response.body.limitHint')}
            </Text>
          )}
        </div>
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
              aria-label={t('workbench.editors.request.response.body.viewPickerAria')}
              style={pickerSelected ? { background: token.colorBgTextActive } : undefined}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <ViewPickerIcon id={pickerIcon} size={14} />
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
            {t('workbench.editors.request.response.body.preview')}
          </Button>
        )}
        <Tooltip
          title={
            wrapLines
              ? t('workbench.editors.request.response.body.unwrapLines')
              : t('workbench.editors.request.response.body.wrapLines')
          }
          placement="bottom"
        >
          <Button
            size="small"
            type="text"
            icon={<WrapLinesIcon />}
            onClick={() => setWrapLines((prev) => !prev)}
            aria-label={t('workbench.editors.request.response.body.wrapLines')}
            style={{ marginLeft: 'auto', ...(wrapLines ? { background: token.colorBgTextActive } : {}) }}
          />
        </Tooltip>
        {filterKind && (
          <Tooltip
            title={
              filterKind === 'jsonpath'
                ? t('workbench.editors.request.response.body.filterJsonPathTooltip')
                : t('workbench.editors.request.response.body.filterXPathTooltip')
            }
            placement="bottom"
          >
            {/* Dot marks an active query — the bar itself can scroll out
                of mind while its filter still narrows the pane. The
                transparent colorBorderBg drops the badge's contrast ring
                (it feeds badgeShadowColor) so only the plain dot shows. */}
            <ConfigProvider theme={{ token: { colorBorderBg: 'transparent' } }}>
              <Badge dot={filterApplied} color={token.colorPrimary} offset={[-4, 4]}>
                <Button
                  size="small"
                  type="text"
                  icon={<FilterOutlined />}
                  aria-label={t('workbench.editors.request.response.body.filterAria')}
                  style={filterOpen ? { background: token.colorBgTextActive } : undefined}
                  onClick={() => {
                    if (!filterOpen && mode !== 'pretty') setMode('pretty');
                    setFilterOpen((prev) => !prev);
                  }}
                />
              </Badge>
            </ConfigProvider>
          </Tooltip>
        )}
        <span
          aria-hidden="true"
          style={{ width: 1, height: 16, background: token.colorBorderSecondary, margin: '0 2px' }}
        />
        <Tooltip
          title={
            copied
              ? t('workbench.editors.request.response.copied')
              : t('workbench.editors.request.response.copyBody')
          }
          placement="bottom"
        >
          <Button
            size="small"
            type="text"
            icon={copied ? <CheckOutlined /> : <CopyOutlined />}
            onClick={copyBody}
            aria-label={t('workbench.editors.request.response.copyBody')}
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
                ? t('workbench.editors.request.response.body.invalidJsonPath')
                : t('workbench.editors.request.response.body.invalidXPath')}
              {lastMatch !== null && ` ${t('workbench.editors.request.response.body.showingLastMatch')}`}
            </Text>
          )}
          {filterResult?.ok && filterResult.matches.length === 0 && (
            <Text type="secondary" style={{ fontSize: 11 }}>
              {t('workbench.editors.request.response.body.noMatches')}
              {lastMatch !== null && ` ${t('workbench.editors.request.response.body.showingLastMatch')}`}
            </Text>
          )}
        </div>
      )}
      {mode === 'pretty' && (
        <div style={{ flex: 1, minHeight: 0 }}>
          <CodeEditor
            value={shownFiltered ?? pretty}
            language={language}
            readOnly
            fill
            variableAutoComplete={false}
            wordWrapOverride={wrapLines ? 'on' : 'off'}
          />
        </div>
      )}
      {mode === 'raw' && (
        <div style={{ flex: 1, overflow: 'auto', overscrollBehavior: 'none', minHeight: 0 }}>
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
              {t('workbench.editors.request.response.body.hexCapNotice', {
                shown: formatBytes(hexDump.shownBytes),
                total: formatBytes(hexDump.totalBytes),
              })}
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
            {/* Rows whose bytes carry a detected file signature render
                their ASCII column highlighted (hover names the format);
                everything else stays one cheap text node per run. */}
            {hexDump.pieces.map((piece, i) => {
              const nl = i < hexDump.pieces.length - 1 ? '\n' : '';
              if (piece.kind === 'plain') return `${piece.text}${nl}`;
              return (
                // biome-ignore lint/suspicious/noArrayIndexKey: pieces are positional derivations of one immutable dump
                <span key={i}>
                  {piece.head}
                  <span title={piece.label} style={{ color: token.colorInfoText, fontWeight: 600 }}>
                    {piece.ascii}
                  </span>
                  {nl}
                </span>
              );
            })}
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
      {mode === 'preview' && previewKind === 'pdf' && pdfBytes && <ResponsePdfPreview bytes={pdfBytes} />}
      {mode === 'preview' && previewKind === 'json' && <ResponseJsonPreview value={parsedJson} />}
      {mode === 'preview' && previewKind === 'html' && (
        <iframe
          title={t('workbench.editors.request.response.body.previewIframeTitle')}
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
