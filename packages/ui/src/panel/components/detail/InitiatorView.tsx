import { hostNavigation } from '@openheaders/core/navigation';
import type { InspectorHarEntry } from '@openheaders/core/types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type CallFrameLike,
  type CopyStackInput,
  computeCallFrameMeta,
  computeFrameLocation,
  formatCallStackForCopy,
} from '../../data/call-frame-meta';
import { frameKey, useResolvedFrames, type ResolvedFramePosition } from '../../data/use-resolved-frames';
import { computeUpstreamChain } from '../../data/upstream-chain';
import { computeCascadeInsights, type CascadeInsight } from '../../data/cascade-insights';
import { computeCascadeSummary, type CascadeSummary, type SubtreeStats } from '../../data/cascade-summary';
import { matchesCascadeQuery, parseCascadeQuery } from '../../data/cascade-filter';
import { computeInitiatorRowMeta, type InitiatorRowMeta } from '../../data/initiator-row-meta';
import type { InspectorRequest } from '../../data/types';
import ResourceIcon from '../traffic/ResourceIcon';
import { HighlightedText } from './HighlightedText';

interface CallFrame {
  functionName?: string;
  url?: string;
  lineNumber?: number;
  columnNumber?: number;
  scriptId?: string;
}

interface StackTrace {
  callFrames?: CallFrame[];
  parent?: StackTrace;
  description?: string;
}

interface Initiator {
  type?: string;
  url?: string;
  lineNumber?: number;
  stack?: StackTrace;
}

type SortMode = 'initiator' | 'chronological' | 'largest';

function extractFilename(url: string): string {
  try {
    const path = new URL(url).pathname;
    const segments = path.split('/');
    return segments[segments.length - 1] || path;
  } catch {
    return url;
  }
}

function shortUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname + (u.pathname.length > 1 ? u.pathname : '');
  } catch {
    return url;
  }
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(2)} MB`;
}

function formatMs(ms: number): string {
  if (ms < 1) return `${ms.toFixed(0)} ms`;
  if (ms < 1000) return `${ms.toFixed(0)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

// ── Upstream call-stack ──────────────────────────────────────────────

function basenameOfSource(source: string): string {
  // Webpack-style sources look like `webpack:///./src/runtime/load_script.js`.
  // Strip the protocol + path, keep the trailing filename (no extension stripping —
  // matches Chrome's `load_script:64` rendering when the file is `load_script.js`).
  const stripped = source.replace(/^[^:]+:\/+/, '');
  const parts = stripped.split('/');
  const last = parts[parts.length - 1] || stripped;
  // Drop trailing `.js`/`.ts`/etc so the file column reads cleaner.
  return last.replace(/\.[a-z]+$/i, '');
}

function FrameRow({
  frame,
  pageOrigin,
  resolved,
}: {
  frame: CallFrame;
  pageOrigin: string | null;
  resolved?: ResolvedFramePosition;
}) {
  const meta = computeCallFrameMeta(frame, pageOrigin);
  const loc = computeFrameLocation(frame);

  // Display-name policy (matches Chrome's panel):
  //
  //   - When source-map resolution gave us a source file at this
  //     position, show `(anonymous)`. The V8 name describes the
  //     *generated* code (post-minify, post-bundle); pairing it with
  //     the resolved *original* file mixes two different worlds and
  //     reads as a contradiction (`b.l (requestAnimationFrame) @
  //     lazy-define:53` — three identifiers for the same callable).
  //   - When source-map resolution failed, fall back to the V8 name
  //     (already de-property-accessed by `computeCallFrameMeta` — see
  //     the `(anonymous)` treatment for `b.l`-style names).
  const hasResolvedFile = resolved?.source != null;
  const displayName = hasResolvedFile ? '(anonymous)' : meta.displayName;
  const treatAsAnonymous = displayName === '(anonymous)';
  const treatAsMinified = !treatAsAnonymous && meta.isMinifiedName;
  const nameClass = [
    'dt-initiator-fn',
    treatAsAnonymous ? 'dt-initiator-fn--anonymous' : null,
    treatAsMinified ? 'dt-initiator-fn--minified' : null,
    !meta.isThirdParty && pageOrigin != null ? 'dt-initiator-fn--first-party' : null,
    meta.isThirdParty ? 'dt-initiator-fn--third-party' : null,
  ]
    .filter(Boolean)
    .join(' ');

  // Right column: prefer resolved file:line when we have one (Chrome's
  // approach), else fall back to the generated URL filename:line[:col].
  // We intentionally drop the column on resolved positions — original
  // sources have meaningful line numbers, and the column adds visual
  // clutter without helping the user. For the unresolved fallback we
  // keep the column because minified single-line bundles are all
  // line=1 so the column is the only differentiator.
  const resolvedFile = hasResolvedFile && resolved?.source ? basenameOfSource(resolved.source) : null;
  const resolvedLineSuffix = resolved?.line != null ? `:${resolved.line + 1}` : '';
  const displayFile = resolvedFile ?? loc.filename;
  const displayLineSuffix = resolvedFile ? resolvedLineSuffix : loc.lineSuffix;

  const openable = !!frame.url;
  const handleOpen = useCallback(() => {
    if (!openable) return;
    hostNavigation.openResource(frame.url ?? '', frame.lineNumber, frame.columnNumber);
  }, [openable, frame.url, frame.lineNumber, frame.columnNumber]);

  return (
    <div className="dt-initiator-frame" data-noise={meta.isLikelyNoise ? 'true' : 'false'}>
      <span
        className={nameClass}
        title={resolved?.name ? `Source-map name: ${resolved.name}` : undefined}
      >
        {displayName}
      </span>
      {displayFile && (
        openable ? (
          <button
            type="button"
            className="dt-initiator-loc dt-initiator-loc--link"
            title={hasResolvedFile ? `${frame.url} (original: ${resolved?.source ?? ''})` : frame.url}
            onClick={handleOpen}
          >
            <span className="dt-initiator-loc-file">{displayFile}</span>
            <span className="dt-initiator-loc-line">{displayLineSuffix}</span>
          </button>
        ) : (
          <span className="dt-initiator-loc" title={frame.url}>
            <span className="dt-initiator-loc-file">{displayFile}</span>
            <span className="dt-initiator-loc-line">{displayLineSuffix}</span>
          </span>
        )
      )}
    </div>
  );
}

/** Flattens an async-stack chain into a `[{ description, callFrames }]`
 *  array — the top-most stack's description (if any) is preserved and
 *  successive `.parent` stacks become their own sections. */
function flattenStack(stack: StackTrace): CopyStackInput[] {
  const out: CopyStackInput[] = [];
  let cur: StackTrace | undefined = stack;
  let isFirst = true;
  while (cur) {
    out.push({
      description: isFirst ? undefined : cur.description ?? 'Async call',
      callFrames: cur.callFrames ?? [],
    });
    cur = cur.parent;
    isFirst = false;
  }
  return out;
}

function frameMatchesQuery(frame: CallFrameLike, displayName: string, needle: string): boolean {
  if (!needle) return true;
  const n = needle.toLowerCase();
  if (displayName.toLowerCase().includes(n)) return true;
  if (frame.url && frame.url.toLowerCase().includes(n)) return true;
  return false;
}

function CallStack({ stack, pageOrigin }: { stack: StackTrace; pageOrigin: string | null }) {
  const sections = useMemo(() => flattenStack(stack), [stack]);
  const allFrames = useMemo(() => {
    const out: CallFrameLike[] = [];
    for (const s of sections) for (const f of s.callFrames ?? []) out.push(f as CallFrameLike);
    return out;
  }, [sections]);
  const resolvedNames = useResolvedFrames(allFrames);
  const totalFrames = useMemo(
    () => sections.reduce((n, s) => n + (s.callFrames?.length ?? 0), 0),
    [sections],
  );
  const resolvedCount = useMemo(() => resolvedNames.size, [resolvedNames]);
  const [filter, setFilter] = useState('');
  const [hideNoise, setHideNoise] = useState(false);
  const [copied, setCopied] = useState(false);
  const needle = filter.trim();

  // Count frames that would ACTUALLY be hidden by the noise toggle —
  // a frame the source map resolved is no longer "noise" because we
  // now know its source line, so excluding it from the hidden-count
  // matches the filter predicate used during rendering.
  const noiseCount = useMemo(() => {
    let n = 0;
    for (const s of sections) {
      for (const f of s.callFrames ?? []) {
        const m = computeCallFrameMeta(f as CallFrameLike, pageOrigin);
        if (!m.isLikelyNoise) continue;
        if (resolvedNames.get(frameKey(f as CallFrameLike))) continue;
        n++;
      }
    }
    return n;
  }, [sections, pageOrigin, resolvedNames]);

  const handleCopy = useCallback(() => {
    const text = formatCallStackForCopy(sections);
    void navigator.clipboard
      ?.writeText(text)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  }, [sections]);

  if (totalFrames === 0) return null;

  return (
    <details className="dt-section" open>
      <summary>
        <span className="dt-initiator-stack-heading">
          Request call stack
          <span className="dt-initiator-stack-count">· {totalFrames} frame{totalFrames === 1 ? '' : 's'}</span>
          {resolvedCount > 0 && (
            <span
              className="dt-initiator-stack-count dt-initiator-stack-count--resolved"
              title="Function names resolved via source maps"
            >
              · {resolvedCount} resolved
            </span>
          )}
        </span>
        <span className="dt-initiator-stack-actions">
          {noiseCount > 0 && (
            <button
              type="button"
              className="dt-initiator-stack-toggle"
              data-active={hideNoise}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setHideNoise((v) => !v);
              }}
              title="Hide anonymous frames inside minified bundles"
            >
              {hideNoise ? `Show ${noiseCount} hidden` : `Hide ${noiseCount} noisy`}
            </button>
          )}
          <button
            type="button"
            className="dt-initiator-stack-toggle"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleCopy();
            }}
            title="Copy stack as text"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </span>
      </summary>
      <div className="dt-initiator-stack-filter">
        <input
          type="search"
          placeholder="Filter frames (function name or URL)…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="dt-initiator-stack-filter-input"
          aria-label="Filter call-stack frames"
        />
      </div>
      {(() => {
        let totalVisible = 0;
        let totalHidden = 0;
        const rendered = sections.map((section, sectionIdx) => {
          const frames = section.callFrames ?? [];
          const sectionFrames = frames.map((f) => ({
            frame: f,
            meta: computeCallFrameMeta(f as CallFrameLike, pageOrigin),
          }));
          const visible = sectionFrames.filter(({ frame, meta }) => {
            const resolved = resolvedNames.get(frameKey(frame as CallFrameLike));
            // A frame resolved by source map is by definition not "noise":
            // we now know its real name.
            const noisy = meta.isLikelyNoise && !resolved;
            if (hideNoise && noisy) return false;
            const nameForQuery = resolved?.name ?? meta.displayName;
            if (needle && !frameMatchesQuery(frame as CallFrameLike, nameForQuery, needle)) return false;
            return true;
          });
          totalVisible += visible.length;
          totalHidden += frames.length - visible.length;
          if (visible.length === 0 && frames.length > 0) return null;
          return (
            <div key={`section-${sectionIdx}`} className="dt-initiator-stack-section">
              {section.description && (
                <div className="dt-initiator-stack-async-label">{section.description}</div>
              )}
              <div className="dt-initiator-stack">
                {visible.map(({ frame }, i) => (
                  <FrameRow
                    key={`${frame.url}-${frame.lineNumber}-${i}`}
                    frame={frame}
                    pageOrigin={pageOrigin}
                    resolved={resolvedNames.get(frameKey(frame as CallFrameLike))}
                  />
                ))}
              </div>
            </div>
          );
        });
        return (
          <>
            {rendered}
            {(needle || hideNoise) && (
              <div className="dt-initiator-stack-status">
                {totalVisible === 0 ? (
                  <span className="dt-col-muted">No frames match.</span>
                ) : (
                  <span className="dt-col-muted">
                    Showing {totalVisible} of {totalFrames} frame{totalFrames === 1 ? '' : 's'}
                    {totalHidden > 0 ? ` (${totalHidden} hidden)` : ''}
                  </span>
                )}
              </div>
            )}
          </>
        );
      })()}
    </details>
  );
}

