import {
  CheckCircleOutlined,
  CheckCircleTwoTone,
  DeleteOutlined,
  EditOutlined,
  GlobalOutlined,
  StarFilled,
  StarOutlined,
} from '@ant-design/icons';
import { Tooltip } from 'antd';
import { createElement, useMemo } from 'react';
import { iconEl } from './icons';
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
  setActiveEnvironment: (uid: string | null) => Promise<unknown> | unknown;
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
        icon: iconEl(
          isActive ? CheckCircleTwoTone : GlobalOutlined,
          isActive ? 'var(--ant-color-primary, #1677ff)' : 'var(--ant-color-text-tertiary, #999)',
        ),
        badge: isDefault
          ? createElement(
              Tooltip,
              { title: 'Default environment — used as fallback when the active env is missing a variable.' },
              createElement(StarFilled, { style: { color: 'var(--ant-color-warning, #faad14)', fontSize: 11 } }),
            )
          : undefined,
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
        addMenuItems: [
          {
            key: 'set-active',
            icon: createElement(CheckCircleOutlined),
            label: isActive ? 'Unset active' : 'Set active',
            onClick: () => void p.setActiveEnvironment(isActive ? null : env.uid),
          },
          {
            key: 'set-default',
            icon: createElement(isDefault ? StarFilled : StarOutlined),
            label: isDefault ? 'Unset default' : 'Set as default',
            onClick: () => void p.setDefaultEnvironment(isDefault ? null : env.uid),
          },
          { type: 'divider' as const, key: 'div' },
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
    p.setActiveEnvironment,
    p.setDefaultEnvironment,
    p.confirmDelete,
    p.onSelectEnvironment,
    p.setRenamingId,
  ]);
}
