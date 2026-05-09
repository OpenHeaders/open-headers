/**
 * Modal shell — single MergePane plus an optional file-list sidebar
 * (Phase 5). Per-file result text is cached so switching files
 * preserves user edits without recreating Monaco editors (plan
 * §11.8): `MergePane` re-seeds its result buffer when `file.initialResult`
 * changes, but the same editor instance keeps its scroll/cursor/sash
 * state.
 *
 * Apply flow: read every file's editable result text (active file
 * via pane handle; inactive files via the cache) and hand the
 * `Map<fileId, text>` to the session adapter. The modal stays open
 * if any outcome is `ok: false`.
 */

import { CheckCircleFilled, DownOutlined, ReloadOutlined, ThunderboltOutlined, UpOutlined } from '@ant-design/icons';
import { Allotment, LayoutPriority } from 'allotment';
import { Alert, Button, Dropdown, Modal, Segmented, Space, Switch, Tag, Tooltip, Typography, theme } from 'antd';
import { type ReactElement, useCallback, useMemo, useRef, useState } from 'react';
import { diffLinesPatience } from '../diff/patience-diff';
import type { MergeApplyOutcome, MergeSession } from '../types';
import { usePersistedLayout } from '../use-persisted-layout';
import MergeFileList, { type MergeFileRowState } from './MergeFileList';
import MergePane, { type HunkStats, type MergeLayout, type MergePaneHandle } from './MergePane';

const { Text } = Typography;

export interface MergeConflictModalProps {
  open: boolean;
  session: MergeSession;
  /** Caller provides the dark-mode signal; the editor stays
   *  shell-agnostic. */
  isDarkMode?: boolean;
  /** Closes the modal after Apply succeeds for every file. The shell
   *  also calls `session.onCancel()` for explicit cancel. */
  onClose(): void;
  /** Surface id for last-used-layout persistence (plan §13 — per-
   *  surface persistence). Suggested values: `'entity-conflict'`,
   *  `'import'`, `'git'`. Defaults to `'default'`. */
  surfaceId?: string;
}