// ── Downstream initiator tree ────────────────────────────────────────

interface FlatRow {
  key: string;
  url: string;
  request: InspectorRequest;
  meta: InitiatorRowMeta;
  subtree: SubtreeStats | null;
  depth: number;
  hasChildren: boolean;
  expanded: boolean;
  parentKey: string | null;
  isAnchor: boolean;
  matches: boolean;
}

interface TreeNode {
  key: string;
  request: InspectorRequest;
  children: TreeNode[];
  matches: boolean;
  hasMatchInSubtree: boolean;
  parentKey: string | null;
  depth: number;
}

function sortChildren(
  children: readonly InspectorRequest[],
  mode: SortMode,
  subtreeStats: ReadonlyMap<string, SubtreeStats>,
): readonly InspectorRequest[] {
  if (mode === 'initiator') return children;
  const arr = children.slice();
  if (mode === 'chronological') {
    arr.sort((a, b) => a.timestamp - b.timestamp);
    return arr;
  }
  // largest: own size + subtree size, descending
  arr.sort((a, b) => {
    const aw = (subtreeStats.get(a.id)?.bytes ?? 0) + (a.harEntry.response?.bodySize ?? 0);
    const bw = (subtreeStats.get(b.id)?.bytes ?? 0) + (b.harEntry.response?.bodySize ?? 0);
    return bw - aw;
  });
  return arr;
}

