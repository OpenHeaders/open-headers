import {
  CheckCircleFilled,
  CheckCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  StarFilled,
  StarOutlined,
} from '@ant-design/icons';
import { createElement, useMemo } from 'react';
import { scopeBadge } from '../shared/scope-colors';
import type { TreeNode } from './types';

interface UseEnvironmentNodesParams {
  environments: readonly { uid: string; name: string }[];
  activeEnvironmentId: string | null;
  defaultEnvironmentId: string | null;
  filterText: string;
  setRenamingId: (id: string | null) => void;
  confirmDelete: (name: string, onConfirm: () => void) => void;
  renameEnvironment: (uid: string, name: string) => Promise<unknown> | unknown;
  deleteEnvironment: (uid: string) => Promise<unknown> | unknown;
  /** User-driven env pick — must go through the env-switcher service
   *  (`useEnvSwitcher().pickActiveEnvironment`) so the active-env
   *  policy is applied (manual pick recorded, collection-mode side
   *  effects). The raw `setActiveEnvironment` from `useEnvironments`
   *  would be silently reverted by the auto-switch effect. */
  pickActiveEnvironment: (uid: string | null) => void;
  setDefaultEnvironment: (uid: string | null) => Promise<unknown> | unknown;
  onSelectEnvironment?: (uid: string, name: string, autoRename?: boolean) => void;
}

export function useEnvironmentNodes(p: UseEnvironmentNodesParams): TreeNode[] {
  const lowerFilter = p.filterText.toLowerCase();
  return useMemo((): TreeNode[] => {
    const items: TreeNode[] = [];

    for (const env of p.environments) {
      if (lowerFilter && !env.name.toLowerCase().includes(lowerFilter)) continue;
      const id = `env-${env.uid}`;
      const isActive = env.uid === p.activeEnvironmentId;
      const isDefault = env.uid === p.defaultEnvironmentId;
      items.push({
        id,
        kind: 'leaf',
        label: env.name,
        depth: 0,
        expandable: false,
        icon: scopeBadge('environment'),
        badge: undefined,
        canRename: true,
        canDelete: true,
        canAddChild: false,
        onOpen: () => p.onSelectEnvironment?.(env.uid, env.name),
        onRename: async (name: string) => {
          void p.renameEnvironment(env.uid, name);
        },
        onDelete: () =>
          p.confirmDelete(env.name, () => {
            void p.deleteEnvironment(env.uid);
          }),
        hoverActions: [
          {
            icon: createElement(isActive ? CheckCircleFilled : CheckCircleOutlined, {
              style: {
                fontSize: 12,
                color: isActive ? 'var(--ant-color-primary-hover, #4096ff)' : 'var(--ant-color-text-tertiary, #999)',
              },
            }),
            tooltip: isActive ? 'Set inactive' : 'Set active',
            alwaysVisible: isActive,
            onClick: () => p.pickActiveEnvironment(isActive ? null : env.uid),
          },
          {
            icon: createElement(isDefault ? StarFilled : StarOutlined, {
              style: {
                fontSize: 12,
                color: isDefault ? 'var(--ant-color-warning, #faad14)' : 'var(--ant-color-text-tertiary, #999)',
              },
            }),
            tooltip: isDefault ? 'Unset default' : 'Set as default',
            alwaysVisible: isDefault,
            onClick: () => void p.setDefaultEnvironment(isDefault ? null : env.uid),
          },
        ],
        addMenuItems: [
          { key: 'rename', icon: createElement(EditOutlined), label: 'Rename', onClick: () => p.setRenamingId(id) },
          {
            key: 'delete',
            icon: createElement(DeleteOutlined),
            label: 'Delete',
            danger: true,
            onClick: () =>
              p.confirmDelete(env.name, () => {
                void p.deleteEnvironment(env.uid);
              }),
          },
        ],
      });
    }
    return items;
  }, [
    p.environments,
    p.activeEnvironmentId,
    p.defaultEnvironmentId,
    lowerFilter,
    p.renameEnvironment,
    p.deleteEnvironment,
    p.pickActiveEnvironment,
    p.setDefaultEnvironment,
    p.confirmDelete,
    p.onSelectEnvironment,
    p.setRenamingId,
  ]);
}
