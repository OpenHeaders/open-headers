import type { InspectorHarEntry } from '@openheaders/core/types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { classifyRequestState } from '../../data/request-state';
import type { InspectorRequest } from '../../data/types';
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

function extractFilename(url: string): string {
  try {
    const path = new URL(url).pathname;
    const segments = path.split('/');
    return segments[segments.length - 1] || path;
  } catch {
    return url;
  }
}

// ── Upstream call-stack ──────────────────────────────────────────────

function FrameRow({ frame }: { frame: CallFrame }) {
  const name = frame.functionName || '(anonymous)';
  const file = frame.url ? extractFilename(frame.url) : '';
  const loc = frame.lineNumber != null ? `${file}:${frame.lineNumber + 1}` : file;
  return (
    <div className="dt-initiator-frame">
      <span className="dt-initiator-fn">{name}</span>
      {loc && (
        <span className="dt-initiator-loc" title={frame.url}>
          @ {loc}
        </span>
      )}
    </div>
  );
}

function CallStack({ stack, label }: { stack: StackTrace; label?: string }) {
  const frames = stack.callFrames ?? [];
  if (frames.length === 0 && !stack.parent) return null;
  return (
    <details className="dt-section" open>
      <summary>{label ?? stack.description ?? 'Request call stack'}</summary>
      <div className="dt-initiator-stack">
        {frames.map((frame, i) => (
          <FrameRow key={`${frame.url}-${frame.lineNumber}-${i}`} frame={frame} />
        ))}
      </div>
      {stack.parent && <CallStack stack={stack.parent} label={stack.parent.description ?? 'Async call'} />}
    </details>
  );
}

// ── Downstream initiator tree ────────────────────────────────────────

interface FlatRow {
  key: string;
  url: string;
  request: InspectorRequest;
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

function isFailureState(entry: InspectorRequest): boolean {
  const s = classifyRequestState(entry);
  return s.kind === 'failed' || s.kind === 'blocked';
}

function buildTree(
  root: InspectorRequest,
  getChildren: (url: string) => readonly InspectorRequest[],
  needle: string,
): TreeNode {
  function build(req: InspectorRequest, parentKey: string | null, depth: number, seen: ReadonlySet<string>): TreeNode {
    const key = parentKey === null ? req.id : `${parentKey}/${req.id}`;
    const matches = needle.length > 0 && req.url.toLowerCase().includes(needle);
    let children: TreeNode[] = [];
    if (!seen.has(req.url)) {
      const nextSeen = new Set(seen);
      nextSeen.add(req.url);
      children = getChildren(req.url).map((c) => build(c, key, depth + 1, nextSeen));
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
): FlatRow[] {
  const out: FlatRow[] = [];
  function walk(node: TreeNode) {
    if (filtering && !node.hasMatchInSubtree) return;
    const visibleChildren = filtering ? node.children.filter((c) => c.hasMatchInSubtree) : node.children;
    const hasChildren = visibleChildren.length > 0;
    // Filtering force-expands so the user can see what matched without
    // hunting through collapsed branches; user-toggled state resumes
    // when the filter clears.
    const isExpanded = filtering ? true : (expanded.get(node.key) ?? true);
    out.push({
      key: node.key,
      url: node.request.url,
      request: node.request,
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

function InitiatorTreeView({
  request,
  getChildren,
}: {
  request: InspectorRequest;
  getChildren: (url: string) => readonly InspectorRequest[];
}) {
  const [filter, setFilter] = useState('');
  const [expanded, setExpanded] = useState<ReadonlyMap<string, boolean>>(() => new Map());
  const [focusedKey, setFocusedKey] = useState<string>(request.id);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const lastFocusedRef = useRef<string>(focusedKey);

  const needle = filter.trim().toLowerCase();
  const filtering = needle.length > 0;

  const tree = useMemo(() => buildTree(request, getChildren, needle), [request, getChildren, needle]);
  const rows = useMemo(() => flattenTree(tree, expanded, filtering), [tree, expanded, filtering]);

  // Keep focused row valid as rows change (filter typing, collapse hiding it).
  useEffect(() => {
    if (rows.length === 0) return;
    if (!rows.some((r) => r.key === focusedKey)) {
      setFocusedKey(rows[0].key);
    }
  }, [rows, focusedKey]);

  // Scroll focused row into view only when it actually changes — guards
  // against the first-mount scroll-jacking the section into focus.
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
          // Expand-only — never navigates. If already expanded (or a
          // leaf), the keypress is a no-op so users don't accidentally
          // jump down a tree they've already opened. Use Down to
          // descend.
          if (focusedRow.hasChildren && !focusedRow.expanded) {
            e.preventDefault();
            setExpandedFor(focusedRow.key, true);
          }
          break;
        case 'ArrowLeft':
          // Collapse if expanded; otherwise move focus to the parent so
          // Left repeatedly walks up the tree.
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
        case ' ':
          if (focusedRow.hasChildren) {
            e.preventDefault();
            setExpandedFor(focusedRow.key, !focusedRow.expanded);
          }
          break;
      }
    },
    [focusedIdx, focusedRow, rows, setExpandedFor],
  );

  return (
    <details className="dt-section" open>
      <summary>Request initiator chain</summary>
      <div className="dt-initiator-chain-filter">
        <input
          type="search"
          placeholder="Filter by URL…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="dt-initiator-chain-filter-input"
          aria-label="Filter initiator chain"
        />
        {filtering && (
          <span className="dt-initiator-chain-filter-count">
            {rows.filter((r) => r.matches).length} match{rows.filter((r) => r.matches).length === 1 ? '' : 'es'}
          </span>
        )}
      </div>
      {/* biome-ignore lint/a11y/useSemanticElements: tree role is intentional */}
      <div
        role="tree"
        aria-label="Request initiator chain"
        className="dt-initiator-chain"
        onKeyDown={onKeyDown}
      >
        {rows.map((row) => {
          const failed = isFailureState(row.request);
          const urlClass = [
            'dt-initiator-chain-url',
            row.isAnchor ? 'dt-initiator-chain-url--anchor' : null,
            failed ? 'dt-initiator-chain-url--failed' : null,
          ]
            .filter(Boolean)
            .join(' ');
          const isFocused = row.key === focusedKey;
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
              onClick={() => setFocusedKey(row.key)}
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
              <span className={urlClass} title={row.url}>
                <HighlightedText text={row.url} query={filtering ? filter : undefined} />
              </span>
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
}

export default function InitiatorView({ request, getInitiatorChildren }: InitiatorViewProps) {
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
      {hasChildren && <InitiatorTreeView request={request} getChildren={getInitiatorChildren} />}

      {raw?.stack && <CallStack stack={raw.stack} />}

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
