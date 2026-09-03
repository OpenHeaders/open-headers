/**
 * ScriptsTab — every script slot in ONE tab: the slot rail
 * (`script-editor/ScriptRail`, drawn from `script-slots.ts`) beside the
 * shared Monaco editor. Mounted by the request editor (`scope:
 * 'request'` — the request's own slots, flat) and by the container
 * editor (`scope: 'container'` — every kind's slots under its kind
 * header; the placeholder speaks to every request the container holds).
 *
 * The editor is the shared CodeEditor host (Prettier-backed
 * `editor.action.formatDocument`) with a native Monaco ghost
 * placeholder — the hint is NOT actual script content, so the draft
 * stays empty until the user types and the dirty fingerprint never
 * sees example code. The labelled Find / Replace / Beautify cluster
 * sits in a toolbar row above the editor (`actions="external"`); a
 * floating bar inside the editor's bottom-right corner hosts the
 * Packages and Snippets menus (ready-made `oh.*` examples, inserted
 * at the cursor).
 *
 * A request inside a collection reads its ancestor chain in the
 * toolbar row (`AncestorScriptsLine`) for the active slot — the levels
 * the executor composes ahead of it. Silent on the container editor's
 * own mount, which passes none.
 */

import type { ScriptKind } from '@openheaders/core/scripts';
import { Divider, theme } from 'antd';
import type * as monaco from 'monaco-editor';
import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '@openheaders/ui/context/LocaleContext';
import type { RequestKind } from '../../request-kind-menu';
import { setScriptAmbientKind } from '../monaco/script-ambient';
import type { AncestorScriptLevels } from '../request-container/ancestry';
import AncestorScriptsLine, { type OpenContainerScripts } from '../script-editor/AncestorScriptsLine';
import { installMenuIconInjector } from '../script-editor/monaco-menu-icons';
import SaveToPackagePopover from '../script-editor/SaveToPackagePopover';
import ScriptPackagesMenu from '../script-editor/ScriptPackagesMenu';
import ScriptRail from '../script-editor/ScriptRail';
import ScriptSnippetsMenu from '../script-editor/ScriptSnippetsMenu';
import {
  DEFAULT_SCRIPT_SLOT,
  SCRIPT_SLOT_BY_KIND,
  SCRIPT_SLOT_GROUPS,
  type ScriptSlotFlags,
  type ScriptSlotScope,
  type ScriptSlotValues,
  scriptSlotGroupsFor,
} from '../script-editor/script-slots';
import CodeEditor from '../shared/CodeEditor';
import CodeEditorActions, { type CodeEditorActionsTarget } from '../shared/CodeEditorActions';
import EditorViewMenu from '../shared/EditorViewMenu';
import DismissLayer from '../template-input/DismissLayer';
import SetAsVariablePopover from '../template-input/SetAsVariablePopover';
import { useAutoSuggestionContext } from '../template-input/SuggestionContextProvider';

interface ScriptsTabProps {
  /** The mount — a request's own slots, or a container's slots for
   *  every request it holds (grouped rail, container placeholders). */
  scope: ScriptSlotScope;
  /** A request mount's kind — the rail draws that kind's slots alone
   *  (both WebSocket flavors read the WebSocket group). Absent = every
   *  group (the container mount). */
  requestKind?: RequestKind;
  scripts: ScriptSlotValues;
  onScriptChange: (kind: ScriptKind, value: string) => void;
  /** Per-slot unsaved flags for the rail dots (see section-unsaved.ts). */
  unsaved?: ScriptSlotFlags;
  /** Editing-scope workspace — target for "Save to Package Library". */
  workspaceId?: string | null;
  /** Open the Package Library tab (Packages popover footer). */
  onOpenPackageLibrary?: () => void;
  /** The ancestor levels whose scripts run ahead of this request's, per
   *  slot — the "Runs after …" line. Absent on container mounts. */
  ancestorScripts?: AncestorScriptLevels;
  /** Opens a container's Scripts section — the line's level links. */
  onOpenContainerScripts?: OpenContainerScripts;
}

