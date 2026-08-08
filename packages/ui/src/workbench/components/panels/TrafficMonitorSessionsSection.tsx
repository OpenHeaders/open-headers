/**
 * TrafficMonitorSessionsSection — the SESSIONS section of the Traffic
 * Monitor source rail (AGENT_TRAFFIC_PLAN.md §11.1, C5 folded in-rail,
 * S26/S27): the sessions archive as a third source kind next to BROWSER
 * TABS and PROXY · SYSTEM, rendered on the workbench's STANDARD sidebar
 * tree — the same {@link TreeNodeRow} anatomy the HTTP Rules and API
 * Requests trees use: collection rows (open-folder icon), user folders
 * inside them, session leaves with a compact fidelity tag in the
 * method-tag slot, inline rename, and `⋯` menus.
 *
 * Placement is auto-stamped at seal (collection = the dominant origin's
 * registrable domain; wire captures under the fixed Traffic
 * Interception collection); folders are user-created only. The session
 * NAME is the tab's title at the capture gesture — date and error
 * chrome render as a derived row badge, never baked into the name.
 * Recording/sealing sessions carry no collection yet and ride the top
 * level with their state tag until the seal files them.
 *
 * Clicking a sealed leaf opens-or-activates the session as a SOURCE TAB
 * on the panel's strip — the same grammar as every other rail row.
 * Organize verbs rewrite metas host-side (one per touched session);
 * delete additionally retires the session's open tab through
 * `onSessionDeleted`.
 *
 * The index re-reads while expanded only: on expand, on the tap's
 * `trafficStatusChanged` nudges (capture start/stop/seal), and on a
 * slow safety interval; collapsed, the section costs nothing.
 */

import { DeleteOutlined, EditOutlined, FolderOpenOutlined, FolderOutlined, LoadingOutlined } from '@ant-design/icons';
import { hostBridge } from '@openheaders/core/bridge';
import type { TrafficArchivedSessionProjection } from '@openheaders/core/traffic';
import { Modal, Tag, theme } from 'antd';
import type { ItemType } from 'antd/es/menu/interface';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocale } from '@openheaders/ui/context/LocaleContext';
import { iconEl, sessionFidelityTag } from '../sidebar/icons';
import { SectionHeader } from '../sidebar/SectionHeader';
import { TreeNodeRow } from '../sidebar/TreeNodeRow';
import type { TreeNode } from '../sidebar/types';

/** Source-key namespace for archived-session tabs on the panel strip.
 *  Doubles as the leaf row's `data-item-id` in the tree. */
const SESSION_SOURCE_KEY_PREFIX = 'session:';

export function sessionSourceKey(id: string): string {
  return `${SESSION_SOURCE_KEY_PREFIX}${id}`;
}

export function isSessionSourceKey(key: string): boolean {
  return key.startsWith(SESSION_SOURCE_KEY_PREFIX);
}

/**
 * One keyboard-navigable rail row — the rail owns ONE cursor spanning
 * its own rows and this section's tree (a panel has one keyboard
 * system, like the sidebars), so the section registers its VISIBLE
 * nodes with the rail instead of running a second nav domain.
 */
export interface TrafficRailNavItem {
  readonly id: string;
  readonly expandable: boolean;
  readonly expanded?: boolean;
  readonly parentId?: string;
  /** Enter — open a leaf / toggle a container. */
  readonly open?: () => void;
  /** ArrowRight/ArrowLeft on a container. */
  readonly toggleExpand?: () => void;
  /** F2 — inline rename. */
  readonly startRename?: () => void;
  /** Delete/Backspace — the row's delete verb (confirmed). */
  readonly remove?: () => void;
}

/** Safety re-read cadence while expanded — the `trafficStatusChanged`
 *  nudges carry the interesting transitions, this catches the rest. */
const RELOAD_INTERVAL_MS = 15_000;

/** One nudge storm (start + attach + seal) folds into one re-read. */
const NUDGE_DEBOUNCE_MS = 300;

/** Tree expansion survives dock-tab switches (the panel's
 *  survive-unmount posture); `null` = never seeded — the first archive
 *  read expands every collection once. */
let lastExpandedKeys: ReadonlySet<string> | null = null;

function collectionNodeId(collection: string): string {
  return `session-col-${collection}`;
}

function folderNodeId(collection: string, folder: string): string {
  return `session-folder-${collection}::${folder}`;
}

/** Derived row-badge timestamp — today by time, this year by day, else
 *  the full date. Chrome, so locale-aware; never stored. */
