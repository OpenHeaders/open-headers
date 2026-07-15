/**
 * ExampleResponsePanel — the response half of the example editor's
 * split. Mirrors the live ResponsePanel's shell (one tab-bar row: Body ·
 * Headers tabs left, meta + a ⋯ split-orientation menu right). The status chip looks
 * exactly like the live meta strip's; clicking it swaps in a searchable
 * code picker (curated codes + canonical reason phrases) that commits
 * code + phrase together. Size · duration stay read-only facts — size
 * recomputes from the edited body at save; duration is the captured
 * measurement. The captured final URL is carried through untouched.
 */

import { AlignLeftOutlined, DownOutlined, EllipsisOutlined } from '@ant-design/icons';
import type { CapturedResponse, ExecutedRequestSnapshot } from '@openheaders/core/types';
import { AutoComplete, Button, ConfigProvider, Dropdown, type MenuProps, Tabs, Tag, Tooltip, Typography, theme } from 'antd';
import type * as monaco from 'monaco-editor';
import type React from 'react';
import { useMemo, useRef, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { listStatusCodes } from '@openheaders/ui/shared/info-popover/data/http-status';
import { useSplitLayoutMenuItems } from '@openheaders/ui/shared/split-layout';
import { getLanguage, LANGUAGE_LIST, type LanguageId } from '../../languages/registry';
import KeyValueTable from '../request-editor/KeyValueTable';
import ResponseBodyView from '../request-editor/response/ResponseBodyView';
import { detectBodyLanguage, formatBytes, isPdfResponse } from '../request-editor/response/response-format';
import { ViewPickerIcon } from '../request-editor/response/ViewPickerIcons';
import type { RequestEditorLayout } from '../request-editor/useRequestEditorLayout';
import CodeEditor from '../shared/CodeEditor';
import { type ExampleResponseDraft, parseStatusInput } from './example-draft';

const { Text } = Typography;

/** Same language list the live response body picker offers. */
const LANGUAGE_OPTIONS = LANGUAGE_LIST.filter((l) => l.id !== 'graphql');

/** Languages with a registered Monaco formatter (built-in LSP or the
 *  Prettier provider) — mirrors CodeEditor's own gate. */
const FORMATTABLE_LANGUAGES: ReadonlySet<LanguageId> = new Set(['javascript', 'json', 'css', 'html', 'xml']);

const StatusCodePicker: React.FC<{
  status: number;
  statusText: string;
  onCommit: (next: { status: number; statusText: string }) => void;
}> = ({ status, statusText, onCommit }) => {
  const { token } = theme.useToken();
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');

  const statusColor =
    status >= 500
      ? token.colorError
      : status >= 400
        ? token.colorWarning
        : status >= 200 && status < 300
          ? token.colorSuccess
          : token.colorTextSecondary;

  const options = useMemo(() => listStatusCodes().map(({ code, phrase }) => ({ value: `${code} ${phrase}` })), []);

  const commit = (input: string) => {
    setEditing(false);
    const parsed = parseStatusInput(input);
    if (parsed) onCommit(parsed);
  };

  if (!editing) {
    return (
      <Tooltip title={t('workbench.editors.responseExample.editStatus')} placement="bottom">
        <Tag
          color="default"
          role="button"
          tabIndex={0}
          style={{ color: statusColor, borderColor: statusColor, marginInlineEnd: 0, cursor: 'pointer' }}
          onClick={() => {
            setText('');
            setEditing(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setText('');
              setEditing(true);
            }
          }}
        >
          {status} {statusText}
        </Tag>
      </Tooltip>
    );
  }

  return (
    <AutoComplete
      autoFocus
      defaultOpen
      size="small"
      style={{ width: 210 }}
      placeholder={t('workbench.editors.responseExample.statusPlaceholder')}
      value={text}
      onChange={setText}
      options={options}
      filterOption={(input, option) => (option?.value ?? '').toLowerCase().includes(input.toLowerCase())}
      onSelect={(value: string) => commit(value)}
      onBlur={() => commit(text)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit(text);
        if (e.key === 'Escape') setEditing(false);
      }}
    />
  );
};

