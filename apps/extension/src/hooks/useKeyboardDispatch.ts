import type { RefObject } from 'react';
import { useCallback, useEffect } from 'react';
import { matchesPopupShortcut } from '@/popup/shortcuts/popup-shortcuts';
import type { RowActions } from '@/popup/utils/table-shared';

export interface FooterActions {
  onToggleRecording?: () => void;
  onToggleRulesPause?: () => void;
  onToggleOptions?: () => void;
  onOpenWorkspace?: () => void;
  onOpenSettings?: () => void;
}

export interface HeaderActions {
  onToggleSurface?: () => void;
}

interface UseKeyboardDispatchOptions {
  focusedRowIndex: number;
  setFocusedRowIndex: (index: number | ((prev: number) => number)) => void;
  nestedFocusIndex: number;
  setNestedFocusIndex: (index: number | ((prev: number) => number)) => void;
  pendingDeleteIndex: number;
  setPendingDeleteIndex: (index: number) => void;
  expandedRowKey: string | number | null;
  setExpandedRowKey: (key: string | number | null) => void;
  nestedRowCount: number;
  isShortcutsOverlayVisible: boolean;
  setIsShortcutsOverlayVisible: (visible: boolean | ((prev: boolean) => boolean)) => void;
  isTourOpen: boolean;
  containerRef: RefObject<HTMLDivElement | null>;
  onTabChange: (tab: string) => void;
  visibleRowCount: number;
  visibleRowIds: readonly (string | number)[];
  hasNextPage: boolean;
  hasPrevPage: boolean;
  onNextPage?: () => void;
  onPrevPage?: () => void;
  rowActions: RowActions;
  footerActions: FooterActions;
  headerActions: HeaderActions;
  onCycleTheme?: () => void;
  onToggleCompactMode?: () => void;
  focusLastRowOnPageChange: RefObject<boolean>;
}

function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || (el as HTMLElement).isContentEditable;
}

function isOverlayOpen(): boolean {
  return (
    document.querySelector(
      '.ant-popconfirm, .ant-popover:not(.ant-popover-hidden), .ant-modal-root, .ant-dropdown:not(.ant-dropdown-hidden)',
    ) !== null
  );
}