function buildTree(
  root: InspectorRequest,
  getChildren: (url: string) => readonly InspectorRequest[],
  pageOrigin: string | null,
  query: ReturnType<typeof parseCascadeQuery>,
  sortMode: SortMode,
  subtreeStats: ReadonlyMap<string, SubtreeStats>,
): TreeNode {
  const useQuery = query.length > 0;
  function build(req: InspectorRequest, parentKey: string | null, depth: number, seen: ReadonlySet<string>): TreeNode {
    const key = parentKey === null ? req.id : `${parentKey}/${req.id}`;
    const meta = computeInitiatorRowMeta(req, pageOrigin);
    const matches = useQuery ? matchesCascadeQuery(req.url, meta, query) : false;
    let children: TreeNode[] = [];
    if (!seen.has(req.url)) {
      const nextSeen = new Set(seen);
      nextSeen.add(req.url);
      const sorted = sortChildren(getChildren(req.url), sortMode, subtreeStats);
      children = sorted.map((c) => build(c, key, depth + 1, nextSeen));
    }
    const hasMatchInSubtree = matches || children.some((c) => c.hasMatchInSubtree);
    return { key, request: req, children, matches, hasMatchInSubtree, parentKey, depth };
  }
  return build(root, null, 0, new Set());
}

function flattenTree(
  tree: TreeNode,
  expanded: ReadonlyMap<string, boolean>,
  filtering: boolean,
  pageOrigin: string | null,
  subtreeStats: ReadonlyMap<string, SubtreeStats>,
): FlatRow[] {
  const out: FlatRow[] = [];
  function walk(node: TreeNode) {
    if (filtering && !node.hasMatchInSubtree) return;
    const visibleChildren = filtering ? node.children.filter((c) => c.hasMatchInSubtree) : node.children;
    const hasChildren = visibleChildren.length > 0;
    const isExpanded = filtering ? true : (expanded.get(node.key) ?? true);
    out.push({
      key: node.key,
      url: node.request.url,
      request: node.request,
      meta: computeInitiatorRowMeta(node.request, pageOrigin),
      subtree: subtreeStats.get(node.request.id) ?? null,
      depth: node.depth,
      hasChildren,
      expanded: isExpanded,
      parentKey: node.parentKey,
      isAnchor: node.parentKey === null,
      matches: node.matches,
    });
    if (hasChildren && isExpanded) {
      for (const c of visibleChildren) walk(c);
    }
  }
  walk(tree);
  return out;
}

