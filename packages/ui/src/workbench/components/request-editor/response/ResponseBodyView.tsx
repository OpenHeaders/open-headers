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
 * Binary-like bodies (`bodyEncoding: 'base64'`, and PDFs regardless of
 * how their bytes decoded) drop the language half of the picker and
 * keep Postman's set — Raw / Hex / Base64: Raw shows the wire as text
 * (lossy U+FFFD where bytes aren't UTF-8), Hex and Base64 decode the
 * snapshot back to the exact wire bytes. Raw and Base64 carry a
 * line-number gutter; Hex numbers its rows.
 */

import {
  CheckOutlined,
  CopyOutlined,
  DownOutlined,
  EyeOutlined,
  FilterOutlined,
  FontColorsOutlined,
} from '@ant-design/icons';
import type { ExecutedRequestSnapshot } from '@openheaders/core/types';
import { Badge, Button, ConfigProvider, Dropdown, type MenuProps, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { useOpenSettings } from '../../../hooks/OpenSettingsContext';
import { getLanguage, LANGUAGE_LIST, type LanguageId } from '../../../languages/registry';
import CodeEditor from '../../shared/CodeEditor';
import ResponseFilterInput from './ResponseFilterInput';
import ResponseImagePreview from './ResponseImagePreview';
import ResponseJsonPreview from './ResponseJsonPreview';
import ResponseMediaPreview from './ResponseMediaPreview';
import ResponsePdfPreview from './ResponsePdfPreview';
import { ViewPickerIcon, WrapLinesIcon } from './ViewPickerIcons';
import { type LosslessParseResult, parseLosslessJson, stringifyLossless } from './lossless-json';
import { detectMagicSignatures } from './magic-signatures';
import { ansiRunStyle, buildAnsiPalette, hasAnsiEscapes, parseAnsiBody, stripAnsiEscapes } from './response-ansi';
import './response-body.css';
import {
  buildHexDump,
  decodeBodyTextLossy,
  encodeBodyBytes,
  formatBase64Lines,
  snapshotBodyBytes,
  toBase64,
} from './response-encoding';
import {
  evaluateJsonPath,
  evaluateXPath,
  normalizeFilterQuery,
  suggestJsonPathCompletions,
  suggestXPathCompletions,
} from './response-filter';
import {
  contentTypeOf,
  detectBodyLanguage,
  formatBytes,
  isNdjsonResponse,
  isPdfResponse,
  mediaPreviewKind,
  prettyBody,
  prettyNdjsonBody,
  sniffsAsMetricsBody,
} from './response-format';
import {
  evaluateMetricsFilter,
  metricsSuggestionLabel,
  parseMetricsBody,
  suggestMetricsCompletions,
} from './response-metrics-filter';
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

/** Line cap for the Raw view's numbered grid — beyond this the per-line
 *  rows would jank the panel, so Raw falls back to one plain `<pre>`. */
const RAW_GUTTER_MAX_LINES = 5000;

/** Shared column style for the Hex view's three `<pre>`s — the gutter,
 *  the offsets, and the dump must line up row for row. */
const HEX_PRE_STYLE: React.CSSProperties = {
  fontFamily: "'SF Mono', 'Fira Code', monospace",
  fontSize: 12,
  margin: 0,
  whiteSpace: 'pre',
};

function PickerLabel({ icon, text }: { icon: string; text: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <ViewPickerIcon id={icon} size={16} />
      {text}
    </span>
  );
}

/** The view a fresh response opens on: media families (PDF, images,
 *  audio/video) go straight to Preview — the rendered document is the
 *  answer; other binary bodies open on Hex (the only faithful
 *  text-free view), text on Pretty. */
function initialMode(response: ExecutedRequestSnapshot): ViewMode {
  if (mediaPreviewKind(response.headers) !== null) return 'preview';
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
  const mediaKind = mediaPreviewKind(response.headers);
  const isPdf = isPdfResponse(response.headers);
  // Binary-LIKE drives the view set: a PDF keeps the Raw/Hex/Base64
  // picker even when its bytes happen to decode as text (all-ASCII
  // PDFs exist; the document is still not a text body).
  const binaryView = isBinary || isPdf;
  // Content-Type detection first; a plain-text body whose leading lines
  // fit the exposition grammar DEFAULTS to the Prometheus view (bare
  // text/plain /metrics endpoints) — a manual override always wins.
  const language = useMemo<LanguageId>(() => {
    if (langOverride) return langOverride;
    const detected = detectBodyLanguage(response.headers);
    if (detected === 'text' && !isBinary && sniffsAsMetricsBody(response.body)) return 'prometheus';
    return detected;
  }, [langOverride, response.headers, response.body, isBinary]);
  const isNdjson = isNdjsonResponse(response.headers);
  // JSON re-indents synchronously (newline-delimited JSON line-wise,
  // each record its own block); markup/code languages swap in the
  // Prettier result when it resolves (wire text paints first).
  const pretty = useFormattedBody(
    useMemo(
      () =>
        isNdjson && language === 'json' ? prettyNdjsonBody(response.body) : prettyBody(response.body, language),
      [response.body, language, isNdjson],
    ),
    language,
  );

  // Parsed body for the JSON tree preview — `undefined` when the viewer
  // language isn't JSON or the body doesn't parse. Binary never parses:
  // the body string is base64, whose digit-only edge cases would
  // otherwise "parse" as a JSON number. Newline-delimited JSON can
  // never whole-body-parse, so it parses line-wise into an array —
  // the tree preview and JSONPath filter see the record list. Parsing
  // is lossless: numbers a double can't hold stay as source-text
  // leaves, and duplicate object keys are reported (last value wins,
  // like JSON.parse — the notice below says so).
  const parsed = useMemo<LosslessParseResult | undefined>(() => {
    if (isBinary || language !== 'json') return undefined;
    if (isNdjson) {
      const lines = response.body.split('\n').filter((line) => line.trim() !== '');
      if (lines.length === 0) return undefined;
      const records: unknown[] = [];
      const duplicateKeys: string[] = [];
      for (const line of lines) {
        const record = parseLosslessJson(line);
        if (record === null) return undefined;
        records.push(record.value);
        for (const key of record.duplicateKeys) {
          if (!duplicateKeys.includes(key)) duplicateKeys.push(key);
        }
      }
      return { value: records, duplicateKeys };
    }
    return parseLosslessJson(response.body) ?? undefined;
  }, [response.body, language, isBinary, isNdjson]);
  const parsedJson = parsed?.value;

  // Media previews come from the Content-Type (they name a RENDERER,
  // not the body's textness) and sit above the binary gate so a raster
  // image still previews; html/json previews need parseable text.
  const previewKind: 'pdf' | 'image' | 'media' | 'html' | 'json' | null = isPdf
    ? 'pdf'
    : mediaKind === 'image'
      ? 'image'
      : mediaKind === 'audio' || mediaKind === 'video'
        ? 'media'
        : isBinary
          ? null
          : language === 'html'
            ? 'html'
            : parsedJson !== undefined
              ? 'json'
              : null;

  // A language override can take Preview away while it's the active
  // mode (e.g. HTML body overridden to Text) — fall back to the body's
  // base view (Hex for binary-like, Pretty otherwise).
  useEffect(() => {
    if (mode === 'preview' && !previewKind) setMode(binaryView ? 'hex' : 'pretty');
  }, [mode, previewKind, binaryView]);

  // Parsed family model for the metrics filter — one linear pass,
  // memoized per body, computed only while the Prometheus grammar is
  // active (multi-MB /metrics bodies parse once, never per keystroke).
  const metricsDoc = useMemo(
    () => (!isBinary && language === 'prometheus' ? parseMetricsBody(response.body) : undefined),
    [response.body, language, isBinary],
  );

  // Structural filter: JSONPath for parseable JSON, XPath for markup,
  // metric families for Prometheus bodies, nothing for languages
  // without a query form (Find covers those) — and nothing for binary,
  // which has no text to query.
  const filterKind: 'jsonpath' | 'xpath' | 'metrics' | null = isBinary
    ? null
    : language === 'json' && parsedJson !== undefined
      ? 'jsonpath'
      : language === 'xml' || language === 'html'
        ? 'xpath'
        : language === 'prometheus'
          ? 'metrics'
          : null;

  // A language override can take the filter away — close the bar.
  useEffect(() => {
    if (!filterKind && filterOpen) setFilterOpen(false);
  }, [filterKind, filterOpen]);

  const filterApplied = filterOpen && filterKind !== null && filterQuery.trim() !== '';
  const filterResult = useMemo(() => {
    if (!filterApplied || !filterKind) return null;
    // Metrics queries carry their own mid-edit forgiveness (a dangling
    // matcher fragment evaluates the completed part).
    if (filterKind === 'metrics') {
      return metricsDoc ? evaluateMetricsFilter(metricsDoc, filterQuery) : null;
    }
    // Normalized: a trailing separator means "descend", not an error.
    const query = normalizeFilterQuery(filterQuery, filterKind);
    if (filterKind === 'jsonpath') return evaluateJsonPath(parsedJson, query);
    return evaluateXPath(response.body, query, language === 'xml' ? 'xml' : 'html');
  }, [filterApplied, filterKind, filterQuery, parsedJson, metricsDoc, response.body, language]);

  // What Pretty shows while the filter matches: the single match, or
  // the match list (JSON as an array; markup and metric-family blocks
  // joined line-wise — XPath matches serialize single-line, metrics
  // matches are verbatim exposition lines). Null while the query is
  // invalid or hits nothing.
  const filteredDisplay = useFormattedBody(
    useMemo(() => {
      if (!filterResult?.ok || filterResult.matches.length === 0) return null;
      if (filterKind === 'jsonpath') {
        // Lossless print — a matched big number must show verbatim.
        const m = filterResult.matches;
        return stringifyLossless(m.length === 1 ? m[0] : m);
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
  const hexLineNumbers = useMemo(
    () => (hexDump ? Array.from({ length: hexDump.rowCount }, (_, i) => i + 1).join('\n') : ''),
    [hexDump],
  );
  const base64Lines = useMemo(
    () =>
      mode === 'base64'
        ? formatBase64Lines(isBinary ? response.body : toBase64(encodeBodyBytes(response.body)))
        : null,
    [mode, response.body, isBinary],
  );
  const base64LineNumbers = useMemo(
    () => (base64Lines ? base64Lines.map((_, i) => i + 1).join('\n') : ''),
    [base64Lines],
  );
  // Raw shows the wire as text — for a binary body that's a lossy
  // display decode (U+FFFD where bytes aren't UTF-8), never the stored
  // base64 string.
  const rawText = useMemo(() => (mode === 'raw' ? decodeBodyTextLossy(response) : null), [mode, response]);
  const rawLines = useMemo(() => (rawText === null ? null : rawText.split('\n')), [rawText]);
  // ANSI SGR rendering for log bodies: `ESC [` in the display text
  // lights it (bytes decide, never the Content-Type); the toggle falls
  // back to the verbatim plain text. Display-only — Copy stays the
  // wire body. The parse is one pass, memoized per body, and computed
  // only inside the gutter cap (beyond it Raw must stay one text node,
  // so the fallback strips escapes instead of styling them).
  const rawHasAnsi = rawText !== null && hasAnsiEscapes(rawText);
  const [ansiPlain, setAnsiPlain] = useState(false);
  const ansiActive = rawHasAnsi && !ansiPlain;
  const ansiLines = useMemo(
    () =>
      ansiActive && rawText !== null && rawLines !== null && rawLines.length <= RAW_GUTTER_MAX_LINES
        ? parseAnsiBody(rawText)
        : null,
    [ansiActive, rawText, rawLines],
  );
  const strippedRawText = useMemo(
    () =>
      ansiActive && rawText !== null && rawLines !== null && rawLines.length > RAW_GUTTER_MAX_LINES
        ? stripAnsiEscapes(rawText)
        : null,
    [ansiActive, rawText, rawLines],
  );
  const ansiPalette = useMemo(() => buildAnsiPalette(token), [token]);
  const previewBytes = useMemo(
    () =>
      mode === 'preview' && (previewKind === 'pdf' || previewKind === 'image' || previewKind === 'media')
        ? snapshotBodyBytes(response)
        : null,
    [mode, previewKind, response],
  );

  // Binary-like bodies have no meaningful language: the language half
  // of the picker stands down, leaving Postman's Raw / Hex / Base64.
  const pickerItems: MenuProps['items'] = [
    ...(binaryView
      ? []
      : [
          ...LANGUAGE_OPTIONS.map((opt) => ({
            key: `lang:${opt.value}`,
            label: <PickerLabel icon={opt.value} text={opt.label} />,
          })),
          { type: 'divider' as const },
        ]),
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
  // otherwise. Binary in Preview shows its base view (Hex) — the one a
  // picker click falls back to.
  const activeEncoding = ENCODING_VIEWS.find((v) => v.mode === mode);
  const pickerKey = activeEncoding ? `view:${activeEncoding.mode}` : binaryView ? 'view:hex' : `lang:${language}`;
  const pickerIcon = activeEncoding ? activeEncoding.mode : binaryView ? 'hex' : language;
  const pickerLabel = activeEncoding ? activeEncoding.label : binaryView ? 'Hex' : getLanguage(language).label;

  // Picker and Preview act as a two-way toggle: the active side carries
  // a quiet selected fill, the other renders as plain text. While
  // Preview holds the selection, the picker's first click only takes it
  // back (no menu); the menu opens on a click while already selected.
  const pickerSelected = mode !== 'preview';
  const onPickerOpenChange = (next: boolean) => {
    if (next && !pickerSelected) {
      setMode(binaryView ? 'hex' : 'pretty');
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
      {parsed !== undefined && parsed.duplicateKeys.length > 0 && (
        <Text type="warning" style={{ fontSize: 11, marginTop: 6 }}>
          {t('workbench.editors.request.response.body.duplicateJsonKeysNotice', {
            keys: parsed.duplicateKeys.join(', '),
          })}
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
            // Toggling Preview off lands on the body's base view — Hex
            // for binary-like bodies (Pretty would paint the stored
            // base64 into Monaco), Pretty otherwise.
            onClick={() => setMode(mode === 'preview' ? (binaryView ? 'hex' : 'pretty') : 'preview')}
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
        {mode === 'raw' && rawHasAnsi && (
          <Tooltip
            title={
              ansiPlain
                ? t('workbench.editors.request.response.body.renderAnsi')
                : t('workbench.editors.request.response.body.plainAnsi')
            }
            placement="bottom"
          >
            <Button
              size="small"
              type="text"
              icon={<FontColorsOutlined />}
              data-testid="oh-response-ansi-toggle"
              onClick={() => setAnsiPlain((prev) => !prev)}
              aria-label={t('workbench.editors.request.response.body.renderAnsi')}
              style={ansiPlain ? undefined : { background: token.colorBgTextActive }}
            />
          </Tooltip>
        )}
        {filterKind && (
          <Tooltip
            title={
              filterKind === 'jsonpath'
                ? t('workbench.editors.request.response.body.filterJsonPathTooltip')
                : filterKind === 'metrics'
                  ? t('workbench.editors.request.response.body.filterMetricsTooltip')
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
                : filterKind === 'metrics'
                  ? 'Filter metric families — http, http_requests_total{code="500"}, {job=~"api.*"}'
                  : 'Filter with XPath — //item/name, /html/head/title'
            }
            hasError={filterResult !== null && !filterResult.ok}
            getSuggestions={(query) =>
              filterKind === 'jsonpath'
                ? suggestJsonPathCompletions(parsedJson, query)
                : filterKind === 'metrics'
                  ? metricsDoc
                    ? suggestMetricsCompletions(metricsDoc, query)
                    : []
                  : suggestXPathCompletions(response.body, language === 'xml' ? 'xml' : 'html', query)
            }
            getSuggestionLabel={filterKind === 'metrics' ? metricsSuggestionLabel : undefined}
          />
          {filterResult && !filterResult.ok && (
            <Text type="danger" style={{ fontSize: 11 }}>
              {filterKind === 'jsonpath'
                ? t('workbench.editors.request.response.body.invalidJsonPath')
                : filterKind === 'metrics'
                  ? t('workbench.editors.request.response.body.invalidMetricsFilter')
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
      {mode === 'raw' && rawLines && (
        <div style={{ flex: 1, overflow: 'auto', overscrollBehavior: 'none', minHeight: 0 }}>
          {rawLines.length <= RAW_GUTTER_MAX_LINES ? (
            // Numbered grid — one row per logical line, so a wrapped
            // line and its number stay height-aligned. Numbers render
            // as ::before pseudo-content (see response-body.css): they
            // never enter textContent, selection, or copies — e2e reads
            // the same `oh-response-body` element and sees body only.
            <div
              data-testid="oh-response-body"
              className="oh-response-raw-grid"
              style={{ fontFamily: "'SF Mono', 'Fira Code', monospace", fontSize: 12, color: token.colorText }}
            >
              {rawLines.map((line, i) => {
                // ANSI rendering swaps in the parsed line: still a plain
                // string for escape-free lines (the fast path), spans
                // only where a style run actually paints.
                const shown = ansiLines ? ansiLines[i] : line;
                return (
                  // biome-ignore lint/suspicious/noArrayIndexKey: lines are positional derivations of one immutable body
                  <Fragment key={i}>
                    <span
                      className="oh-response-raw-ln"
                      aria-hidden="true"
                      data-ln={i + 1}
                      style={{ color: token.geekblue7 }}
                    />
                    <span
                      style={{
                        whiteSpace: wrapLines ? 'pre-wrap' : 'pre',
                        wordBreak: wrapLines ? 'break-word' : 'normal',
                        minHeight: '1em',
                      }}
                    >
                      {typeof shown === 'string'
                        ? shown
                        : shown.map((run, j) =>
                            run.style === null ? (
                              run.text
                            ) : (
                              // biome-ignore lint/suspicious/noArrayIndexKey: runs are positional derivations of one immutable line
                              <span key={j} style={ansiRunStyle(run.style, ansiPalette)}>
                                {run.text}
                              </span>
                            ),
                          )}
                    </span>
                  </Fragment>
                );
              })}
            </div>
          ) : (
            // Beyond the gutter cap the per-line grid would jank the
            // panel — fall back to the single-text-node <pre>. With ANSI
            // rendering active the escapes strip (still one text node —
            // per-run spans would defeat the cap's purpose).
            <pre
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
              {strippedRawText ?? rawLines.join('\n')}
            </pre>
          )}
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
          {/* Three columns, each ONE text node regardless of row count
              (a 512 KB dump is 32k rows — per-row elements would jank):
              line-number gutter (sticky through horizontal scroll),
              colored offsets, then the dump itself. Only rows carrying
              a detected file signature split off spans, so their ASCII
              column highlights (hover names the format). */}
          <div style={{ display: 'flex', width: 'fit-content', minWidth: '100%' }}>
            <pre
              aria-hidden="true"
              style={{
                ...HEX_PRE_STYLE,
                color: token.geekblue7,
                textAlign: 'right',
                userSelect: 'none',
                position: 'sticky',
                left: 0,
                background: token.colorBgContainer,
                paddingRight: 12,
                minWidth: 34,
              }}
            >
              {hexLineNumbers}
            </pre>
            <pre data-testid="oh-response-hex-offsets" style={{ ...HEX_PRE_STYLE, color: token.magenta7 }}>
              {hexDump.offsetsText}
            </pre>
            <pre data-testid="oh-response-hex" style={{ ...HEX_PRE_STYLE, color: token.colorText }}>
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
        </div>
      )}
      {mode === 'base64' && base64Lines && (
        <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          {/* Fixed-width base64 rows (the classic 76-char MIME line)
              never wrap, so the gutter and content stay two single
              text nodes at any size — same layout as the Hex view. */}
          <div style={{ display: 'flex', width: 'fit-content', minWidth: '100%' }}>
            <pre
              aria-hidden="true"
              style={{
                ...HEX_PRE_STYLE,
                color: token.geekblue7,
                textAlign: 'right',
                userSelect: 'none',
                position: 'sticky',
                left: 0,
                background: token.colorBgContainer,
                paddingRight: 12,
                minWidth: 34,
              }}
            >
              {base64LineNumbers}
            </pre>
            <pre data-testid="oh-response-base64" style={{ ...HEX_PRE_STYLE, color: token.colorText }}>
              {base64Lines.join('\n')}
            </pre>
          </div>
        </div>
      )}
      {mode === 'preview' && previewKind === 'pdf' && previewBytes && <ResponsePdfPreview bytes={previewBytes} />}
      {mode === 'preview' && previewKind === 'image' && previewBytes && (
        <ResponseImagePreview
          bytes={previewBytes}
          mimeType={contentTypeOf(response.headers).split(';')[0].trim()}
        />
      )}
      {mode === 'preview' && previewKind === 'media' && previewBytes && (
        <ResponseMediaPreview
          bytes={previewBytes}
          mimeType={contentTypeOf(response.headers).split(';')[0].trim()}
          kind={mediaKind === 'audio' ? 'audio' : 'video'}
        />
      )}
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
