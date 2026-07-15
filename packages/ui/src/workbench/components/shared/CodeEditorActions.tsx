/**
 * CodeEditorActions — the Find / Replace / Format button cluster for a
 * mounted CodeEditor. CodeEditor renders it as its hover corner
 * overlay by default; hosts that own a toolbar row above the editor
 * (e.g. the Body tab's encoding picker) render it there instead via
 * `actions="external"` + `actionsRef`, which keeps the buttons out of
 * the buffer so they never cover long first lines.
 */

import { AlignLeftOutlined, SearchOutlined, SwapOutlined } from '@ant-design/icons';
import { Button, Tooltip } from 'antd';
import type React from 'react';
import { ShortcutHintTitle } from '@openheaders/ui/components/ShortcutKbd';
import { useShortcutLabel } from '../../hooks/useWorkspaceShortcuts';
import { type LanguageId, toMonacoLanguage } from '../../languages/registry';

/** Monaco language ids that have a registered formatter — either
 *  Monaco's built-in LSP (JSON / CSS / HTML) or our Prettier provider
 *  (JS / XML). `plaintext` + graphql fallbacks stay off. The set is
 *  source-of-truth constant: adding a language here requires adding a
 *  provider somewhere Monaco can see. */
const MONACO_FORMATTABLE_LANGUAGES = new Set(['javascript', 'json', 'css', 'html', 'xml']);

export function isFormattableLanguage(language: LanguageId): boolean {
  return MONACO_FORMATTABLE_LANGUAGES.has(toMonacoLanguage(language));
}

/** Imperative surface a CodeEditor exposes (via `actionsRef`) so an
 *  externally-rendered cluster can drive it. */
export interface CodeEditorActionsTarget {
  find: () => void;
  replace: () => void;
  format: () => void;
}

interface CodeEditorActionsProps {
  /** Ref populated by the CodeEditor this cluster drives. */
  target: React.RefObject<CodeEditorActionsTarget | null>;
  language: LanguageId;
  readOnly?: boolean;
  /** Show the action names as visible button text next to the icons
   *  (e.g. the Scripts tab's toolbar row) — icon-only when omitted. */
  labels?: boolean;
  /** Action names — tooltips always, visible text with `labels`. */
  findText?: string;
  replaceText?: string;
  formatText?: string;
  style?: React.CSSProperties;
}

const CodeEditorActions: React.FC<CodeEditorActionsProps> = ({
  target,
  language,
  readOnly = false,
  labels = false,
  findText = 'Find',
  replaceText = 'Replace',
  formatText = 'Format',
  style,
}) => {
  // Live registry hints — rebinding in Settings → Keyboard repaints
  // the tooltips, and the same settings drive the actual Monaco
  // keybindings (see monaco/editor-keybindings.ts).
  const findShortcutLabel = useShortcutLabel('find');
  const replaceShortcutLabel = useShortcutLabel('replace');
  const formatShortcutLabel = useShortcutLabel('format-code');
  const formattable = isFormattableLanguage(language);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, ...style }}>
      <Tooltip title={<ShortcutHintTitle label={findShortcutLabel}>{findText}</ShortcutHintTitle>} placement="top">
        <Button
          size="small"
          type="text"
          icon={<SearchOutlined />}
          onClick={() => target.current?.find()}
          aria-label={findText}
        >
          {labels ? findText : null}
        </Button>
      </Tooltip>
      {!readOnly && (
        <Tooltip
          title={<ShortcutHintTitle label={replaceShortcutLabel}>{replaceText}</ShortcutHintTitle>}
          placement="top"
        >
          <Button
            size="small"
            type="text"
            icon={<SwapOutlined />}
            onClick={() => target.current?.replace()}
            aria-label={replaceText}
          >
            {labels ? replaceText : null}
          </Button>
        </Tooltip>
      )}
      {!readOnly && formattable && (
        <Tooltip
          title={<ShortcutHintTitle label={formatShortcutLabel}>{formatText}</ShortcutHintTitle>}
          placement="top"
        >
          <Button
            size="small"
            type="text"
            icon={<AlignLeftOutlined />}
            onClick={() => target.current?.format()}
            aria-label={formatText}
          >
            {labels ? formatText : null}
          </Button>
        </Tooltip>
      )}
    </div>
  );
};

export default CodeEditorActions;