// ── Chips ────────────────────────────────────────────────────────────

function Chip({ tone, title, children }: { tone?: 'default' | 'warn' | 'good' | 'muted'; title?: string; children: React.ReactNode }) {
  return (
    <span className="dt-initiator-row-chip" data-tone={tone ?? 'default'} title={title}>
      {children}
    </span>
  );
}

function RowChips({ meta, subtree }: { meta: InitiatorRowMeta; subtree: SubtreeStats | null }) {
  const chips: React.ReactNode[] = [];
  if (meta.initiatorType) chips.push(<Chip key="init" tone="muted" title="Initiator type">{meta.initiatorType}</Chip>);
  if (meta.isFailed && meta.statusCode != null) {
    chips.push(<Chip key="status" tone="warn" title="HTTP status">{meta.statusCode}</Chip>);
  } else if (meta.statusCode != null && (meta.statusCode >= 400 || meta.statusCode === 0)) {
    chips.push(<Chip key="status" tone="warn" title="HTTP status">{meta.statusCode}</Chip>);
  } else if (meta.isFailed) {
    chips.push(<Chip key="status" tone="warn" title="Request failed">failed</Chip>);
  }
  if (meta.sizeBytes != null && meta.sizeBytes >= 50 * 1024) {
    chips.push(<Chip key="size" title="Transferred">{formatBytes(meta.sizeBytes)}</Chip>);
  }
  if (meta.durationMs != null && meta.durationMs >= 200) {
    chips.push(<Chip key="dur" title="Duration">{formatMs(meta.durationMs)}</Chip>);
  }
  if (meta.isThirdParty) chips.push(<Chip key="3p" tone="muted" title="Third-party origin">3rd-party</Chip>);
  if (subtree && subtree.count > 0) {
    chips.push(
      <Chip key="sub" tone="muted" title="Subtree weight (descendants · bytes)">
        +{subtree.count} req · {formatBytes(subtree.bytes)}
      </Chip>,
    );
  }
  if (chips.length === 0) return null;
  return <span className="dt-initiator-row-chips">{chips}</span>;
}

// ── Summary header ───────────────────────────────────────────────────

function CascadeSummaryHeader({ summary }: { summary: CascadeSummary }) {
  if (summary.requestCount === 0) return null;
  return (
    <div className="dt-initiator-cascade-summary">
      <span className="dt-initiator-cascade-stat">
        <strong>{summary.requestCount}</strong>{' '}
        request{summary.requestCount === 1 ? '' : 's'}
      </span>
      <span className="dt-initiator-cascade-stat">
        <strong>{formatBytes(summary.transferredBytes)}</strong> transferred
      </span>
      <span className="dt-initiator-cascade-stat">
        <strong>{formatMs(summary.cumulativeMs)}</strong> cumulative
      </span>
      {summary.failedCount > 0 && (
        <span className="dt-initiator-cascade-stat" data-tone="warn">
          <strong>{summary.failedCount}</strong> failed
        </span>
      )}
    </div>
  );
}

// ── Insight callouts ────────────────────────────────────────────────

function InsightCallout({ insight }: { insight: CascadeInsight }) {
  const icon = insight.kind === 'failure' ? '⚠' : '⚡';
  return (
    <div className="dt-initiator-insight" data-kind={insight.kind}>
      <span className="dt-initiator-insight-icon" aria-hidden="true">{icon}</span>
      <div className="dt-initiator-insight-body">
        <div className="dt-initiator-insight-headline">{insight.headline}</div>
        {insight.hint && <div className="dt-initiator-insight-hint">{insight.hint}</div>}
      </div>
    </div>
  );
}

// ── Tree component ───────────────────────────────────────────────────

