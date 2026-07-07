import { hostNavigation } from '@openheaders/core/navigation';
import { useCallback, useMemo, useState } from 'react';
import {
  type CallFrameLike,
  type CopyStackInput,
  computeCallFrameMeta,
  computeFrameLocation,
  formatCallStackForCopy,
} from '../../../data/initiator/call-frame-meta';
import {
  frameKey,
  type ResolvedFramePosition,
  sourceFileLabel,
  useResolvedFrames,
} from '../../../data/initiator/use-resolved-frames';

export interface CallFrame {
  functionName?: string;
  url?: string;
  lineNumber?: number;
  columnNumber?: number;
  scriptId?: string;
}

export interface StackTrace {
  callFrames?: CallFrame[];
  parent?: StackTrace;
  description?: string;
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

  // Display-name policy (matches the browser's panel): prefer the source
  // map's ORIGINAL name when resolution yielded one, else keep the V8 name —
  // the browser pairs the generated function name with the resolved file
  // (`sendEvent @ hydro-analytics.ts:120`), so we do too. `(anonymous)` only
  // when neither side names the frame (V8 property-access names already
  // collapse to `(anonymous)` in `computeCallFrameMeta`).
  const hasResolvedFile = resolved?.source != null;
  const displayName = resolved?.name ?? meta.displayName;
  const treatAsAnonymous = displayName === '(anonymous)';
  const treatAsMinified = !treatAsAnonymous && resolved?.name == null && meta.isMinifiedName;
  const nameClass = [
    'dt-initiator-fn',
    treatAsAnonymous ? 'dt-initiator-fn--anonymous' : null,
    treatAsMinified ? 'dt-initiator-fn--minified' : null,
    !meta.isThirdParty && pageOrigin != null ? 'dt-initiator-fn--first-party' : null,
    meta.isThirdParty ? 'dt-initiator-fn--third-party' : null,
  ]
    .filter(Boolean)
    .join(' ');

  // Right column: prefer resolved file:line when we have one (the
  // browser's approach), else fall back to the generated URL
  // filename:line[:col]. The resolved label is the source's last path
  // segment VERBATIM — extension kept (`hydro-analytics.ts:120`), exactly
  // as the browser renders it. We intentionally drop the column on
  // resolved positions — original sources have meaningful line numbers,
  // and the column adds visual clutter without helping the user. For the
  // unresolved fallback we keep the column because minified single-line
  // bundles are all line=1 so the column is the only differentiator.
  const resolvedFile = hasResolvedFile && resolved?.source ? sourceFileLabel(resolved.source) : null;
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
      <span className={nameClass} title={resolved?.name ? `Source-map name: ${resolved.name}` : undefined}>
        {displayName}
      </span>
      {displayFile &&
        (openable ? (
          <button
            type="button"
            className="dt-initiator-loc dt-initiator-loc--link"
            title={hasResolvedFile ? `${frame.url} (original: ${resolved?.source ?? ''})` : frame.url}
            onClick={handleOpen}
          >
            <span className="dt-initiator-loc-at">@</span>
            <span className="dt-initiator-loc-file">{displayFile}</span>
            <span className="dt-initiator-loc-line">{displayLineSuffix}</span>
          </button>
        ) : (
          <span className="dt-initiator-loc" title={frame.url}>
            <span className="dt-initiator-loc-at">@</span>
            <span className="dt-initiator-loc-file">{displayFile}</span>
            <span className="dt-initiator-loc-line">{displayLineSuffix}</span>
          </span>
        ))}
    </div>
  );
}

/**
 * Async-boundary label for a section. The wire description for an await
 * boundary is the bare `await`; the browser's panel names the async
 * function whose continuation sits directly above the boundary (the last
 * frame of the preceding section) — `await in listModels` — so we do too.
 */
function asyncSectionLabel(description: string | undefined, previous: CopyStackInput | undefined): string {
  const base = description ?? 'Async call';
  if (base !== 'await') return base;
  const frames = previous?.callFrames ?? [];
  const name = frames[frames.length - 1]?.functionName?.trim();
  return name ? `await in ${name}` : base;
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
      description: isFirst ? undefined : asyncSectionLabel(cur.description, out[out.length - 1]),
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

export function CallStack({ stack, pageOrigin }: { stack: StackTrace; pageOrigin: string | null }) {
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
          <span className="dt-initiator-stack-count">
            · {totalFrames} frame{totalFrames === 1 ? '' : 's'}
          </span>
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
              {section.description && <div className="dt-initiator-stack-async-label">{section.description}</div>}
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
