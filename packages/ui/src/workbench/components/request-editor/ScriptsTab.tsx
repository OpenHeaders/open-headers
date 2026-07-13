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
import type { MessageKey } from '@openheaders/i18n';
import { Button, Divider, Tooltip, theme } from 'antd';
import type * as monaco from 'monaco-editor';
import type React from 'react';
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import { type InfoPopoverContent, InfoTrigger } from '@openheaders/ui/shared/info-popover';
import { installMenuIconInjector } from '../script-editor/monaco-menu-icons';
import SaveToPackagePopover from '../script-editor/SaveToPackagePopover';
import ScriptPackagesMenu from '../script-editor/ScriptPackagesMenu';
import CodeEditor from '../shared/CodeEditor';
import DismissLayer from '../template-input/DismissLayer';
import ScriptSnippetsMenu from '../script-editor/ScriptSnippetsMenu';
import SetAsVariablePopover from '../template-input/SetAsVariablePopover';
import { useAutoSuggestionContext } from '../template-input/SuggestionContextProvider';

interface ScriptsTabProps {
  preRequestScript: string;
  postResponseScript: string;
  onPreRequestChange: (value: string) => void;
  onPostResponseChange: (value: string) => void;
  /** Editing-scope workspace — target for "Save to Package Library". */
  workspaceId?: string | null;
  /** Open the Package Library tab (Packages popover footer). */
  onOpenPackageLibrary?: () => void;
}

// `oh.*` API labels are code — only the descriptions localize.
const scriptInfo = (kind: ScriptKind, t: Translate): InfoPopoverContent =>
  kind === 'pre-request'
    ? {
        title: t('workbench.editors.request.scripts.preInfoTitle'),
        summary: t('workbench.editors.request.scripts.preInfoSummary'),
        sections: [
          {
            heading: t('workbench.editors.request.scripts.apiHeading'),
            items: [
              { label: 'oh.setHeader(name, value)', desc: t('workbench.editors.request.scripts.apiSetHeader') },
              {
                label: 'oh.setQueryParam(name, value)',
                desc: t('workbench.editors.request.scripts.apiSetQueryParam'),
              },
              { label: 'oh.setUrl(url)', desc: t('workbench.editors.request.scripts.apiSetUrl') },
              { label: 'oh.setBody(body)', desc: t('workbench.editors.request.scripts.apiSetBody') },
              { label: 'oh.require(name)', desc: t('workbench.editors.request.scripts.apiRequire') },
            ],
          },
        ],
      }
    : {
        title: t('workbench.editors.request.scripts.postInfoTitle'),
        summary: t('workbench.editors.request.scripts.postInfoSummary'),
        sections: [
          {
            heading: t('workbench.editors.request.scripts.apiHeading'),
            items: [
              { label: 'oh.test(name, fn)', desc: t('workbench.editors.request.scripts.apiTest') },
              { label: 'oh.require(name)', desc: t('workbench.editors.request.scripts.apiRequire') },
            ],
          },
        ],
      };

const SCRIPT_PLACEHOLDER_KEY: Record<ScriptKind, MessageKey> = {
  'pre-request': 'workbench.editors.request.scripts.prePlaceholder',
  'post-response': 'workbench.editors.request.scripts.postPlaceholder',
};

