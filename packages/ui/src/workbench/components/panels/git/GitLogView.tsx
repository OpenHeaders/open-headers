/**
 * GitLogView — ONE log tab's view (toolbar, ref rail, commit timeline,
 * split detail pane, diff modal), self-sufficient per pane: it fetches
 * its own refs + log for its tab's scope and refetches on
 * `workspaceTreeGitStatus` frames (the panel-wide lifeline — every
 * pass that can move git status pushes one). Splitting the panel
 * mounts one instance per visible log tab; each holds only view state,
 * the tab's scope/filter/selection live in the registry
 * (git-panel-view-store) so they survive unmounts and moves between
 * panes.
 */

import { BranchesOutlined, ReloadOutlined } from '@ant-design/icons';
import {
  hostBridge,
  type WorkspaceTreeFileDiffPairWire,
  type WorkspaceTreeLogEntryWire,
  type WorkspaceTreeRefWire,
} from '@openheaders/core/bridge';
import { Button, Input, Tag, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale } from '@openheaders/ui/context/LocaleContext';
import CommitDetails from './CommitDetails';
import CommitList from './CommitList';
import DiffModal from './DiffModal';
import FileTreeView from './FileTreeView';
import { type GitLogTabState, gitPanelTabKey } from './git-panel-view-store';
import { computeLogGraph } from './graph';
import RefTree from './RefTree';

export interface GitLogViewProps {
  workspaceId: string;
  tab: GitLogTabState;
  /** Checked-out branch from the panel's status feed (unborn incluced). */
  branch: string | null;
  patchTab: (patch: Partial<Omit<GitLogTabState, 'kind' | 'id'>>) => void;
}

const LOG_LIMIT = 200;

