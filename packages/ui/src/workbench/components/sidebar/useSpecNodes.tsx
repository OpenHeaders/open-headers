import { DeleteOutlined, EditOutlined, FileTextOutlined } from '@ant-design/icons';
import { SPEC_ENTITY_TYPE } from '@openheaders/core/sync';
import { createElement, useMemo } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { iconEl } from './icons';
import type { TreeNode } from './types';

interface UseSpecNodesParams {
  specs: readonly { uid: string; name: string }[];
  filterText: string;
  setRenamingId: (id: string | null) => void;
  confirmDelete: (name: string, onConfirm: () => void) => void;
  renameSpec: (uid: string, name: string) => Promise<unknown> | unknown;
  deleteSpec: (uid: string) => Promise<unknown> | unknown;
  onSelectSpec?: (uid: string, name: string, autoRename?: boolean) => void;
}

export function useSpecNodes(p: UseSpecNodesParams): TreeNode[] {
  const t = useT();
  const lowerFilter = p.filterText.toLowerCase();
  return useMemo((): TreeNode[] => {
    const items: TreeNode[] = [];

    for (const spec of p.specs) {
      if (lowerFilter && !spec.name.toLowerCase().includes(lowerFilter)) continue;
      const id = `spec-${spec.uid}`;
      items.push({
        id,
        kind: 'leaf',
        label: spec.name,
        depth: 0,
        expandable: false,
        icon: iconEl(FileTextOutlined, 'var(--ant-color-text-tertiary, #999)'),
        badge: undefined,
        canRename: true,
        canDelete: true,
        canAddChild: false,
        onOpen: () => p.onSelectSpec?.(spec.uid, spec.name),
        onRename: async (name: string) => {
          void p.renameSpec(spec.uid, name);
        },
        onDelete: () =>
          p.confirmDelete(spec.name, () => {
            void p.deleteSpec(spec.uid);
          }),
        addMenuItems: [
          {
            key: 'rename',
            icon: createElement(EditOutlined),
            label: t('workbench.sidebar.menu.rename'),
            onClick: () => p.setRenamingId(id),
          },
          {
            key: 'delete',
            icon: createElement(DeleteOutlined),
            label: t('workbench.sidebar.menu.delete'),
            danger: true,
            onClick: () =>
              p.confirmDelete(spec.name, () => {
                void p.deleteSpec(spec.uid);
              }),
          },
        ],
        awareness: { entityType: SPEC_ENTITY_TYPE, entityId: spec.uid },
      });
    }
    return items;
  }, [p.specs, lowerFilter, p.renameSpec, p.deleteSpec, p.confirmDelete, p.onSelectSpec, p.setRenamingId, t]);
}