const ScriptsTab: React.FC<ScriptsTabProps> = ({
  preRequestScript,
  postResponseScript,
  onPreRequestChange,
  onPostResponseChange,
  workspaceId = null,
  onOpenPackageLibrary,
}) => {
  const { token } = theme.useToken();
  const t = useT();
  const [active, setActive] = useState<ScriptKind>('pre-request');
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const suggestionContext = useAutoSuggestionContext();
  // Selection-action popovers, opened from the editor's context menu.
  // They anchor to a tiny fixed-position marker planted at the
  // selection's end coordinates — anchoring to the editor CONTAINER
  // would push the popover below the whole pane (usually off-screen).
  const [varPopover, setVarPopover] = useState<{ text: string } | null>(null);
  const [pkgPopover, setPkgPopover] = useState<{ text: string } | null>(null);
  const [anchorPoint, setAnchorPoint] = useState<{ x: number; y: number } | null>(null);
  const [anchorNode, setAnchorNode] = useState<HTMLElement | null>(null);
  const closeSelectionPopovers = () => {
    setVarPopover(null);
    setPkgPopover(null);
    setAnchorPoint(null);
    setAnchorNode(null);
  };

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

  // Row is a `role="button"` div (not a real <button>) so the
  // InfoTrigger — itself a <button> — can sit inline right after the
  // label without nesting interactive elements.
  const Rail: React.FC<{ kind: ScriptKind; label: string }> = ({ kind, label }) => {
    const selected = active === kind;
    const hasScript = kind === 'pre-request' ? preRequestScript.trim() : postResponseScript.trim();
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => setActive(kind)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setActive(kind);
          }
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 10px',
          background: selected ? token.colorFillTertiary : 'transparent',
          borderRadius: 4,
          cursor: 'pointer',
          color: token.colorText,
          fontSize: 13,
        }}
      >
        <span>{label}</span>
        <InfoTrigger content={scriptInfo(kind, t)} />
        <span style={{ flex: 1 }} />
        {hasScript && (
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: token.colorPrimary,
              flexShrink: 0,
            }}
          />
        )}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', gap: 8, height: '100%', minHeight: 340 }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          width: 150,
          position: 'sticky',
          top: 0,
          alignSelf: 'start',
        }}
      >
        <Rail kind="pre-request" label={t('workbench.editors.request.scripts.preRequest')} />
        <Rail kind="post-response" label={t('workbench.editors.request.scripts.postResponse')} />
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, position: 'relative' }}>
        <CodeEditor
          language="javascript"
          value={value}
          onChange={onChange}
          minHeight={300}
          placeholder={t(SCRIPT_PLACEHOLDER_KEY[active])}
          onEditorMount={(editor) => {
            editorRef.current = editor;
            installMenuIconInjector(editor, t('workbench.editors.scriptEditor.saveToPackage'));
            const container = editor.getContainerDomNode();
            const selectedText = (): string => {
              const model = editor.getModel();
              const selection = editor.getSelection();
              if (!model || !selection || selection.isEmpty()) return '';
              return model.getValueInRange(selection);
            };
            const replaceSelection = (transform: (text: string) => string): void => {
              const selection = editor.getSelection();
              const text = selectedText();
              if (!selection || !text) return;
              let next = text;
              try {
                next = transform(text);
              } catch {
                // Malformed escape sequence on decode — keep as-is.
              }
              editor.executeEdits('oh-selection-action', [{ range: selection, text: next }]);
            };
            // Custom entries on Monaco's built-in context menu — shown
            // only while a selection exists.
            // Viewport coords of the selection end — where the popover
            // anchors. Falls back to the container's top edge when the
            // selection has scrolled out of view.
            const selectionAnchorPoint = (): { x: number; y: number } => {
              const rect = container.getBoundingClientRect();
              const selection = editor.getSelection();
              const pos = selection ? editor.getScrolledVisiblePosition(selection.getEndPosition()) : null;
              if (!pos) return { x: rect.left + 24, y: rect.top + 24 };
              return { x: rect.left + pos.left, y: rect.top + pos.top + pos.height };
            };
            editor.addAction({
              id: 'oh.set-as-variable',
              label: t('shared.templateInput.setAsVariable'),
              contextMenuGroupId: '9_oh_actions',
              contextMenuOrder: 1,
              precondition: 'editorHasSelection',
              run: () => {
                const text = selectedText();
                if (!text) return;
                setAnchorPoint(selectionAnchorPoint());
                setVarPopover({ text });
              },
            });
            editor.addAction({
              id: 'oh.save-to-package',
              label: t('workbench.editors.scriptEditor.saveToPackage'),
              contextMenuGroupId: '9_oh_actions',
              contextMenuOrder: 2,
              precondition: 'editorHasSelection',
              run: () => {
                const text = selectedText();
                if (!text) return;
                setAnchorPoint(selectionAnchorPoint());
                setPkgPopover({ text });
              },
            });
            editor.addAction({
              id: 'oh.encode-uri-component',
              label: 'EncodeURIComponent',
              contextMenuGroupId: '9_oh_transform',
              contextMenuOrder: 1,
              precondition: 'editorHasSelection',
              run: () => replaceSelection(encodeURIComponent),
            });
            editor.addAction({
              id: 'oh.decode-uri-component',
              label: 'DecodeURIComponent',
              contextMenuGroupId: '9_oh_transform',
              contextMenuOrder: 2,
              precondition: 'editorHasSelection',
              run: () => replaceSelection(decodeURIComponent),
            });
            editor.addAction({
              id: 'oh.find-selection',
              label: t('workbench.editors.scriptEditor.menuFind'),
              contextMenuGroupId: '9_oh_transform',
              contextMenuOrder: 3,
              precondition: 'editorHasSelection',
              run: () => {
                void editor.getAction('actions.find')?.run();
              },
            });
          }}
        />
        {(varPopover || pkgPopover) &&
          anchorPoint &&
          createPortal(
            <span
              ref={setAnchorNode}
              aria-hidden
              style={{
                position: 'fixed',
                top: anchorPoint.y,
                left: anchorPoint.x,
                width: 2,
                height: 2,
                pointerEvents: 'none',
              }}
            />,
            document.body,
          )}
        {varPopover &&
          anchorNode &&
          createPortal(
            <DismissLayer onClose={closeSelectionPopovers}>
              <SetAsVariablePopover
                anchorEl={anchorNode}
                initialValue={varPopover.text}
                collectionId={suggestionContext.collectionId}
                onClose={closeSelectionPopovers}
              />
            </DismissLayer>,
            document.body,
          )}
        {pkgPopover && anchorNode && (
          <SaveToPackagePopover
            anchorEl={anchorNode}
            workspaceId={workspaceId}
            selectionText={pkgPopover.text}
            onClose={closeSelectionPopovers}
          />
        )}
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
          <ScriptPackagesMenu workspaceId={workspaceId} onInsert={insertSnippet} onOpenLibrary={onOpenPackageLibrary} />
          <Divider type="vertical" style={{ margin: 0 }} />
          <ScriptSnippetsMenu kind={active} onInsert={insertSnippet} />
          <Divider type="vertical" style={{ margin: 0 }} />
          <Tooltip title={t('workbench.editors.request.scripts.format')} placement="top">
            <Button
              size="small"
              type="text"
              icon={<AlignLeftOutlined />}
              aria-label={t('workbench.editors.request.scripts.formatAria')}
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
