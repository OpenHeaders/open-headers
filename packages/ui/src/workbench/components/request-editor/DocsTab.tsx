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
import { useT } from '@openheaders/ui/context/LocaleContext';
import { InfoTrigger } from '@openheaders/ui/shared/info-popover';
import { MarkdownView } from '@openheaders/ui/shared/markdown';
import CodeEditor from '../shared/CodeEditor';
import HighlightedCodeBlock from '../shared/HighlightedCodeBlock';
import { type MarkdownEditor, registerMarkdownShortcuts } from '../shared/markdown-commands';
import MarkdownToolbar from '../shared/MarkdownToolbar';

const { Text } = Typography;

type DocsMode = 'write' | 'preview';

const renderDocsCodeBlock = (code: string, lang?: string) => <HighlightedCodeBlock code={code} lang={lang} />;

interface DocsTabProps {
  value: string;
  onChange: (value: string) => void;
}

const DocsTab: React.FC<DocsTabProps> = ({ value, onChange }) => {
  const { token } = theme.useToken();
  const t = useT();
  const [mode, setMode] = useState<DocsMode>(() => (value.trim() ? 'preview' : 'write'));
  const [editor, setEditor] = useState<MarkdownEditor | null>(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, minHeight: 0 }}>
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
            { value: 'write', label: t('workbench.editors.request.docs.write') },
            { value: 'preview', label: t('workbench.editors.request.docs.preview') },
          ]}
        />
        <InfoTrigger
          content={{
            title: t('workbench.editors.request.docs.infoTitle'),
            summary: t('workbench.editors.request.docs.infoSummary'),
          }}
        />
        {mode === 'write' && (
          <div style={{ marginLeft: 10 }}>
            <MarkdownToolbar editor={editor} />
          </div>
        )}
      </div>
      {mode === 'write' ? (
        // Absolute inset host — see ScriptsTab: a fill editor must not
        // contribute intrinsic height or Monaco's inline height ratchets
        // the scroller's content size and the pane never shrinks back.
        <div style={{ flex: 1, minHeight: 100, position: 'relative' }}>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
            <CodeEditor
              value={value}
              onChange={onChange}
              language="markdown"
              fill
              placeholder={t('workbench.editors.request.docs.placeholder')}
              variableAutoComplete={false}
              onEditorMount={(ed, monacoApi) => {
                setEditor(ed);
                registerMarkdownShortcuts(ed, monacoApi);
              }}
            />
          </div>
        </div>
      ) : value.trim() ? (
        <MarkdownView renderCodeBlock={renderDocsCodeBlock}>{value}</MarkdownView>
      ) : (
        <Text type="secondary" style={{ fontSize: 12, padding: '24px 0', textAlign: 'center' }}>
          {t('workbench.editors.request.docs.empty')}
        </Text>
      )}
    </div>
  );
};

export default DocsTab;
