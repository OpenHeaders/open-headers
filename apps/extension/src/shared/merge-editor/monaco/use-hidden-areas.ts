/**
 * Auto-collapse unchanged regions in a Monaco editor via
 * `editor.setHiddenAreas(...)`, with clickable "N lines hidden —
 * click to expand" markers at each gap (the user-facing affordance
 * mainstream diff viewers all surface for the same
 * primitive).
 *
 * `setHiddenAreas` isn't part of Monaco's stable public type surface
 * but it ships on `IStandaloneCodeEditor` instances; we treat it as
 * a stable API and degrade-to-noop if a future build removes it.
 *
 * The hook maintains a small internal state — a set of gap keys the
 * user has expanded — so individual gaps can be opened without
 * disabling Compact view wholesale. The state is keyed by
 * `${start}-${end}` line range so it survives normal re-renders;
 * the user re-clicks if line numbers shift far enough that the key
 * no longer matches (rare for typical merge sessions).
 */

import type * as monaco from 'monaco-editor';
import { type RefObject, useEffect, useRef, useState } from 'react';
import type { LineRange } from '../diff/line-diff';
import type { MonacoEditorHandle } from './use-monaco-editor-lifecycle';
import './hidden-areas.css';

export interface UseHiddenAreasArgs {
  editorRef: RefObject<MonacoEditorHandle>;
  /** Hunk ranges to keep visible on this pane, in pane-local line
   *  coordinates. `endLine` follows our LineRange convention
   *  (exclusive); zero-extent ranges are treated as a single anchor
   *  line + context on either side. */
  visibleRanges: readonly LineRange[];
  /** Parallel array: the structural indent of each hunk's content
   *  (smallest indent across its non-empty theirs / mine lines).
   *  Drives ancestor lookup so insertion-point hunks (whose anchor
   *  is the line BELOW the conflict, often at a sibling indent) find
   *  the correct logical parent. Without this, walking up from the
   *  anchor's indent misses parents that share the anchor's level.
   *  Example: an X-C row added inside `requestHeaders:` anchors at
   *  the `responseHeaders:` line below — both at indent 2, siblings.
   *  Content indent (4) reveals `requestHeaders:` at indent 2 as the
   *  real parent. Length must match `visibleRanges`; entries with
   *  `undefined` fall back to the anchor line's own indent. */
  contentIndents?: ReadonlyArray<number | undefined>;
  /** Number of unchanged context lines kept above + below each hunk. */
  context: number;
  /** When false, the hook clears any previously-set hidden areas
   *  (full file becomes visible again). */
  enabled: boolean;
}

interface EditorWithHiddenAreas extends monaco.editor.ICodeEditor {
  setHiddenAreas?(ranges: monaco.IRange[], source?: unknown): void;
}

interface GapInfo {
  range: monaco.IRange;
  key: string;
  lineCount: number;
}

/** Lines revealed per click on the directional expand buttons.
 *  Matches the GitLab convention (20-line chunks); 10 felt too small
 *  for typical YAML headers, 20 covers a full header rule with room
 *  to spare. */
const STEP_LINES = 20;

interface GapExpansion {
  /** Lines peeled off the TOP of the gap (i.e. revealed immediately
   *  below the previous hunk). Accumulated by clicks on the
   *  expand-down (↓) button. */
  top: number;
  /** Lines peeled off the BOTTOM of the gap (revealed immediately
   *  above the next hunk). Accumulated by clicks on the expand-up
   *  (↑) button. */
  bottom: number;
}