const GitLogView: React.FC<GitLogViewProps> = ({ workspaceId, tab, branch, patchTab }) => {
  const { token } = theme.useToken();
  const { t } = useLocale();

  const [entries, setEntries] = useState<WorkspaceTreeLogEntryWire[]>([]);
  const [refs, setRefs] = useState<WorkspaceTreeRefWire[]>([]);
  const [currentRef, setCurrentRef] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileDiff, setFileDiff] = useState<WorkspaceTreeFileDiffPairWire | null>(null);
  const [fileDiffLoading, setFileDiffLoading] = useState<string | null>(null);

  const { selectedRef, filter, selectedSha, refsCollapsed } = tab;
  const tabKey = gitPanelTabKey(tab);

  const reload = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const refsResult = await hostBridge.call('oh.workspaceTree.listRefs', { workspaceId });
      if (refsResult.ok) {
        setRefs(refsResult.refs);
        setCurrentRef(refsResult.current);
      } else {
        setRefs([]);
        setCurrentRef(null);
      }
      const result = await hostBridge.call('oh.workspaceTree.log', {
        workspaceId,
        limit: LOG_LIMIT,
        ...(selectedRef !== null ? { ref: selectedRef } : {}),
      });
      if (result.ok) {
        setEntries(result.entries);
      } else if (result.reason === 'unknown-ref') {
        // The scoped ref vanished (branch deleted, tag dropped) —
        // fall back to HEAD; the effect below refetches.
        patchTab({ selectedRef: null });
      } else {
        setEntries([]);
        setError(t('workbench.gitLog.loadFailed', { detail: result.detail ?? result.reason }));
      }
    } catch (err) {
      setEntries([]);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, selectedRef, patchTab, t]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    return hostBridge.subscribe('workspaceTreeGitStatus', (payload) => {
      if (payload.workspaceId !== workspaceId) return;
      void reload();
    });
  }, [workspaceId, reload]);

  const filtered = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (needle === '') return entries;
    return entries.filter(
      (entry) =>
        entry.subject.toLowerCase().includes(needle) ||
        entry.authorName.toLowerCase().includes(needle) ||
        entry.sha.startsWith(needle),
    );
  }, [entries, filter]);

  // Graph edges are honest only over the contiguous log — a text filter
  // hides rows, so filtered rendering degrades to plain dots.
  const graph = useMemo(() => (filtered === entries ? computeLogGraph(entries) : null), [filtered, entries]);

  const refsBySha = useMemo(() => {
    const map = new Map<string, WorkspaceTreeRefWire[]>();
    for (const ref of refs) {
      const rows = map.get(ref.sha);
      if (rows !== undefined) rows.push(ref);
      else map.set(ref.sha, [ref]);
    }
    return map;
  }, [refs]);

  const headSha = useMemo(() => {
    const current = refs.find((ref) => ref.kind === 'local' && ref.name === currentRef);
    if (current !== undefined) return current.sha;
    return selectedRef === null ? (entries[0]?.sha ?? null) : null;
  }, [refs, currentRef, selectedRef, entries]);

  const selected = useMemo(
    () => (selectedSha !== null ? (entries.find((entry) => entry.sha === selectedSha) ?? null) : null),
    [entries, selectedSha],
  );

  // The branch gitStatus reports but listRefs doesn't: an unborn HEAD
  // (fresh repo, first commit pending). Shown as the current branch in
  // the Local group; its name must never scope `log` — the membership
  // gate would refuse it — so selecting it is HEAD scope.
  const unbornBranch = useMemo(
    () => (branch !== null && !refs.some((ref) => ref.kind === 'local' && ref.name === branch) ? branch : null),
    [branch, refs],
  );

  const selectedRefKind = useMemo(
    () => refs.find((ref) => ref.name === selectedRef)?.kind ?? 'local',
    [refs, selectedRef],
  );

  const openFileDiff = async (sha: string, filePath: string): Promise<void> => {
    setFileDiffLoading(filePath);
    try {
      const result = await hostBridge.call('oh.workspaceTree.fileDiff', {
        workspaceId,
        sha,
        path: filePath,
      });
      if (result.ok) setFileDiff(result.diff);
      else setError(t('workbench.gitLog.loadFailed', { detail: result.detail ?? result.reason }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setFileDiffLoading(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }} data-testid="git-tool-view">
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
        <Button
          size="small"
          type={refsCollapsed ? 'text' : 'default'}
          icon={<BranchesOutlined />}
          title={t('workbench.gitLog.refs.toggle')}
          aria-pressed={!refsCollapsed}
          onClick={() => patchTab({ refsCollapsed: !refsCollapsed })}
          data-testid="git-tool-refs-toggle"
        />
        <Input
          size="small"
          allowClear
          value={filter}
          onChange={(e) => patchTab({ filter: e.target.value })}
          placeholder={t('workbench.gitLog.filterPlaceholder')}
          style={{ maxWidth: 240 }}
          data-testid="git-tool-filter"
        />
        {selectedRef !== null && (
          <Tag
            closable
            onClose={() => patchTab({ selectedRef: null })}
            style={{ margin: 0, fontFamily: token.fontFamilyCode }}
            data-testid="git-tool-scope-chip"
          >
            {selectedRefKind === 'tag'
              ? t('workbench.gitLog.scopeChip.tag', { name: selectedRef })
              : t('workbench.gitLog.scopeChip.branch', { name: selectedRef })}
          </Tag>
        )}
        <span style={{ flex: 1 }} />
        <Button
          size="small"
          type="text"
          icon={<ReloadOutlined />}
          loading={loading}
          title={t('workbench.gitLog.refresh')}
          onClick={() => void reload()}
          data-testid="git-tool-refresh"
        />
      </div>
      {error !== null && (
        <div
          style={{
            flex: '0 0 auto',
            padding: '4px 12px',
            fontSize: 12,
            color: token.colorError,
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
          }}
          data-testid="git-tool-error"
        >
          {error}
        </div>
      )}
      <div style={{ flex: '1 1 auto', display: 'flex', minHeight: 0 }}>
        {!refsCollapsed && (
          <RefTree
            refs={refs}
            currentRef={currentRef}
            unbornBranch={unbornBranch}
            selectedRef={selectedRef}
            onSelect={(ref) => patchTab({ selectedRef: ref })}
          />
        )}
        <div
          style={{
            flex: '1 1 55%',
            minWidth: 0,
            display: 'flex',
            minHeight: 0,
            borderRight: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          <CommitList
            entries={filtered}
            graph={graph}
            refsBySha={refsBySha}
            selectedSha={selectedSha}
            onSelect={(sha) => patchTab({ selectedSha: sha })}
            filtersActive={filter.trim() !== '' || selectedRef !== null}
            onResetFilters={() => patchTab({ filter: '', selectedRef: null })}
          />
        </div>
        <div
          style={{ flex: '1 1 45%', minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}
          data-testid="git-tool-detail"
        >
          {selected === null ? (
            <>
              <div
                style={{
                  flex: '1 1 55%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  color: token.colorTextSecondary,
                }}
                data-testid="git-tool-detail-placeholder"
              >
                {t('workbench.gitLog.selectCommit')}
              </div>
              <div
                style={{
                  flex: '1 1 45%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  color: token.colorTextSecondary,
                  borderTop: `1px solid ${token.colorBorderSecondary}`,
                }}
                data-testid="git-tool-detail-none"
              >
                {t('workbench.gitLog.noneSelected')}
              </div>
            </>
          ) : (
            <>
              <FileTreeView
                key={`${tabKey}:${selected.sha}`}
                files={selected.files}
                loadingPath={fileDiffLoading}
                onOpenFile={(path) => void openFileDiff(selected.sha, path)}
              />
              <div
                style={{
                  flex: '1 1 45%',
                  minHeight: 0,
                  overflowY: 'auto',
                  borderTop: `1px solid ${token.colorBorderSecondary}`,
                }}
              >
                <CommitDetails
                  entry={selected}
                  refsAtCommit={refsBySha.get(selected.sha) ?? []}
                  isHead={selected.sha === headSha}
                />
              </div>
            </>
          )}
        </div>
      </div>
      <DiffModal diff={fileDiff} onClose={() => setFileDiff(null)} />
    </div>
  );
};

export default GitLogView;