function sessionWhen(startedAtMs: number, locale: string): string {
  const at = new Date(startedAtMs);
  const now = new Date();
  if (at.toDateString() === now.toDateString()) {
    return at.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  }
  if (at.getFullYear() === now.getFullYear()) {
    return at.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
  }
  return at.toLocaleDateString(locale);
}

interface SessionGroups {
  /** Recording/sealing (and crash-recovered) rows — no collection yet. */
  readonly loose: TrafficArchivedSessionProjection[];
  readonly collections: ReadonlyArray<{
    readonly name: string;
    /** Directly under the collection, newest first. */
    readonly unfoldered: TrafficArchivedSessionProjection[];
    readonly folders: ReadonlyArray<{ readonly name: string; readonly rows: TrafficArchivedSessionProjection[] }>;
    /** Every member, folders included — group verbs operate on this. */
    readonly members: TrafficArchivedSessionProjection[];
  }>;
}

function groupSessions(sessions: ReadonlyArray<TrafficArchivedSessionProjection>): SessionGroups {
  const sorted = [...sessions].sort((a, b) => b.startedAtMs - a.startedAtMs);
  const loose = sorted.filter((session) => session.collection === undefined);
  const byCollection = new Map<string, TrafficArchivedSessionProjection[]>();
  for (const session of sorted) {
    if (session.collection === undefined) continue;
    const members = byCollection.get(session.collection);
    if (members !== undefined) members.push(session);
    else byCollection.set(session.collection, [session]);
  }
  const collections = [...byCollection.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, members]) => {
      const byFolder = new Map<string, TrafficArchivedSessionProjection[]>();
      for (const session of members) {
        if (session.folder === undefined) continue;
        const rows = byFolder.get(session.folder);
        if (rows !== undefined) rows.push(session);
        else byFolder.set(session.folder, [session]);
      }
      return {
        name,
        unfoldered: members.filter((session) => session.folder === undefined),
        folders: [...byFolder.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([f, rows]) => ({ name: f, rows })),
        members,
      };
    });
  return { loose, collections };
}

export interface TrafficMonitorSessionsSectionProps {
  /** The panel's active source key — highlights the open session row. */
  selected: string | null;
  /** Open (or activate) one SEALED session as a source tab. */
  onOpenSession: (session: TrafficArchivedSessionProjection) => void;
  /** A session deleted here — the panel retires its open tab. */
  onSessionDeleted: (id: string) => void;
  /** The rail's ONE keyboard cursor — highlights the matching row. */
  focusedId: string | null;
  /** A row was clicked — the rail moves its cursor here. */
  onFocusRow: (id: string) => void;
  /** Publish this section's VISIBLE nav rows to the rail's keyboard
   *  system (written every render; the rail reads at key time). */
  registerNavItems: (items: TrafficRailNavItem[]) => void;
}

