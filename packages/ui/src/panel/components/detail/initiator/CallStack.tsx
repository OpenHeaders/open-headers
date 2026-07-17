import { hostNavigation } from '@openheaders/core/navigation';
import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
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
import {
  buildTextPredicate,
  DEFAULT_TEXT_MATCH_CONFIG,
  type TextMatchConfig,
  type TextPredicate,
} from '../../../data/text-match';
import { FilterInput } from '../../FilterInput';

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

// Row copy resolved once per locale — the frame loop reads this object,
// never `t()` (per-row law). The param-bearing titles are lazy formats.
function buildStackRowLabels(t: Translate) {
  return {
    sourceMapNameTitle: (name: string) => t('panel.inspector.initiator.stack.sourceMapNameTitle', { name }),
    originalTitle: (url: string, source: string) => t('panel.inspector.initiator.stack.originalTitle', { url, source }),
  };
}
type StackRowLabels = ReturnType<typeof buildStackRowLabels>;

function FrameRow({
  frame,
  pageOrigin,
  resolved,
  labels,
}: {
  frame: CallFrame;
  pageOrigin: string | null;
  resolved?: ResolvedFramePosition;
  labels: StackRowLabels;
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
      <span className={nameClass} title={resolved?.name ? labels.sourceMapNameTitle(resolved.name) : undefined}>
        {displayName}
      </span>
      {displayFile &&
        (openable ? (
          <button
            type="button"
            className="dt-initiator-loc dt-initiator-loc--link"
            title={hasResolvedFile ? labels.originalTitle(frame.url ?? '', resolved?.source ?? '') : frame.url}
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
 * Async-boundary label for a section, matching the browser's panel: the
 * wire description for an await boundary is the bare `await`, and the label
 * names the async function whose continuation sits directly above the
 * boundary (the last frame of the preceding section) — `await in
 * listModels`, or `await in (anonymous)` when that frame is unnamed. The
 * Promise wire descriptions get their friendly forms; anything else passes
 * through verbatim.
 */
function asyncSectionLabel(description: string | undefined, previous: CopyStackInput | undefined): string {
  if (!description) return 'Async Call';
  if (description === 'Promise.resolve') return 'Promise resolved (async)';
  if (description === 'Promise.reject') return 'Promise rejected (async)';
  if (description === 'await') {
    const frames = previous?.callFrames ?? [];
    const last = frames[frames.length - 1];
    if (last) return `await in ${last.functionName?.trim() || '(anonymous)'}`;
  }
  return description;
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

function frameMatchesQuery(frame: CallFrameLike, displayName: string, predicate: TextPredicate): boolean {
  if (predicate.test(displayName)) return true;
  if (frame.url && predicate.test(frame.url)) return true;
  return false;
}

export function CallStack({ stack, pageOrigin }: { stack: StackTrace; pageOrigin: string | null }) {
  const t = useT();
  const rowLabels = useMemo(() => buildStackRowLabels(t), [t]);
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
  const [filterConfig, setFilterConfig] = useState<TextMatchConfig>(DEFAULT_TEXT_MATCH_CONFIG);
  const [hideNoise, setHideNoise] = useState(false);
  const [copied, setCopied] = useState(false);
  const filterPredicate = useMemo(() => buildTextPredicate(filter, filterConfig), [filter, filterConfig]);

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
          {t('panel.inspector.initiator.stack.heading')}
          <span className="dt-initiator-stack-count">
            · {t('panel.inspector.initiator.stack.frameCount', { count: totalFrames })}
          </span>
          {resolvedCount > 0 && (
            <span
              className="dt-initiator-stack-count dt-initiator-stack-count--resolved"
              title={t('panel.inspector.initiator.stack.resolvedTitle')}
            >
              · {t('panel.inspector.initiator.stack.resolvedCount', { count: resolvedCount })}
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
              title={t('panel.inspector.initiator.stack.noiseTitle')}
            >
              {hideNoise
                ? t('panel.inspector.initiator.stack.showHidden', { count: noiseCount })
                : t('panel.inspector.initiator.stack.hideNoisy', { count: noiseCount })}
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
            title={t('panel.inspector.initiator.stack.copyTitle')}
          >
            {copied ? t('panel.inspector.initiator.stack.copied') : t('panel.inspector.initiator.stack.copy')}
          </button>
        </span>
      </summary>
      <div className="dt-initiator-stack-filter">
        <FilterInput
          value={filter}
          onChange={setFilter}
          config={filterConfig}
          onConfigChange={setFilterConfig}
          hasError={filterPredicate.error}
          placeholder={t('panel.inspector.initiator.stack.filterPlaceholder')}
          ariaLabel={t('panel.inspector.initiator.stack.filterAria')}
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
            if (!filterPredicate.empty && !frameMatchesQuery(frame as CallFrameLike, nameForQuery, filterPredicate)) {
              return false;
            }
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
                    labels={rowLabels}
                  />
                ))}
              </div>
            </div>
          );
        });
        return (
          <>
            {rendered}
            {(!filterPredicate.empty || hideNoise) && (
              <div className="dt-initiator-stack-status">
                {totalVisible === 0 ? (
                  <span className="dt-col-muted">{t('panel.inspector.initiator.stack.noMatch')}</span>
                ) : (
                  <span className="dt-col-muted">
                    {t('panel.inspector.initiator.stack.showing', { shown: totalVisible, count: totalFrames })}
                    {totalHidden > 0
                      ? ` ${t('panel.inspector.initiator.stack.hiddenSuffix', { count: totalHidden })}`
                      : ''}
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