const MergeConflictModal = ({
  open,
  session,
  isDarkMode,
  onClose,
  surfaceId = 'default',
}: MergeConflictModalProps): ReactElement => {
  const { token } = theme.useToken();
  const paneRef = useRef<MergePaneHandle>(null);
  const [applying, setApplying] = useState(false);
  const [outcomes, setOutcomes] = useState<MergeApplyOutcome[]>([]);
  const [stats, setStats] = useState<HunkStats>({
    theirsRemaining: 0,
    mineRemaining: 0,
    totalRemaining: 0,
    nonConflicting: 0,
    conflicts: 0,
  });
  // VS Code's default — gutter shows conflicts only until the user
  // opts into the noisier view. Plan §5.4.
  const [showNonConflicting, setShowNonConflicting] = useState(false);
  const [layout, setLayout] = usePersistedLayout(surfaceId, 'column');
  const failedOutcomes = useMemo(() => outcomes.filter((o) => !o.ok), [outcomes]);
  const allResolved = stats.totalRemaining === 0;
  const baseAvailable = useMemo(() => session.files.some((f) => f.base !== undefined), [session]);

  // ARIA live announcer. Polite — won't interrupt the screen reader's
  // current utterance. The remaining-hunk count is appended so each
  // announcement carries the user's progress without an extra tick.
  const liveRef = useRef<HTMLDivElement>(null);
  const announce = useCallback(
    (msg: string) => {
      if (!liveRef.current) return;
      const remaining = stats.totalRemaining;
      const tail =
        remaining === 0 ? ' All hunks resolved.' : ` ${remaining} ${remaining === 1 ? 'hunk' : 'hunks'} remaining.`;
      // Toggle the text to force a re-announcement even if the message
      // is identical to the previous one (some screen readers debounce).
      liveRef.current.textContent = '';
      liveRef.current.textContent = msg + tail;
    },
    [stats.totalRemaining],
  );

  // Active file id — initialized from `session.initialFileId` or the
  // first file. Multi-file selection updates this from the sidebar.
  const [activeFileId, setActiveFileId] = useState<string | null>(() => {
    if (session.files.length === 0) return null;
    if (session.initialFileId && session.files.some((f) => f.id === session.initialFileId)) {
      return session.initialFileId;
    }
    return session.files[0].id;
  });

  // Per-file result-text cache. Updated on every file switch + on Apply
  // so inactive files contribute their last user edit. Apply payload
  // also fetches the active file via the pane handle to capture any
  // post-edit text the cache hasn't seen.
  const [resultsByFileId, setResultsByFileId] = useState<Map<string, string>>(() => new Map());

  const activeFile = useMemo(() => {
    if (!activeFileId) return null;
    const file = session.files.find((f) => f.id === activeFileId);
    if (!file) return null;
    const cached = resultsByFileId.get(file.id);
    return cached !== undefined ? { ...file, initialResult: cached } : file;
  }, [activeFileId, session.files, resultsByFileId]);

  // File-row status map. `failed` rows surface their adapter error in
  // the sidebar tooltip. `resolved` is set on Apply success.
  const fileStates = useMemo<Map<string, MergeFileRowState>>(() => {
    const map = new Map<string, MergeFileRowState>();
    for (const o of outcomes) {
      map.set(o.fileId, { status: o.ok ? 'resolved' : 'failed', error: o.error });
    }
    return map;
  }, [outcomes]);

  // Initial per-file hunk count — diffs every file on session open so
  // the sidebar can show a "N" badge per row. Recomputes when the
  // session changes (reasonable since the session is the unit of work).
  // For very large sessions (>200 files) this could become expensive;
  // defer that optimization to a real consumer.
  const initialHunkCounts = useMemo<Map<string, number>>(() => {
    const map = new Map<string, number>();
    for (const f of session.files) {
      const seed = resultsByFileId.get(f.id) ?? f.initialResult;
      const t = diffLinesPatience(f.theirs, seed).length;
      const m = diffLinesPatience(f.mine, seed).length;
      map.set(f.id, t + m);
    }
    return map;
  }, [session.files, resultsByFileId]);

  // Active file shows live count from MergePane stats; inactive files
  // show the (possibly stale) initial count. Live wins on collision.
  const sidebarHunkCounts = useMemo<Map<string, number>>(() => {
    const map = new Map(initialHunkCounts);
    if (activeFileId) map.set(activeFileId, stats.totalRemaining);
    return map;
  }, [initialHunkCounts, activeFileId, stats.totalRemaining]);

  const handleFileSelect = useCallback(
    (nextFileId: string) => {
      if (!activeFileId || nextFileId === activeFileId) return;
      // Cache the active file's current text BEFORE switching so the
      // user's in-progress edits ride along.
      const text = paneRef.current?.getResultText();
      if (text !== undefined) {
        setResultsByFileId((prev) => {
          if (prev.get(activeFileId) === text) return prev;
          const next = new Map(prev);
          next.set(activeFileId, text);
          return next;
        });
      }
      setActiveFileId(nextFileId);
    },
    [activeFileId],
  );

  const handleCancel = useCallback(() => {
    session.onCancel();
    onClose();
  }, [session, onClose]);

  // Session-wide bulk apply. Replaces every file's result text with
  // either `theirs` or `mine` wholesale; conflicts are accepted per
  // the user's chosen side. Plan §5.4: confirmation modal names what
  // will happen with a per-group breakdown so a misclick doesn't
  // silently overwrite 50 entities.
  const summarizeSessionScope = useCallback((): string => {
    const total = session.files.length;
    const groupCounts = new Map<string, number>();
    for (const f of session.files) {
      const key = f.group ?? 'Other';
      groupCounts.set(key, (groupCounts.get(key) ?? 0) + 1);
    }
    const groupParts = Array.from(groupCounts.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([g, n]) => `${n} ${g}`)
      .join(', ');
    return `${total} ${total === 1 ? 'file' : 'files'}${groupParts ? ` (${groupParts})` : ''}`;
  }, [session.files]);

  const applySessionWide = useCallback(
    (side: 'theirs' | 'mine') => {
      Modal.confirm({
        title: side === 'theirs' ? 'Accept all incoming (session)' : 'Accept all current (session)',
        content: (
          <Typography.Paragraph style={{ marginBottom: 0 }}>
            <Typography.Text>
              {side === 'theirs'
                ? `Replace ${summarizeSessionScope()} with the incoming version.`
                : `Reset ${summarizeSessionScope()} to your current version.`}
            </Typography.Text>
            <br />
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {side === 'theirs'
                ? 'This discards your local edits for every file in the session.'
                : 'This discards every incoming change for every file in the session.'}
            </Typography.Text>
          </Typography.Paragraph>
        ),
        okText: side === 'theirs' ? 'Accept all incoming' : 'Accept all current',
        cancelText: 'Cancel',
        okButtonProps: { danger: side === 'theirs' },
        onOk: () => {
          setResultsByFileId(() => {
            const next = new Map<string, string>();
            for (const f of session.files) {
              next.set(f.id, side === 'theirs' ? f.theirs : f.mine);
            }
            return next;
          });
        },
      });
    },
    [session.files, summarizeSessionScope],
  );

  const handleApply = useCallback(async () => {
    if (!activeFile) return;
    setApplying(true);
    try {
      // Build the results map: cached text for inactive files, live
      // pane text for the active file. Files the user never opened
      // fall back to their adapter-supplied initialResult.
      const results = new Map<string, string>();
      for (const f of session.files) {
        const cached = resultsByFileId.get(f.id);
        results.set(f.id, cached ?? f.initialResult);
      }
      const liveText = paneRef.current?.getResultText();
      if (liveText !== undefined && activeFileId) {
        results.set(activeFileId, liveText);
      }
      const next = await session.onApply(session.files, results);
      setOutcomes(next);
      if (next.every((o) => o.ok)) onClose();
    } finally {
      setApplying(false);
    }
  }, [activeFile, activeFileId, resultsByFileId, session, onClose]);

  return (
    <Modal
      open={open}
      onCancel={handleCancel}
      title={session.title}
      width="min(1600px, 95vw)"
      destroyOnClose
      zIndex={1100}
      footer={[
        <Button key="cancel" onClick={handleCancel} disabled={applying}>
          Cancel
        </Button>,
        <Button key="apply" type="primary" onClick={handleApply} loading={applying} disabled={!allResolved}>
          Complete Merge
        </Button>,
      ]}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          height: 'calc(85vh - 120px)',
          minHeight: 480,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Space size={6}>
            <Tooltip title="Previous hunk">
              <Button
                size="small"
                icon={<UpOutlined />}
                disabled={stats.totalRemaining === 0}
                onClick={() => paneRef.current?.gotoPrevHunk()}
              />
            </Tooltip>
            <Tooltip title="Next hunk">
              <Button
                size="small"
                icon={<DownOutlined />}
                disabled={stats.totalRemaining === 0}
                onClick={() => paneRef.current?.gotoNextHunk()}
              />
            </Tooltip>
          </Space>
          {allResolved ? (
            <Tag color="success" icon={<CheckCircleFilled />}>
              All hunks resolved
            </Tag>
          ) : (
            <Tag color={stats.conflicts > 0 ? 'warning' : 'processing'}>
              {stats.totalRemaining} {stats.totalRemaining === 1 ? 'hunk' : 'hunks'} remaining
              {stats.conflicts > 0 ? ` · ${stats.conflicts} conflict${stats.conflicts === 1 ? '' : 's'}` : ''}
              {stats.nonConflicting > 0 ? ` · ${stats.nonConflicting} non-conflicting` : ''}
            </Tag>
          )}
          <Tooltip title="Apply every hunk only one side touched, in one undo step. Conflicts stay for manual resolution.">
            <Button
              size="small"
              icon={<ThunderboltOutlined />}
              disabled={stats.nonConflicting === 0}
              onClick={() => paneRef.current?.applyNonConflicting()}
            >
              Apply non-conflicting
            </Button>
          </Tooltip>
          {session.files.length > 1 ? (
            <Dropdown
              menu={{
                items: [
                  {
                    key: 'file-theirs',
                    label: 'Accept all incoming (this file)',
                    disabled: stats.theirsRemaining === 0,
                    onClick: () => paneRef.current?.acceptAllTheirs(),
                  },
                  {
                    key: 'file-mine',
                    label: 'Accept all current (this file)',
                    disabled: stats.mineRemaining === 0,
                    onClick: () => paneRef.current?.acceptAllMine(),
                  },
                  { type: 'divider' },
                  {
                    key: 'session-theirs',
                    label: 'Accept all incoming (whole session)',
                    danger: true,
                    onClick: () => applySessionWide('theirs'),
                  },
                  {
                    key: 'session-mine',
                    label: 'Accept all current (whole session)',
                    onClick: () => applySessionWide('mine'),
                  },
                ],
              }}
            >
              <Button size="small">
                Accept all <DownOutlined />
              </Button>
            </Dropdown>
          ) : (
            <>
              <Button
                size="small"
                disabled={stats.theirsRemaining === 0}
                onClick={() => paneRef.current?.acceptAllTheirs()}
              >
                Accept all incoming
              </Button>
              <Button
                size="small"
                disabled={stats.mineRemaining === 0}
                onClick={() => paneRef.current?.acceptAllMine()}
              >
                Accept all current
              </Button>
            </>
          )}
          <Space size={8} style={{ marginLeft: 'auto' }}>
            <Tooltip title={baseAvailable ? '' : 'Base view unavailable — no common ancestor in this session.'}>
              <Segmented
                size="small"
                value={layout}
                onChange={(v) => setLayout(v as MergeLayout)}
                options={[
                  { label: 'Column', value: 'column' },
                  { label: 'Base on top', value: 'show-base-top', disabled: !baseAvailable },
                  { label: 'Base in center', value: 'show-base-center', disabled: !baseAvailable },
                ]}
              />
            </Tooltip>
            <Tooltip title="Reset pane sizes for the current layout">
              <Button size="small" icon={<ReloadOutlined />} onClick={() => paneRef.current?.resetLayout()} />
            </Tooltip>
            <Switch size="small" checked={showNonConflicting} onChange={setShowNonConflicting} />
            <Text style={{ fontSize: 12 }} type="secondary">
              Show non-conflicting
            </Text>
          </Space>
        </div>
        {failedOutcomes.length > 0 ? (
          <Alert
            type="error"
            showIcon
            message={
              <Space direction="vertical" size={2}>
                <Text strong>Apply reported errors:</Text>
                {failedOutcomes.map((o) => (
                  <Text key={o.fileId} type="secondary" style={{ fontSize: 12 }}>
                    {session.files.find((f) => f.id === o.fileId)?.label ?? o.fileId}: {o.error ?? 'unknown error'}
                  </Text>
                ))}
              </Space>
            }
          />
        ) : null}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            border: `1px solid ${token.colorBorderSecondary}`,
            borderRadius: 4,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'row',
          }}
        >
          {/* Sidebar lives outside MergePane's CSS-grid layout, so an
              outer Allotment can resize it without crossing the
              "editor containers must stay mounted" invariant. Allotment
              renders nothing for the sidebar pane in single-file mode
              because MergeFileList returns null at files.length === 1. */}
          {session.files.length > 1 && activeFileId ? (
            <Allotment proportionalLayout={false}>
              <Allotment.Pane preferredSize={280} minSize={200} maxSize={480} snap priority={LayoutPriority.Low}>
                <MergeFileList
                  files={session.files}
                  activeFileId={activeFileId}
                  states={fileStates}
                  hunkCounts={sidebarHunkCounts}
                  onSelect={handleFileSelect}
                />
              </Allotment.Pane>
              <Allotment.Pane priority={LayoutPriority.High}>
                {activeFile ? (
                  <MergePane
                    ref={paneRef}
                    file={activeFile}
                    isDarkMode={isDarkMode}
                    showNonConflicting={showNonConflicting}
                    layout={layout}
                    onHunkStatsChange={setStats}
                    onAnnounce={announce}
                  />
                ) : (
                  <div style={{ padding: 16 }}>
                    <Text type="secondary">No files in this merge session.</Text>
                  </div>
                )}
              </Allotment.Pane>
            </Allotment>
          ) : (
            <div style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
              {activeFile ? (
                <MergePane
                  ref={paneRef}
                  file={activeFile}
                  isDarkMode={isDarkMode}
                  showNonConflicting={showNonConflicting}
                  layout={layout}
                  onHunkStatsChange={setStats}
                  onAnnounce={announce}
                />
              ) : (
                <div style={{ padding: 16 }}>
                  <Text type="secondary">No files in this merge session.</Text>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {/* Visually-hidden polite live region. Off-screen via the
          standard sr-only clip rect; aria-live="polite" so screen
          readers pick up announcements without preempting the user's
          current focus. */}
      <div
        ref={liveRef}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: 'hidden',
          clip: 'rect(0,0,0,0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      />
    </Modal>
  );
};

export default MergeConflictModal;