export function useHiddenAreas({
  editorRef,
  visibleRanges,
  contentIndents,
  context,
  enabled,
}: UseHiddenAreasArgs): void {
  // Per-gap partial-expansion state. The "expand all" button drops
  // the gap from this map (= fully revealed); directional buttons
  // accumulate top / bottom counts. Map key is the gap's
  // `${start}-${end}` line range, same as before.
  const [gapExpansions, setGapExpansions] = useState<ReadonlyMap<string, GapExpansion>>(
    () => new Map(),
  );
  const fullyExpandedRef = useRef<Set<string>>(new Set());
  const zoneIdsRef = useRef<Map<string, string>>(new Map());

  // Reset user expansions only when compact view is toggled OFF.
  // Don't reset on visibleRanges change — for the result pane, the
  // visibleRanges memo busts on every pick-state mutation (via
  // pickStateRev), and resetting there would lose the user's
  // expansion every time they Accept / Ignore a hunk.
  useEffect(() => {
    if (!enabled) {
      setGapExpansions(new Map());
      fullyExpandedRef.current = new Set();
    }
  }, [enabled]);

  useEffect(() => {
    const editor = editorRef.current.editor as EditorWithHiddenAreas | null;
    const model = editorRef.current.model;
    if (!editor || !model) return;

    const zoneIds = zoneIdsRef.current;

    // Always start by clearing any previous markers — we'll re-emit
    // them below based on the current hidden set.
    const clearZones = (): void => {
      if (zoneIds.size === 0) return;
      editor.changeViewZones((accessor) => {
        for (const id of zoneIds.values()) accessor.removeZone(id);
      });
      zoneIds.clear();
    };
    clearZones();

    if (typeof editor.setHiddenAreas !== 'function') return;

    if (!enabled) {
      editor.setHiddenAreas([], 'oh-merge-hidden');
      return;
    }
    if (visibleRanges.length === 0) {
      // No hunks → would hide the whole file. Skip — hiding the
      // entire content surface is hostile.
      editor.setHiddenAreas([], 'oh-merge-hidden');
      return;
    }

    const lineCount = model.getLineCount();

    // Augment each hunk's visible range with its YAML/structural
    // ancestor lines (e.g. the `requestHeaders:` key that owns a
    // header-row conflict, plus `action:` above it). Otherwise a
    // collapsed file with the parent key hidden leaves the user
    // staring at `- uid: hr0000cc` with no idea which list it
    // belongs to — header? query param? mock body? Keeping
    // ancestors visible costs one line per nesting level and
    // restores the "where am I" information.
    const ancestorLines = collectAncestorLines(model, visibleRanges, contentIndents);

    // Expand each visible range by `context` lines on each side,
    // clamping to [1, lineCount]. Zero-extent ranges
    // (insertion-point hunks) center the context window on
    // startLine. Ancestor lines enter as single-line ranges with
    // no context expansion — they're navigational markers, not
    // diff content.
    const expanded = visibleRanges
      .map((r) => {
        const lastVisibleLine = r.endLine > r.startLine ? r.endLine - 1 : r.startLine;
        return {
          start: Math.max(1, r.startLine - context),
          end: Math.min(lineCount, lastVisibleLine + context),
        };
      })
      .concat(ancestorLines.map((line) => ({ start: line, end: line })))
      .sort((a, b) => a.start - b.start);

    // Merge overlapping or adjacent visible windows.
    const merged: Array<{ start: number; end: number }> = [];
    for (const r of expanded) {
      const last = merged[merged.length - 1];
      if (last && r.start <= last.end + 1) {
        last.end = Math.max(last.end, r.end);
      } else {
        merged.push({ ...r });
      }
    }

    // Candidate hidden ranges = complement of merged visible windows
    // within [1, lineCount]. Each carries a stable key
    // (`${start}-${end}`) so user-expanded gaps drop out below.
    const candidates: GapInfo[] = [];
    let cursor = 1;
    for (const r of merged) {
      if (r.start > cursor) {
        candidates.push({
          range: { startLineNumber: cursor, startColumn: 1, endLineNumber: r.start - 1, endColumn: 1 },
          key: `${cursor}-${r.start - 1}`,
          lineCount: r.start - cursor,
        });
      }
      cursor = r.end + 1;
    }
    if (cursor <= lineCount) {
      candidates.push({
        range: { startLineNumber: cursor, startColumn: 1, endLineNumber: lineCount, endColumn: 1 },
        key: `${cursor}-${lineCount}`,
        lineCount: lineCount - cursor + 1,
      });
    }

    // For each candidate gap, apply partial expansion and emit the
    // (possibly shrunken) hidden range. Gaps the user fully expanded
    // via "Expand All" drop out entirely.
    interface AdjustedGap {
      key: string;
      range: monaco.IRange;
      remainingLineCount: number;
      originalLineCount: number;
    }
    const adjusted: AdjustedGap[] = [];
    for (const gap of candidates) {
      if (fullyExpandedRef.current.has(gap.key)) continue;
      const exp = gapExpansions.get(gap.key) ?? { top: 0, bottom: 0 };
      const peeledStart = gap.range.startLineNumber + exp.top;
      const peeledEnd = gap.range.endLineNumber - exp.bottom;
      if (peeledStart > peeledEnd) continue;
      adjusted.push({
        key: gap.key,
        range: {
          startLineNumber: peeledStart,
          startColumn: 1,
          endLineNumber: peeledEnd,
          endColumn: 1,
        },
        remainingLineCount: peeledEnd - peeledStart + 1,
        originalLineCount: gap.lineCount,
      });
    }

    editor.setHiddenAreas(adjusted.map((g) => g.range), 'oh-merge-hidden');

    // Emit a GitLab-style three-button strip at each hidden gap's
    // boundary. Anchor: `afterLineNumber = startLineNumber - 1` =
    // the last visible line just before the (remaining) hidden range
    // (Monaco's hidden-areas state collapses the hidden lines out
    // of the rendered flow, so this anchor renders between the
    // last visible line before the gap and the next visible line
    // after it).
    editor.changeViewZones((accessor) => {
      for (const gap of adjusted) {
        const dom = buildGapDom({
          key: gap.key,
          remainingLineCount: gap.remainingLineCount,
          onExpandDown: (key) => {
            setGapExpansions((prev) => {
              const next = new Map(prev);
              const cur = next.get(key) ?? { top: 0, bottom: 0 };
              next.set(key, { ...cur, top: cur.top + STEP_LINES });
              return next;
            });
          },
          onExpandUp: (key) => {
            setGapExpansions((prev) => {
              const next = new Map(prev);
              const cur = next.get(key) ?? { top: 0, bottom: 0 };
              next.set(key, { ...cur, bottom: cur.bottom + STEP_LINES });
              return next;
            });
          },
          onExpandAll: (key) => {
            fullyExpandedRef.current.add(key);
            // Bump expansions to force a re-render without changing
            // its content — the ref change above is what drives the
            // hide list, but React needs a state nudge to re-run.
            setGapExpansions((prev) => new Map(prev));
          },
        });
        const zoneId = accessor.addZone({
          afterLineNumber: gap.range.startLineNumber - 1,
          heightInLines: 1,
          domNode: dom,
        } satisfies monaco.editor.IViewZone);
        zoneIds.set(gap.key, zoneId);
      }
    });

    return () => {
      clearZones();
      editor.setHiddenAreas?.([], 'oh-merge-hidden');
    };
  }, [editorRef, visibleRanges, contentIndents, context, enabled, gapExpansions]);
}