export function useKeyboardDispatch(options: UseKeyboardDispatchOptions): void {
  const {
    focusedRowIndex,
    setFocusedRowIndex,
    nestedFocusIndex,
    setNestedFocusIndex,
    pendingDeleteIndex,
    setPendingDeleteIndex,
    expandedRowKey,
    setExpandedRowKey,
    nestedRowCount,
    isShortcutsOverlayVisible,
    setIsShortcutsOverlayVisible,
    isTourOpen,
    containerRef,
    onTabChange,
    visibleRowCount,
    visibleRowIds,
    hasNextPage,
    hasPrevPage,
    onNextPage,
    onPrevPage,
    rowActions,
    footerActions,
    headerActions,
    onCycleTheme,
    onToggleCompactMode,
    focusLastRowOnPageChange,
  } = options;

  const { onToggleRow, onEditRow, onCopyRow, onDeleteRow, onAddRule, onExpandRow, onCollapseRow, onPauseRow } =
    rowActions;

  const { onToggleRecording, onToggleRulesPause, onToggleOptions, onOpenWorkspace, onOpenSettings } = footerActions;
  const { onToggleSurface } = headerActions;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const key = e.key;

      // Block Cmd/Ctrl+A (select all) — not useful in popup, except in input fields
      if (key === 'a' && (e.metaKey || e.ctrlKey) && !isInputFocused()) {
        e.preventDefault();
        return;
      }

      // Shortcuts overlay toggle — always available, even while the
      // overlay itself is showing, so the user can dismiss it with the
      // same key they opened it with.
      if (!isInputFocused() && matchesPopupShortcut(e, 'toggle-shortcuts-help')) {
        e.preventDefault();
        setIsShortcutsOverlayVisible((prev: boolean) => !prev);
        return;
      }

      // Close overlay with Escape
      if (key === 'Escape' && isShortcutsOverlayVisible) {
        e.preventDefault();
        e.stopImmediatePropagation();
        setIsShortcutsOverlayVisible(false);
        return;
      }

      if (isShortcutsOverlayVisible) return;

      // Tour is open — let Escape and arrow keys through for tour navigation, block everything else
      if (isTourOpen) return;

      // Toggle options dropdown — must be handled before isOverlayOpen() bail-out
      // so pressing the bound key again can close the dropdown
      if (!isInputFocused() && onToggleOptions && matchesPopupShortcut(e, 'toggle-options-menu')) {
        e.preventDefault();
        onToggleOptions();
        return;
      }

      // Open settings — handled here (before the modifier bail-out below)
      // because its default chord `mod+,` carries a modifier key, and
      // because it should fire from any popup context, not just the
      // focused row mode.
      if (!isInputFocused() && onOpenSettings && matchesPopupShortcut(e, 'open-settings')) {
        e.preventDefault();
        onOpenSettings();
        return;
      }

      // Toggle surface (popup ↔ side panel). Handled alongside the
      // other modifier-carrying chrome actions so it fires from any
      // context — the user shouldn't have to leave row focus to flip
      // the surface.
      if (!isInputFocused() && onToggleSurface && matchesPopupShortcut(e, 'toggle-surface')) {
        e.preventDefault();
        onToggleSurface();
        return;
      }

      if (isOverlayOpen()) return;

      // Pending delete confirmation — Enter or the delete-row chord confirms.
      if (pendingDeleteIndex >= 0) {
        e.preventDefault();
        if ((key === 'Enter' || matchesPopupShortcut(e, 'delete-row')) && onDeleteRow) {
          onDeleteRow(pendingDeleteIndex);
        }
        setPendingDeleteIndex(-1);
        return;
      }

      // Escape: only intercept for search bar and overlays.
      // Otherwise let the browser close the popup.
      if (key === 'Escape') {
        if (isInputFocused()) {
          // First Escape clears search text (handled by the input's onKeyDown).
          // Second Escape (when input is empty) blurs and enters row navigation.
          (document.activeElement as HTMLElement).blur();
          if (focusedRowIndex < 0) setFocusedRowIndex(0);
          e.preventDefault();
          return;
        }
        return;
      }

      // Enter in search input
      if (key === 'Enter' && isInputFocused()) {
        (document.activeElement as HTMLElement).blur();
        if (focusedRowIndex < 0) setFocusedRowIndex(0);
        e.preventDefault();
        return;
      }

      // Prevent Tab from moving focus
      if (key === 'Tab') {
        e.preventDefault();
        return;
      }

      if (isInputFocused()) return;

      // Ignore single-key shortcuts when a modifier is held (e.g. Ctrl+R to reload)
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      // Tab switching
      if (matchesPopupShortcut(e, 'tab-this-page')) {
        e.preventDefault();
        onTabChange('active-workbench');
        return;
      }
      if (matchesPopupShortcut(e, 'tab-all-rules')) {
        e.preventDefault();
        onTabChange('all-workbench');
        return;
      }
      if (matchesPopupShortcut(e, 'tab-collections')) {
        e.preventDefault();
        onTabChange('collections');
        return;
      }

      // Focus search
      if (matchesPopupShortcut(e, 'focus-search')) {
        e.preventDefault();
        const activePane = containerRef.current?.querySelector('.ant-tabs-tabpane-active') ?? containerRef.current;
        const searchInput = activePane?.querySelector<HTMLInputElement>(
          '.ant-input-search input, .ant-input-affix-wrapper input',
        );
        if (searchInput) {
          setFocusedRowIndex(-1);
          searchInput.focus();
          searchInput.select();
        }
        return;
      }

      // Page navigation
      if (matchesPopupShortcut(e, 'prev-page')) {
        e.preventDefault();
        if (hasPrevPage && onPrevPage) {
          onPrevPage();
          setFocusedRowIndex(0);
        }
        return;
      }
      if (matchesPopupShortcut(e, 'next-page')) {
        e.preventDefault();
        if (hasNextPage && onNextPage) {
          onNextPage();
          setFocusedRowIndex(0);
        }
        return;
      }

      // === Nested focus mode (inside expanded row's sub-table) ===
      if (nestedFocusIndex >= 0 && focusedRowIndex >= 0) {
        if (matchesPopupShortcut(e, 'move-down')) {
          e.preventDefault();
          if (nestedRowCount > 0) {
            setNestedFocusIndex((prev: number) => (prev + 1 >= nestedRowCount ? 0 : prev + 1));
          }
          return;
        }
        if (matchesPopupShortcut(e, 'move-up')) {
          e.preventDefault();
          if (nestedRowCount > 0) {
            setNestedFocusIndex((prev: number) => (prev <= 0 ? nestedRowCount - 1 : prev - 1));
          }
          return;
        }
        if (matchesPopupShortcut(e, 'collapse-row')) {
          e.preventDefault();
          setNestedFocusIndex(-1);
          setExpandedRowKey(null);
          return;
        }
        if (matchesPopupShortcut(e, 'copy-value') && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          // Copy nested row URL — this is the one place we touch DOM for a user action
          const activePane = containerRef.current?.querySelector('.ant-tabs-tabpane-active') ?? containerRef.current;
          if (activePane) {
            const parentRows = activePane.querySelectorAll('tr.ant-table-row[data-row-key]');
            const parentRow = parentRows[focusedRowIndex];
            const expandedRow = parentRow?.nextElementSibling;
            if (expandedRow?.classList.contains('ant-table-expanded-row')) {
              const nestedRows = expandedRow.querySelectorAll('.ant-table-row[data-row-key]');
              const nestedRow = nestedRows[nestedFocusIndex];
              const copyIcon = nestedRow?.querySelector('.value-copy-icon') as HTMLElement | null;
              if (copyIcon) copyIcon.click();
            }
          }
          return;
        }
        if (matchesPopupShortcut(e, 'toggle-row')) {
          e.preventDefault();
          // Toggle the switch in the focused nested row
          const activePane = containerRef.current?.querySelector('.ant-tabs-tabpane-active') ?? containerRef.current;
          if (activePane) {
            const parentRows = activePane.querySelectorAll('tr.ant-table-row[data-row-key]');
            const parentRow = parentRows[focusedRowIndex];
            const expandedRow = parentRow?.nextElementSibling;
            if (expandedRow?.classList.contains('ant-table-expanded-row')) {
              const nestedRows = expandedRow.querySelectorAll('.ant-table-row[data-row-key]');
              const nestedRow = nestedRows[nestedFocusIndex];
              const toggle = nestedRow?.querySelector('.ant-switch') as HTMLButtonElement | null;
              if (toggle) toggle.click();
            }
          }
          return;
        }
        // Other keys in nested mode — don't process as parent actions
        return;
      }

      // === Parent row navigation ===
      if (matchesPopupShortcut(e, 'move-down')) {
        e.preventDefault();
        if (visibleRowCount === 0) return;
        setFocusedRowIndex((prev: number) => {
          const next = prev + 1;
          if (next >= visibleRowCount) {
            if (hasNextPage && onNextPage) {
              onNextPage();
              return 0;
            }
            return 0;
          }
          return next;
        });
        return;
      }
      if (matchesPopupShortcut(e, 'move-up')) {
        e.preventDefault();
        if (visibleRowCount === 0) return;
        setFocusedRowIndex((prev: number) => {
          if (prev <= 0) {
            if (hasPrevPage && onPrevPage) {
              onPrevPage();
              focusLastRowOnPageChange.current = true;
              return 0;
            }
            return visibleRowCount - 1;
          }
          return prev - 1;
        });
        return;
      }

      // === Row actions (when a parent row is focused) ===
      if (focusedRowIndex >= 0) {
        if (matchesPopupShortcut(e, 'expand-row')) {
          e.preventDefault();
          if (onExpandRow) {
            // Tree table mode — expand focused node
            onExpandRow(focusedRowIndex);
          } else {
            const rowId = visibleRowIds[focusedRowIndex] ?? null;
            if (expandedRowKey === rowId && nestedRowCount > 0) {
              setNestedFocusIndex(0);
            } else if (rowId !== null) {
              setExpandedRowKey(rowId);
              (document.activeElement as HTMLElement)?.blur();
            }
          }
          return;
        }
        if (matchesPopupShortcut(e, 'collapse-row')) {
          e.preventDefault();
          if (onCollapseRow) {
            // Tree table mode — collapse focused node
            onCollapseRow(focusedRowIndex);
          } else {
            setExpandedRowKey(null);
          }
          return;
        }
        if (onToggleRow && matchesPopupShortcut(e, 'toggle-row')) {
          e.preventDefault();
          onToggleRow(focusedRowIndex);
          return;
        }
        if (onEditRow && matchesPopupShortcut(e, 'edit-row')) {
          e.preventDefault();
          onEditRow(focusedRowIndex);
          return;
        }
        if (onCopyRow && !e.ctrlKey && !e.metaKey && matchesPopupShortcut(e, 'copy-value')) {
          e.preventDefault();
          onCopyRow(focusedRowIndex);
          return;
        }
        if (onDeleteRow && matchesPopupShortcut(e, 'delete-row')) {
          e.preventDefault();
          setPendingDeleteIndex(focusedRowIndex);
          return;
        }
        // Row-scoped pause — distinct from the global shift+p.
        // Checked here (before global actions) so it wins when a row is
        // focused, and falls through to global pause if no row handler.
        if (onPauseRow && matchesPopupShortcut(e, 'toggle-pause-focused')) {
          e.preventDefault();
          onPauseRow(focusedRowIndex);
          return;
        }
      }

      // Global actions
      if (onAddRule && matchesPopupShortcut(e, 'add-rule')) {
        e.preventDefault();
        onAddRule();
        return;
      }
      if (onToggleRecording && matchesPopupShortcut(e, 'toggle-recording')) {
        e.preventDefault();
        onToggleRecording();
        return;
      }
      if (onToggleRulesPause && matchesPopupShortcut(e, 'toggle-rules-pause')) {
        e.preventDefault();
        onToggleRulesPause();
        return;
      }
      if (onCycleTheme && matchesPopupShortcut(e, 'cycle-theme')) {
        e.preventDefault();
        onCycleTheme();
        return;
      }
      if (onToggleCompactMode && matchesPopupShortcut(e, 'toggle-compact-mode')) {
        e.preventDefault();
        onToggleCompactMode();
        return;
      }
      if (onOpenWorkspace && matchesPopupShortcut(e, 'open-workspace')) {
        e.preventDefault();
        onOpenWorkspace();
        return;
      }
    },
    [
      focusedRowIndex,
      nestedFocusIndex,
      pendingDeleteIndex,
      expandedRowKey,
      nestedRowCount,
      visibleRowCount,
      visibleRowIds,
      hasNextPage,
      hasPrevPage,
      isShortcutsOverlayVisible,
      isTourOpen,
      onTabChange,
      onNextPage,
      onPrevPage,
      onToggleRow,
      onEditRow,
      onCopyRow,
      onDeleteRow,
      onAddRule,
      onExpandRow,
      onCollapseRow,
      onToggleRecording,
      onToggleRulesPause,
      onToggleOptions,
      onOpenWorkspace,
      onCycleTheme,
      onToggleCompactMode,
      setFocusedRowIndex,
      setNestedFocusIndex,
      setIsShortcutsOverlayVisible,
      setPendingDeleteIndex,
      setExpandedRowKey,
      containerRef,
      focusLastRowOnPageChange,
      onOpenSettings,
      onPauseRow,
      onToggleSurface,
    ],
  );

  // Listen on document
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Capture-phase Escape interceptor: only prevent browser from closing
  // the popup when search is focused, shortcuts overlay is open, or
  // an Ant Design popover/dropdown is open.
  useEffect(() => {
    const handleEscapeCapture = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (isShortcutsOverlayVisible || isOverlayOpen() || isInputFocused()) {
        e.preventDefault();
      }
    };
    document.addEventListener('keydown', handleEscapeCapture, true);
    return () => document.removeEventListener('keydown', handleEscapeCapture, true);
  }, [isShortcutsOverlayVisible]);
}
