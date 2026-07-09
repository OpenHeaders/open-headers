/**
 * ExampleResponsePanel — the response half of the example editor's
 * split. Mirrors the live ResponsePanel's shell (one tab-bar row: Body ·
 * Headers tabs left, meta + layout toggle right). The status chip looks
 * exactly like the live meta strip's; clicking it swaps in a searchable
 * code picker (curated codes + canonical reason phrases) that commits
 * code + phrase together. Size · duration stay read-only facts — size
 * recomputes from the edited body at save; duration is the captured
 * measurement. The captured final URL is carried through untouched.
 */

import { AlignLeftOutlined, DownOutlined } from '@ant-design/icons';
import type { CapturedResponse } from '@openheaders/core/types';
import { AutoComplete, Button, ConfigProvider, Dropdown, type MenuProps, Tabs, Tag, Tooltip, Typography, theme } from 'antd';
import type * as monaco from 'monaco-editor';
import type React from 'react';
import { useMemo, useRef, useState } from 'react';
import { listStatusCodes } from '@openheaders/ui/shared/info-popover/data/http-status';
import { SplitLayoutToggle } from '@openheaders/ui/shared/split-layout';
import { getLanguage, LANGUAGE_LIST, type LanguageId } from '../../languages/registry';
import KeyValueTable from '../request-editor/KeyValueTable';
import { detectBodyLanguage, formatBytes } from '../request-editor/response/response-format';
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
      <Tooltip title="Edit status code" placement="bottom">
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
      placeholder="Enter response code"
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
  /** Captured meta shown read-only beside the status chip. */
  meta: Pick<CapturedResponse, 'bodyBytes' | 'durationMs'>;
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
  const [activeTab, setActiveTab] = useState<'body' | 'headers'>('body');
  const patch = (p: Partial<ExampleResponseDraft>) => onChange({ ...value, ...p });

  const headerRows = value.headers.filter((r) => r.key.trim()).map((r) => ({ key: r.key, value: r.value }));
  const capturedAtDate = new Date(capturedAt);

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
                title={`Captured ${Number.isNaN(capturedAtDate.getTime()) ? capturedAt : capturedAtDate.toLocaleString()}`}
                placement="bottom"
              >
                <Text type="secondary" style={{ fontSize: 11, whiteSpace: 'nowrap', cursor: 'help' }}>
                  {meta.durationMs} ms · {formatBytes(meta.bodyBytes)}
                </Text>
              </Tooltip>
              <SplitLayoutToggle layout={layout} onChange={onLayoutChange} />
            </div>
          ),
        }}
        items={[
          {
            key: 'body',
            label: 'Body',
            children: (
              <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
                  <ConfigProvider theme={{ token: { fontSize: 12 }, components: { Dropdown: { paddingBlock: 3 } } }}>
                    <Dropdown menu={languageMenu} trigger={['click']}>
                      <Button size="small" type="text" aria-label="Body language">
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <ViewPickerIcon id={language} size={14} />
                          {getLanguage(language).label}
                          <DownOutlined style={{ fontSize: 9, opacity: 0.65 }} />
                        </span>
                      </Button>
                    </Dropdown>
                  </ConfigProvider>
                  <Tooltip
                    title={formattable ? 'Format body' : `No formatter for ${getLanguage(language).label}`}
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
                      Format
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
            label: `Headers (${headerRows.length})`,
            children: (
              <div
                className="rules-thin-scrollbar"
                style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '8px 0' }}
              >
                <KeyValueTable
                  rows={value.headers}
                  onChange={(headers) => patch({ headers })}
                  hideEnabled
                  keyPlaceholder="Header"
                  valuePlaceholder="Value"
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
