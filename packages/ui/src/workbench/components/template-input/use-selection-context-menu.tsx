/**
 * use-selection-context-menu — right-click on a TemplateInput text
 * selection → custom context menu (Set as variable, clipboard trio,
 * Encode/DecodeURIComponent).
 *
 * The selection is captured as flat char offsets at contextmenu time,
 * so menu actions do plain string surgery on the controlled `value`
 * and never depend on the live DOM selection surviving the menu
 * interaction. A collapsed caret (no selection) falls through to the
 * browser's native menu.
 *
 * "Set as variable" opens {@link SetAsVariablePopover} with the
 * selection pre-filled as the VALUE — the inverse of the `{{ref}}`
 * hover-create flow, sharing its scope + save machinery.
 */

import type { MenuProps } from 'antd';
import type React from 'react';
import { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { getSelectionOffsets, setCaretOffset } from './caret';
import DismissLayer from './DismissLayer';
import SelectionContextMenu from './SelectionContextMenu';
import SetAsVariablePopover from './SetAsVariablePopover';

interface MenuSession {
  x: number;
  y: number;
  start: number;
  end: number;
  text: string;
}

interface UseSelectionContextMenuParams {
  editableRef: React.RefObject<HTMLDivElement | null>;
  value: string;
  onChange?: (value: string) => void;
  collectionId?: string;
}

export interface UseSelectionContextMenuApi {
  handleContextMenu: (e: React.MouseEvent<HTMLDivElement>) => void;
  /** Rendered menu + popover layers — mount once in the component tree. */
  contextMenuLayer: React.ReactNode;
}

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    // Legacy path for hosts where the async clipboard API is gated.
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
  } finally {
    ta.remove();
  }
}

export function useSelectionContextMenu({
  editableRef,
  value,
  onChange,
  collectionId,
}: UseSelectionContextMenuParams): UseSelectionContextMenuApi {
  const [menu, setMenu] = useState<MenuSession | null>(null);
  const [varPopover, setVarPopover] = useState<{ text: string } | null>(null);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const root = editableRef.current;
      if (!root) return;
      const offsets = getSelectionOffsets(root);
      // No selection → native menu (spellcheck, browser paste, …).
      if (!offsets || offsets.start === offsets.end) return;
      e.preventDefault();
      const text = (root.textContent ?? '').slice(offsets.start, offsets.end);
      setMenu({ x: e.clientX, y: e.clientY, start: offsets.start, end: offsets.end, text });
    },
    [editableRef],
  );

  const replaceRange = useCallback(
    (session: MenuSession, replacement: string) => {
      const next = value.slice(0, session.start) + replacement + value.slice(session.end);
      onChange?.(next);
      // Restore focus + place the caret after the replacement once the
      // controlled value has round-tripped through the re-highlight.
      requestAnimationFrame(() => {
        const root = editableRef.current;
        if (!root) return;
        root.focus();
        setCaretOffset(root, session.start + replacement.length);
      });
    },
    [value, onChange, editableRef],
  );

  const buildItems = useCallback(
    (session: MenuSession): NonNullable<MenuProps['items']> => [
      {
        key: 'set-as-variable',
        label: 'Set as variable',
        onClick: () => setVarPopover({ text: session.text }),
      },
      { type: 'divider' },
      {
        key: 'cut',
        label: 'Cut',
        disabled: !onChange,
        onClick: () => {
          void copyText(session.text);
          replaceRange(session, '');
        },
      },
      {
        key: 'copy',
        label: 'Copy',
        onClick: () => {
          void copyText(session.text);
        },
      },
      {
        key: 'paste',
        label: 'Paste',
        disabled: !onChange,
        onClick: () => {
          void navigator.clipboard
            .readText()
            .then((clip) => replaceRange(session, clip))
            .catch(() => {
              // Clipboard read denied — leave the field untouched.
            });
        },
      },
      { type: 'divider' },
      {
        key: 'encode-uri-component',
        label: 'EncodeURIComponent',
        disabled: !onChange,
        onClick: () => replaceRange(session, encodeURIComponent(session.text)),
      },
      {
        key: 'decode-uri-component',
        label: 'DecodeURIComponent',
        disabled: !onChange,
        onClick: () => {
          let decoded = session.text;
          try {
            decoded = decodeURIComponent(session.text);
          } catch {
            // Malformed escape sequence — keep the text as-is.
          }
          replaceRange(session, decoded);
        },
      },
    ],
    [onChange, replaceRange],
  );

  const contextMenuLayer = (
    <>
      {menu && <SelectionContextMenu x={menu.x} y={menu.y} items={buildItems(menu)} onClose={() => setMenu(null)} />}
      {varPopover &&
        editableRef.current &&
        createPortal(
          <SetAsVariablePopoverDismissable
            anchorEl={editableRef.current}
            initialValue={varPopover.text}
            collectionId={collectionId}
            onClose={() => setVarPopover(null)}
          />,
          document.body,
        )}
    </>
  );

  return { handleContextMenu, contextMenuLayer };
}

/** Wraps the popover with outside-click + Esc dismissal (the hover-
 *  popover host normally owns this; the context-menu flow mounts the
 *  popover directly). */
const SetAsVariablePopoverDismissable: React.FC<React.ComponentProps<typeof SetAsVariablePopover>> = (props) => {
  return <DismissLayer onClose={props.onClose}>{<SetAsVariablePopover {...props} />}</DismissLayer>;
};
