/**
 * GitLogPanel — the workbench Git tool window (GIT_PLAN.md §9 history
 * view, IDE-log layout). Three panes over the Phase 7 read verbs: a
 * collapsible ref tree (`oh.workspaceTree.listRefs` — Local / Remote /
 * Tags, current branch starred; remote refs are whatever the last
 * background fetch brought in, the panel never touches the network), a
 * commit timeline (`oh.workspaceTree.log`, ref-scoped when a ref is
 * selected), and the selected commit's detail — authorship, co-author
 * trailers, changed paths; clicking a path opens that change as an
 * old/new Monaco diff (`oh.workspaceTree.fileDiff` — binary and
 * over-cap blobs answer typed flags rendered as plain notices). Pure
 * reads off the per-binding chain; the panel never mutates the repo.
 *
 * Only hosts that register the `workspaceGit` capability (the desktop
 * renderer, whose bridge reaches the workspace-tree runtime in-process)
 * ever mount this window. The `workspaceTreeGitStatus` lifeline doubles
 * as the refresh nudge: every pass that can move `git status` pushes a
 * status frame, and the panel refetches the log on frames for its
 * workspace — an engine commit shows up without a manual refresh.
 */

import { BranchesOutlined, ReloadOutlined } from '@ant-design/icons';
import {
  hostBridge,
  type WorkspaceTreeFileDiffPairWire,
  type WorkspaceTreeLogEntryWire,
  type WorkspaceTreeRefWire,
} from '@openheaders/core/bridge';
import { Button, Input, Modal, Tag, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import '@openheaders/ui/workbench/components/monaco/bootstrap';
import { useLocale } from '@openheaders/ui/context/LocaleContext';
import { createPanelHeaderWiring, PanelHeader } from '@openheaders/ui/shared/dock-layout';
import type { InfoPopoverContent } from '@openheaders/ui/shared/info-popover';
import { formatAgo } from '@openheaders/ui/shared/awareness/format-ago';
import { useActiveWorkspaceId } from '@openheaders/ui/shared/hooks/readers/useActiveWorkspaceId';
import {
  DEFAULT_DIFF_VIEWER_OPTIONS,
  type DiffViewerOptions,
  RichDiffEditor,
} from '@openheaders/ui/workbench/components/diff-viewer';

export interface GitLogPanelProps {
  info: InfoPopoverContent;
  onHide: () => void;
}

const LOG_LIMIT = 200;

/** Monaco language for a tree path — the workspace tree is YAML-first. */
function diffLanguage(filePath: string): string {
  if (/\.ya?ml$/i.test(filePath)) return 'yaml';
  if (/\.json$/i.test(filePath)) return 'json';
  if (/\.md$/i.test(filePath)) return 'markdown';
  return 'plaintext';
}

/** Porcelain status letter → theme color, IDE-style (added green,
 *  modified blue, deleted red, rename/copy amber). */
function statusColor(status: string, token: ReturnType<typeof theme.useToken>['token']): string {
  switch (status) {
    case 'A':
      return token.colorSuccessText;
    case 'D':
      return token.colorErrorText;
    case 'R':
    case 'C':
      return token.colorWarningText;
    default:
      return token.colorInfoText;
  }
}

const GitLogPanel: React.FC<GitLogPanelProps> = ({ info, onHide }) => {
  const { token } = theme.useToken();
  const { locale, t } = useLocale();
  const headerWiring = useMemo(() => createPanelHeaderWiring({ onHide }), [onHide]);
  const workspaceId = useActiveWorkspaceId();

  const [bound, setBound] = useState(false);
  const [branch, setBranch] = useState<string | null>(null);
  const [entries, setEntries] = useState<WorkspaceTreeLogEntryWire[]>([]);
  const [refs, setRefs] = useState<WorkspaceTreeRefWire[]>([]);
  const [currentRef, setCurrentRef] = useState<string | null>(null);
  const [selectedRef, setSelectedRef] = useState<string | null>(null);
  const [refsCollapsed, setRefsCollapsed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [selectedSha, setSelectedSha] = useState<string | null>(null);
  const [fileDiff, setFileDiff] = useState<WorkspaceTreeFileDiffPairWire | null>(null);
  const [fileDiffLoading, setFileDiffLoading] = useState<string | null>(null);
  const [diffOptions, setDiffOptions] = useState<DiffViewerOptions>(DEFAULT_DIFF_VIEWER_OPTIONS);

  const reload = useCallback(async (): Promise<void> => {
    if (workspaceId === null) {
      setBound(false);
      setEntries([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await hostBridge.call('oh.workspaceTree.list');
      const isBound = list.bindings.some((row) => row.workspaceId === workspaceId);
      setBound(isBound);
      if (!isBound) {
        setBranch(null);
        setEntries([]);
        return;
      }
      const status = await hostBridge.call('oh.workspaceTree.gitStatus', { workspaceId });
      setBranch(status.branch);
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
        setSelectedRef(null);
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
  }, [workspaceId, selectedRef, t]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (workspaceId === null) return;
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

  const selected = useMemo(
    () => (selectedSha !== null ? (entries.find((entry) => entry.sha === selectedSha) ?? null) : null),
    [entries, selectedSha],
  );

  const refGroups = useMemo(
    () =>
      (
        [
          ['local', t('workbench.gitLog.refs.local')],
          ['remote', t('workbench.gitLog.refs.remote')],
          ['tag', t('workbench.gitLog.refs.tags')],
        ] as const
      ).map(([kind, label]) => ({ kind, label, refs: refs.filter((ref) => ref.kind === kind) })),
    [refs, t],
  );

  const openFileDiff = async (sha: string, filePath: string): Promise<void> => {
    if (workspaceId === null) return;
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

  const authorLine = (entry: WorkspaceTreeLogEntryWire): string =>
    t('workbench.gitLog.authorLine', {
      author: entry.authorName,
      email: entry.authorEmail,
      date: new Date(entry.authoredAt).toLocaleString(),
    });

  return (
    <div className="rules-bottom-panel">
      <PanelHeader wiring={headerWiring} title={<strong>{t('workbench.toolWindows.git')}</strong>} info={info} />
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
          <Button
            size="small"
            type={refsCollapsed ? 'text' : 'default'}
            icon={<BranchesOutlined />}
            title={t('workbench.gitLog.refs.toggle')}
            aria-pressed={!refsCollapsed}
            onClick={() => setRefsCollapsed((collapsed) => !collapsed)}
            data-testid="git-tool-refs-toggle"
          />
          <Input
            size="small"
            allowClear
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t('workbench.gitLog.filterPlaceholder')}
            style={{ maxWidth: 260 }}
            data-testid="git-tool-filter"
          />
          {branch !== null && (
            <Tag style={{ margin: 0, fontFamily: token.fontFamilyCode }} data-testid="git-tool-branch">
              {branch}
            </Tag>
          )}
          <span style={{ flex: 1 }} />
          <Button
            size="small"
            icon={<ReloadOutlined />}
            loading={loading}
            onClick={() => void reload()}
            data-testid="git-tool-refresh"
          >
            {t('workbench.gitLog.refresh')}
          </Button>
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
        {!bound ? (
          <div
            style={{
              flex: '1 1 auto',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              color: token.colorTextSecondary,
            }}
            data-testid="git-tool-not-bound"
          >
            <strong style={{ fontSize: 13, color: token.colorText }}>{t('workbench.gitLog.notBound.title')}</strong>
            <span style={{ fontSize: 12 }}>{t('workbench.gitLog.notBound.body')}</span>
          </div>
        ) : (
          <div style={{ flex: '1 1 auto', display: 'flex', minHeight: 0 }}>
            {!refsCollapsed && (
              <div
                style={{
                  flex: '0 0 190px',
                  minWidth: 0,
                  overflowY: 'auto',
                  padding: '4px 0',
                  borderRight: `1px solid ${token.colorBorderSecondary}`,
                  background: token.colorFillQuaternary,
                }}
                data-testid="git-tool-refs"
              >
                {refs.length === 0 ? (
                  <div
                    style={{ padding: '12px', fontSize: 12, color: token.colorTextSecondary }}
                    data-testid="git-tool-refs-empty"
                  >
                    {t('workbench.gitLog.refs.empty')}
                  </div>
                ) : (
                  refGroups.map((group) =>
                    group.refs.length === 0 ? null : (
                      <div key={group.kind} data-testid="git-tool-ref-group" data-kind={group.kind}>
                        <div
                          style={{
                            padding: '6px 12px 2px',
                            fontSize: 11,
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: 0.4,
                            color: token.colorTextSecondary,
                          }}
                        >
                          {group.label}
                        </div>
                        {group.refs.map((ref) => {
                          const isCurrent = ref.kind === 'local' && ref.name === currentRef;
                          const isActive = ref.name === selectedRef;
                          return (
                            <button
                              key={`${ref.kind}:${ref.name}`}
                              type="button"
                              onClick={() => setSelectedRef(isActive ? null : ref.name)}
                              title={ref.name}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                width: '100%',
                                padding: '2px 12px',
                                border: 'none',
                                textAlign: 'left',
                                cursor: 'pointer',
                                fontSize: 12,
                                background: isActive ? token.controlItemBgActive : 'transparent',
                                color: token.colorText,
                                fontWeight: isCurrent ? 600 : 400,
                              }}
                              data-testid="git-tool-ref-row"
                              data-ref={ref.name}
                              data-kind={ref.kind}
                            >
                              <span
                                style={{
                                  flex: '1 1 auto',
                                  minWidth: 0,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {ref.name}
                              </span>
                              {isCurrent && (
                                <span aria-hidden style={{ flex: '0 0 auto', color: token.colorWarningText }}>
                                  ★
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    ),
                  )
                )}
              </div>
            )}
            <div
              style={{ flex: '1 1 55%', minWidth: 0, overflowY: 'auto', borderRight: `1px solid ${token.colorBorderSecondary}` }}
              data-testid="git-tool-list"
            >
              {filtered.length === 0 ? (
                <div
                  style={{ padding: '18px 12px', fontSize: 12, color: token.colorTextSecondary }}
                  data-testid="git-tool-empty"
                >
                  {t('workbench.gitLog.empty')}
                </div>
              ) : (
                filtered.map((entry) => {
                  const isSelected = entry.sha === selectedSha;
                  return (
                    <button
                      key={entry.sha}
                      type="button"
                      onClick={() => setSelectedSha(entry.sha)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        width: '100%',
                        padding: '3px 12px 3px 0',
                        border: 'none',
                        textAlign: 'left',
                        cursor: 'pointer',
                        background: isSelected ? token.controlItemBgActive : 'transparent',
                        color: token.colorText,
                      }}
                      data-testid="git-tool-row"
                      data-sha={entry.sha}
                    >
                      <span
                        aria-hidden
                        style={{
                          position: 'relative',
                          flex: '0 0 auto',
                          width: 20,
                          alignSelf: 'stretch',
                          minHeight: 24,
                        }}
                      >
                        <span
                          style={{
                            position: 'absolute',
                            left: 9,
                            top: 0,
                            bottom: 0,
                            width: 2,
                            background: token.colorSuccessBorder,
                          }}
                        />
                        <span
                          style={{
                            position: 'absolute',
                            left: 6,
                            top: '50%',
                            marginTop: -4,
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: token.colorSuccess,
                          }}
                        />
                      </span>
                      <span
                        style={{
                          flex: '1 1 auto',
                          minWidth: 0,
                          fontSize: 12,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {entry.subject}
                      </span>
                      <span style={{ flex: '0 0 auto', fontSize: 11.5, color: token.colorTextSecondary }}>
                        {entry.authorName}
                      </span>
                      <span
                        title={new Date(entry.authoredAt).toLocaleString()}
                        style={{
                          flex: '0 0 auto',
                          minWidth: 52,
                          textAlign: 'right',
                          fontSize: 11.5,
                          color: token.colorTextSecondary,
                        }}
                      >
                        {formatAgo(Date.now() - new Date(entry.authoredAt).getTime(), locale)}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
            <div style={{ flex: '1 1 45%', minWidth: 0, overflowY: 'auto' }} data-testid="git-tool-detail">
              {selected === null ? (
                <div
                  style={{
                    height: '100%',
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
              ) : (
                <div style={{ padding: '10px 14px' }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: token.colorText }}>{selected.subject}</div>
                  <div
                    style={{
                      marginTop: 4,
                      fontFamily: token.fontFamilyCode,
                      fontSize: 11,
                      color: token.colorTextSecondary,
                      userSelect: 'all',
                    }}
                    data-testid="git-tool-detail-sha"
                  >
                    {selected.sha}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 11.5, color: token.colorTextSecondary }}>
                    {authorLine(selected)}
                  </div>
                  {selected.coAuthors.length > 0 && (
                    <div
                      style={{ marginTop: 2, fontSize: 11.5, color: token.colorTextSecondary }}
                      data-testid="git-tool-detail-co-authors"
                    >
                      {t('workbench.gitLog.coAuthors', { authors: selected.coAuthors.join(', ') })}
                    </div>
                  )}
                  <div
                    style={{
                      margin: '10px 0 4px',
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: token.colorText,
                    }}
                  >
                    {t('workbench.gitLog.filesHeading')}
                  </div>
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                    {selected.files.map((file) => (
                      <li key={`${selected.sha}:${file.path}`}>
                        <Button
                          type="link"
                          size="small"
                          loading={fileDiffLoading === file.path}
                          onClick={() => void openFileDiff(selected.sha, file.path)}
                          style={{ padding: 0, height: 'auto', fontSize: 11 }}
                          data-testid="git-tool-file"
                        >
                          <span style={{ fontFamily: token.fontFamilyCode }}>
                            <span style={{ color: statusColor(file.status, token) }}>{file.status}</span> {file.path}
                          </span>
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      <Modal
        open={fileDiff !== null}
        title={fileDiff !== null ? t('workbench.gitLog.diff.title', { path: fileDiff.path }) : ''}
        onCancel={() => setFileDiff(null)}
        footer={null}
        width="82%"
        destroyOnHidden
        data-testid="git-tool-diff-modal"
      >
        {fileDiff !== null && fileDiff.binary && (
          <p style={{ fontSize: 12, margin: 0 }} data-testid="git-tool-diff-binary">
            {t('workbench.gitLog.diff.binary')}
          </p>
        )}
        {fileDiff !== null && !fileDiff.binary && fileDiff.tooLarge && (
          <p style={{ fontSize: 12, margin: 0 }} data-testid="git-tool-diff-too-large">
            {t('workbench.gitLog.diff.tooLarge', {
              size: String(Math.ceil(Math.max(fileDiff.oldSize ?? 0, fileDiff.newSize ?? 0) / 1024)),
            })}
          </p>
        )}
        {fileDiff !== null && !fileDiff.binary && !fileDiff.tooLarge && (
          <div style={{ height: '62vh' }} data-testid="git-tool-diff-editor">
            <RichDiffEditor
              original={fileDiff.oldContent ?? ''}
              modified={fileDiff.newContent ?? ''}
              language={diffLanguage(fileDiff.path)}
              options={diffOptions}
              onOptionsChange={setDiffOptions}
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default GitLogPanel;