/**
 * Indentation-based ancestor walker. For each hunk's start line,
 * walks UP collecting lines with STRICTLY LESS indentation (the
 * structural parents in indent-driven formats — YAML keys, JSON
 * nesting, etc.). Stops at indent 0 (top-level).
 *
 * Returns a deduplicated, sorted list of ancestor line numbers
 * across all hunks. Caller uses these as additional visible ranges
 * so collapsed regions never hide the section header that gives
 * the conflict its meaning ("this is inside requestHeaders").
 */
function collectAncestorLines(
  model: monaco.editor.ITextModel,
  ranges: readonly LineRange[],
  contentIndents: ReadonlyArray<number | undefined> | undefined,
): number[] {
  const out = new Set<number>();
  for (let i = 0; i < ranges.length; i++) {
    const r = ranges[i];
    if (r.startLine <= 1) continue;
    // Reference indent: prefer the hunk's content indent (passed by
    // the caller from the diff's theirsLines/mineLines). Falls back
    // to the anchor line's own indent when the caller didn't supply
    // one. The content indent is the right reference for
    // insertion-point hunks where the anchor line is a SIBLING of
    // the conflict's parent, not a child — walking from the
    // anchor's indent would miss the actual list/key that owns the
    // inserted content.
    const supplied = contentIndents?.[i];
    const referenceIndent =
      supplied !== undefined ? supplied : leadingIndent(model.getLineContent(r.startLine));
    if (referenceIndent === 0) continue;
    let currentIndent = referenceIndent;
    for (let line = r.startLine - 1; line >= 1 && currentIndent > 0; line--) {
      const content = model.getLineContent(line);
      if (content.trim() === '') continue;
      const indent = leadingIndent(content);
      if (indent < currentIndent) {
        out.add(line);
        currentIndent = indent;
      }
    }
  }
  return Array.from(out).sort((a, b) => a - b);
}

function leadingIndent(line: string): number {
  let i = 0;
  while (i < line.length && (line[i] === ' ' || line[i] === '\t')) i++;
  return i;
}

function buildGapDom(lineCount: number, key: string, onExpand: (key: string) => void): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'oh-merge__action-zone-wrapper';
  const root = document.createElement('div');
  root.className = 'oh-merge__hidden-gap';
  root.title = 'Click to expand this region';
  // Eat mousedown so Monaco's editor-level mouse handler doesn't
  // intercept it for caret positioning before the click fires.
  const eatMouseDown = (e: Event): void => {
    e.stopPropagation();
  };
  root.addEventListener('mousedown', eatMouseDown);
  root.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    onExpand(key);
  });
  const label = document.createElement('span');
  label.className = 'oh-merge__hidden-gap-label';
  const word = lineCount === 1 ? 'line' : 'lines';
  label.textContent = `↕ ${lineCount} ${word} hidden — click to expand`;
  root.appendChild(label);
  wrapper.appendChild(root);
  return wrapper;
}
