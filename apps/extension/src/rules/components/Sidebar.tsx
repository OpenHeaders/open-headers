/**
 * Sidebar — IDE-style tree panel with 3 collapsible sections.
 *
 * Mirrors desktop v5-shell/Sidebar.tsx exactly:
 * - Toolbar: filter, +create, expand/collapse all
 * - 3 collapsible sections (API Requests read-only, Rules functional, Environments read-only)
 * - Full TreeNodeRow rendering from V5.CollectionTree (collection → folder → rule)
 * - Keyboard navigation, inline rename, confirm delete
 */

import {
  AimOutlined,
  BorderLeftOutlined,
  CheckCircleOutlined,
  ClearOutlined,
  DeleteOutlined,
  EditOutlined,
  EllipsisOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  FolderOutlined,
  MenuUnfoldOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  RollbackOutlined,
  SearchOutlined,
  StopOutlined,
} from '@ant-design/icons';
import { useRules } from '@hooks/useRules';
import type { V5 } from '@openheaders/core/types';
import { hasNestedPauseMarkers, isRuleComplete } from '@openheaders/core/utils';
import { call } from '@utils/bridge';
import type { InputRef } from 'antd';
import { App, Dropdown, Input, Modal, Tooltip, theme } from 'antd';
import type { ItemType } from 'antd/es/menu/interface';
import type React from 'react';
import { createElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TEMPLATES_BY_TYPE } from '../rule-templates';
import { buildRuleTypeMenuItems, buildRuleTypeMenuItemsCE } from '../rule-type-menu';
import { useSettingValue } from '../settings/hooks';
import { buildRuleIcon } from './shared/rule-icon';
import { TreeNodeRow } from './sidebar/TreeNodeRow';
import type { TreeNode } from './sidebar/types';
import { renderTwoToneIcon } from './TwoToneIconPicker';

// ── Icon helpers ───────────────────────────────────────────────────

function iconEl(Icon: typeof StopOutlined, color: string, size = 12): React.ReactNode {
  return createElement(Icon, { style: { color, fontSize: size } });
}

function ruleTypeSubmenu(onAddRule: (type: string) => void): ItemType[] {
  return buildRuleTypeMenuItemsCE(onAddRule) as ItemType[];
}

/**
 * Pause menu for a container (collection or folder). Three actions:
 *   1. Toggle (always shown). Smart toggle that flips effective state by
 *      setting the opposite explicit marker. Even when the node already
 *      inherits the desired state, setting the marker pins it so a parent
 *      flip can't silently change it back — the same closest-specifier
 *      override model `.gitignore` and uBlock use.
 *   2. Reset Override (only when this exact path has its own marker).
 *      Removes the explicit pin so the node falls back to inheriting.
 *   3. Clear Nested Overrides (only when descendants carry markers).
 *      Wipes every marker strictly under this node — power-user cleanup.
 */