interface ExampleResponsePanelProps {
  value: ExampleResponseDraft;
  onChange: (next: ExampleResponseDraft) => void;
  /** Captured meta shown read-only beside the status chip; the
   *  truncation facts feed the binary body pane's notice. */
  meta: Pick<CapturedResponse, 'bodyBytes' | 'durationMs' | 'bodyTruncated' | 'bodyCapBytes'>;
  capturedAt: string;
  layout: RequestEditorLayout;
  onLayoutChange: (next: RequestEditorLayout) => void;
}

const ExampleResponsePanel: React.FC<ExampleResponsePanelProps> = ({
  value,
  onChange,
  meta,
  capturedAt,
  layout,
  onLayoutChange,
}) => {
  const { token } = theme.useToken();
  const t = useT();
  const [activeTab, setActiveTab] = useState<'body' | 'headers'>('body');
  const layoutMenuItems = useSplitLayoutMenuItems(layout, onLayoutChange);
  const patch = (p: Partial<ExampleResponseDraft>) => onChange({ ...value, ...p });

  const headerRows = useMemo(
    () => value.headers.filter((r) => r.key.trim()).map((r) => ({ key: r.key, value: r.value })),
    [value.headers],
  );
  const capturedAtDate = new Date(capturedAt);

  // Binary-like bodies (captured base64, or a PDF media type — same
  // law as the live panel) are not hand-editable text: the Body tab
  // renders the live viewer (Raw / Hex / Base64 + Preview) read-only
  // over the captured bytes instead of Monaco. The snapshot identity
  // must hold across unrelated re-renders — ResponseBodyView resets
  // its view mode when the response object changes.
  const binaryView = value.bodyEncoding === 'base64' || isPdfResponse(headerRows);
  const binarySnapshot = useMemo<ExecutedRequestSnapshot | null>(() => {
    if (!binaryView) return null;
    return {
      status: value.status,
      statusText: value.statusText,
      url: value.url,
      headers: headerRows,
      body: value.body,
      ...(value.bodyEncoding === undefined ? {} : { bodyEncoding: value.bodyEncoding }),
      bodyTruncated: meta.bodyTruncated,
      ...(meta.bodyCapBytes === undefined ? {} : { bodyCapBytes: meta.bodyCapBytes }),
      bodyBytes: meta.bodyBytes,
      durationMs: meta.durationMs,
      error: null,
    };
  }, [
    binaryView,
    value.status,
    value.statusText,
    value.url,
    value.body,
    value.bodyEncoding,
    headerRows,
    meta.bodyTruncated,
    meta.bodyCapBytes,
    meta.bodyBytes,
    meta.durationMs,
  ]);

  // Body language: auto-detected from the (edited) Content-Type header,
  // user-overridable via the same picker the live response body offers.
  // The choice drives highlighting AND which formatter Format invokes.
  const [langOverride, setLangOverride] = useState<LanguageId | null>(null);
  const language = langOverride ?? detectBodyLanguage(headerRows);
  const bodyEditorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const formattable = FORMATTABLE_LANGUAGES.has(language);
  const runFormat = () => {
    // Same document-format action CodeEditor's own cluster invokes —
    // parse failures surface through its inline error banner.
    void bodyEditorRef.current?.getAction('editor.action.formatDocument')?.run();
  };

  const languageMenu: MenuProps = {
    items: LANGUAGE_OPTIONS.map((l) => ({
      key: l.id,
      label: (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
          <ViewPickerIcon id={l.id} size={16} />
          {l.label}
        </span>
      ),
    })),
    onClick: ({ key }) => setLangOverride(key as LanguageId),
    selectable: true,
    selectedKeys: [language],
  };

  return (
    <div
      className="rules-thin-scrollbar"
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        minWidth: 0,
        background: token.colorBgContainer,
      }}
    >
      <Tabs
        size="small"
        activeKey={activeTab}
        onChange={(k) => setActiveTab(k as 'body' | 'headers')}
        className="rules-response-tabs"
        style={{ flex: 1, padding: '0 16px', display: 'flex', flexDirection: 'column', minHeight: 0 }}
        tabBarStyle={{ marginBottom: 0 }}
        tabBarExtraContent={{
          right: (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, paddingLeft: 12 }}>
              <StatusCodePicker
                status={value.status}
                statusText={value.statusText}
                onCommit={(next) => patch(next)}
              />
              <Tooltip
                title={t('workbench.editors.responseExample.capturedTooltip', {
                  date: Number.isNaN(capturedAtDate.getTime()) ? capturedAt : capturedAtDate.toLocaleString(),
                })}
                placement="bottom"
              >
                <Text type="secondary" style={{ fontSize: 11, whiteSpace: 'nowrap', cursor: 'help' }}>
                  {meta.durationMs} ms · {formatBytes(meta.bodyBytes)}
                </Text>
              </Tooltip>
              <Dropdown trigger={['click']} menu={{ items: layoutMenuItems }} overlayStyle={{ minWidth: 220 }}>
                <Button
                  size="small"
                  type="text"
                  icon={<EllipsisOutlined />}
                  aria-label={t('workbench.editors.responseExample.moreActionsAria')}
                />
              </Dropdown>
            </div>
          ),
        }}
        items={[
          {
            key: 'body',
            label: t('workbench.editors.responseExample.tab.body'),
            children: binarySnapshot ? (
              <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                <ResponseBodyView response={binarySnapshot} />
              </div>
            ) : (
              <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
                  <ConfigProvider theme={{ token: { fontSize: 12 }, components: { Dropdown: { paddingBlock: 3 } } }}>
                    <Dropdown menu={languageMenu} trigger={['click']}>
                      <Button size="small" type="text" aria-label={t('workbench.editors.responseExample.bodyLanguageAria')}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <ViewPickerIcon id={language} size={14} />
                          {getLanguage(language).label}
                          <DownOutlined style={{ fontSize: 9, opacity: 0.65 }} />
                        </span>
                      </Button>
                    </Dropdown>
                  </ConfigProvider>
                  <Tooltip
                    title={
                      formattable
                        ? t('workbench.editors.responseExample.formatBody')
                        : t('workbench.editors.responseExample.noFormatter', {
                            language: getLanguage(language).label,
                          })
                    }
                    placement="bottom"
                  >
                    <Button
                      size="small"
                      type="text"
                      icon={<AlignLeftOutlined />}
                      disabled={!formattable}
                      onClick={runFormat}
                      style={{ marginLeft: 'auto' }}
                    >
                      {t('workbench.editors.responseExample.format')}
                    </Button>
                  </Tooltip>
                </div>
                <div
                  style={{
                    flex: 1,
                    minHeight: 0,
                    marginBottom: 8,
                    border: `1px solid ${token.colorBorderSecondary}`,
                    borderRadius: 4,
                  }}
                >
                  <CodeEditor
                    value={value.body}
                    language={language}
                    onChange={(body) => patch({ body })}
                    onEditorMount={(editor) => {
                      bodyEditorRef.current = editor;
                    }}
                    fill
                    variableAutoComplete={false}
                  />
                </div>
              </div>
            ),
          },
          {
            key: 'headers',
            label: t('workbench.editors.responseExample.tab.headers', { count: headerRows.length }),
            children: (
              <div
                className="rules-thin-scrollbar"
                style={{ flex: 1, minHeight: 0, overflow: 'auto', overscrollBehavior: 'none', padding: '8px 0' }}
              >
                <KeyValueTable
                  rows={value.headers}
                  onChange={(headers) => patch({ headers })}
                  hideEnabled
                  keyPlaceholder={t('workbench.editors.request.headers.keyPlaceholder')}
                />
              </div>
            ),
          },
        ]}
      />
    </div>
  );
};

export default ExampleResponsePanel;
