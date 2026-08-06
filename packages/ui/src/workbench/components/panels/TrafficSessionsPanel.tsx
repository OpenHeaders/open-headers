/**
 * TrafficSessionsPanel — the Traffic Sessions tool window
 * (AGENT_TRAFFIC_PLAN.md §11.1, C5): every archived session, prior
 * runs included, read from the archive's meta index over the operator
 * plane (`oh.daemon.traffic.sessions.*` — human plane, no MCP mirror).
 *
 * The window owns the ARCHIVE; the Traffic Monitor rail's SESSIONS
 * section keeps live state only. Rows group by their organize folder
 * (§11.1 auto-placement fills it at seal; the user refiles freely and
 * auto-placement never moves an organized session), with unfiled
 * sessions at the top level. Search, sort and the folder grouping are
 * all in-memory over the index — no second store exists (§11.4).
 *
 * Organize verbs (rename / move to folder / delete) rewrite one meta
 * atomically host-side; delete sweeps blobs no surviving session
 * reaches. Sealed rows only — a recording session's meta belongs to
 * the recorder, and its row here just mirrors the live state until the
 * seal lands. Opening a session is the C6 replay viewer's job: a row
 * selects into the detail strip, nothing more, until that ships.
 */

import {
  EllipsisOutlined,
  FileOutlined,
  FolderOpenOutlined,
  FolderOutlined,
  LoadingOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { hostBridge } from '@openheaders/core/bridge';
import type { TrafficArchivedSessionProjection } from '@openheaders/core/traffic';
import type { MessageKey } from '@openheaders/i18n';
import { Button, Dropdown, Input, type MenuProps, Modal, Select, Tag, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale } from '@openheaders/ui/context/LocaleContext';
import { createPanelHeaderWiring, PanelHeader } from '@openheaders/ui/shared/dock-layout';
import type { InfoPopoverContent } from '@openheaders/ui/shared/info-popover';
import { formatSize } from '../../../panel/components/traffic/formatters';

export interface TrafficSessionsPanelProps {
  info: InfoPopoverContent;
  onHide: () => void;
}

type SessionSort = 'newest' | 'oldest' | 'name' | 'size';

const SORT_KEYS: Record<SessionSort, MessageKey> = {
  newest: 'workbench.trafficSessions.sortNewest',
  oldest: 'workbench.trafficSessions.sortOldest',
  name: 'workbench.trafficSessions.sortName',
  size: 'workbench.trafficSessions.sortSize',
};

const FIDELITY_KEYS: Record<TrafficArchivedSessionProjection['fidelity'], MessageKey> = {
  cdp: 'workbench.trafficSessions.fidelityCdp',
  heuristic: 'workbench.trafficSessions.fidelityHeuristic',
  proxy: 'workbench.trafficSessions.fidelityProxy',
};

/** List refresh cadence — matches the rail's operator-plane poll. */
const RELOAD_INTERVAL_MS = 15_000;

function compareSessions(a: TrafficArchivedSessionProjection, b: TrafficArchivedSessionProjection, sort: SessionSort): number {
  switch (sort) {
    case 'newest':
      return b.startedAtMs - a.startedAtMs;
    case 'oldest':
      return a.startedAtMs - b.startedAtMs;
    case 'name':
      return a.name.localeCompare(b.name);
    case 'size':
      return b.sizeBytes - a.sizeBytes;
  }
}

function matchesNeedle(session: TrafficArchivedSessionProjection, needle: string): boolean {
  if (session.name.toLowerCase().includes(needle)) return true;
  if (session.folder !== undefined && session.folder.toLowerCase().includes(needle)) return true;
  if (session.sourceLabel.toLowerCase().includes(needle)) return true;
  return session.origins.some((origin) => origin.toLowerCase().includes(needle));
}

const TrafficSessionsPanel: React.FC<TrafficSessionsPanelProps> = ({ info, onHide }) => {
  const { token } = theme.useToken();
  const { locale, t } = useLocale();
  const headerWiring = useMemo(() => createPanelHeaderWiring({ onHide }), [onHide]);
  const [modal, modalContext] = Modal.useModal();

  const [sessions, setSessions] = useState<ReadonlyArray<TrafficArchivedSessionProjection>>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SessionSort>('newest');
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
    void reload();
    const timer = setInterval(() => void reload(), RELOAD_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [reload]);

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
          });
          setSelectedId((prev) => (prev === session.id ? null : prev));
        },
      });
    },
    [modal, t, withPending],
  );

  const folders = useMemo(() => {
    const names = new Set<string>();
    for (const session of sessions) {
      if (session.folder !== undefined) names.add(session.folder);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [sessions]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const kept = needle === '' ? [...sessions] : sessions.filter((session) => matchesNeedle(session, needle));
    return kept.sort((a, b) => compareSessions(a, b, sort));
  }, [sessions, search, sort]);

  /** Unfiled rows at the top level, then folders alphabetically —
   *  folders that lost every row to the search filter drop out. */
  const grouped = useMemo(() => {
    const unfiled = visible.filter((session) => session.folder === undefined);
    const byFolder = new Map<string, TrafficArchivedSessionProjection[]>();
    for (const session of visible) {
      if (session.folder === undefined) continue;
      const rows = byFolder.get(session.folder);
      if (rows !== undefined) rows.push(session);
      else byFolder.set(session.folder, [session]);
    }
    return { unfiled, folders: [...byFolder.entries()].sort((a, b) => a[0].localeCompare(b[0])) };
  }, [visible]);

  const selected = useMemo(
    () => (selectedId !== null ? (sessions.find((session) => session.id === selectedId) ?? null) : null),
    [sessions, selectedId],
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
    [folders, organize, confirmDelete, t],
  );

  const renderRow = (session: TrafficArchivedSessionProjection, indented: boolean): React.ReactNode => {
    const isPending = pending.has(session.id);
    const live = session.state !== 'sealed';
    return (
      <Dropdown key={session.id} menu={rowMenu(session)} trigger={['contextMenu']}>
        <div
          className="rules-sidebar-item traffic-sessions-row"
          data-testid="traffic-sessions-row"
          data-session-id={session.id}
          style={{
            paddingLeft: indented ? 30 : 14,
            backgroundColor: selectedId === session.id ? 'rgba(24, 144, 255, 0.08)' : undefined,
          }}
          onClick={() => setSelectedId(session.id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') setSelectedId(session.id);
          }}
          role="button"
          tabIndex={0}
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
          <span
            style={{ fontSize: 11, color: token.colorTextTertiary, flex: '0 0 auto', whiteSpace: 'nowrap' }}
          >
            {formatSize(session.sizeBytes)}
          </span>
          {isPending ? (
            <LoadingOutlined spin style={{ fontSize: 12, color: token.colorPrimary, flex: '0 0 auto' }} />
          ) : (
            <Dropdown menu={rowMenu(session)} trigger={['click']} placement="bottomRight">
              <span
                role="button"
                tabIndex={0}
                aria-label={t('workbench.trafficSessions.rowMenuAria')}
                data-testid="traffic-sessions-row-menu"
                style={{ flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', color: token.colorTextTertiary }}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <EllipsisOutlined style={{ fontSize: 14 }} />
              </span>
            </Dropdown>
          )}
        </div>
      </Dropdown>
    );
  };

  return (
    <div className="rules-bottom-panel">
      <PanelHeader
        wiring={headerWiring}
        title={<strong>{t('workbench.toolWindows.trafficSessions')}</strong>}
        info={info}
      />
      {modalContext}
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>
        <div
          style={{
            flex: '0 0 auto',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 12px',
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            background: token.colorFillQuaternary,
          }}
        >
          <Input
            size="small"
            allowClear
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('workbench.trafficSessions.searchPlaceholder')}
            style={{ maxWidth: 260 }}
            data-testid="traffic-sessions-search"
          />
          <Select<SessionSort>
            size="small"
            value={sort}
            onChange={setSort}
            options={(Object.keys(SORT_KEYS) as SessionSort[]).map((key) => ({ value: key, label: t(SORT_KEYS[key]) }))}
            style={{ width: 150 }}
            data-testid="traffic-sessions-sort"
          />
          <span style={{ flex: 1 }} />
          <Button
            size="small"
            icon={<ReloadOutlined />}
            loading={loading}
            onClick={() => void reload()}
            data-testid="traffic-sessions-refresh"
          >
            {t('workbench.trafficSessions.refresh')}
          </Button>
        </div>
        <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', padding: '4px 0' }} data-testid="traffic-sessions-list">
          {sessions.length === 0 && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                padding: '24px 12px',
                color: token.colorTextSecondary,
              }}
              data-testid="traffic-sessions-empty"
            >
              <strong style={{ fontSize: 13, color: token.colorText }}>{t('workbench.trafficSessions.empty')}</strong>
              <span style={{ fontSize: 12 }}>{t('workbench.trafficSessions.emptyHint')}</span>
            </div>
          )}
          {sessions.length > 0 && visible.length === 0 && (
            <div
              style={{ padding: '12px', fontSize: 12, color: token.colorTextSecondary }}
              data-testid="traffic-sessions-empty-filtered"
            >
              {t('workbench.trafficSessions.emptyFiltered')}
            </div>
          )}
          {grouped.unfiled.map((session) => renderRow(session, false))}
          {grouped.folders.map(([folder, rows]) => {
            const collapsed = collapsedFolders.has(folder);
            return (
              <div key={folder}>
                <div
                  className="rules-sidebar-item traffic-sessions-folder"
                  data-testid="traffic-sessions-folder"
                  data-folder={folder}
                  onClick={() =>
                    setCollapsedFolders((prev) => {
                      const next = new Set(prev);
                      if (next.has(folder)) next.delete(folder);
                      else next.add(folder);
                      return next;
                    })
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setCollapsedFolders((prev) => {
                        const next = new Set(prev);
                        if (next.has(folder)) next.delete(folder);
                        else next.add(folder);
                        return next;
                      });
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  style={{ paddingLeft: 14 }}
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
                </div>
                {!collapsed && rows.map((session) => renderRow(session, true))}
              </div>
            );
          })}
        </div>
        {selected !== null && (
          <div
            style={{
              flex: '0 0 auto',
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              columnGap: 12,
              rowGap: 2,
              padding: '6px 12px',
              fontSize: 12,
              color: token.colorTextSecondary,
              borderTop: `1px solid ${token.colorBorderSecondary}`,
              background: token.colorFillQuaternary,
            }}
            data-testid="traffic-sessions-detail"
          >
            <span style={{ color: token.colorText, fontWeight: 600 }}>{selected.sourceLabel}</span>
            <span>{new Date(selected.startedAtMs).toLocaleString(locale)}</span>
            <span>{t('workbench.trafficSessions.detailRequests', { count: selected.requests })}</span>
            <span style={selected.errors > 0 ? { color: token.colorErrorText } : undefined}>
              {t('workbench.trafficSessions.detailErrors', { count: selected.errors })}
            </span>
            <span>{t('workbench.trafficSessions.detailEvents', { count: selected.events })}</span>
            <span>{formatSize(selected.sizeBytes)}</span>
            <span>{t(FIDELITY_KEYS[selected.fidelity])}</span>
            <span>
              {selected.encrypted
                ? t('workbench.trafficSessions.detailEncrypted')
                : t('workbench.trafficSessions.detailUnencrypted')}
            </span>
          </div>
        )}
      </div>
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
    </div>
  );
};

export default TrafficSessionsPanel;
