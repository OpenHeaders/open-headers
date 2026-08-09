/**
 * GitComparePane — one Compare-with-Current tab (IDE-log): two stacked
 * sections, "commits that exist in <current> but don't exist in <ref>"
 * above and the reverse below. Each section is a commit list with its
 * own detail pane (files tree over commit details — the log view's
 * anatomy); an empty side answers "<X> contains all commits from <Y>".
 * Self-sufficient per pane: fetches `compareRefs` (+ refs for the
 * inline chips) on mount and refetches on `workspaceTreeGitStatus`
 * frames — the lists always compare against the LIVE current branch.
 */

import { WarningOutlined } from '@ant-design/icons';
import {
  hostBridge,
  type WorkspaceTreeLogEntryWire,
  type WorkspaceTreeRefWire,
} from '@openheaders/core/bridge';
import { theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import CommitDetails from '../CommitDetails';
import CommitList from '../CommitList';
import DiffModal from '../DiffModal';
import FileTreeView from '../FileTreeView';
import type { GitCompareTabState } from '../git-panel-view-store';
import { useFileDiff } from '../use-file-diff';

export interface GitComparePaneProps {
  workspaceId: string;
  tab: GitCompareTabState;
  patchTab: (patch: Partial<Omit<GitCompareTabState, 'kind' | 'id' | 'ref'>>) => void;
}

interface CompareSideProps {
  /** Banner copy: commits in `a` that `b` lacks. */
  a: string;
  b: string;
  entries: WorkspaceTreeLogEntryWire[];
  refsBySha: ReadonlyMap<string, WorkspaceTreeRefWire[]>;
  selectedSha: string | null;
  onSelect: (sha: string) => void;
  onOpenFile: (sha: string, path: string) => void;
  loadingPath: string | null;
  testid: string;
}

const CompareSide: React.FC<CompareSideProps> = ({
  a,
  b,
  entries,
  refsBySha,
  selectedSha,
  onSelect,
  onOpenFile,
  loadingPath,
  testid,
}) => {
  const { token } = theme.useToken();
  const t = useT();
  const selected = selectedSha !== null ? (entries.find((entry) => entry.sha === selectedSha) ?? null) : null;

  return (
    <div style={{ flex: '1 1 50%', minHeight: 0, display: 'flex', flexDirection: 'column' }} data-testid={testid}>
      <div
        style={{
          flex: '0 0 auto',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 12px',
          fontSize: 12,
          background: token.colorWarningBg,
          color: token.colorText,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
        }}
        data-testid="git-tool-compare-banner"
      >
        <WarningOutlined style={{ color: token.colorWarning, flexShrink: 0 }} />
        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {t('workbench.gitLog.compare.onlyIn', { a, b })}
        </span>
      </div>
      <div style={{ flex: '1 1 auto', display: 'flex', minHeight: 0 }}>
        <div
          style={{
            flex: '1 1 55%',
            minWidth: 0,
            display: 'flex',
            minHeight: 0,
            borderRight: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          {entries.length === 0 ? (
            <div
              style={{
                flex: '1 1 auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                color: token.colorTextSecondary,
              }}
              data-testid="git-tool-compare-contains-all"
            >
              {t('workbench.gitLog.compare.containsAll', { a: b, b: a })}
            </div>
          ) : (
            <CommitList
              entries={entries}
              graph={null}
              refsBySha={refsBySha}
              selectedSha={selectedSha}
              onSelect={onSelect}
              filtersActive={false}
              onResetFilters={() => undefined}
            />
          )}
        </div>
        <div style={{ flex: '1 1 45%', minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {selected === null ? (
            <div
              style={{
                flex: '1 1 auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                color: token.colorTextSecondary,
              }}
              data-testid="git-tool-compare-detail-placeholder"
            >
              {t('workbench.gitLog.selectCommit')}
            </div>
          ) : (
            <>
              <FileTreeView
                key={selected.sha}
                files={selected.files}
                loadingPath={loadingPath}
                onOpenFile={(path) => onOpenFile(selected.sha, path)}
                showHeader
              />
              <div
                style={{
                  flex: '1 1 45%',
                  minHeight: 0,
                  overflowY: 'auto',
                  borderTop: `1px solid ${token.colorBorderSecondary}`,
                }}
              >
                <CommitDetails entry={selected} refsAtCommit={refsBySha.get(selected.sha) ?? []} isHead={false} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const GitComparePane: React.FC<GitComparePaneProps> = ({ workspaceId, tab, patchTab }) => {
  const { token } = theme.useToken();
  const t = useT();
  const [current, setCurrent] = useState<string | null>(null);
  const [onlyInCurrent, setOnlyInCurrent] = useState<WorkspaceTreeLogEntryWire[]>([]);
  const [onlyInRef, setOnlyInRef] = useState<WorkspaceTreeLogEntryWire[]>([]);
  const [refs, setRefs] = useState<WorkspaceTreeRefWire[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileDiff = useFileDiff(workspaceId);

  const reload = useCallback(async (): Promise<void> => {
    setError(null);
    try {
      const refsResult = await hostBridge.call('oh.workspaceTree.listRefs', { workspaceId });
      setRefs(refsResult.ok ? refsResult.refs : []);
      const result = await hostBridge.call('oh.workspaceTree.compareRefs', { workspaceId, ref: tab.ref });
      if (result.ok) {
        setCurrent(result.current);
        setOnlyInCurrent(result.onlyInCurrent);
        setOnlyInRef(result.onlyInRef);
      } else {
        setOnlyInCurrent([]);
        setOnlyInRef([]);
        setError(t('workbench.gitLog.compare.failed', { detail: result.detail ?? result.reason }));
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }, [workspaceId, tab.ref, t]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    return hostBridge.subscribe('workspaceTreeGitStatus', (payload) => {
      if (payload.workspaceId !== workspaceId) return;
      void reload();
    });
  }, [workspaceId, reload]);

  const refsBySha = useMemo(() => {
    const map = new Map<string, WorkspaceTreeRefWire[]>();
    for (const ref of refs) {
      const rows = map.get(ref.sha);
      if (rows !== undefined) rows.push(ref);
      else map.set(ref.sha, [ref]);
    }
    return map;
  }, [refs]);

  const currentLabel = current ?? 'HEAD';

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}
      data-testid="git-tool-compare"
      data-ref={tab.ref}
    >
      {error !== null && (
        <div
          style={{
            flex: '0 0 auto',
            padding: '4px 12px',
            fontSize: 12,
            color: token.colorError,
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
          }}
          data-testid="git-tool-compare-error"
        >
          {error}
        </div>
      )}
      <CompareSide
        a={currentLabel}
        b={tab.ref}
        entries={onlyInCurrent}
        refsBySha={refsBySha}
        selectedSha={tab.selectedInCurrent}
        onSelect={(sha) => patchTab({ selectedInCurrent: sha })}
        onOpenFile={(sha, path) => void fileDiff.open(sha, path)}
        loadingPath={fileDiff.loadingPath}
        testid="git-tool-compare-current-side"
      />
      <div aria-hidden style={{ flex: '0 0 auto', height: 1, background: token.colorBorderSecondary }} />
      <CompareSide
        a={tab.ref}
        b={currentLabel}
        entries={onlyInRef}
        refsBySha={refsBySha}
        selectedSha={tab.selectedInRef}
        onSelect={(sha) => patchTab({ selectedInRef: sha })}
        onOpenFile={(sha, path) => void fileDiff.open(sha, path)}
        loadingPath={fileDiff.loadingPath}
        testid="git-tool-compare-ref-side"
      />
      <DiffModal diff={fileDiff.diff} onClose={fileDiff.close} />
    </div>
  );
};

export default GitComparePane;