function InitiatorTreeView({
  request,
  getChildren,
  pageOrigin,
  onOpenRequest,
}: {
  request: InspectorRequest;
  getChildren: (url: string) => readonly InspectorRequest[];
  pageOrigin: string | null;
  onOpenRequest?: (entryId: string) => void;
}) {
  const [filter, setFilter] = useState('');
  const [failuresOnly, setFailuresOnly] = useState(false);
  const [thirdPartyOnly, setThirdPartyOnly] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('initiator');
  const [expanded, setExpanded] = useState<ReadonlyMap<string, boolean>>(() => new Map());
  const [focusedKey, setFocusedKey] = useState<string>(request.id);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const lastFocusedRef = useRef<string>(focusedKey);

  const summary = useMemo(
    () => computeCascadeSummary(request, getChildren, pageOrigin),
    [request, getChildren, pageOrigin],
  );
  const insights = useMemo(() => computeCascadeInsights(summary), [summary]);

  // Build the effective query — free-text + toggles compile to one token list.
  const compiledQuery = useMemo(() => {
    const parts: string[] = [];
    if (filter.trim()) parts.push(filter.trim());
    if (failuresOnly) parts.push('is:failed');
    if (thirdPartyOnly) parts.push('is:third-party');
    return parseCascadeQuery(parts.join(' '));
  }, [filter, failuresOnly, thirdPartyOnly]);

  const tree = useMemo(
    () => buildTree(request, getChildren, pageOrigin, compiledQuery, sortMode, summary.subtreeStats),
    [request, getChildren, pageOrigin, compiledQuery, sortMode, summary.subtreeStats],
  );
  const filtering = compiledQuery.length > 0;
  const rows = useMemo(
    () => flattenTree(tree, expanded, filtering, pageOrigin, summary.subtreeStats),
    [tree, expanded, filtering, pageOrigin, summary.subtreeStats],
  );

  useEffect(() => {
    if (rows.length === 0) return;
    if (!rows.some((r) => r.key === focusedKey)) setFocusedKey(rows[0].key);
  }, [rows, focusedKey]);

  useEffect(() => {
    if (lastFocusedRef.current === focusedKey) return;
    lastFocusedRef.current = focusedKey;
    const el = rowRefs.current.get(focusedKey);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [focusedKey]);

  const setExpandedFor = useCallback((key: string, val: boolean) => {
    setExpanded((prev) => {
      const next = new Map(prev);
      next.set(key, val);
      return next;
    });
  }, []);

  const focusedIdx = rows.findIndex((r) => r.key === focusedKey);
  const focusedRow = focusedIdx >= 0 ? rows[focusedIdx] : null;

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!focusedRow) return;
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          if (focusedIdx < rows.length - 1) setFocusedKey(rows[focusedIdx + 1].key);
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (focusedIdx > 0) setFocusedKey(rows[focusedIdx - 1].key);
          break;
        case 'ArrowRight':
          if (focusedRow.hasChildren && !focusedRow.expanded) {
            e.preventDefault();
            setExpandedFor(focusedRow.key, true);
          }
          break;
        case 'ArrowLeft':
          if (focusedRow.hasChildren && focusedRow.expanded) {
            e.preventDefault();
            setExpandedFor(focusedRow.key, false);
          } else if (focusedRow.parentKey) {
            e.preventDefault();
            setFocusedKey(focusedRow.parentKey);
          }
          break;
        case 'Home':
          e.preventDefault();
          if (rows.length) setFocusedKey(rows[0].key);
          break;
        case 'End':
          e.preventDefault();
          if (rows.length) setFocusedKey(rows[rows.length - 1].key);
          break;
        case 'Enter':
          if (onOpenRequest && !focusedRow.isAnchor) {
            e.preventDefault();
            onOpenRequest(focusedRow.request.id);
          } else if (focusedRow.hasChildren) {
            e.preventDefault();
            setExpandedFor(focusedRow.key, !focusedRow.expanded);
          }
          break;
        case ' ':
          if (focusedRow.hasChildren) {
            e.preventDefault();
            setExpandedFor(focusedRow.key, !focusedRow.expanded);
          }
          break;
      }
    },
    [focusedIdx, focusedRow, rows, setExpandedFor, onOpenRequest],
  );

  return (
    <details className="dt-section" open>
      <summary>Request initiator chain</summary>
      <CascadeSummaryHeader summary={summary} />
      {insights.map((ins, i) => (
        <InsightCallout key={`${ins.kind}-${i}`} insight={ins} />
      ))}
      <div className="dt-initiator-chain-filter">
        <input
          type="search"
          placeholder="Filter — text, is:failed, is:third-party, type:js, status:404, size:>50kb"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="dt-initiator-chain-filter-input"
          aria-label="Filter initiator chain"
        />
        <div className="dt-initiator-quick-toggles" role="group" aria-label="Quick filters">
          <button
            type="button"
            className="dt-initiator-quick-toggle"
            data-active={failuresOnly}
            onClick={() => setFailuresOnly((v) => !v)}
            aria-pressed={failuresOnly}
            title="Show only failed / blocked rows"
          >
            Failures
          </button>
          <button
            type="button"
            className="dt-initiator-quick-toggle"
            data-active={thirdPartyOnly}
            onClick={() => setThirdPartyOnly((v) => !v)}
            aria-pressed={thirdPartyOnly}
            title="Show only rows from a different origin than the page"
          >
            3rd-party
          </button>
        </div>
        <label className="dt-initiator-sort-select" title="Sort children by">
          <span className="dt-initiator-sort-label">Sort</span>
          <select value={sortMode} onChange={(e) => setSortMode(e.target.value as SortMode)}>
            <option value="initiator">Initiator order</option>
            <option value="chronological">Chronological</option>
            <option value="largest">Largest subtree</option>
          </select>
        </label>
        {filtering && (
          <span className="dt-initiator-chain-filter-count">
            {rows.filter((r) => r.matches).length} match{rows.filter((r) => r.matches).length === 1 ? '' : 'es'}
          </span>
        )}
      </div>
      {/* biome-ignore lint/a11y/useSemanticElements: tree role is intentional */}
      <div role="tree" aria-label="Request initiator chain" className="dt-initiator-chain" onKeyDown={onKeyDown}>
        {rows.map((row) => {
          const isFocused = row.key === focusedKey;
          const urlClass = [
            'dt-initiator-chain-url',
            row.isAnchor ? 'dt-initiator-chain-url--anchor' : null,
            row.meta.isFailed ? 'dt-initiator-chain-url--failed' : null,
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <div
              key={row.key}
              ref={(el) => {
                if (el) rowRefs.current.set(row.key, el);
                else rowRefs.current.delete(row.key);
              }}
              role="treeitem"
              tabIndex={isFocused ? 0 : -1}
              aria-level={row.depth + 1}
              aria-expanded={row.hasChildren ? row.expanded : undefined}
              aria-selected={isFocused}
              className={`dt-initiator-chain-row${isFocused ? ' dt-initiator-chain-row--focused' : ''}`}
              style={{ paddingLeft: 4 + row.depth * 16 }}
              onClick={() => {
                setFocusedKey(row.key);
                if (onOpenRequest && !row.isAnchor) onOpenRequest(row.request.id);
              }}
              onFocus={() => setFocusedKey(row.key)}
            >
              {row.hasChildren ? (
                <button
                  type="button"
                  tabIndex={-1}
                  className="dt-initiator-chain-toggle"
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedFor(row.key, !row.expanded);
                  }}
                  aria-label={row.expanded ? 'Collapse' : 'Expand'}
                >
                  {row.expanded ? '▼' : '▶'}
                </button>
              ) : (
                <span className="dt-initiator-chain-toggle dt-initiator-chain-toggle--leaf" aria-hidden="true" />
              )}
              {!row.isAnchor && row.request.resourceType && (
                <span className="dt-initiator-row-icon" aria-hidden="true">
                  <ResourceIcon type={row.request.resourceType} />
                </span>
              )}
              <span className={urlClass} title={row.url}>
                <HighlightedText text={shortUrl(row.url)} query={filter.trim() ? filter.trim() : undefined} />
              </span>
              <RowChips meta={row.meta} subtree={row.subtree} />
            </div>
          );
        })}
      </div>
    </details>
  );
}