export const TrafficMonitorSessionsSection: React.FC<TrafficMonitorSessionsSectionProps> = ({
  selected,
  onOpenSession,
  onSessionDeleted,
  focusedId,
  onFocusRow,
  registerNavItems,
}) => {
  const { locale, t } = useLocale();
  const { token } = theme.useToken();
  const [modal, modalContext] = Modal.useModal();

  const [expanded, setExpanded] = useState(false);
  const [sessions, setSessions] = useState<ReadonlyArray<TrafficArchivedSessionProjection>>([]);
  const [loading, setLoading] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => new Set(lastExpandedKeys ?? []));
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const seededRef = useRef(lastExpandedKeys !== null);

  useEffect(() => {
    lastExpandedKeys = expandedKeys;
  }, [expandedKeys]);

  const reload = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const { sessions: rows } = await hostBridge.call('oh.daemon.traffic.sessions.list');
      setSessions(rows);
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!expanded) return;
    void reload();
    const interval = setInterval(() => void reload(), RELOAD_INTERVAL_MS);
    let nudge: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = hostBridge.subscribe('trafficStatusChanged', () => {
      if (nudge !== null) clearTimeout(nudge);
      nudge = setTimeout(() => {
        nudge = null;
        void reload();
      }, NUDGE_DEBOUNCE_MS);
    });
    return () => {
      clearInterval(interval);
      unsubscribe();
      if (nudge !== null) clearTimeout(nudge);
    };
  }, [expanded, reload]);

  const grouped = useMemo(() => groupSessions(sessions), [sessions]);

  // First archive read: every collection starts expanded — the section
  // is a shallow tree, and an all-collapsed opener would hide the rows
  // the user expanded SESSIONS to see. Collapse state sticks after.
  useEffect(() => {
    if (seededRef.current || grouped.collections.length === 0) return;
    seededRef.current = true;
    setExpandedKeys(new Set(grouped.collections.map((collection) => collectionNodeId(collection.name))));
  }, [grouped]);

  const toggleExpandKey = useCallback((id: string): void => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const expandKeys = useCallback((ids: string[]): void => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.add(id);
      return next;
    });
  }, []);

  const organize = useCallback(
    async (id: string, changes: { name?: string; collection?: string | null; folder?: string | null }) => {
      try {
        await hostBridge.call('oh.daemon.traffic.sessions.organize', { id, ...changes });
      } catch {
        // Archive unavailable — the reload leaves the list honest.
      }
      await reload();
    },
    [reload],
  );

  /** Group rename — collection/folder are denormalized strings on each
   *  member's meta, so a group verb is one atomic rewrite per member. */
  const organizeMany = useCallback(
    async (ids: ReadonlyArray<string>, changes: { collection?: string | null; folder?: string | null }) => {
      for (const id of ids) {
        try {
          await hostBridge.call('oh.daemon.traffic.sessions.organize', { id, ...changes });
        } catch {
          // Partial failures converge on the reload below.
        }
      }
      await reload();
    },
    [reload],
  );

  const deleteMany = useCallback(
    async (rows: ReadonlyArray<TrafficArchivedSessionProjection>) => {
      for (const session of rows) {
        try {
          await hostBridge.call('oh.daemon.traffic.sessions.delete', { id: session.id });
          onSessionDeleted(session.id);
        } catch {
          // Refused (still recording) or unavailable — reload converges.
        }
      }
      await reload();
    },
    [reload, onSessionDeleted],
  );

  const confirmDeleteSession = useCallback(
    (session: TrafficArchivedSessionProjection): void => {
      modal.confirm({
        title: t('workbench.trafficSessions.deleteTitle'),
        content: t('workbench.trafficSessions.deleteBody', { name: session.name }),
        okText: t('workbench.trafficSessions.deleteOk'),
        okButtonProps: { danger: true, 'data-testid': 'traffic-sessions-delete-ok' },
        cancelText: t('shared.action.cancel'),
        onOk: () => {
          void deleteMany([session]);
        },
      });
    },
    [modal, t, deleteMany],
  );

  const confirmDeleteGroup = useCallback(
    (name: string, members: ReadonlyArray<TrafficArchivedSessionProjection>): void => {
      const sealed = members.filter((session) => session.state === 'sealed');
      modal.confirm({
        title: t('workbench.trafficSessions.deleteGroupTitle', { name }),
        content: t('workbench.trafficSessions.deleteGroupBody', { count: sealed.length }),
        okText: t('workbench.trafficSessions.deleteOk'),
        okButtonProps: { danger: true, 'data-testid': 'traffic-sessions-delete-ok' },
        cancelText: t('shared.action.cancel'),
        onOk: () => {
          void deleteMany(sealed);
        },
      });
    },
    [modal, t, deleteMany],
  );

  /** The leaf `⋯` menu — the sessions-specific verb set (Move-to-folder
   *  has no place in the built-in leaf menu). Sealed rows only; a
   *  collection-less row (crash recovery) has nowhere to move to. */
  const sessionMenuItems = useCallback(
    (
      session: TrafficArchivedSessionProjection,
      collection: { name: string; folders: ReadonlyArray<{ name: string }> } | null,
    ): ItemType[] => {
      const items: ItemType[] = [
        {
          key: 'rename',
          icon: <EditOutlined />,
          label: <span data-testid="traffic-sessions-menu-rename">{t('workbench.sidebar.menu.rename')}</span>,
          onClick: () => setRenamingId(sessionSourceKey(session.id)),
        },
      ];
      if (collection !== null) {
        const moveChildren: ItemType[] = collection.folders
          .filter((folder) => folder.name !== session.folder)
          .map((folder) => ({
            key: `move:${folder.name}`,
            label: <span data-testid="traffic-sessions-menu-move-target">{folder.name}</span>,
            onClick: () => void organize(session.id, { folder: folder.name }),
          }));
        moveChildren.push({
          key: 'move-new',
          label: <span data-testid="traffic-sessions-menu-move-new">{t('workbench.trafficSessions.moveNew')}</span>,
          onClick: () => {
            const folderName = t('workbench.sidebar.defaults.newFolder');
            const fid = folderNodeId(collection.name, folderName);
            expandKeys([collectionNodeId(collection.name), fid]);
            setRenamingId(fid);
            void organize(session.id, { folder: folderName });
          },
        });
        if (session.folder !== undefined) {
          moveChildren.push({
            key: 'move-none',
            label: <span data-testid="traffic-sessions-menu-move-none">{t('workbench.trafficSessions.moveNone')}</span>,
            onClick: () => void organize(session.id, { folder: null }),
          });
        }
        items.push({
          key: 'move',
          icon: <FolderOutlined />,
          label: <span data-testid="traffic-sessions-menu-move">{t('workbench.trafficSessions.move')}</span>,
          children: moveChildren,
        });
      }
      items.push(
        { type: 'divider', key: 'div' },
        {
          key: 'delete',
          icon: <DeleteOutlined />,
          label: <span data-testid="traffic-sessions-menu-delete">{t('workbench.sidebar.menu.delete')}</span>,
          danger: true,
          onClick: () => confirmDeleteSession(session),
        },
      );
      return items;
    },
    [t, organize, expandKeys, confirmDeleteSession],
  );

  /** Container `⋯` — rename + delete-with-count, the standard verbs. */
  const groupMenuItems = useCallback(
    (nodeId: string, name: string, members: ReadonlyArray<TrafficArchivedSessionProjection>): ItemType[] => [
      {
        key: 'rename',
        icon: <EditOutlined />,
        label: <span data-testid="traffic-sessions-menu-rename">{t('workbench.sidebar.menu.rename')}</span>,
        onClick: () => setRenamingId(nodeId),
      },
      { type: 'divider', key: 'div' },
      {
        key: 'delete',
        icon: <DeleteOutlined />,
        label: <span data-testid="traffic-sessions-menu-delete">{t('workbench.sidebar.menu.delete')}</span>,
        danger: true,
        onClick: () => confirmDeleteGroup(name, members),
      },
    ],
    [t, confirmDeleteGroup],
  );

  const countBadge = (count: number): React.ReactNode => (
    <span style={{ marginLeft: 'auto', fontSize: 11, color: token.colorTextTertiary, flex: '0 0 auto' }}>{count}</span>
  );

  const sessionBadge = (session: TrafficArchivedSessionProjection): React.ReactNode => {
    const live = session.state !== 'sealed';
    return (
      <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 6, alignItems: 'center', flex: '0 0 auto' }}>
        {live && (
          <Tag
            color={session.state === 'recording' ? 'red' : 'default'}
            style={{ margin: 0, fontSize: 11, lineHeight: '16px' }}
            data-testid="traffic-sessions-row-state"
          >
            {session.state === 'recording'
              ? t('workbench.trafficSessions.stateRecording')
              : t('workbench.trafficSessions.stateSealing')}
          </Tag>
        )}
        {!live && session.errors > 0 && (
          <span style={{ fontSize: 11, color: token.colorError }}>{session.errors}</span>
        )}
        <span style={{ fontSize: 11, color: token.colorTextTertiary }}>{sessionWhen(session.startedAtMs, locale)}</span>
      </span>
    );
  };

  const sessionNode = (
    session: TrafficArchivedSessionProjection,
    depth: number,
    parent: { name: string; folders: ReadonlyArray<{ name: string }> } | null,
    parentNodeId?: string,
  ): TreeNode => {
    const sealed = session.state === 'sealed';
    const id = sessionSourceKey(session.id);
    return {
      id,
      kind: 'leaf',
      label: session.name || session.sourceLabel,
      depth,
      expandable: false,
      ...(parentNodeId !== undefined ? { parentId: parentNodeId } : {}),
      icon: sessionFidelityTag(session.fidelity),
      badge: sessionBadge(session),
      canRename: sealed,
      canDelete: sealed,
      canAddChild: false,
      ...(sealed
        ? {
            onOpen: () => onOpenSession(session),
            onRename: (name: string) => void organize(session.id, { name }),
            onDelete: () => confirmDeleteSession(session),
            actionMenuItems: sessionMenuItems(session, parent),
          }
        : {}),
    };
  };

  // Rebuilt per render on purpose: the tree is rail-scale (tens of
  // rows), and the builders close over render-scope handlers — a memo
  // here would either go stale or carry every handler as a dep.
  const buildNodes = (): TreeNode[] => {
    const out: TreeNode[] = [];
    for (const session of grouped.loose) out.push(sessionNode(session, 0, null));
    for (const collection of grouped.collections) {
      const colId = collectionNodeId(collection.name);
      out.push({
        id: colId,
        kind: 'group',
        label: collection.name,
        depth: 0,
        expandable: true,
        icon: iconEl(FolderOpenOutlined, 'var(--ant-color-text-tertiary, #999)'),
        badge: countBadge(collection.members.length),
        canRename: true,
        canDelete: true,
        // Container hover anatomy (`⋯` cluster) without a `+`: nothing
        // under a collection is creatable — sessions arrive by
        // recording, folders through a session's Move verb.
        canAddChild: true,
        onOpen: () => toggleExpandKey(colId),
        onRename: (name: string) => {
          // The node id derives from the name — carry the expansion over.
          if (expandedKeys.has(colId)) expandKeys([collectionNodeId(name)]);
          void organizeMany(
            collection.members.filter((s) => s.state === 'sealed').map((s) => s.id),
            { collection: name },
          );
        },
        onDelete: () => confirmDeleteGroup(collection.name, collection.members),
        actionMenuItems: groupMenuItems(colId, collection.name, collection.members),
      });
      if (!expandedKeys.has(colId)) continue;
      for (const session of collection.unfoldered) out.push(sessionNode(session, 1, collection, colId));
      for (const folder of collection.folders) {
        const fid = folderNodeId(collection.name, folder.name);
        out.push({
          id: fid,
          kind: 'folder',
          label: folder.name,
          depth: 1,
          expandable: true,
          parentId: colId,
          icon: iconEl(FolderOutlined, 'var(--ant-color-text-tertiary, #999)'),
          badge: countBadge(folder.rows.length),
          canRename: true,
          canDelete: true,
          canAddChild: true,
          onOpen: () => toggleExpandKey(fid),
          onRename: (name: string) => {
            if (expandedKeys.has(fid)) expandKeys([folderNodeId(collection.name, name)]);
            void organizeMany(
              folder.rows.filter((s) => s.state === 'sealed').map((s) => s.id),
              { folder: name },
            );
          },
          onDelete: () => confirmDeleteGroup(folder.name, folder.rows),
          actionMenuItems: groupMenuItems(fid, folder.name, folder.rows),
        });
        if (!expandedKeys.has(fid)) continue;
        for (const session of folder.rows) out.push(sessionNode(session, 2, collection, fid));
      }
    }
    return out;
  };
  const nodes = buildNodes();

  // Publish the visible rows into the rail's ONE keyboard system after
  // every render (the rail stores them in a ref — no render loop).
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally runs every render — `nodes` is rebuilt each pass
  useEffect(() => {
    registerNavItems(
      expanded
        ? nodes.map((node) => ({
            id: node.id,
            expandable: node.expandable,
            ...(node.expandable
              ? { expanded: expandedKeys.has(node.id), toggleExpand: () => toggleExpandKey(node.id) }
              : {}),
            ...(node.parentId !== undefined ? { parentId: node.parentId } : {}),
            ...(node.onOpen !== undefined ? { open: node.onOpen } : {}),
            ...(node.canRename ? { startRename: () => setRenamingId(node.id) } : {}),
            ...(node.onDelete !== undefined ? { remove: node.onDelete } : {}),
          }))
        : [],
    );
  });
  useEffect(() => () => registerNavItems([]), [registerNavItems]);

  return (
    <>
      {modalContext}
      <SectionHeader
        title={t('workbench.trafficMonitor.sessionsTitle')}
        testid="traffic-monitor-sessions-header"
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
        actions={
          expanded && loading ? (
            <LoadingOutlined spin style={{ fontSize: 11, color: token.colorTextTertiary }} />
          ) : undefined
        }
      />
      {expanded && (
        <div
          data-testid="traffic-sessions-list"
          // Basis 0 to match the browsers body's `flex: 1` — the two
          // open lists split the column's slack EQUALLY; basis auto
          // would let whichever list holds more content crush the other.
          style={{ flex: '1 1 0', minHeight: 0, overflowY: 'auto', overscrollBehavior: 'none' }}
        >
          {sessions.length === 0 && !loading && (
            <div
              data-testid="traffic-sessions-empty"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: 2,
                padding: '4px 14px 8px',
                color: token.colorTextSecondary,
              }}
            >
              <span style={{ fontSize: 12, color: token.colorText }}>{t('workbench.trafficSessions.empty')}</span>
              <span style={{ fontSize: 11 }}>{t('workbench.trafficSessions.emptyHint')}</span>
            </div>
          )}
          {nodes.map((node) => (
            <TreeNodeRow
              key={node.id}
              node={node}
              isSelected={node.id === selected}
              isFocused={focusedId === node.id}
              isRenaming={renamingId === node.id}
              isExpanded={node.expandable ? expandedKeys.has(node.id) : undefined}
              onClick={() => {
                onFocusRow(node.id);
                node.onOpen?.();
              }}
              onDoubleClick={() => {
                if (node.canRename) setRenamingId(node.id);
              }}
              onStartRename={() => {
                setRenamingId((prev) => (prev === node.id ? null : node.id));
              }}
            />
          ))}
        </div>
      )}
    </>
  );
};
