/**
 * ScriptsTab — Pre-request / Post-response scripts in ONE tab with a
 * left-rail picker + shared Monaco editor. Each rail entry carries an
 * `(i)` popover explaining when that script runs and its `oh.*` API —
 * the editor pane itself stays chrome-free.
 *
 * The editor is the shared CodeEditor host (Find / Replace / Format
 * corner actions, Prettier-backed `editor.action.formatDocument`) with
 * a native Monaco ghost placeholder — the hint is NOT actual script
 * content, so the draft stays empty until the user types and the dirty
 * fingerprint never sees example code. A floating action bar inside the
 * editor's bottom-right corner hosts the snippets menu (ready-made
 * `oh.*` examples, inserted at the cursor) and a Format shortcut.
 */

import { AlignLeftOutlined } from '@ant-design/icons';
import type { ScriptKind } from '@openheaders/core/scripts';
import { Button, Divider, Tooltip, theme } from 'antd';
import type * as monaco from 'monaco-editor';
import type React from 'react';
import { useRef, useState } from 'react';
import { type InfoPopoverContent, InfoTrigger } from '@openheaders/ui/shared/info-popover';
import ScriptSnippetsMenu from '../script-editor/ScriptSnippetsMenu';
import CodeEditor from '../shared/CodeEditor';

interface ScriptsTabProps {
  preRequestScript: string;
  postResponseScript: string;
  onPreRequestChange: (value: string) => void;
  onPostResponseChange: (value: string) => void;
}

const SCRIPT_INFO: Record<ScriptKind, InfoPopoverContent> = {
  'pre-request': {
    title: 'Pre-request script',
    summary: 'Runs in a sandboxed iframe before the request is sent. Mutate the outgoing request with the oh API:',
    sections: [
      {
        heading: 'API',
        items: [
          { label: 'oh.setHeader(name, value)', desc: 'add or replace a header' },
          { label: 'oh.setQueryParam(name, value)', desc: 'add or replace a query parameter' },
          { label: 'oh.setUrl(url)', desc: 'rewrite the target URL' },
          { label: 'oh.setBody(body)', desc: 'replace the request body' },
          { label: 'oh.require(name)', desc: 'load a script package from the Package Library' },
        ],
      },
    ],
  },
  'post-response': {
    title: 'Post-response script',
    summary: 'Runs in a sandboxed iframe after the response arrives. Assertion results land in the Response panel:',
    sections: [
      {
        heading: 'API',
        items: [
          { label: 'oh.test(name, fn)', desc: 'register an assertion' },
          { label: 'oh.require(name)', desc: 'load a script package from the Package Library' },
        ],
      },
    ],
  },
};

const SCRIPT_PLACEHOLDER: Record<ScriptKind, string> = {
  'pre-request': 'Use JavaScript to modify this request before it is sent.',
  'post-response': 'Use JavaScript to test and read this response after it arrives.',
};

const ScriptsTab: React.FC<ScriptsTabProps> = ({
  preRequestScript,
  postResponseScript,
  onPreRequestChange,
  onPostResponseChange,
}) => {
  const { token } = theme.useToken();
  const [active, setActive] = useState<ScriptKind>('pre-request');
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  const value = active === 'pre-request' ? preRequestScript : postResponseScript;
  const onChange = (v: string) => {
    if (active === 'pre-request') onPreRequestChange(v);
    else onPostResponseChange(v);
  };

  // Insert at the cursor, always starting on its own line: if the caret
  // sits mid-line the snippet gets a leading newline, and a trailing one
  // so typing resumes below it. Falls back to appending through the
  // draft when Monaco hasn't mounted yet.
  const insertSnippet = (code: string) => {
    const editor = editorRef.current;
    const model = editor?.getModel();
    const selection = editor?.getSelection();
    if (!editor || !model || !selection) {
      onChange(value.trim() ? `${value.replace(/\n$/, '')}\n${code}\n` : `${code}\n`);
      return;
    }
    const lineContent = model.getLineContent(selection.startLineNumber);
    const prefix = lineContent.slice(0, selection.startColumn - 1).trim() ? '\n' : '';
    const text = `${prefix}${code}\n`;
    editor.executeEdits('snippets', [{ range: selection, text }]);
    // Monaco keeps the cursor at the edit START without an explicit
    // end-cursor state — a second insert would then land BEFORE the
    // first. Pin it to the line after the inserted block.
    const endLine = selection.startLineNumber + text.split('\n').length - 1;
    editor.setPosition({ lineNumber: endLine, column: 1 });
    editor.focus();
    editor.revealPositionInCenterIfOutsideViewport({ lineNumber: endLine, column: 1 });
  };

  const Rail: React.FC<{ kind: ScriptKind; label: string }> = ({ kind, label }) => {
    const selected = active === kind;
    const hasScript = kind === 'pre-request' ? preRequestScript.trim() : postResponseScript.trim();
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button
          type="button"
          onClick={() => setActive(kind)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flex: 1,
            minWidth: 0,
            padding: '8px 12px',
            background: selected ? token.colorFillTertiary : 'transparent',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            color: token.colorText,
            fontSize: 13,
            textAlign: 'left',
          }}
        >
          <span>{label}</span>
          {hasScript && (
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: token.colorPrimary,
              }}
            />
          )}
        </button>
        <InfoTrigger content={SCRIPT_INFO[kind]} />
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', gap: 16, height: '100%', minHeight: 340 }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          width: 190,
          paddingRight: 12,
          borderRight: `1px solid ${token.colorBorderSecondary}`,
          position: 'sticky',
          top: 0,
          alignSelf: 'start',
        }}
      >
        <Rail kind="pre-request" label="Pre-request" />
        <Rail kind="post-response" label="Post-response" />
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, position: 'relative' }}>
        <CodeEditor
          language="javascript"
          value={value}
          onChange={onChange}
          minHeight={300}
          placeholder={SCRIPT_PLACEHOLDER[active]}
          onEditorMount={(editor) => {
            editorRef.current = editor;
          }}
        />
        {/* Floating action bar INSIDE the editor surface, bottom-right —
            above Monaco's horizontal scrollbar and clear of the resize
            grip strip (12px) below the buffer. z-index 12 matches the
            editor's corner action cluster. */}
        <div
          style={{
            position: 'absolute',
            bottom: 34,
            right: 26,
            zIndex: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            padding: '2px 4px',
            background: token.colorBgElevated,
            border: `1px solid ${token.colorBorderSecondary}`,
            borderRadius: 8,
            boxShadow: token.boxShadowTertiary,
          }}
        >
          <ScriptSnippetsMenu kind={active} onInsert={insertSnippet} />
          <Divider type="vertical" style={{ margin: 0 }} />
          <Tooltip title="Format" placement="top">
            <Button
              size="small"
              type="text"
              icon={<AlignLeftOutlined />}
              aria-label="Format script"
              onClick={() => {
                void editorRef.current?.getAction('editor.action.formatDocument')?.run();
              }}
            />
          </Tooltip>
        </div>
      </div>
    </div>
  );
};

export default ScriptsTab;