const ScriptsTab: React.FC<ScriptsTabProps> = ({
  scope,
  requestKind,
  scripts,
  onScriptChange,
  unsaved,
  workspaceId = null,
  onOpenPackageLibrary,
  ancestorScripts,
  onOpenContainerScripts,
}) => {
  const { token } = theme.useToken();
  const t = useT();
  const groups = useMemo(
    () => (requestKind === undefined ? SCRIPT_SLOT_GROUPS : scriptSlotGroupsFor(requestKind)),
    [requestKind],
  );
  const [active, setActive] = useState<ScriptKind>(() => groups[0]?.slots[0]?.kind ?? DEFAULT_SCRIPT_SLOT);
  // The ambient `oh.*` types follow the active slot — a session hook's
  // surface is its own (oh.connect / oh.message / oh.close), so the
  // editor's completions and squigglies swap with the rail selection.
  useEffect(() => {
    setScriptAmbientKind(active);
  }, [active]);
  const ancestorLevels = ancestorScripts?.[active] ?? [];
  // Script-editor wrap — a per-pane override of the global
  // `editor.wordWrap` setting; OFF by default (scripts are code, and
  // the code idiom keeps long lines on one line).
  const [wrapScript, setWrapScript] = useState(false);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  // Imperative surface of the mounted editor — drives the labelled
  // Find / Replace / Beautify cluster in the toolbar row above it.
  const editorActionsRef = useRef<CodeEditorActionsTarget | null>(null);
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

  const value = scripts[active];
  const onChange = (v: string) => onScriptChange(active, v);

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

  return (
    <div style={{ display: 'flex', gap: 8, flex: 1, minHeight: 0 }}>
      <ScriptRail
        groups={groups}
        grouped={scope === 'container'}
        active={active}
        scripts={scripts}
        unsaved={unsaved}
        onSelect={setActive}
      />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, minHeight: 120 }}>
        {/* Toolbar row ABOVE the editor (labelled variant of the shared
            cluster) — keeps the buttons out of the buffer so they never
            cover long first lines. */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
          <AncestorScriptsLine levels={ancestorLevels} onOpen={onOpenContainerScripts} />
          <CodeEditorActions
            target={editorActionsRef}
            language="javascript"
            labels
            findText={t('workbench.editors.scriptEditor.find')}
            replaceText={t('workbench.editors.scriptEditor.replace')}
            formatText={t('workbench.editors.scriptEditor.beautify')}
          />
          <EditorViewMenu wrap={wrapScript} onWrapChange={setWrapScript} data-testid="oh-script-editor-menu" />
        </div>
        <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
          {/* Absolute inset host: the fill editor must not contribute
              intrinsic height — Monaco's automaticLayout writes an explicit
              pixel height on its DOM, and in-flow that height feeds back
              into the scroller's content size, ratcheting the editor so it
              grows with the pane but never shrinks. Out of flow, the cell's
              height is purely divider-driven and Monaco tracks it both
              ways. */}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
            <CodeEditor
              language="javascript"
              value={value}
              onChange={onChange}
              fill
              actions="external"
              actionsRef={editorActionsRef}
              wordWrapOverride={wrapScript ? 'on' : 'off'}
              placeholder={t(SCRIPT_SLOT_BY_KIND[active].placeholderKey[scope])}
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
          </div>
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
              above Monaco's horizontal scrollbar (the fill-mode editor has
              no resize grip strip). z-index 12 matches the editor's corner
              action cluster. */}
          <div
            style={{
              position: 'absolute',
              bottom: 22,
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
            <Divider orientation="vertical" style={{ margin: 0 }} />
            <ScriptSnippetsMenu kind={active} scope={scope} onInsert={insertSnippet} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScriptsTab;
