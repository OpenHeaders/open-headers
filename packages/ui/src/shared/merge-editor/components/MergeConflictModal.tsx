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
import { type ReactElement, type ReactNode, useCallback, useMemo, useRef, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { diffLinesPatience } from '../diff/patience-diff';
import type { MergeApplyOutcome, MergeSession } from '../types';
import { usePersistedLayout } from '../use-persisted-layout';
import MergeFileList, { type MergeFileRowState } from './MergeFileList';
import MergePane, { type HunkStats, type MergeLayout, type MergePaneHandle } from './MergePane';
import './merge-conflict-modal.css';

const { Text } = Typography;

export interface MergeConflictModalProps {
  open: boolean;
  session: MergeSession;
  /** Caller provides the dark-mode signal; the editor stays
   *  shell-agnostic. */
  isDarkMode?: boolean;
  /** Caller provides the Monaco theme id; the editor stays
   *  shell-agnostic (falls back to built-in `vs` / `vs-dark`). */
  monacoTheme?: string;
  /** Closes the modal after Apply succeeds for every file. The shell
   *  also calls `session.onCancel()` for explicit cancel. */
  onClose(): void;
  /** Surface id for last-used-layout persistence (plan §13 — per-
   *  surface persistence). Suggested values: `'entity-conflict'`,
   *  `'import'`, `'git'`. Defaults to `'default'`. */
  surfaceId?: string;
  /** Optional caller-owned chrome rendered between the modal title
   *  and the merge editor body (above the toolbar). Hosts adapter-
   *  specific banners — parse rejections, target pickers, dedup
   *  hints, vault-decrypt prompts — without forcing the editor to
   *  know about them. Stays out of the editor's height calc; it
   *  takes its own space at the top of the flex column. */
  headerSlot?: ReactNode;
  /** Optional extra content rendered before the Cancel + Complete
   *  Merge buttons in the modal footer. Use for adapter-specific
   *  Advanced toggles or back-to-legacy buttons. */
  footerLeading?: ReactNode;
}

const MergeConflictModal = ({
  open,
  session,
  isDarkMode,
  monacoTheme,
  onClose,
  surfaceId = 'default',
  headerSlot,
  footerLeading,
}: MergeConflictModalProps): ReactElement => {
  const { token } = theme.useToken();
  const t = useT();
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
  // Single-click-resolve: when enabled, accepting one side of a hunk
  // auto-dismisses the other so the hunk fully resolves on the first
  // click. Default OFF so the diagonal-append affordance stays
  // discoverable. Plan §5.4 reserved this toggle for the per-side
  // state machine; toggling it doesn't undo prior decisions, only
  // affects future clicks.
  const [singleClickResolve, setSingleClickResolve] = useState(false);
  // Affordance-style toggles. Both default ON. The user-side prefers
  // one or the other based on muscle memory — some users
  // gravitate to the gutter glyphs, VS Code users to the inline
  // labels. Defaulting both lets each user land in something they
  // recognize, and they can disable the redundant one once they've
  // chosen. Side gutters are spatially incorrect in show-base-*
  // layouts (the result pane is on a separate row from theirs/mine,
  // so flankers end up at the modal edges); we force-disable the
  // toggle there.
  const [inlineActionLabels, setInlineActionLabels] = useState(true);
  const [sideActionGutters, setSideActionGutters] = useState(true);
  // Compact view collapses unchanged regions across all three panes so
  // only hunks (+ a few lines of context) stay visible. Off by default
  // because compact view loses the surrounding YAML context which is
  // often useful for understanding the rule's overall shape.
  const [compactView, setCompactView] = useState(false);
  // Bumped whenever any file's pick-state changes via MergePane's
  // `onPickStateChange`. Forces the modal's memoized hunk-count diff
  // to re-run so the sidebar pill / Complete Merge gate reflect the
  // user's clicks immediately (without waiting for the next stats
  // emission, which only covers the active file).
  const [pickStateRev, setPickStateRev] = useState(0);
  // Stable callback so MergePane's `useMemo([..., onPickStateChange])`
  // doesn't recreate the pick-state controller on every modal render.
  // (MergePane also ref-mirrors this internally, but stabilizing here
  // avoids unnecessary churn through the prop chain.)
  const handlePickStateChange = useCallback(() => {
    setPickStateRev((n) => n + 1);
  }, []);
  const [layout, setLayout] = usePersistedLayout(surfaceId, 'column');
  // Side gutters are spatially correct only in Column layout — in
  // base-on-top / base-in-center the result pane is on a separate
  // row, so flankers end up at the modal edges (visually
  // disconnected from theirs / mine). Force-disable the toggle in
  // those layouts; users still get the inline labels.
  const sideGuttersAvailable = layout === 'column';
  const effectiveSideGutters = sideGuttersAvailable && sideActionGutters;
  const failedOutcomes = useMemo(() => outcomes.filter((o) => !o.ok), [outcomes]);
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
        remaining === 0
          ? ` ${t('shared.mergeEditor.announce.allResolved')}`
          : ` ${t('shared.mergeEditor.announce.remaining', { count: remaining })}`;
      // Toggle the text to force a re-announcement even if the message
      // is identical to the previous one (some screen readers debounce).
      liveRef.current.textContent = '';
      liveRef.current.textContent = msg + tail;
    },
    [stats.totalRemaining, t],
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

  // Initial per-file hunk count — diffs every file on session open so
  // the sidebar can show a "N" badge per row. Recomputes when the
  // session changes (reasonable since the session is the unit of work).
  // For very large sessions (>200 files) this could become expensive;
  // defer that optimization to a real consumer.
  //
  // Hoisted above `fileStates` because in-session status derives from
  // the per-file hunk count (resolved iff zero remaining).
  const initialHunkCounts = useMemo<Map<string, number>>(() => {
    const map = new Map<string, number>();
    for (const f of session.files) {
      const seed = resultsByFileId.get(f.id) ?? f.initialResult;
      // Symmetric to MergePane's per-kind diff gating: `kind: 'add'`
      // skips the mine-vs-result diff (mine is empty by design),
      // `kind: 'remove'` skips the theirs-vs-result diff. Without
      // these gates, every add file shows a phantom whole-content
      // hunk on the mine side and never resolves.
      const t = f.kind === 'remove' ? 0 : diffLinesPatience(f.theirs, seed).length;
      const m = f.kind === 'add' ? 0 : diffLinesPatience(f.mine, seed).length;
      map.set(f.id, t + m);
    }
    // Read pickStateRev so a controller-driven state change in the
    // active MergePane re-runs this memo. The diff itself doesn't
    // depend on the rev — the dependency just busts the cache so the
    // sidebar pill catches up to the user's clicks immediately.
    void pickStateRev;
    return map;
  }, [session.files, resultsByFileId, pickStateRev]);

  // Active file shows live count from MergePane stats; inactive files
  // show the (possibly stale) initial count. Live wins on collision.
  const sidebarHunkCounts = useMemo<Map<string, number>>(() => {
    const map = new Map(initialHunkCounts);
    if (activeFileId) map.set(activeFileId, stats.totalRemaining);
    return map;
  }, [initialHunkCounts, activeFileId, stats.totalRemaining]);

  // File-row status map. Three layers (later layers override earlier):
  //   1. In-session derived: every file with zero hunks remaining is
  //      `resolved` — bulk actions (Accept All Incoming, Apply Non-
  //      Conflicting) drive this by writing to `resultsByFileId`,
  //      which the initial-count diff picks up. Files that never
  //      diverged (kind: 'add' on a fresh workspace) start at zero
  //      and surface as resolved immediately. Plan §5.3's "or
  //      accepted-all hunks" branch.
  //   2. Apply outcomes: success → `resolved`, failure → `failed`
  //      (with the adapter error in the sidebar tooltip).
  // The `partial` status is reserved for future per-file reorder/
  // bulk affordances; not driven today.
  const fileStates = useMemo<Map<string, MergeFileRowState>>(() => {
    const map = new Map<string, MergeFileRowState>();
    for (const f of session.files) {
      const remaining = sidebarHunkCounts.get(f.id) ?? 0;
      if (remaining === 0) {
        map.set(f.id, { status: 'resolved' });
      }
    }
    for (const o of outcomes) {
      map.set(o.fileId, { status: o.ok ? 'resolved' : 'failed', error: o.error });
    }
    return map;
  }, [outcomes, session.files, sidebarHunkCounts]);

  // Whole-session gate for Complete Merge. The active file's live
  // hunk count is folded in via `sidebarHunkCounts` already, so this
  // is the same predicate the sidebar uses to surface per-row status.
  const allFilesResolved = useMemo(() => {
    for (const f of session.files) {
      if ((sidebarHunkCounts.get(f.id) ?? 0) > 0) return false;
    }
    return true;
  }, [session.files, sidebarHunkCounts]);

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
      const key = f.group ?? t('shared.mergeEditor.groupOther');
      groupCounts.set(key, (groupCounts.get(key) ?? 0) + 1);
    }
    const groupParts = Array.from(groupCounts.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([g, n]) => `${n} ${g}`)
      .join(', ');
    return `${t('shared.mergeEditor.sessionScope.files', { count: total })}${groupParts ? ` (${groupParts})` : ''}`;
  }, [session.files, t]);

  const applySessionWide = useCallback(
    (side: 'theirs' | 'mine') => {
      Modal.confirm({
        title:
          side === 'theirs'
            ? t('shared.mergeEditor.confirm.acceptIncomingTitle')
            : t('shared.mergeEditor.confirm.acceptCurrentTitle'),
        content: (
          <Typography.Paragraph style={{ marginBottom: 0 }}>
            <Typography.Text>
              {side === 'theirs'
                ? t('shared.mergeEditor.confirm.replaceWithIncoming', { scope: summarizeSessionScope() })
                : t('shared.mergeEditor.confirm.resetToCurrent', { scope: summarizeSessionScope() })}
            </Typography.Text>
            <br />
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {side === 'theirs'
                ? t('shared.mergeEditor.confirm.discardsLocal')
                : t('shared.mergeEditor.confirm.discardsIncoming')}
            </Typography.Text>
          </Typography.Paragraph>
        ),
        okText: side === 'theirs' ? t('shared.mergeEditor.confirm.okIncoming') : t('shared.mergeEditor.confirm.okCurrent'),
        cancelText: t('shared.mergeEditor.confirm.cancel'),
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
    [session.files, summarizeSessionScope, t],
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
      centered
      destroyOnClose
      zIndex={1100}
      footer={[
        footerLeading ?? null,
        <Button key="cancel" onClick={handleCancel} disabled={applying}>
          {t('shared.mergeEditor.footer.cancel')}
        </Button>,
        <Button key="apply" type="primary" onClick={handleApply} loading={applying} disabled={!allFilesResolved}>
          {t('shared.mergeEditor.footer.completeMerge')}
        </Button>,
      ]}
    >
      {/* Viewport-clamped scroll column — sizing + scrollbar treatment
          in merge-conflict-modal.css. The editor keeps a usable floor
          via its own minHeight below. */}
      <div className="oh-merge__modal-body">
        {headerSlot}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Space size={6}>
            <Tooltip title={t('shared.mergeEditor.toolbar.prevHunk')}>
              <Button
                size="small"
                icon={<UpOutlined />}
                disabled={stats.totalRemaining === 0}
                onClick={() => paneRef.current?.gotoPrevHunk()}
              />
            </Tooltip>
            <Tooltip title={t('shared.mergeEditor.toolbar.nextHunk')}>
              <Button
                size="small"
                icon={<DownOutlined />}
                disabled={stats.totalRemaining === 0}
                onClick={() => paneRef.current?.gotoNextHunk()}
              />
            </Tooltip>
          </Space>
          {stats.totalRemaining === 0 ? (
            <Tag color="success" icon={<CheckCircleFilled />}>
              {t('shared.mergeEditor.toolbar.allResolved')}
            </Tag>
          ) : (
            <Tag color={stats.conflicts > 0 ? 'warning' : 'processing'}>
              {t('shared.mergeEditor.toolbar.hunksRemaining', { count: stats.totalRemaining })}
              {stats.conflicts > 0
                ? ` · ${t('shared.mergeEditor.toolbar.conflictsCount', { count: stats.conflicts })}`
                : ''}
              {stats.nonConflicting > 0
                ? ` · ${t('shared.mergeEditor.toolbar.nonConflictingCount', { count: stats.nonConflicting })}`
                : ''}
            </Tag>
          )}
          <Tooltip title={t('shared.mergeEditor.toolbar.applyNonConflictingTooltip')}>
            <Button
              size="small"
              icon={<ThunderboltOutlined />}
              disabled={stats.nonConflicting === 0}
              onClick={() => paneRef.current?.applyNonConflicting()}
            >
              {t('shared.mergeEditor.toolbar.applyNonConflicting')}
            </Button>
          </Tooltip>
          {session.files.length > 1 ? (
            <Dropdown
              menu={{
                items: [
                  {
                    key: 'file-theirs',
                    label: t('shared.mergeEditor.toolbar.acceptAllIncomingFile'),
                    disabled: stats.theirsRemaining === 0,
                    onClick: () => paneRef.current?.acceptAllTheirs(),
                  },
                  {
                    key: 'file-mine',
                    label: t('shared.mergeEditor.toolbar.acceptAllCurrentFile'),
                    disabled: stats.mineRemaining === 0,
                    onClick: () => paneRef.current?.acceptAllMine(),
                  },
                  { type: 'divider' },
                  {
                    key: 'session-theirs',
                    label: t('shared.mergeEditor.toolbar.acceptAllIncomingSession'),
                    danger: true,
                    onClick: () => applySessionWide('theirs'),
                  },
                  {
                    key: 'session-mine',
                    label: t('shared.mergeEditor.toolbar.acceptAllCurrentSession'),
                    onClick: () => applySessionWide('mine'),
                  },
                ],
              }}
            >
              <Button size="small">
                {t('shared.mergeEditor.toolbar.acceptAll')} <DownOutlined />
              </Button>
            </Dropdown>
          ) : (
            <>
              <Button
                size="small"
                disabled={stats.theirsRemaining === 0}
                onClick={() => paneRef.current?.acceptAllTheirs()}
              >
                {t('shared.mergeEditor.toolbar.acceptAllIncoming')}
              </Button>
              <Button
                size="small"
                disabled={stats.mineRemaining === 0}
                onClick={() => paneRef.current?.acceptAllMine()}
              >
                {t('shared.mergeEditor.toolbar.acceptAllCurrent')}
              </Button>
            </>
          )}
          <Space size={8} style={{ marginLeft: 'auto' }}>
            <Tooltip title={baseAvailable ? '' : t('shared.mergeEditor.toolbar.baseUnavailable')}>
              <Segmented
                size="small"
                value={layout}
                onChange={(v) => setLayout(v as MergeLayout)}
                options={[
                  { label: t('shared.mergeEditor.layout.column'), value: 'column' },
                  { label: t('shared.mergeEditor.layout.baseOnTop'), value: 'show-base-top', disabled: !baseAvailable },
                  {
                    label: t('shared.mergeEditor.layout.baseInCenter'),
                    value: 'show-base-center',
                    disabled: !baseAvailable,
                  },
                ]}
              />
            </Tooltip>
            <Tooltip title={t('shared.mergeEditor.toolbar.resetLayout')}>
              <Button size="small" icon={<ReloadOutlined />} onClick={() => paneRef.current?.resetLayout()} />
            </Tooltip>
            <Switch size="small" checked={showNonConflicting} onChange={setShowNonConflicting} />
            <Text style={{ fontSize: 12 }} type="secondary">
              {t('shared.mergeEditor.toggle.showNonConflicting')}
            </Text>
            <Tooltip title={t('shared.mergeEditor.toggle.compactViewTooltip')}>
              <Switch size="small" checked={compactView} onChange={setCompactView} />
            </Tooltip>
            <Text style={{ fontSize: 12 }} type="secondary">
              {t('shared.mergeEditor.toggle.compactView')}
            </Text>
            <Tooltip title={t('shared.mergeEditor.toggle.singleClickResolveTooltip')}>
              <Switch size="small" checked={singleClickResolve} onChange={setSingleClickResolve} />
            </Tooltip>
            <Text style={{ fontSize: 12 }} type="secondary">
              {t('shared.mergeEditor.toggle.singleClickResolve')}
            </Text>
            <Tooltip title={t('shared.mergeEditor.toggle.inlineLabelsTooltip')}>
              <Switch size="small" checked={inlineActionLabels} onChange={setInlineActionLabels} />
            </Tooltip>
            <Text style={{ fontSize: 12 }} type="secondary">
              {t('shared.mergeEditor.toggle.inlineLabels')}
            </Text>
            <Tooltip
              title={
                sideGuttersAvailable
                  ? t('shared.mergeEditor.toggle.sideGuttersTooltip')
                  : t('shared.mergeEditor.toggle.sideGuttersUnavailable')
              }
            >
              <Switch
                size="small"
                checked={effectiveSideGutters}
                onChange={setSideActionGutters}
                disabled={!sideGuttersAvailable}
              />
            </Tooltip>
            <Text style={{ fontSize: 12 }} type="secondary" disabled={!sideGuttersAvailable}>
              {t('shared.mergeEditor.toggle.sideGutters')}
            </Text>
          </Space>
        </div>
        {failedOutcomes.length > 0 ? (
          <Alert
            type="error"
            showIcon
            message={
              <Space direction="vertical" size={2}>
                <Text strong>{t('shared.mergeEditor.errors.applyReported')}</Text>
                {failedOutcomes.map((o) => (
                  <Text key={o.fileId} type="secondary" style={{ fontSize: 12 }}>
                    {session.files.find((f) => f.id === o.fileId)?.label ?? o.fileId}:{' '}
                    {o.error ?? t('shared.mergeEditor.errors.unknown')}
                  </Text>
                ))}
              </Space>
            }
          />
        ) : null}
        <div
          style={{
            flex: 1,
            // A short viewport shrinks the editor before the toolbar;
            // the floor keeps the panes usable and lets the column
            // scroll inside the modal instead of crushing Monaco.
            minHeight: 240,
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
                    monacoTheme={monacoTheme}
                    showNonConflicting={showNonConflicting}
                    compactView={compactView}
                    layout={layout}
                    onHunkStatsChange={setStats}
                    onAnnounce={announce}
                  />
                ) : (
                  <div style={{ padding: 16 }}>
                    <Text type="secondary">{t('shared.mergeEditor.emptySession')}</Text>
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
                  monacoTheme={monacoTheme}
                  showNonConflicting={showNonConflicting}
                  singleClickResolve={singleClickResolve}
                  inlineActionLabels={inlineActionLabels}
                  sideActionGutters={effectiveSideGutters}
                  compactView={compactView}
                  layout={layout}
                  onHunkStatsChange={setStats}
                  onPickStateChange={handlePickStateChange}
                  onAnnounce={announce}
                />
              ) : (
                <div style={{ padding: 16 }}>
                  <Text type="secondary">{t('shared.mergeEditor.emptySession')}</Text>
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
