/**
 * StorageDocSaveButton — the shared Save affordance of the storage
 * document editors. Same grammar as the workbench editors' Save: a
 * SaveOutlined prefix, a tooltip leading with the ⌘S / Ctrl+S chord,
 * and this module also OWNS the binding — preventDefault keeps the
 * browser's own save dialog suppressed, and the handler is scoped to
 * the visible, focused document, so the hint is never a lie. The
 * wrapper span keeps the tooltip reachable while the button is
 * disabled (native disabled buttons swallow hover events).
 */

import { SaveOutlined } from '@ant-design/icons';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { ShortcutHintTitle } from '@openheaders/ui/components/ShortcutKbd';
import { useTabActive } from '@openheaders/ui/shared/awareness/TabActiveContext';
import { isMac } from '@openheaders/ui/shared/platform';
import { Tooltip } from 'antd';
import { useEffect, useRef } from 'react';

export const SAVE_SHORTCUT_LABEL = isMac ? '⌘S' : 'Ctrl+S';

function useSaveShortcut(enabled: boolean, onSave: () => void): void {
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const tabActive = useTabActive();
  useEffect(() => {
    if (!enabled || !tabActive) return;
    const handler = (event: KeyboardEvent) => {
      if (!(isMac ? event.metaKey : event.ctrlKey) || event.shiftKey || event.altKey) return;
      if (event.key.toLowerCase() !== 's') return;
      event.preventDefault();
      onSaveRef.current();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [enabled, tabActive]);
}

interface StorageDocSaveButtonProps {
  /** Committable right now — enables the button and arms the chord. */
  savable: boolean;
  saving: boolean;
  dirty: boolean;
  /** Tooltip body while savable — what Save writes and where. */
  saveHint: string;
  /** Tooltip body while dirty but blocked — why it can't commit. */
  blockedHint?: string;
  /** Whether this document is the focused group's active tab — a
   *  split can show two documents at once and the chord must only
   *  save the focused one. Defaults to true for single-document
   *  surfaces. */
  isActiveDocument?: boolean;
  onSave: () => void;
}

export function StorageDocSaveButton({
  savable,
  saving,
  dirty,
  saveHint,
  blockedHint,
  isActiveDocument = true,
  onSave,
}: StorageDocSaveButtonProps) {
  // Bound while the document is active even when there's nothing to
  // commit — ⌘S must never fall through to the browser's save dialog —
  // but it only ACTS when a save can land.
  const t = useT();
  const savableRef = useRef(savable && !saving);
  savableRef.current = savable && !saving;
  useSaveShortcut(isActiveDocument, () => {
    if (savableRef.current) onSave();
  });
  const noChanges = t('panel.storage.save.noChanges');
  const hint = savable ? saveHint : dirty ? (blockedHint ?? noChanges) : noChanges;
  return (
    <Tooltip title={savable ? <ShortcutHintTitle label={SAVE_SHORTCUT_LABEL}>{hint}</ShortcutHintTitle> : hint}>
      <span className="dt-storagedoc-save-wrap">
        <button
          type="button"
          className="dt-storagedoc-save"
          disabled={!savable || saving}
          onClick={onSave}
        >
          <SaveOutlined aria-hidden="true" />
          {t('panel.storage.save.label')}
        </button>
      </span>
    </Tooltip>
  );
}