interface ContainerMenuOptions {
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

function containerMenuItems({
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

const DEFAULT_TEMPLATE_COLLECTION = 'Default Templates';

function templateCollectionMenuItems(
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

function templateFolderMenuItems(onAddFolder: () => void, onRename: () => void, onDelete: () => void): ItemType[] {
  return [
    { key: 'add-folder', icon: createElement(FolderOutlined), label: 'Add Folder', onClick: onAddFolder },
    { type: 'divider' as const, key: 'div' },
    { key: 'rename', icon: createElement(EditOutlined), label: 'Rename', onClick: onRename },
    { key: 'delete', icon: createElement(DeleteOutlined), label: 'Delete', danger: true, onClick: onDelete },
  ];
}

// ── Section header ─────────────────────────────────────────────────

function SectionHeader({
  title,
  expanded,
  onToggle,
  actions,
}: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  actions?: React.ReactNode;
}) {
  const { token } = theme.useToken();
  return (
    <div
      className="rules-sidebar-section"
      style={{ color: token.colorTextSecondary }}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onToggle();
      }}
      role="button"
      tabIndex={-1}
    >
      <span className="rules-sidebar-section-title">
        <span
          style={{
            display: 'inline-block',
            fontSize: 10,
            marginRight: 4,
            transition: 'transform 0.2s ease',
            transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
          }}
        >
          &#9654;
        </span>
        {title}
      </span>
      {actions && (
        // biome-ignore lint/a11y/noStaticElementInteractions: stopPropagation guard for nested click handlers
        <span onClick={(e) => e.stopPropagation()} onKeyDown={() => {}}>
          {actions}
        </span>
      )}
    </div>
  );
}

// ── Props ──────────────────────────────────────────────────────────

interface SidebarProps {
  activeTabId?: string | null;
  onSelectRule: (uid: string) => void;
  onCreateRule: (type: string, context?: { collectionId: string; folderPath?: string }, templateKey?: string) => void;
  onDeleteRule?: (uid: string) => void;
  onOpenCollectionOverview?: (uid: string, name: string, autoRename?: boolean) => void;
  onOpenFolderOverview?: (uid: string, name: string, autoRename?: boolean) => void;
  /** Open a template for editing. */
  onSelectTemplate?: (uid: string) => void;
  /** Open template collection overview tab. */
  onOpenTemplateCollectionOverview?: (uid: string, name: string, autoRename?: boolean) => void;
  /** Open template folder overview tab. */
  onOpenTemplateFolderOverview?: (uid: string, name: string, autoRename?: boolean) => void;
  /** Ref to the filter input for keyboard shortcut focus. */
  filterRef?: React.Ref<InputRef>;
}

const Sidebar: React.FC<SidebarProps> = ({
  activeTabId,
  onSelectRule,
  onCreateRule,
  onDeleteRule,
  onOpenCollectionOverview,
  onOpenFolderOverview,
  onSelectTemplate,
  onOpenTemplateCollectionOverview,
  onOpenTemplateFolderOverview,
  filterRef,
}) => {
  const { token } = theme.useToken();
  const {
    rules,
    localCollectionTrees,
    isConnected,
    pauseMarkers,
    pausedUids,
    togglePause,
    clearPauseOverride,
    clearNestedPauseOverrides,
    updateLocalRule,
    deleteLocalCollection,
    createLocalFolder,
    renameLocalFolder,
    deleteLocalFolder,
    renameLocalCollection,
    createLocalCollection,
    templateCollectionTrees,
    deleteTemplate,
    updateTemplate,
    createTemplateCollection,
    renameTemplateCollection,
    deleteTemplateCollection,
    createTemplateFolder,
    renameTemplateFolder,
    deleteTemplateFolder,
  } = useRules();
  const { message } = App.useApp();

  const [filterText, setFilterText] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [sectionsExpanded, setSectionsExpanded] = useState<Record<string, boolean>>({
    requests: false,
    rules: true,
    templates: false,
    environments: false,
  });
  const [openWithSingleClick, setOpenWithSingleClick] = useState(true);
  const [openCollectionsWithSingleClick, setOpenCollectionsWithSingleClick] = useState(true);
  const [openFoldersWithSingleClick, setOpenFoldersWithSingleClick] = useState(true);
  const [alwaysSelectOpened, setAlwaysSelectOpened] = useState(true);
  const [optionsMenuOpen, setOptionsMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const toggleSection = useCallback((key: string) => {
    setSectionsExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const toggleExpand = useCallback((key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setSectionsExpanded({ requests: true, rules: true, templates: true, environments: true });
    const allKeys = new Set<string>();
    const collectKeys = (nodes: V5.TreeNode[]) => {
      for (const n of nodes) {
        if (n.type === 'folder') {
          allKeys.add(`folder-${n.uid}`);
          collectKeys(n.children);
        }
      }
    };
    for (const col of localCollectionTrees) {
      allKeys.add(`col-${col.uid}`);
      collectKeys(col.tree);
    }
    for (const col of templateCollectionTrees) {
      allKeys.add(`tpl-col-${col.uid}`);
      collectKeys(col.tree);
    }
    setExpandedKeys(allKeys);
  }, [localCollectionTrees, templateCollectionTrees]);

  const collapseAll = useCallback(() => {
    setSectionsExpanded({ requests: false, rules: false, templates: false, environments: false });
    setExpandedKeys(new Set());
  }, []);

  const confirmOnDelete = useSettingValue('general.confirmOnDelete');
  const confirmDelete = useCallback(
    (name: string, onConfirm: () => void) => {
      if (!confirmOnDelete) {
        onConfirm();
        return;
      }
      Modal.confirm({
        title: <span style={{ fontSize: 13, fontWeight: 600 }}>Delete item?</span>,
        width: 380,
        content: (
          <p style={{ fontSize: 12, margin: '4px 0 0' }}>
            Are you sure you want to delete <strong>{name}</strong>? This action cannot be undone.
          </p>
        ),
        okText: 'Delete',
        okButtonProps: { danger: true, size: 'small' },
        cancelButtonProps: { size: 'small' },
        onOk: onConfirm,
      });
    },
    [confirmOnDelete],
  );

  const handleToggleRule = useCallback(
    (ruleUid: string, enabled: boolean) => {
      call('toggleRule', { ruleId: ruleUid, enabled })
        .then((resp) => {
          if (!resp?.success) message.error('Failed to toggle rule');
        })
        .catch(() => message.error('Failed to toggle rule'));
    },
    [message],
  );

  // ── Build tree nodes from V5.CollectionTree[] ────────────────

  const lowerFilter = filterText.toLowerCase();

  /** Walk V5.TreeNode[] (folder/rule) and produce sidebar TreeNode[] */
  const walkV5Tree = useCallback(
    (v5Nodes: V5.TreeNode[], depth: number, parentId: string, collectionId: string): TreeNode[] => {
      const items: TreeNode[] = [];

      for (const node of v5Nodes) {
        if (node.type === 'folder') {
          const fid = `folder-${node.uid}`;
          const isExpanded = expandedKeys.has(fid);
          const folderPaused = pausedUids.has(node.uid);
          const folderHasOwnMarker = pauseMarkers.has(node.path);
          const folderHasNestedMarkers = hasNestedPauseMarkers(node.path, pauseMarkers);
          const onAddRule = (type: string) => onCreateRule(type, { collectionId, folderPath: node.path });
          const onAddFolder = () => {
            void createLocalFolder('New Folder', node.path).then((f) => {
              if (f) {
                setExpandedKeys((prev) => {
                  const next = new Set(prev);
                  next.add(fid);
                  return next;
                });
                onOpenFolderOverview?.(f.uid, f.name, true);
              }
            });
          };

          items.push({
            id: fid,
            kind: 'folder',
            label: node.name,
            depth,
            expandable: true,
            parentId,
            icon: iconEl(
              FolderOutlined,
              folderPaused ? 'var(--ant-color-warning, #faad14)' : 'var(--ant-color-text-tertiary, #999)',
            ),
            canRename: true,
            canDelete: true,
            canAddChild: true,
            onOpen: () => {
              toggleExpand(fid);
              onOpenFolderOverview?.(node.uid, node.name);
            },
            onRename: async (name: string) => {
              void renameLocalFolder(node.uid, name);
            },
            onDelete: () =>
              confirmDelete(node.name, () => {
                void deleteLocalFolder(node.uid);
              }),
            addMenuItems: containerMenuItems({
              onAddRule,
              onAddFolder,
              onRename: () => setRenamingId(fid),
              onDelete: () =>
                confirmDelete(node.name, () => {
                  void deleteLocalFolder(node.uid);
                }),
              effectivelyPaused: folderPaused,
              hasOwnMarker: folderHasOwnMarker,
              hasNestedMarkers: folderHasNestedMarkers,
              onTogglePause: () => togglePause(node.path),
              onClearOverride: () => clearPauseOverride(node.path),
              onClearNested: () => clearNestedPauseOverrides(node.path),
              kind: 'folder',
            }),
          });
          if (isExpanded) {
            const children = walkV5Tree(node.children, depth + 1, fid, collectionId);
            if (children.length > 0) {
              items.push(...children);
            } else {
              items.push({
                id: `${fid}-empty`,
                kind: 'placeholder',
                label: '',
                depth: depth + 1,
                expandable: false,
                icon: null,
                canRename: false,
                canDelete: false,
                canAddChild: false,
                placeholderTitle: 'Folder is empty',
                placeholderMessage: 'Add a rule or folder to get started.',
                placeholderActions: [
                  {
                    label: 'Add rule',
                    icon: iconEl(PlusOutlined, 'var(--ant-color-text-tertiary, #999)'),
                    onClick: () => onAddRule('header'),
                  },
                  {
                    label: 'Add folder',
                    icon: iconEl(FolderOutlined, 'var(--ant-color-text-tertiary, #999)'),
                    onClick: onAddFolder,
                  },
                ],
              });
            }
          }
        } else if (node.type === 'rule') {
          if (lowerFilter && !node.name.toLowerCase().includes(lowerFilter)) continue;
          const rid = `rule-${node.uid}`;
          const fullRule = rules.find((r) => r.uid === node.uid);
          const complete = fullRule ? isRuleComplete(fullRule) : true;
          const rulePaused = pausedUids.has(node.uid);
          const isActive = node.enabled && complete && !rulePaused;

          // Badge: paused (yellow) takes precedence over draft/off (gray).
          // Paused communicates "ancestor is paused" — the most actionable
          // status — so we surface it ahead of incomplete or disabled.
          let badge: React.ReactNode;
          if (rulePaused) {
            badge = createElement(
              'span',
              { style: { fontSize: 9, color: 'var(--ant-color-warning, #faad14)', marginLeft: 'auto' } },
              'paused',
            );
          } else if (!complete) {
            badge = createElement(
              'span',
              { style: { fontSize: 9, color: 'var(--ant-color-text-tertiary, #999)', marginLeft: 'auto' } },
              'draft',
            );
          } else if (!node.enabled) {
            badge = createElement(
              'span',
              { style: { fontSize: 9, color: 'var(--ant-color-text-tertiary, #999)', marginLeft: 'auto' } },
              'off',
            );
          }

          items.push({
            id: rid,
            kind: 'leaf',
            label: node.name,
            depth,
            expandable: false,
            parentId,
            icon: buildRuleIcon({ ruleType: node.ruleType, rule: fullRule, isActive, paused: rulePaused }),
            badge,
            canRename: true,
            canDelete: true,
            canAddChild: false,
            hoverAction: node.enabled
              ? {
                  icon: iconEl(StopOutlined, 'var(--ant-color-text-tertiary, #999)', 11),
                  tooltip: 'Disable rule',
                  onClick: () => handleToggleRule(node.uid, false),
                }
              : {
                  icon: iconEl(CheckCircleOutlined, 'var(--ant-color-text-tertiary, #999)', 11),
                  tooltip: 'Enable rule',
                  onClick: () => handleToggleRule(node.uid, true),
                },
            onOpen: () => onSelectRule(node.uid),
            onRename: fullRule
              ? async (name: string) => {
                  void updateLocalRule(node.uid, { name });
                }
              : undefined,
            onDelete: () =>
              confirmDelete(node.name, () => {
                onDeleteRule?.(node.uid);
              }),
          });
        }
      }

      return items;
    },
    [
      expandedKeys,
      lowerFilter,
      rules,
      pauseMarkers,
      pausedUids,
      togglePause,
      clearPauseOverride,
      clearNestedPauseOverrides,
      toggleExpand,
      onCreateRule,
      onSelectRule,
      onDeleteRule,
      handleToggleRule,
      updateLocalRule,
      createLocalFolder,
      renameLocalFolder,
      deleteLocalFolder,
      confirmDelete,
      onOpenFolderOverview,
    ],
  );

  const rulesNodes = useMemo((): TreeNode[] => {
    const items: TreeNode[] = [];

    for (const collection of localCollectionTrees) {
      if (lowerFilter && !collection.name.toLowerCase().includes(lowerFilter)) {
        // Check if any rule in tree matches
        const hasMatch = collection.tree.some((n) => n.type === 'rule' && n.name.toLowerCase().includes(lowerFilter));
        if (!hasMatch) continue;
      }

      const colId = `col-${collection.uid}`;
      const isExpanded = expandedKeys.has(colId);
      const onAddRule = (type: string) => onCreateRule(type, { collectionId: collection.uid });
      const onAddFolder = () => {
        void createLocalFolder('New Folder', collection.path).then((f) => {
          if (f) {
            setExpandedKeys((prev) => {
              const next = new Set(prev);
              next.add(colId);
              return next;
            });
            onOpenFolderOverview?.(f.uid, f.name, true);
          }
        });
      };

      const colPaused = pausedUids.has(collection.uid);
      const colHasOwnMarker = pauseMarkers.has(collection.path);
      const colHasNestedMarkers = hasNestedPauseMarkers(collection.path, pauseMarkers);
      items.push({
        id: colId,
        kind: 'group',
        label: collection.name,
        depth: 0,
        expandable: true,
        icon: iconEl(
          FolderOpenOutlined,
          colPaused ? 'var(--ant-color-warning, #faad14)' : 'var(--ant-color-text-tertiary, #999)',
        ),
        canRename: true,
        canDelete: true,
        canAddChild: true,
        onOpen: () => {
          toggleExpand(colId);
          onOpenCollectionOverview?.(collection.uid, collection.name);
        },
        onRename: async (name) => {
          void renameLocalCollection(collection.uid, name);
        },
        onDelete: () =>
          confirmDelete(collection.name, () => {
            void deleteLocalCollection(collection.uid);
          }),
        addMenuItems: containerMenuItems({
          onAddRule,
          onAddFolder,
          onRename: () => setRenamingId(colId),
          onDelete: () =>
            confirmDelete(collection.name, () => {
              void deleteLocalCollection(collection.uid);
            }),
          effectivelyPaused: colPaused,
          hasOwnMarker: colHasOwnMarker,
          hasNestedMarkers: colHasNestedMarkers,
          onTogglePause: () => togglePause(collection.path),
          onClearOverride: () => clearPauseOverride(collection.path),
          onClearNested: () => clearNestedPauseOverrides(collection.path),
          kind: 'collection',
        }),
      });

      if (isExpanded) {
        const children = walkV5Tree(collection.tree, 1, colId, collection.uid);
        if (children.length > 0) {
          items.push(...children);
        } else {
          items.push({
            id: `${colId}-empty`,
            kind: 'placeholder',
            label: '',
            depth: 1,
            expandable: false,
            icon: null,
            canRename: false,
            canDelete: false,
            canAddChild: false,
            placeholderTitle: 'Collection is empty',
            placeholderMessage: 'Add a rule or folder to get started.',
            placeholderActions: [
              {
                label: 'Add rule',
                icon: iconEl(PlusOutlined, 'var(--ant-color-text-tertiary, #999)'),
                onClick: () => onAddRule('header'),
              },
              {
                label: 'Add folder',
                icon: iconEl(FolderOutlined, 'var(--ant-color-text-tertiary, #999)'),
                onClick: onAddFolder,
              },
            ],
          });
        }
      }
    }

    return items;
  }, [
    localCollectionTrees,
    lowerFilter,
    expandedKeys,
    pauseMarkers,
    pausedUids,
    togglePause,
    clearPauseOverride,
    clearNestedPauseOverrides,
    toggleExpand,
    onCreateRule,
    walkV5Tree,
    renameLocalCollection,
    deleteLocalCollection,
    createLocalFolder,
    confirmDelete,
    onOpenCollectionOverview,
    onOpenFolderOverview,
  ]);

  // ── Flat items for keyboard nav ──────────────────────────────

  // ── Template tree nodes ────────────────────────────────────────

  const walkTemplateTree = useCallback(
    (v5Nodes: V5.TreeNode[], depth: number, parentId: string, collectionId: string): TreeNode[] => {
      const items: TreeNode[] = [];

      for (const node of v5Nodes) {
        if (node.type === 'folder') {
          const fid = `tpl-folder-${node.uid}`;
          const isExpanded = expandedKeys.has(fid);
          const onAddFolder = () => {
            void createTemplateFolder('New Folder', node.path).then((f) => {
              if (f) {
                setExpandedKeys((prev) => {
                  const next = new Set(prev);
                  next.add(fid);
                  return next;
                });
                onOpenTemplateFolderOverview?.(f.uid, f.name, true);
              }
            });
          };

          items.push({
            id: fid,
            kind: 'folder',
            label: node.name,
            depth,
            expandable: true,
            parentId,
            icon: iconEl(FolderOutlined, 'var(--ant-color-text-tertiary, #999)'),
            canRename: true,
            canDelete: true,
            canAddChild: true,
            onOpen: () => {
              toggleExpand(fid);
              onOpenTemplateFolderOverview?.(node.uid, node.name);
            },
            onRename: async (name: string) => {
              void renameTemplateFolder(node.uid, name);
            },
            onDelete: () =>
              confirmDelete(node.name, () => {
                void deleteTemplateFolder(node.uid);
              }),
            addMenuItems: templateFolderMenuItems(
              onAddFolder,
              () => setRenamingId(fid),
              () =>
                confirmDelete(node.name, () => {
                  void deleteTemplateFolder(node.uid);
                }),
            ),
          });
          if (isExpanded) {
            const children = walkTemplateTree(node.children, depth + 1, fid, collectionId);
            if (children.length > 0) {
              items.push(...children);
            } else {
              items.push({
                id: `${fid}-empty`,
                kind: 'placeholder',
                label: '',
                depth: depth + 1,
                expandable: false,
                icon: null,
                canRename: false,
                canDelete: false,
                canAddChild: false,
                placeholderTitle: 'Folder is empty',
                placeholderMessage: 'Save a rule as template to populate.',
              });
            }
          }
        } else if (node.type === 'template') {
          if (lowerFilter && !node.name.toLowerCase().includes(lowerFilter)) continue;
          const tid = `tpl-${node.uid}`;
          const tplNode = node as V5.TemplateNode;

          items.push({
            id: tid,
            kind: 'leaf',
            label: node.name,
            depth,
            expandable: false,
            parentId,
            icon:
              renderTwoToneIcon(tplNode.icon, { fontSize: 12 }) ||
              iconEl(FileTextOutlined, 'var(--ant-color-text-tertiary, #999)'),
            canRename: true,
            canDelete: true,
            canAddChild: false,
            onOpen: () => onSelectTemplate?.(node.uid),
            onRename: async (name: string) => {
              void updateTemplate(node.uid, { name });
            },
            onDelete: () =>
              confirmDelete(node.name, () => {
                void deleteTemplate(node.uid);
              }),
          });
        }
      }

      return items;
    },
    [
      expandedKeys,
      lowerFilter,
      toggleExpand,
      createTemplateFolder,
      renameTemplateFolder,
      deleteTemplateFolder,
      updateTemplate,
      deleteTemplate,
      confirmDelete,
      onSelectTemplate,
      onOpenTemplateFolderOverview,
    ],
  );

  // ── System (built-in) template nodes ──────────────────────────

  const RULE_TYPE_LABEL: Record<string, string> = {
    header: 'Header',
    block: 'Block',
    redirect: 'Redirect',
    'query-param': 'Query Param',
    inject: 'Inject',
    delay: 'Delay',
    body: 'API Request Body',
    mock: 'API Response',
  };

  const systemTemplateNodes = useMemo((): TreeNode[] => {
    const items: TreeNode[] = [];
    const colId = 'sys-tpl-col';
    const isExpanded = expandedKeys.has(colId);

    items.push({
      id: colId,
      kind: 'group',
      label: 'System Templates',
      depth: 0,
      expandable: true,
      icon: iconEl(FolderOpenOutlined, 'var(--ant-color-text-tertiary, #999)'),
      canRename: false,
      canDelete: false,
      canAddChild: false,
      onOpen: () => toggleExpand(colId),
    });

    if (isExpanded) {
      for (const [ruleType, tpls] of Object.entries(TEMPLATES_BY_TYPE)) {
        if (tpls.length === 0) continue;
        const filteredTpls = lowerFilter ? tpls.filter((t) => t.name.toLowerCase().includes(lowerFilter)) : tpls;
        if (lowerFilter && filteredTpls.length === 0) continue;

        const folderId = `sys-tpl-${ruleType}`;
        const folderExpanded = expandedKeys.has(folderId);

        items.push({
          id: folderId,
          kind: 'folder',
          label: RULE_TYPE_LABEL[ruleType] ?? ruleType,
          depth: 1,
          expandable: true,
          parentId: colId,
          icon: iconEl(FolderOutlined, 'var(--ant-color-text-tertiary, #999)'),
          canRename: false,
          canDelete: false,
          canAddChild: false,
          onOpen: () => toggleExpand(folderId),
        });

        if (folderExpanded) {
          for (const tpl of filteredTpls) {
            items.push({
              id: `sys-tpl-item-${tpl.key}`,
              kind: 'leaf',
              label: tpl.name,
              depth: 2,
              expandable: false,
              parentId: folderId,
              icon: createElement('span', { style: { fontSize: 12 } }, tpl.icon),
              canRename: false,
              canDelete: false,
              canAddChild: false,
              onOpen: () => onCreateRule(ruleType, undefined, tpl.key),
            });
          }
        }
      }
    }

    return items;
    // biome-ignore lint/correctness/useExhaustiveDependencies: RULE_TYPE_LABEL is a module-level constant, stable across renders
  }, [expandedKeys, lowerFilter, toggleExpand, onCreateRule, RULE_TYPE_LABEL]);

  // ── User template collection nodes ────────────────────────────

  const templateNodes = useMemo((): TreeNode[] => {
    const items: TreeNode[] = [];

    for (const collection of templateCollectionTrees) {
      if (lowerFilter && !collection.name.toLowerCase().includes(lowerFilter)) {
        const hasMatch = collection.tree.some(
          (n) => n.type === 'template' && n.name.toLowerCase().includes(lowerFilter),
        );
        if (!hasMatch) continue;
      }

      const colId = `tpl-col-${collection.uid}`;
      const isExpanded = expandedKeys.has(colId);
      const isDefault = collection.name === DEFAULT_TEMPLATE_COLLECTION;
      const onAddFolder = () => {
        void createTemplateFolder('New Folder', collection.path).then((f) => {
          if (f) {
            setExpandedKeys((prev) => {
              const next = new Set(prev);
              next.add(colId);
              return next;
            });
            onOpenTemplateFolderOverview?.(f.uid, f.name, true);
          }
        });
      };

      items.push({
        id: colId,
        kind: 'group',
        label: collection.name,
        depth: 0,
        expandable: true,
        icon: iconEl(FolderOpenOutlined, 'var(--ant-color-text-tertiary, #999)'),
        canRename: !isDefault,
        canDelete: !isDefault,
        canAddChild: true,
        onOpen: () => {
          toggleExpand(colId);
          onOpenTemplateCollectionOverview?.(collection.uid, collection.name);
        },
        onRename: !isDefault
          ? async (name) => {
              void renameTemplateCollection(collection.uid, name);
            }
          : undefined,
        onDelete: !isDefault
          ? () =>
              confirmDelete(collection.name, () => {
                void deleteTemplateCollection(collection.uid);
              })
          : undefined,
        addMenuItems: templateCollectionMenuItems(
          onAddFolder,
          () => setRenamingId(colId),
          () =>
            confirmDelete(collection.name, () => {
              void deleteTemplateCollection(collection.uid);
            }),
          isDefault,
        ),
      });

      if (isExpanded) {
        const children = walkTemplateTree(collection.tree, 1, colId, collection.uid);
        if (children.length > 0) {
          items.push(...children);
        } else {
          items.push({
            id: `${colId}-empty`,
            kind: 'placeholder',
            label: '',
            depth: 1,
            expandable: false,
            icon: null,
            canRename: false,
            canDelete: false,
            canAddChild: false,
            placeholderTitle: 'No templates yet',
            placeholderMessage: 'Save a rule as template from the editor.',
          });
        }
      }
    }

    return items;
  }, [
    templateCollectionTrees,
    lowerFilter,
    expandedKeys,
    toggleExpand,
    walkTemplateTree,
    renameTemplateCollection,
    deleteTemplateCollection,
    createTemplateFolder,
    confirmDelete,
    onOpenTemplateCollectionOverview,
    onOpenTemplateFolderOverview,
  ]);

  // ── Flat items for keyboard nav ──────────────────────────────

  const allFlatItems = useMemo(
    () => [
      ...(sectionsExpanded.rules ? rulesNodes : []),
      ...(sectionsExpanded.templates ? [...systemTemplateNodes, ...templateNodes] : []),
    ],
    [sectionsExpanded.rules, sectionsExpanded.templates, rulesNodes, systemTemplateNodes, templateNodes],
  );

  const isSelected = useCallback(
    (id: string) => {
      if (!alwaysSelectOpened || !activeTabId) return false;
      // Direct match: col-{uid}, folder-{uid}, tpl-col-{uid}, tpl-folder-{uid} tabs
      if (activeTabId === id) return true;
      // Rule tabs: edit-{uid} matches rule-{uid} sidebar node
      if (id.startsWith('rule-') && activeTabId === `edit-${id.replace('rule-', '')}`) return true;
      // Template tabs: tpl-edit-{uid} matches tpl-{uid} sidebar node
      if (id.startsWith('tpl-') && activeTabId === `tpl-edit-${id.replace('tpl-', '')}`) return true;
      return false;
    },
    [activeTabId, alwaysSelectOpened],
  );

  const isFocused = useCallback((id: string) => focusedId === id, [focusedId]);

  const shouldOpenOnSingleClick = useCallback(
    (node: TreeNode) => {
      if (node.kind === 'group') return openCollectionsWithSingleClick;
      if (node.kind === 'folder') return openFoldersWithSingleClick;
      return openWithSingleClick;
    },
    [openWithSingleClick, openCollectionsWithSingleClick, openFoldersWithSingleClick],
  );

  const handleItemClick = useCallback(
    (node: TreeNode) => {
      setFocusedId(node.id);
      if (shouldOpenOnSingleClick(node)) node.onOpen?.();
    },
    [shouldOpenOnSingleClick],
  );

  const handleItemDoubleClick = useCallback(
    (node: TreeNode) => {
      if (!shouldOpenOnSingleClick(node)) node.onOpen?.();
    },
    [shouldOpenOnSingleClick],
  );

  // Select Opened Tab — expand ancestors, focus, and scroll to the active tab's sidebar node.
  // Returns true if the node was found and selected, false otherwise.
  const selectOpenedFile = useCallback((): boolean => {
    if (!activeTabId) return false;

    // Determine which sidebar node ID corresponds to this tab
    let nodeId: string | null = null;
    let section: 'rules' | 'templates' = 'rules';

    if (activeTabId.startsWith('edit-')) {
      nodeId = `rule-${activeTabId.replace('edit-', '')}`;
    } else if (activeTabId.startsWith('tpl-edit-')) {
      nodeId = `tpl-${activeTabId.replace('tpl-edit-', '')}`;
      section = 'templates';
    } else if (activeTabId.startsWith('tpl-col-') || activeTabId.startsWith('tpl-folder-')) {
      nodeId = activeTabId;
      section = 'templates';
    } else if (activeTabId.startsWith('col-') || activeTabId.startsWith('folder-')) {
      nodeId = activeTabId;
    }
    if (!nodeId) return false;

    // Helper: find node in a tree and return ancestor keys to expand
    const findAncestors = (
      trees: V5.CollectionTree[],
      targetUid: string,
      targetType: string,
      colKeyPrefix: string,
      folderKeyPrefix: string,
    ): { ancestors: string[]; section: 'rules' | 'templates' } | null => {
      for (const col of trees) {
        const colKey = `${colKeyPrefix}${col.uid}`;
        const walk = (nodes: V5.TreeNode[], trail: string[]): string[] | null => {
          for (const n of nodes) {
            if (n.type === targetType && n.uid === targetUid) return trail;
            if (n.type === 'folder') {
              const found = walk(n.children, [...trail, `${folderKeyPrefix}${n.uid}`]);
              if (found) return found;
            }
          }
          return null;
        };
        const result = walk(col.tree, [colKey]);
        if (result) return { ancestors: result, section };
      }
      return null;
    };

    // For collection nodes, just ensure the section is open
    if (nodeId.startsWith('col-') || nodeId.startsWith('tpl-col-')) {
      setSectionsExpanded((prev) => ({ ...prev, [section]: true }));
      setFocusedId(nodeId);
      setTimeout(() => {
        containerRef.current?.querySelector(`[data-item-id="${nodeId}"]`)?.scrollIntoView({ block: 'nearest' });
      }, 50);
      return true;
    }

    // For leaf/folder nodes, find ancestors and expand them
    let found: { ancestors: string[]; section: 'rules' | 'templates' } | null = null;

    if (section === 'rules') {
      const targetUid = nodeId.startsWith('rule-') ? nodeId.replace('rule-', '') : nodeId.replace('folder-', '');
      const targetType = nodeId.startsWith('rule-') ? 'rule' : 'folder';
      found = findAncestors(localCollectionTrees, targetUid, targetType, 'col-', 'folder-');
    } else {
      const targetUid = nodeId.replace('tpl-', '');
      // Try template items first, then folders
      found =
        findAncestors(templateCollectionTrees, targetUid, 'template', 'tpl-col-', 'tpl-folder-') ||
        findAncestors(templateCollectionTrees, targetUid, 'folder', 'tpl-col-', 'tpl-folder-');
    }

    if (found) {
      setExpandedKeys((prev) => {
        const next = new Set(prev);
        for (const k of found.ancestors) next.add(k);
        return next;
      });
      setSectionsExpanded((prev) => ({ ...prev, [found.section]: true }));
      setFocusedId(nodeId);
      setTimeout(() => {
        containerRef.current?.querySelector(`[data-item-id="${nodeId}"]`)?.scrollIntoView({ block: 'nearest' });
      }, 50);
      return true;
    }

    return false;
  }, [activeTabId, localCollectionTrees, templateCollectionTrees]);

  // Auto-select on active tab change, with retry when tree data arrives async
  const prevActiveTabRef = useRef(activeTabId);
  const pendingSelectRef = useRef<string | null>(null);
  useEffect(() => {
    if (!alwaysSelectOpened || !activeTabId) return;

    const tabChanged = prevActiveTabRef.current !== activeTabId;
    prevActiveTabRef.current = activeTabId;

    if (tabChanged) {
      // Tab just changed — attempt selection, mark pending if rule not found yet
      const found = selectOpenedFile();
      pendingSelectRef.current = found ? null : activeTabId;
    } else if (pendingSelectRef.current === activeTabId) {
      // Tree data updated — retry pending selection
      const found = selectOpenedFile();
      if (found) pendingSelectRef.current = null;
    }
  }, [alwaysSelectOpened, activeTabId, selectOpenedFile]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const currentIdx = allFlatItems.findIndex((n) => n.id === focusedId);
        const nextIdx =
          e.key === 'ArrowDown' ? Math.min(currentIdx + 1, allFlatItems.length - 1) : Math.max(currentIdx - 1, 0);
        const next = allFlatItems[nextIdx];
        if (next) {
          setFocusedId(next.id);
          setTimeout(
            () =>
              containerRef.current?.querySelector(`[data-item-id="${next.id}"]`)?.scrollIntoView({ block: 'nearest' }),
            0,
          );
        }
      } else if (e.key === 'Enter' && focusedId) {
        e.preventDefault();
        allFlatItems.find((n) => n.id === focusedId)?.onOpen?.();
      } else if (e.key === 'ArrowRight' && focusedId) {
        const node = allFlatItems.find((n) => n.id === focusedId);
        if (node?.expandable && !expandedKeys.has(node.id)) {
          e.preventDefault();
          toggleExpand(node.id);
        }
      } else if (e.key === 'ArrowLeft' && focusedId) {
        e.preventDefault();
        const node = allFlatItems.find((n) => n.id === focusedId);
        if (node?.expandable && expandedKeys.has(node.id)) toggleExpand(node.id);
        else if (node?.parentId) setFocusedId(node.parentId);
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && focusedId) {
        e.preventDefault();
        allFlatItems.find((n) => n.id === focusedId)?.onDelete?.();
      } else if (e.key === 'F2' && focusedId) {
        e.preventDefault();
        const node = allFlatItems.find((n) => n.id === focusedId);
        if (node?.canRename) setRenamingId(focusedId);
      }
    },
    [allFlatItems, focusedId, expandedKeys, toggleExpand],
  );

  // Create a new collection — appears collapsed, opens overview tab with breadcrumb rename
  const createNewCollection = useCallback(async () => {
    const col = await createLocalCollection('New Collection');
    if (col) {
      setSectionsExpanded((prev) => ({ ...prev, rules: true }));
      onOpenCollectionOverview?.(col.uid, col.name, true);
    }
  }, [createLocalCollection, onOpenCollectionOverview]);

  const createMenuItems = [
    ...buildRuleTypeMenuItems(onCreateRule),
    { type: 'divider' as const, key: 'div-collection' },
    { key: 'collection', icon: <FolderOpenOutlined />, label: 'Collection', onClick: () => void createNewCollection() },
  ];

  const renderNodes = (nodes: TreeNode[], emptyCreate?: () => void) => {
    if (nodes.length === 0) {
      return (
        <div className="rules-sidebar-empty-state">
          <span style={{ color: token.colorTextSecondary, fontSize: 12, fontWeight: 600 }}>No items in this panel</span>
          {emptyCreate && (
            <button
              type="button"
              className="rules-sidebar-create-btn"
              style={{ color: token.colorText }}
              onClick={emptyCreate}
            >
              <PlusOutlined style={{ fontSize: 10 }} /> Create
            </button>
          )}
        </div>
      );
    }
    return nodes.map((node) => (
      <TreeNodeRow
        key={node.id}
        node={node}
        isSelected={isSelected(node.id)}
        isFocused={isFocused(node.id)}
        isRenaming={renamingId === node.id}
        isExpanded={node.expandable ? expandedKeys.has(node.id) : undefined}
        onClick={() => handleItemClick(node)}
        onDoubleClick={() => handleItemDoubleClick(node)}
        onStartRename={() => {
          if (renamingId === node.id) setRenamingId(null);
          else setRenamingId(node.id);
        }}
      />
    ));
  };

  return (
    <div className="rules-sidebar" style={{ background: token.colorBgLayout }}>
      <div className="rules-sidebar-toolbar" style={{ borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
        <Input
          ref={filterRef}
          size="small"
          placeholder="Filter"
          prefix={<SearchOutlined style={{ color: token.colorTextTertiary, fontSize: 11 }} />}
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' || e.key === 'Enter') {
              e.preventDefault();
              // Move focus from filter input into the tree
              const first = allFlatItems[0];
              if (first) {
                setFocusedId(first.id);
                containerRef.current?.focus();
                setTimeout(() => {
                  containerRef.current
                    ?.querySelector(`[data-item-id="${first.id}"]`)
                    ?.scrollIntoView({ block: 'nearest' });
                }, 0);
              }
            } else if (e.key === 'Escape') {
              if (filterText) {
                // Has text → clear it, stay focused
                setFilterText('');
              } else {
                // Already empty → exit to tree
                containerRef.current?.focus();
              }
            }
          }}
          allowClear
          style={{ flex: 1, fontSize: 11 }}
          variant="borderless"
        />
        <Dropdown menu={{ items: createMenuItems }} trigger={['click']} placement="bottomRight">
          <Tooltip title="New rule" placement="bottom">
            <div className="rules-sidebar-toolbar-icon" style={{ color: token.colorTextSecondary }}>
              <PlusOutlined />
            </div>
          </Tooltip>
        </Dropdown>
        <Tooltip title="Select Opened Tab" placement="bottom">
          <button
            type="button"
            className="rules-sidebar-toolbar-icon"
            style={{ color: token.colorTextSecondary, background: 'none', border: 'none', cursor: 'pointer' }}
            onClick={selectOpenedFile}
          >
            <AimOutlined />
          </button>
        </Tooltip>
        <Tooltip title="Expand All" placement="bottom">
          <button
            type="button"
            className="rules-sidebar-toolbar-icon"
            style={{ color: token.colorTextSecondary, background: 'none', border: 'none', cursor: 'pointer' }}
            onClick={expandAll}
          >
            <MenuUnfoldOutlined />
          </button>
        </Tooltip>
        <Tooltip title="Collapse All" placement="bottom">
          <button
            type="button"
            className="rules-sidebar-toolbar-icon"
            style={{ color: token.colorTextSecondary, background: 'none', border: 'none', cursor: 'pointer' }}
            onClick={collapseAll}
          >
            <BorderLeftOutlined />
          </button>
        </Tooltip>
        <Dropdown
          menu={{
            items: [
              {
                key: 'behavior',
                label: 'Behavior',
                children: [
                  {
                    key: 'single-click',
                    label: `${openWithSingleClick ? '✓ ' : ''}Open Entries with Single Click`,
                    onClick: () => setOpenWithSingleClick((v) => !v),
                  },
                  {
                    key: 'collections-single-click',
                    label: `${openCollectionsWithSingleClick ? '✓ ' : ''}Open Collections with Single Click`,
                    onClick: () => setOpenCollectionsWithSingleClick((v) => !v),
                  },
                  {
                    key: 'folders-single-click',
                    label: `${openFoldersWithSingleClick ? '✓ ' : ''}Open Folders with Single Click`,
                    onClick: () => setOpenFoldersWithSingleClick((v) => !v),
                  },
                  {
                    key: 'always-select',
                    label: `${alwaysSelectOpened ? '✓ ' : ''}Always Select Opened Tab`,
                    onClick: () => setAlwaysSelectOpened((v) => !v),
                  },
                ],
              },
            ],
          }}
          trigger={['click']}
          placement="bottomRight"
          onOpenChange={setOptionsMenuOpen}
        >
          <Tooltip title="Options" placement="bottom" open={optionsMenuOpen ? false : undefined}>
            <div className="rules-sidebar-toolbar-icon" style={{ color: token.colorTextSecondary }}>
              <EllipsisOutlined />
            </div>
          </Tooltip>
        </Dropdown>
      </div>

      {/* biome-ignore lint/a11y/noStaticElementInteractions: keyboard navigation container */}
      <div ref={containerRef} className="rules-sidebar-content" onKeyDown={handleKeyDown} style={{ outline: 'none' }}>
        <SectionHeader
          title="API REQUESTS"
          expanded={sectionsExpanded.requests}
          onToggle={() => toggleSection('requests')}
        />
        {sectionsExpanded.requests && (
          <div className="rules-sidebar-empty" style={{ color: token.colorTextTertiary }}>
            {isConnected
              ? 'API requests are managed in the desktop app.'
              : 'Connect to desktop app to see API requests.'}
          </div>
        )}

        <SectionHeader
          title="RULES"
          expanded={sectionsExpanded.rules}
          onToggle={() => toggleSection('rules')}
          actions={
            <Dropdown menu={{ items: createMenuItems }} trigger={['click']} placement="bottomRight">
              <PlusOutlined
                style={{ fontSize: 11, color: token.colorTextTertiary, cursor: 'pointer' }}
                onClick={(e) => e.stopPropagation()}
              />
            </Dropdown>
          }
        />
        {sectionsExpanded.rules && (
          <div style={{ flex: 1, overflowY: 'auto' }}>{renderNodes(rulesNodes, () => void createNewCollection())}</div>
        )}

        <SectionHeader
          title="TEMPLATES"
          expanded={sectionsExpanded.templates}
          onToggle={() => toggleSection('templates')}
          actions={
            <Tooltip title="New template collection" placement="bottom">
              <PlusOutlined
                style={{ fontSize: 11, color: token.colorTextTertiary, cursor: 'pointer' }}
                onClick={(e) => {
                  e.stopPropagation();
                  void createTemplateCollection('New Collection').then((col) => {
                    if (col) {
                      setSectionsExpanded((prev) => ({ ...prev, templates: true }));
                      onOpenTemplateCollectionOverview?.(col.uid, col.name, true);
                    }
                  });
                }}
              />
            </Tooltip>
          }
        />
        {sectionsExpanded.templates && (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {renderNodes(systemTemplateNodes)}
            {renderNodes(templateNodes, () => {
              void createTemplateCollection('My Templates').then((col) => {
                if (col) {
                  setSectionsExpanded((prev) => ({ ...prev, templates: true }));
                  onOpenTemplateCollectionOverview?.(col.uid, col.name, true);
                }
              });
            })}
          </div>
        )}

        <SectionHeader
          title="ENVIRONMENTS"
          expanded={sectionsExpanded.environments}
          onToggle={() => toggleSection('environments')}
        />
        {sectionsExpanded.environments && (
          <div className="rules-sidebar-empty" style={{ color: token.colorTextTertiary }}>
            {isConnected
              ? 'Environments are managed in the desktop app.'
              : 'Connect to desktop app to see environments.'}
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