// ── Container ────────────────────────────────────────────────────────

interface InitiatorViewProps {
  request: InspectorRequest;
  getInitiatorChildren: (url: string) => readonly InspectorRequest[];
  getRequestByUrl: (url: string) => InspectorRequest | null;
  pageOrigin: string | null;
  onOpenRequest?: (entryId: string) => void;
}

function UpstreamChain({
  request,
  getRequestByUrl,
  pageOrigin,
  onOpenRequest,
}: {
  request: InspectorRequest;
  getRequestByUrl: (url: string) => InspectorRequest | null;
  pageOrigin: string | null;
  onOpenRequest?: (entryId: string) => void;
}) {
  const chain = useMemo(() => computeUpstreamChain(request, getRequestByUrl), [request, getRequestByUrl]);
  if (chain.length <= 1) return null; // No ancestors — nothing to show.
  return (
    <details className="dt-section" open>
      <summary>Request initiator chain</summary>
      <div className="dt-initiator-chain">
        {chain.map((entry, i) => {
          const isCurrent = entry.request?.id === request.id;
          const openable = !!onOpenRequest && !!entry.request && !isCurrent;
          const meta = entry.request ? computeInitiatorRowMeta(entry.request, pageOrigin) : null;
          const urlClass = [
            'dt-initiator-chain-url',
            isCurrent ? 'dt-initiator-chain-url--anchor' : null,
            meta?.isFailed ? 'dt-initiator-chain-url--failed' : null,
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <div
              key={`${entry.url}-${i}`}
              className={`dt-initiator-chain-row${isCurrent ? ' dt-initiator-chain-row--focused' : ''}`}
              style={{ paddingLeft: 4 + i * 16, cursor: openable ? 'pointer' : 'default' }}
              onClick={() => {
                if (openable) onOpenRequest?.(entry.request!.id);
              }}
            >
              <span className="dt-initiator-chain-toggle dt-initiator-chain-toggle--leaf" aria-hidden="true" />
              {entry.request?.resourceType ? (
                <span className="dt-initiator-row-icon" aria-hidden="true">
                  <ResourceIcon type={entry.request.resourceType} />
                </span>
              ) : null}
              <span className={urlClass} title={entry.url}>
                {entry.url}
              </span>
              {meta && <RowChips meta={meta} subtree={null} />}
            </div>
          );
        })}
      </div>
    </details>
  );
}

