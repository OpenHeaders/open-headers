/**
 * Side-by-side diff dialog for an entity with multiple unresolved
 * external changes.
 *
 * Entity-agnostic — caller supplies:
 *   - `savedText`: serialized canonical (left pane).
 *   - `buildLocalText(resolutions)`: returns the serialized projection
 *     with the user's pending per-row picks applied. Called every time
 *     the picks change so the right pane reflects the would-be result
 *     of Apply, the same way IDE merge tools preview.
 *   - `conflicts`: the active per-path conflict map.
 *   - `pathLabels` (optional): pretty label per path for the table.
 *   - `localValuesByPath` (optional): the user's actual current edit
 *     per path for the table column.
 *
 * Attribution UX (matches Google Docs suggested-edits / Linear comment
 * threads):
 *   - When every conflict came from the same peer, render a single
 *     attribution banner above the table: "Saved by Workbench · 54s
 *     ago". No per-row noise.
 *   - When peers diverge, the banner reads "Saved by multiple
 *     surfaces" and the per-row chips light up with each row's source.
 *   - When awareness can't attribute (rare — no live peers at all),
 *     the banner is omitted; nothing surfaces.
 *
 * Resolution UX (VS Code merge editor / GitHub PR
 * suggestions): picking a side gives the row a tint, bolds the chosen
 * value, dims the other, and ticks a "✓ Resolved" indicator. The top
 * counter and the Apply button label both track progress.
 */

