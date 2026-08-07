/**
 * TrafficMonitorSessionsSection — the SESSIONS section of the Traffic
 * Monitor source rail (AGENT_TRAFFIC_PLAN.md §11.1, C5 folded in-rail,
 * S26): the sessions archive as a third source kind next to BROWSER
 * TABS and PROXY · SYSTEM. The header expands in place over the
 * archive's meta index (`oh.daemon.traffic.sessions.*` — human plane,
 * no MCP mirror): rows group by their organize folder with unfiled
 * sessions at the top level, newest first. Clicking a sealed row
 * opens-or-activates the session as a SOURCE TAB on the panel's strip
 * — the same grammar as every other rail row; a recording/sealing row
 * carries its live state tag and opens nothing until the seal lands.
 *
 * Organize verbs (rename / move to folder / delete) ride the row's
 * context and ⋯ menus and rewrite one meta atomically host-side;
 * delete additionally retires the session's open tab through
 * `onSessionDeleted`. Index facts (source, date, counts, size,
 * fidelity, encryption) live on the row tooltip — no detail footer.
 *
 * The index re-reads while expanded only: on expand, on the tap's
 * `trafficStatusChanged` nudges (capture start/stop/seal), and on a
 * slow safety interval; collapsed, the section costs nothing.
 */

import { EllipsisOutlined, FileOutlined, FolderOpenOutlined, FolderOutlined, LoadingOutlined } from '@ant-design/icons';
import { hostBridge } from '@openheaders/core/bridge';
import type { TrafficArchivedSessionProjection } from '@openheaders/core/traffic';
import type { MessageKey } from '@openheaders/i18n';
import { Dropdown, Input, type MenuProps, Modal, Tag, theme, Tooltip } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocale } from '@openheaders/ui/context/LocaleContext';
import { formatSize } from '../../../panel/components/traffic/formatters';
import { SectionHeader } from '../sidebar/SectionHeader';

/** Source-key namespace for archived-session tabs on the panel strip. */
const SESSION_SOURCE_KEY_PREFIX = 'session:';

export function sessionSourceKey(id: string): string {
  return `${SESSION_SOURCE_KEY_PREFIX}${id}`;
}

export function isSessionSourceKey(key: string): boolean {
  return key.startsWith(SESSION_SOURCE_KEY_PREFIX);
}

const FIDELITY_KEYS: Record<TrafficArchivedSessionProjection['fidelity'], MessageKey> = {
  cdp: 'workbench.trafficSessions.fidelityCdp',
  heuristic: 'workbench.trafficSessions.fidelityHeuristic',
  proxy: 'workbench.trafficSessions.fidelityProxy',
};

/** Safety re-read cadence while expanded — the `trafficStatusChanged`
 *  nudges carry the interesting transitions, this catches the rest. */
const RELOAD_INTERVAL_MS = 15_000;

/** One nudge storm (start + attach + seal) folds into one re-read. */
const NUDGE_DEBOUNCE_MS = 300;

export interface TrafficMonitorSessionsSectionProps {
  /** Away from the rail's side (see the rail's `side` prop). */
  tooltipPlacement: 'left' | 'right';
  /** The panel's active source key — highlights the open session row. */
  selected: string | null;
  /** Open (or activate) one SEALED session as a source tab. */
  onOpenSession: (session: TrafficArchivedSessionProjection) => void;
  /** A session deleted here — the panel retires its open tab. */
  onSessionDeleted: (id: string) => void;
}