export default function InitiatorView({
  request,
  getInitiatorChildren,
  getRequestByUrl,
  pageOrigin,
  onOpenRequest,
}: InitiatorViewProps) {
  const har: InspectorHarEntry = request.harEntry;
  const raw = har._initiator as Initiator | undefined;
  const hasChildren = getInitiatorChildren(request.url).length > 0;

  if (!raw && !hasChildren) {
    return (
      <span className="dt-col-muted" style={{ padding: 12 }}>
        No initiator data available.
      </span>
    );
  }

  return (
    <div className="dt-initiator-view">
      {raw?.stack && <CallStack stack={raw.stack} pageOrigin={pageOrigin} />}

      <UpstreamChain
        request={request}
        getRequestByUrl={getRequestByUrl}
        pageOrigin={pageOrigin}
        onOpenRequest={onOpenRequest}
      />

      {hasChildren && (
        <InitiatorTreeView
          request={request}
          getChildren={getInitiatorChildren}
          pageOrigin={pageOrigin}
          onOpenRequest={onOpenRequest}
        />
      )}

      {raw && !raw.stack && raw.url && (
        <details className="dt-section" open>
          <summary>Initiator</summary>
          <div className="dt-initiator-frame">
            <span className="dt-initiator-fn">{raw.type ?? 'other'}</span>
            <span className="dt-initiator-loc" title={raw.url}>
              @ {extractFilename(raw.url)}
              {raw.lineNumber != null ? `:${raw.lineNumber + 1}` : ''}
            </span>
          </div>
        </details>
      )}

      {raw && !raw.stack && !raw.url && !hasChildren && (
        <details className="dt-section" open>
          <summary>Initiator</summary>
          <div className="dt-kv">
            <span className="dt-kv-key">Type:</span>
            <span className="dt-kv-val">{raw.type ?? 'unknown'}</span>
          </div>
        </details>
      )}
    </div>
  );
}
