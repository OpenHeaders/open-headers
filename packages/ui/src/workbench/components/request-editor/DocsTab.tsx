/**
 * DocsTab — free-form markdown notes for the request, persisted as the
 * optional `description` field on the `Request` schema.
 *
 * Read-first: docs are read far more often than written, so a request
 * that already has docs opens in Preview (rendered markdown); an empty
 * one opens in Write. The sticky header row carries the Write/Preview
 * toggle plus, in Write mode, a GitHub-style formatting toolbar that
 * inserts markdown around the Monaco selection (⌘B / ⌘I / ⌘K also
 * registered) — the source stays plain markdown, no rich-text fork.
 * Preview highlights fenced code via Monaco's tokenizer
 * (`HighlightedCodeBlock`) and chips `{{variable}}` references.
 */

import { Segmented, Typography, theme } from 'antd';
import type React from 'react';
import { useState } from 'react';
import { InfoTrigger } from '@openheaders/ui/shared/info-popover';
import { MarkdownView } from '@openheaders/ui/shared/markdown';
import CodeEditor from '../shared/CodeEditor';
import HighlightedCodeBlock from '../shared/HighlightedCodeBlock';
import { type MarkdownEditor, registerMarkdownShortcuts } from '../shared/markdown-commands';
import MarkdownToolbar from '../shared/MarkdownToolbar';

const { Text } = Typography;

type DocsMode = 'write' | 'preview';

const DOCS_PLACEHOLDER = 'What does this request do?\nWhy it exists, when to run it, expected auth scope.';

const renderDocsCodeBlock = (code: string, lang?: string) => <HighlightedCodeBlock code={code} lang={lang} />;

interface DocsTabProps {
  value: string;
  onChange: (value: string) => void;
}

const DocsTab: React.FC<DocsTabProps> = ({ value, onChange }) => {
  const { token } = theme.useToken();
  const [mode, setMode] = useState<DocsMode>(() => (value.trim() ? 'preview' : 'write'));
  const [editor, setEditor] = useState<MarkdownEditor | null>(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          position: 'sticky',
          top: 0,
          zIndex: 5,
          background: token.colorBgContainer,
          paddingBottom: 4,
        }}
      >
        <Segmented
          size="small"
          value={mode}
          onChange={(next) => setMode(next as DocsMode)}
          options={[
            { value: 'write', label: 'Write' },
            { value: 'preview', label: 'Preview' },
          ]}
        />
        <InfoTrigger
          content={{
            title: 'Docs',
            summary:
              'Document this request — why it exists, when to run it, expected auth scope. Markdown supported: headings, lists, tables, code blocks, links. {{variable}} references render as chips in the preview.',
          }}
        />
        {mode === 'write' && (
          <div style={{ marginLeft: 10 }}>
            <MarkdownToolbar editor={editor} />
          </div>
        )}
      </div>
      {mode === 'write' ? (
        <CodeEditor
          value={value}
          onChange={onChange}
          language="markdown"
          minHeight={280}
          placeholder={DOCS_PLACEHOLDER}
          variableAutoComplete={false}
          onEditorMount={(ed, monacoApi) => {
            setEditor(ed);
            registerMarkdownShortcuts(ed, monacoApi);
          }}
        />
      ) : value.trim() ? (
        <MarkdownView renderCodeBlock={renderDocsCodeBlock}>{value}</MarkdownView>
      ) : (
        <Text type="secondary" style={{ fontSize: 12, padding: '24px 0', textAlign: 'center' }}>
          Nothing documented yet — switch to Write to add notes.
        </Text>
      )}
    </div>
  );
};

export default DocsTab;