import {
  CheckCircleFilled,
  CloudDownloadOutlined,
  EditOutlined,
  MinusCircleFilled,
  PlusCircleFilled,
  SwapOutlined,
  WarningFilled,
} from '@ant-design/icons';
import { useTheme } from '@context/ThemeContext';
import { Button, Modal, Radio, Space, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import SurfaceChip from '@/shared/awareness/SurfaceChip';
import { MergeConflictModal } from '@/shared/merge-editor';
import type { DiffViewerOptions } from '@/workbench/components/diff-viewer';
import { DEFAULT_DIFF_VIEWER_OPTIONS, RichDiffEditor } from '@/workbench/components/diff-viewer';
import { decorateYamlForDiff } from './decorate-yaml';
import { buildEntityMergeSession } from './entity-merge-adapter';
import type { ConflictRemoteInfo, PathConflict } from './types';

/** Feature flag for the new merge-editor preview surface. Read once
 *  per dialog mount; flip in DevTools console:
 *    localStorage.setItem('oh.merge-editor.preview', '1')
 *  Phase 6 wiring (incremental): when the caller passes `onResolveText`,
 *  the preview's Complete Merge commits through that callback (parse
 *  text → entity → adopt → advance tracker). Callers that haven't
 *  wired `onResolveText` yet keep the legacy no-commit preview and
 *  must use the path-keyed table to actually resolve. */
function isMergeEditorPreviewEnabled(): boolean {
  try {
    return globalThis.localStorage?.getItem('oh.merge-editor.preview') === '1';
  } catch {
    return false;
  }
}

const { Text } = Typography;

export type ConflictResolution = 'theirs' | 'mine';

export interface EntityConflictDialogProps {
  open: boolean;
  /** Serialized canonical (left pane). YAML by convention. */
  savedText: string;
  /** Serialize the user's projection with per-row picks applied. */
  buildLocalText: (resolutions: ReadonlyMap<string, ConflictResolution>) => string;
  /** Language id for syntax highlighting. Defaults to "yaml". */
  language?: string;
  /** All active conflicts on the entity, keyed by path. */
  conflicts: ReadonlyMap<string, PathConflict>;
  /** Optional current local form values per path. */
  localValuesByPath?: ReadonlyMap<string, string>;
  /** Optional human-readable label per path. */
  pathLabels?: ReadonlyMap<string, string>;
  /** Optional baseline (common-ancestor) serialized YAML. When
   *  supplied, the merge-editor preview renders 3-pane and exposes
   *  the Show Base layout switcher. */
  baseText?: string;
  /** Caller commits the chosen resolution map. */
  onResolve: (resolutions: Map<string, ConflictResolution>) => void;
  /** Phase 6 commit seam for the merge-editor surface. When supplied,
   *  the merge-editor preview's Complete Merge runs `onResolveText`
   *  with the user's final result text; the caller owns parsing it
   *  back to an entity, adopting it into the form, and advancing the
   *  conflict tracker. Throw to surface a parse / persist error —
   *  the preview renders the message inline and stays open. When
   *  omitted the preview stays no-commit (legacy until each editor
   *  wires its own text parser). */
  onResolveText?: (resultText: string) => Promise<void> | void;
  onClose: () => void;
}

const ELLIPSIS: React.CSSProperties = {
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

type AttributionSummary =
  | { kind: 'none' }
  | { kind: 'single'; remote: ConflictRemoteInfo }
  | { kind: 'multiple'; remotes: ConflictRemoteInfo[] };

function summarizeAttribution(conflicts: ReadonlyMap<string, PathConflict>): AttributionSummary {
  const remotes: ConflictRemoteInfo[] = [];
  const seen = new Set<string>();
  for (const c of conflicts.values()) {
    if (!c.remote) continue;
    if (seen.has(c.remote.instanceId)) continue;
    seen.add(c.remote.instanceId);
    remotes.push(c.remote);
  }
  if (remotes.length === 0) return { kind: 'none' };
  if (remotes.length === 1) return { kind: 'single', remote: remotes[0] };
  return { kind: 'multiple', remotes };
}

const EntityConflictDialog: React.FC<EntityConflictDialogProps> = ({
  open,
  savedText,
  buildLocalText,
  language = 'yaml',
  conflicts,
  localValuesByPath,
  pathLabels,
  baseText,
  onResolve,
  onResolveText,
  onClose,
}) => {
  const { token } = theme.useToken();
  const { isDarkMode } = useTheme();
  const [previewOpen, setPreviewOpen] = useState(false);
  // Read once per mount so toggling in DevTools doesn't surprise an
  // already-open dialog. Refresh by reopening.
  const previewEnabled = useMemo(() => isMergeEditorPreviewEnabled(), []);
  // Track the value snapshot at pick time so live broadcasts that
  // change `theirs` after a pick can flag the row as stale and force
  // the user to re-confirm. Same model as VS Code's merge editor —
  // resolutions don't quietly outlive the input they were made on.
  const [resolutions, setResolutions] = useState<Map<string, { choice: ConflictResolution; theirsAtPick: string }>>(
    () => new Map(),
  );
  const [staleNotice, setStaleNotice] = useState<Set<string>>(() => new Set());
  const [diffOptions, setDiffOptions] = useState<DiffViewerOptions>(DEFAULT_DIFF_VIEWER_OPTIONS);

  useEffect(() => {
    if (!open) return;
    setResolutions(new Map());
    setStaleNotice(new Set());
  }, [open]);

  // Invalidate any resolution whose remembered `theirs` no longer
  // matches the live conflict — the saved value drifted under us.
  // The row's resolution clears + a yellow "saved value changed —
  // please re-confirm" warning appears until the user picks again.
  useEffect(() => {
    setResolutions((prev) => {
      let changed = false;
      const next = new Map(prev);
      const newlyStale: string[] = [];
      for (const [path, r] of prev) {
        const c = conflicts.get(path);
        if (!c) {
          // Conflict resolved upstream (e.g. peer reverted) — silently drop.
          next.delete(path);
          changed = true;
          continue;
        }
        if (c.theirs !== r.theirsAtPick) {
          next.delete(path);
          newlyStale.push(path);
          changed = true;
        }
      }
      if (newlyStale.length > 0) {
        setStaleNotice((prevStale) => {
          const nextStale = new Set(prevStale);
          for (const p of newlyStale) nextStale.add(p);
          return nextStale;
        });
      }
      return changed ? next : prev;
    });
  }, [conflicts]);

  const orderedPaths = useMemo(() => Array.from(conflicts.keys()).sort(), [conflicts]);
  const total = conflicts.size;
  const resolvedCount = resolutions.size;
  const allResolved = resolvedCount === total;
  const attribution = useMemo(() => summarizeAttribution(conflicts), [conflicts]);
  const isMixed = attribution.kind === 'multiple';

  // Reduce to the simple Map<path, choice> shape callers downstream expect.
  const choiceOnly = useMemo(() => {
    const out = new Map<string, ConflictResolution>();
    for (const [k, v] of resolutions) out.set(k, v.choice);
    return out;
  }, [resolutions]);

  const localText = useMemo(() => buildLocalText(choiceOnly), [buildLocalText, choiceOnly]);
  // Tag each array-row's lines with their uid so Monaco's line-by-line
  // diff can't cross-match identical scalar values from different rows
  // (e.g. two headers that both happen to have `value: "3"`).
  const decoratedSaved = useMemo(
    () => (language === 'yaml' ? decorateYamlForDiff(savedText) : savedText),
    [language, savedText],
  );
  const decoratedLocal = useMemo(
    () => (language === 'yaml' ? decorateYamlForDiff(localText) : localText),
    [language, localText],
  );

  const setOne = (path: string, choice: ConflictResolution) => {
    const c = conflicts.get(path);
    if (!c) return;
    setResolutions((prev) => {
      const next = new Map(prev);
      next.set(path, { choice, theirsAtPick: c.theirs });
      return next;
    });
    // Clear stale-notice for this row — user just re-confirmed.
    setStaleNotice((prev) => {
      if (!prev.has(path)) return prev;
      const next = new Set(prev);
      next.delete(path);
      return next;
    });
  };

  const handleApply = () => {
    onResolve(choiceOnly);
    onClose();
  };

  const setAll = (choice: ConflictResolution) => {
    const next = new Map<string, { choice: ConflictResolution; theirsAtPick: string }>();
    for (const p of orderedPaths) {
      const c = conflicts.get(p);
      if (!c) continue;
      next.set(p, { choice, theirsAtPick: c.theirs });
    }
    setResolutions(next);
    setStaleNotice(new Set());
  };
  const handleAllSaved = () => setAll('theirs');
  const handleAllMine = () => setAll('mine');

  const valueCellStyle = (isChosen: boolean, isOther: boolean, isResolved: boolean): React.CSSProperties => ({
    padding: '6px 8px',
    fontFamily: 'monospace',
    fontSize: 11,
    ...ELLIPSIS,
    fontWeight: isChosen ? 600 : 400,
    color: isChosen ? token.colorSuccessText : isOther ? token.colorTextTertiary : token.colorText,
    textDecoration: isOther ? 'line-through' : 'none',
    opacity: isResolved && !isChosen ? 0.6 : 1,
  });

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={`Resolve external changes — ${total} ${total === 1 ? 'field' : 'fields'}`}
      width="min(1200px, 95vw)"
      destroyOnClose
      zIndex={1100}
      footer={[
        previewEnabled ? (
          <Button key="preview" onClick={() => setPreviewOpen(true)}>
            Preview new merge editor
          </Button>
        ) : null,
        <Button key="cancel" onClick={onClose}>
          Cancel
        </Button>,
        <Button key="apply" type="primary" onClick={handleApply} disabled={resolvedCount === 0}>
          {allResolved ? 'Apply' : `Apply (${resolvedCount} of ${total} resolved)`}
        </Button>,
      ]}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: 'calc(80vh - 120px)', minHeight: 420 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <Space size={8}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Pick a side per field, or apply one choice to all:
            </Text>
            <Button size="small" onClick={handleAllMine}>
              Keep all mine
            </Button>
            <Button size="small" onClick={handleAllSaved}>
              Use all saved
            </Button>
          </Space>
          <Text
            style={{
              fontSize: 12,
              color: allResolved ? token.colorSuccessText : token.colorTextSecondary,
              fontWeight: allResolved ? 600 : 400,
            }}
          >
            {allResolved && <CheckCircleFilled style={{ marginRight: 4 }} />}
            Resolved {resolvedCount} of {total}
          </Text>
        </div>

        {attribution.kind === 'single' && (
          <div
            style={{
              padding: '6px 10px',
              borderRadius: 4,
              background: token.colorInfoBg,
              border: `1px solid ${token.colorInfoBorder}`,
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            <CloudDownloadOutlined style={{ color: token.colorInfoText }} />
            <span>Saved by</span>
            <SurfaceChip
              kind={attribution.remote.surfaceKind}
              label={attribution.remote.surfaceLabel}
              agoMs={attribution.remote.agoMs}
            />
          </div>
        )}
        {attribution.kind === 'multiple' && (
          <div
            style={{
              padding: '6px 10px',
              borderRadius: 4,
              background: token.colorInfoBg,
              border: `1px solid ${token.colorInfoBorder}`,
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            <CloudDownloadOutlined style={{ color: token.colorInfoText }} />
            <span>Saved by multiple sources:</span>
            {attribution.remotes.map((r) => (
              <SurfaceChip
                key={r.instanceId}
                kind={r.surfaceKind}
                label={r.surfaceLabel}
                agoMs={r.agoMs}
                size="small"
              />
            ))}
          </div>
        )}

        <div
          style={{
            maxHeight: 220,
            overflow: 'auto',
            border: `1px solid ${token.colorBorderSecondary}`,
            borderRadius: 4,
          }}
        >
          <table
            style={{
              width: '100%',
              fontSize: 12,
              borderCollapse: 'collapse',
              tableLayout: 'fixed',
            }}
          >
            <colgroup>
              <col />
              <col style={{ width: '22%' }} />
              <col style={{ width: '22%' }} />
              <col style={{ width: 240 }} />
            </colgroup>
            <thead>
              <tr style={{ background: token.colorFillQuaternary }}>
                <th style={{ textAlign: 'left', padding: '6px 8px' }}>Field</th>
                <th style={{ textAlign: 'left', padding: '6px 8px' }}>Saved value</th>
                <th style={{ textAlign: 'left', padding: '6px 8px' }}>Your edit</th>
                <th style={{ textAlign: 'left', padding: '6px 8px' }}>Resolution</th>
              </tr>
            </thead>
            <tbody>
              {orderedPaths.map((path) => {
                const c = conflicts.get(path);
                if (!c) return null;
                const kind = c.kind ?? 'leaf';
                const label = pathLabels?.get(path) ?? path;
                const r = resolutions.get(path);
                const choice = r?.choice ?? null;
                const isResolved = choice !== null;
                const isStale = staleNotice.has(path);
                const yourEdit = localValuesByPath?.get(path) ?? c.base;
                const showRowSource = isMixed && c.remote;
                // Mine-side display copy depends on the kind:
                //   - leaf       → user's current form value
                //   - set-add    → "(not present)" because the row is new
                //                  externally
                //   - set-remove → the row's last summary (saved removed it,
                //                  user still has it)
                const mineDisplay =
                  kind === 'set-add'
                    ? '(not present)'
                    : kind === 'set-remove'
                      ? c.base
                      : kind === 'set-reorder'
                        ? c.base
                        : kind === 'union-swap'
                          ? c.base
                          : yourEdit;
                const theirsDisplay = kind === 'set-remove' ? '(removed)' : c.theirs;
                const useSavedLabel =
                  kind === 'set-add'
                    ? 'Add row'
                    : kind === 'set-remove'
                      ? 'Remove row'
                      : kind === 'set-reorder'
                        ? 'Use saved order'
                        : kind === 'union-swap'
                          ? 'Use saved type'
                          : 'Use saved';
                const keepMineLabel = kind === 'leaf' ? 'Keep mine' : 'Ignore';
                const kindIcon =
                  kind === 'set-add' ? (
                    <Tooltip title="Saved version added this row">
                      <PlusCircleFilled style={{ color: token.colorSuccess, fontSize: 12, marginRight: 4 }} />
                    </Tooltip>
                  ) : kind === 'set-remove' ? (
                    <Tooltip title="Saved version removed this row">
                      <MinusCircleFilled style={{ color: token.colorError, fontSize: 12, marginRight: 4 }} />
                    </Tooltip>
                  ) : kind === 'set-reorder' ? (
                    <Tooltip title="Saved version has a different row order">
                      <SwapOutlined style={{ color: token.colorWarning, fontSize: 12, marginRight: 4 }} />
                    </Tooltip>
                  ) : kind === 'union-swap' ? (
                    <Tooltip title="Saved version uses a different type — accepting replaces the whole branch">
                      <SwapOutlined style={{ color: token.colorWarning, fontSize: 12, marginRight: 4 }} />
                    </Tooltip>
                  ) : null;
                const rowBg = isStale ? token.colorWarningBg : isResolved ? token.colorSuccessBg : 'transparent';
                return (
                  <tr
                    key={path}
                    style={{
                      borderTop: `1px solid ${token.colorBorderSecondary}`,
                      background: rowBg,
                      transition: 'background 120ms ease',
                    }}
                  >
                    <td style={{ padding: '6px 8px' }}>
                      <Tooltip title={label} mouseEnterDelay={0.4}>
                        <div style={{ display: 'flex', alignItems: 'center', ...ELLIPSIS }}>
                          {kindIcon}
                          <span style={ELLIPSIS}>{label}</span>
                        </div>
                      </Tooltip>
                      {isStale && (
                        <div
                          style={{
                            marginTop: 2,
                            color: token.colorWarningText,
                            fontSize: 10,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <WarningFilled />
                          Saved value changed — please re-confirm
                        </div>
                      )}
                    </td>
                    <td
                      style={valueCellStyle(choice === 'theirs', choice === 'mine', isResolved)}
                      title={theirsDisplay}
                    >
                      <div style={ELLIPSIS}>{theirsDisplay || <Text type="secondary">(empty)</Text>}</div>
                      {showRowSource && c.remote && (
                        <div style={{ marginTop: 2, textDecoration: 'none' }}>
                          <SurfaceChip
                            kind={c.remote.surfaceKind}
                            label={c.remote.surfaceLabel}
                            agoMs={c.remote.agoMs}
                            size="small"
                          />
                        </div>
                      )}
                    </td>
                    <td style={valueCellStyle(choice === 'mine', choice === 'theirs', isResolved)} title={mineDisplay}>
                      {mineDisplay || <Text type="secondary">(empty)</Text>}
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                        <Radio.Group
                          size="small"
                          value={choice}
                          onChange={(e) => setOne(path, e.target.value as ConflictResolution)}
                          style={{ display: 'inline-flex', flexWrap: 'nowrap' }}
                        >
                          <Radio.Button value="theirs">{useSavedLabel}</Radio.Button>
                          <Radio.Button value="mine">{keepMineLabel}</Radio.Button>
                        </Radio.Group>
                        {isResolved && !isStale && (
                          <Tooltip title="Resolved">
                            <CheckCircleFilled style={{ color: token.colorSuccess, fontSize: 14, flexShrink: 0 }} />
                          </Tooltip>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            border: `1px solid ${token.colorBorderSecondary}`,
            borderRadius: 4,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'flex',
              borderBottom: `1px solid ${token.colorBorderSecondary}`,
              background: token.colorFillQuaternary,
              fontSize: 12,
            }}
          >
            <div
              style={{
                flex: '1 1 50%',
                minWidth: 0,
                padding: '6px 10px',
                borderRight: `1px solid ${token.colorBorderSecondary}`,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <CloudDownloadOutlined style={{ color: token.colorTextSecondary }} />
              <Text strong>Saved version</Text>
            </div>
            <div
              style={{
                flex: '1 1 50%',
                minWidth: 0,
                padding: '6px 10px',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <EditOutlined style={{ color: token.colorTextSecondary }} />
              <Text strong>Your edits</Text>
              <Text type="secondary" style={{ fontSize: 11 }}>
                · with pending picks applied
              </Text>
            </div>
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <RichDiffEditor
              original={decoratedSaved}
              modified={decoratedLocal}
              language={language}
              options={diffOptions}
              onOptionsChange={setDiffOptions}
            />
          </div>
        </div>
      </div>
      {previewEnabled && previewOpen ? (
        <MergeConflictModal
          open
          isDarkMode={isDarkMode}
          surfaceId="entity-conflict"
          onClose={() => setPreviewOpen(false)}
          session={buildEntityMergeSession({
            fileId: 'preview',
            label: 'Preview',
            title: 'New merge editor — preview (does not commit)',
            language,
            theirsText: savedText,
            mineText: localText,
            baseText,
            initialResult: localText,
            // Phase 6 commit seam. When the caller wired
            // `onResolveText`, Complete Merge parses + adopts +
            // closes both modals on success. Otherwise stays
            // no-commit so operators can still preview.
            onApply: onResolveText
              ? async (resultText: string) => {
                  await onResolveText(resultText);
                  setPreviewOpen(false);
                  onClose();
                }
              : () => undefined,
            onCancel: () => setPreviewOpen(false),
          })}
        />
      ) : null}
    </Modal>
  );
};

export default EntityConflictDialog;
