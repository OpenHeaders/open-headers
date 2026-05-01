import {
  ClearOutlined,
  CodeOutlined,
  DeleteOutlined,
  EditOutlined,
  ExportOutlined,
  FolderOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  RollbackOutlined,
} from '@ant-design/icons';
import type { ItemType } from 'antd/es/menu/interface';
import { createElement } from 'react';
import { buildRuleTypeMenuItemsCE } from '../../rule-type-menu';

export const DEFAULT_TEMPLATE_COLLECTION = 'Default Templates';

export function ruleTypeSubmenu(onAddRule: (type: string) => void): ItemType[] {
  return buildRuleTypeMenuItemsCE(onAddRule) as ItemType[];
}

/**
 * Shared contract for tree-row menus:
 *   `+`   (add)    — only creates. Scoped to the row's container.
 *   `⋯`   (action) — only modifies the row itself. Never creates.
 *
 * Keeping the two sets in separate helpers avoids the old mistake of
 * filtering a single big list per-button, which let modify actions leak
 * into `+` and create actions leak into `⋯`.
 */
export interface ContainerAddMenuOptions {
  /** Rules side — emits a submenu of rule types. */
  onAddRule?: (type: string) => void;
  /** Requests side — single "Add Request" item. */
  onAddRequest?: () => void;
  onAddFolder: () => void;
}

export function containerAddMenuItems({ onAddRule, onAddRequest, onAddFolder }: ContainerAddMenuOptions): ItemType[] {
  const items: ItemType[] = [];
  if (onAddRule) {
    items.push({
      key: 'add-rule',
      icon: createElement(PlusOutlined),
      label: 'Add Rule',
      children: ruleTypeSubmenu(onAddRule),
    });
  }
  if (onAddRequest) {
    items.push({
      key: 'add-request',
      icon: createElement(PlusOutlined),
      label: 'Add Request',
      onClick: onAddRequest,
    });
  }
  items.push({
    key: 'add-folder',
    icon: createElement(FolderOutlined),
    label: 'Add Folder',
    onClick: onAddFolder,
  });
  return items;
}

export interface ContainerActionMenuOptions {
  onRename: () => void;
  onDelete: () => void;
  kind: 'collection' | 'folder';
  /** Pause controls — only surfaced when callers wire them (Rules side). */
  effectivelyPaused?: boolean;
  hasOwnMarker?: boolean;
  hasNestedMarkers?: boolean;
  onTogglePause?: () => void;
  onClearOverride?: () => void;
  onClearNested?: () => void;
  /** "Export…" entry on this container's `⋯`. Wired only when the
   *  caller hooks the workspace-export modal up to the sidebar. */
  onExport?: () => void;
  /** "Edit Variables" entry — collection-kind only. Wired by callers
   *  that have a variables editor for this collection family
   *  (rule / request / template). */
  onOpenVariables?: () => void;
}

export function containerActionMenuItems({
  onRename,
  onDelete,
  kind,
  effectivelyPaused,
  hasOwnMarker,
  hasNestedMarkers,
  onTogglePause,
  onClearOverride,
  onClearNested,
  onExport,
  onOpenVariables,
}: ContainerActionMenuOptions): ItemType[] {
  const noun = kind === 'collection' ? 'Collection' : 'Folder';
  const items: ItemType[] = [];
  if (onTogglePause) {
    items.push({
      key: 'toggle-pause',
      icon: createElement(effectivelyPaused ? PlayCircleOutlined : PauseCircleOutlined),
      label: `${effectivelyPaused ? 'Unpause' : 'Pause'} ${noun}`,
      onClick: onTogglePause,
    });
    if (hasOwnMarker && onClearOverride) {
      items.push({
        key: 'clear-override',
        icon: createElement(RollbackOutlined),
        label: `Reset ${noun} Pause Override`,
        onClick: onClearOverride,
      });
    }
    if (hasNestedMarkers && onClearNested) {
      items.push({
        key: 'clear-nested',
        icon: createElement(ClearOutlined),
        label: 'Clear Nested Pause Overrides',
        onClick: onClearNested,
      });
    }
    items.push({ type: 'divider' as const, key: 'div-pause' });
  }
  items.push({ key: 'rename', icon: createElement(EditOutlined), label: 'Rename', onClick: onRename });
  if (kind === 'collection' && onOpenVariables) {
    items.push({
      key: 'edit-variables',
      icon: createElement(CodeOutlined),
      label: 'Edit Variables',
      onClick: onOpenVariables,
    });
  }
  if (onExport) {
    items.push({ key: 'export', icon: createElement(ExportOutlined), label: 'Export…', onClick: onExport });
  }
  items.push({
    key: 'delete',
    icon: createElement(DeleteOutlined),
    label: 'Delete',
    danger: true,
    onClick: onDelete,
  });
  return items;
}

export function templateCollectionMenuItems(
  onAddFolder: () => void,
  onRename: () => void,
  onDelete: () => void,
  isDefault: boolean,
  onExport?: () => void,
  onOpenVariables?: () => void,
): ItemType[] {
  const items: ItemType[] = [
    { key: 'add-folder', icon: createElement(FolderOutlined), label: 'Add Folder', onClick: onAddFolder },
  ];
  if (!isDefault) {
    items.push({ type: 'divider' as const, key: 'div' });
    items.push({ key: 'rename', icon: createElement(EditOutlined), label: 'Rename', onClick: onRename });
    if (onOpenVariables) {
      items.push({
        key: 'edit-variables',
        icon: createElement(CodeOutlined),
        label: 'Edit Variables',
        onClick: onOpenVariables,
      });
    }
    if (onExport) {
      items.push({ key: 'export', icon: createElement(ExportOutlined), label: 'Export…', onClick: onExport });
    }
    items.push({
      key: 'delete',
      icon: createElement(DeleteOutlined),
      label: 'Delete',
      danger: true,
      onClick: onDelete,
    });
  }
  return items;
}

export function templateFolderMenuItems(
  onAddFolder: () => void,
  onRename: () => void,
  onDelete: () => void,
  onExport?: () => void,
): ItemType[] {
  const items: ItemType[] = [
    { key: 'add-folder', icon: createElement(FolderOutlined), label: 'Add Folder', onClick: onAddFolder },
    { type: 'divider' as const, key: 'div' },
    { key: 'rename', icon: createElement(EditOutlined), label: 'Rename', onClick: onRename },
  ];
  if (onExport) {
    items.push({ key: 'export', icon: createElement(ExportOutlined), label: 'Export…', onClick: onExport });
  }
  items.push({ key: 'delete', icon: createElement(DeleteOutlined), label: 'Delete', danger: true, onClick: onDelete });
  return items;
}