export const TrafficMonitorSessionsSection: React.FC<TrafficMonitorSessionsSectionProps> = ({
  tooltipPlacement,
  selected,
  onOpenSession,
  onSessionDeleted,
}) => {
  const { locale, t } = useLocale();
  const { token } = theme.useToken();
  const [modal, modalContext] = Modal.useModal();

  const [expanded, setExpanded] = useState(false);
  const [sessions, setSessions] = useState<ReadonlyArray<TrafficArchivedSessionProjection>>([]);
  const [loading, setLoading] = useState(false);
  const [collapsedFolders, setCollapsedFolders] = useState<ReadonlySet<string>>(() => new Set());
  /** Rows whose organize/delete verb is in flight — spinner state. */
  const [pending, setPending] = useState<ReadonlySet<string>>(() => new Set());
  const [renameTarget, setRenameTarget] = useState<TrafficArchivedSessionProjection | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [newFolderTarget, setNewFolderTarget] = useState<TrafficArchivedSessionProjection | null>(null);
  const [newFolderValue, setNewFolderValue] = useState('');

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

  const withPending = useCallback(
    (id: string, verb: () => Promise<void>): void => {
      setPending((prev) => new Set(prev).add(id));
      void (async () => {
        try {
          await verb();
        } catch {
          // Archive unavailable — the reload leaves the list honest.
        }
        await reload();
        setPending((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      })();
    },
    [reload],
  );

  const organize = useCallback(
    (session: TrafficArchivedSessionProjection, changes: { name?: string; folder?: string | null }): void => {
      withPending(session.id, async () => {
        await hostBridge.call('oh.daemon.traffic.sessions.organize', { id: session.id, ...changes });
      });
    },
    [withPending],
  );

  const confirmDelete = useCallback(
    (session: TrafficArchivedSessionProjection): void => {
      modal.confirm({
        title: t('workbench.trafficSessions.deleteTitle'),
        content: t('workbench.trafficSessions.deleteBody', { name: session.name }),
        okText: t('workbench.trafficSessions.deleteOk'),
        okButtonProps: { danger: true, 'data-testid': 'traffic-sessions-delete-ok' },
        cancelText: t('shared.action.cancel'),
        onOk: () => {
          withPending(session.id, async () => {
            await hostBridge.call('oh.daemon.traffic.sessions.delete', { id: session.id });
            onSessionDeleted(session.id);
          });
        },
      });
    },
    [modal, t, withPending, onSessionDeleted],
  );

  const folders = useMemo(() => {
    const names = new Set<string>();
    for (const session of sessions) {
      if (session.folder !== undefined) names.add(session.folder);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [sessions]);

  /** Newest first; unfiled rows at the top level, then folders
   *  alphabetically — the archive at rail scale needs no sort/search
   *  chrome. */
  const grouped = useMemo(() => {
    const sorted = [...sessions].sort((a, b) => b.startedAtMs - a.startedAtMs);
    const unfiled = sorted.filter((session) => session.folder === undefined);
    const byFolder = new Map<string, TrafficArchivedSessionProjection[]>();
    for (const session of sorted) {
      if (session.folder === undefined) continue;
      const rows = byFolder.get(session.folder);
      if (rows !== undefined) rows.push(session);
      else byFolder.set(session.folder, [session]);
    }
    return { unfiled, folders: [...byFolder.entries()].sort((a, b) => a[0].localeCompare(b[0])) };
  }, [sessions]);

  const openSession = useCallback(
    (session: TrafficArchivedSessionProjection): void => {
      if (session.state !== 'sealed') return;
      onOpenSession(session);
    },
    [onOpenSession],
  );

  const rowMenu = useCallback(
    (session: TrafficArchivedSessionProjection): MenuProps => {
      const sealed = session.state === 'sealed';
      const moveChildren: NonNullable<MenuProps['items']> = folders
        .filter((folder) => folder !== session.folder)
        .map((folder) => ({
          key: `move:${folder}`,
          label: <span data-testid="traffic-sessions-menu-move-target">{folder}</span>,
          onClick: () => organize(session, { folder }),
        }));
      moveChildren.push({
        key: 'move-new',
        label: <span data-testid="traffic-sessions-menu-move-new">{t('workbench.trafficSessions.moveNew')}</span>,
        onClick: () => {
          setNewFolderValue('');
          setNewFolderTarget(session);
        },
      });
      if (session.folder !== undefined) {
        moveChildren.push({
          key: 'move-none',
          label: <span data-testid="traffic-sessions-menu-move-none">{t('workbench.trafficSessions.moveNone')}</span>,
          onClick: () => organize(session, { folder: null }),
        });
      }
      return {
        items: [
          {
            key: 'open',
            label: <span data-testid="traffic-sessions-menu-open">{t('workbench.trafficSessions.openSession')}</span>,
            disabled: !sealed,
            onClick: () => openSession(session),
          },
          { type: 'divider' },
          {
            key: 'rename',
            label: <span data-testid="traffic-sessions-menu-rename">{t('workbench.trafficSessions.rename')}</span>,
            disabled: !sealed,
            onClick: () => {
              setRenameValue(session.name);
              setRenameTarget(session);
            },
          },
          {
            key: 'move',
            label: <span data-testid="traffic-sessions-menu-move">{t('workbench.trafficSessions.move')}</span>,
            disabled: !sealed,
            children: moveChildren,
          },
          { type: 'divider' },
          {
            key: 'delete',
            label: <span data-testid="traffic-sessions-menu-delete">{t('workbench.trafficSessions.delete')}</span>,
            danger: true,
            disabled: !sealed,
            onClick: () => confirmDelete(session),
          },
        ],
      };
    },
    [folders, organize, confirmDelete, openSession, t],
  );

  /** Index facts on the tooltip — the detail footer's successor. */
  const rowDetail = (session: TrafficArchivedSessionProjection): React.ReactNode => (
    <span style={{ fontSize: 12 }}>
      {session.sourceLabel} · {new Date(session.startedAtMs).toLocaleString(locale)}
      <br />
      {t('workbench.trafficSessions.detailRequests', { count: session.requests })} ·{' '}
      {t('workbench.trafficSessions.detailErrors', { count: session.errors })} · {formatSize(session.sizeBytes)}
      <br />
      {t(FIDELITY_KEYS[session.fidelity])} ·{' '}
      {session.encrypted
        ? t('workbench.trafficSessions.detailEncrypted')
        : t('workbench.trafficSessions.detailUnencrypted')}
    </span>
  );

  const renderRow = (session: TrafficArchivedSessionProjection, indented: boolean): React.ReactNode => {
    const isPending = pending.has(session.id);
    const live = session.state !== 'sealed';
    const active = selected === sessionSourceKey(session.id);
    return (
      <Dropdown key={session.id} menu={rowMenu(session)} trigger={['contextMenu']}>
        <Tooltip title={rowDetail(session)} placement={tooltipPlacement}>
          <button
            type="button"
            data-testid="traffic-sessions-row"
            data-session-id={session.id}
            aria-pressed={active}
            className={`rules-sidebar-item traffic-monitor-source-row${active ? ' selected' : ''}`}
            style={{ paddingLeft: indented ? 30 : 14 }}
            onClick={() => openSession(session)}
          >
            <FileOutlined style={{ fontSize: 12, color: token.colorTextTertiary, flex: '0 0 auto' }} />
            <span className="rules-sidebar-item-label" title={session.name}>
              {session.name}
            </span>
            {live && (
              <Tag
                color={session.state === 'recording' ? 'red' : 'default'}
                style={{ margin: 0, flex: '0 0 auto', fontSize: 11, lineHeight: '16px' }}
                data-testid="traffic-sessions-row-state"
              >
                {session.state === 'recording'
                  ? t('workbench.trafficSessions.stateRecording')
                  : t('workbench.trafficSessions.stateSealing')}
              </Tag>
            )}
            {isPending ? (
              <LoadingOutlined spin style={{ fontSize: 12, color: token.colorPrimary, flex: '0 0 auto' }} />
            ) : (
              <Dropdown menu={rowMenu(session)} trigger={['click']} placement="bottomRight">
                <span
                  role="button"
                  tabIndex={0}
                  aria-label={t('workbench.trafficSessions.rowMenuAria')}
                  data-testid="traffic-sessions-row-menu"
                  style={{
                    flex: '0 0 auto',
                    display: 'inline-flex',
                    alignItems: 'center',
                    color: token.colorTextTertiary,
                  }}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <EllipsisOutlined style={{ fontSize: 14 }} />
                </span>
              </Dropdown>
            )}
          </button>
        </Tooltip>
      </Dropdown>
    );
  };

  const toggleFolder = (folder: string): void => {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folder)) next.delete(folder);
      else next.add(folder);
      return next;
    });
  };

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
          {grouped.unfiled.map((session) => renderRow(session, false))}
          {grouped.folders.map(([folder, rows]) => {
            const collapsed = collapsedFolders.has(folder);
            return (
              <div key={folder}>
                <button
                  type="button"
                  className="rules-sidebar-item traffic-monitor-source-row"
                  data-testid="traffic-sessions-folder"
                  data-folder={folder}
                  aria-expanded={!collapsed}
                  style={{ paddingLeft: 14 }}
                  onClick={() => toggleFolder(folder)}
                >
                  {collapsed ? (
                    <FolderOutlined style={{ fontSize: 12, color: token.colorTextTertiary, flex: '0 0 auto' }} />
                  ) : (
                    <FolderOpenOutlined style={{ fontSize: 12, color: token.colorTextTertiary, flex: '0 0 auto' }} />
                  )}
                  <span className="rules-sidebar-item-label" style={{ fontWeight: 600 }} title={folder}>
                    {folder}
                  </span>
                  <span style={{ fontSize: 11, color: token.colorTextTertiary, flex: '0 0 auto' }}>{rows.length}</span>
                </button>
                {!collapsed && rows.map((session) => renderRow(session, true))}
              </div>
            );
          })}
        </div>
      )}
      <Modal
        open={renameTarget !== null}
        title={t('workbench.trafficSessions.renameTitle')}
        okText={t('workbench.trafficSessions.renameOk')}
        cancelText={t('shared.action.cancel')}
        okButtonProps={{ disabled: renameValue.trim().length === 0, 'data-testid': 'traffic-sessions-rename-ok' }}
        onCancel={() => setRenameTarget(null)}
        onOk={() => {
          if (renameTarget !== null && renameValue.trim().length > 0) {
            organize(renameTarget, { name: renameValue.trim() });
          }
          setRenameTarget(null);
        }}
        destroyOnHidden
      >
        <Input
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onPressEnter={() => {
            if (renameTarget !== null && renameValue.trim().length > 0) {
              organize(renameTarget, { name: renameValue.trim() });
              setRenameTarget(null);
            }
          }}
          data-testid="traffic-sessions-rename-input"
          autoFocus
        />
      </Modal>
      <Modal
        open={newFolderTarget !== null}
        title={t('workbench.trafficSessions.moveNewTitle')}
        okText={t('workbench.trafficSessions.moveNewOk')}
        cancelText={t('shared.action.cancel')}
        okButtonProps={{ disabled: newFolderValue.trim().length === 0, 'data-testid': 'traffic-sessions-new-folder-ok' }}
        onCancel={() => setNewFolderTarget(null)}
        onOk={() => {
          if (newFolderTarget !== null && newFolderValue.trim().length > 0) {
            organize(newFolderTarget, { folder: newFolderValue.trim() });
          }
          setNewFolderTarget(null);
        }}
        destroyOnHidden
      >
        <Input
          value={newFolderValue}
          onChange={(e) => setNewFolderValue(e.target.value)}
          onPressEnter={() => {
            if (newFolderTarget !== null && newFolderValue.trim().length > 0) {
              organize(newFolderTarget, { folder: newFolderValue.trim() });
              setNewFolderTarget(null);
            }
          }}
          placeholder={t('workbench.trafficSessions.moveNewPlaceholder')}
          data-testid="traffic-sessions-new-folder-input"
          autoFocus
        />
      </Modal>
    </>
  );
};
