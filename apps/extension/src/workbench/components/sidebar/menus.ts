import {
  ClearOutlined,
  DeleteOutlined,
  EditOutlined,
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
 * Pause menu for a container (collection or folder). Three actions:
 *   1. Toggle (always shown). Smart toggle that flips effective state by
 *      setting the opposite explicit marker.
 *   2. Reset Override (only when this exact path has its own marker).
 *   3. Clear Nested Overrides (only when descendants carry markers).
 */
export interface ContainerMenuOptions {
  onAddRule: (type: string) => void;
  onAddFolder: () => void;
  onRename: () => void;
  onDelete: () => void;
  effectivelyPaused: boolean;
  hasOwnMarker: boolean;
  hasNestedMarkers: boolean;
  onTogglePause: () => void;
  onClearOverride: () => void;
  onClearNested: () => void;
  kind: 'collection' | 'folder';
}

export function containerMenuItems({
  onAddRule,
  onAddFolder,
  onRename,
  onDelete,
  effectivelyPaused,
  hasOwnMarker,
  hasNestedMarkers,
  onTogglePause,
  onClearOverride,
  onClearNested,
  kind,
}: ContainerMenuOptions): ItemType[] {
  const noun = kind === 'collection' ? 'Collection' : 'Folder';
  return [
    {
      key: 'add-item',
      icon: createElement(PlusOutlined),
      label: 'Add Rule',
      children: ruleTypeSubmenu(onAddRule),
    },
    { key: 'add-folder', icon: createElement(FolderOutlined), label: 'Add Folder', onClick: onAddFolder },
    { type: 'divider' as const, key: 'div-pause' },
    {
      key: 'toggle-pause',
      icon: createElement(effectivelyPaused ? PlayCircleOutlined : PauseCircleOutlined),
      label: `${effectivelyPaused ? 'Unpause' : 'Pause'} ${noun}`,
      onClick: onTogglePause,
    },
    ...(hasOwnMarker
      ? [
          {
            key: 'clear-override',
            icon: createElement(RollbackOutlined),
            label: `Reset ${noun} Pause Override`,
            onClick: onClearOverride,
          },
        ]
      : []),
    ...(hasNestedMarkers
      ? [
          {
            key: 'clear-nested',
            icon: createElement(ClearOutlined),
            label: `Clear Nested Pause Overrides`,
            onClick: onClearNested,
          },
        ]
      : []),
    { type: 'divider' as const, key: 'div' },
    { key: 'rename', icon: createElement(EditOutlined), label: 'Rename', onClick: onRename },
    { key: 'delete', icon: createElement(DeleteOutlined), label: 'Delete', danger: true, onClick: onDelete },
  ];
}

export function templateCollectionMenuItems(
  onAddFolder: () => void,
  onRename: () => void,
  onDelete: () => void,
  isDefault: boolean,
): ItemType[] {
  return [
    { key: 'add-folder', icon: createElement(FolderOutlined), label: 'Add Folder', onClick: onAddFolder },
    ...(!isDefault
      ? [
          { type: 'divider' as const, key: 'div' },
          { key: 'rename', icon: createElement(EditOutlined), label: 'Rename', onClick: onRename },
          { key: 'delete', icon: createElement(DeleteOutlined), label: 'Delete', danger: true, onClick: onDelete },
        ]
      : []),
  ];
}

export function templateFolderMenuItems(
  onAddFolder: () => void,
  onRename: () => void,
  onDelete: () => void,
): ItemType[] {
  return [
    { key: 'add-folder', icon: createElement(FolderOutlined), label: 'Add Folder', onClick: onAddFolder },
    { type: 'divider' as const, key: 'div' },
    { key: 'rename', icon: createElement(EditOutlined), label: 'Rename', onClick: onRename },
    { key: 'delete', icon: createElement(DeleteOutlined), label: 'Delete', danger: true, onClick: onDelete },
  ];
}
