/**
 * Diff view for a two-sided body override — original (what the page /
 * server produced) against modified (what actually travelled after the
 * rule). Rendered through the shared {@link RichDiffEditor}, which owns
 * the Monaco diff lifecycle (dispose-order, model swaps). Its built-in
 * toolbar stays hidden — the panel idiom is a single bottom bar, so
 * this component renders one: a hide-unchanged toggle (default on —
 * only changed hunks show) and the caller's override CTA on the left,
 * with the caller's controls (mode buttons + swap) right-aligned.
 *
 * Both sides are pretty-printed first when the language is known, so
 * the diff shows semantic changes rather than formatting noise
 * (servers often ship minified bodies while the override is
 * hand-formatted).
 */

import { useEffect, useState } from 'react';
// Side-effect import: kicks Monaco's bootstrap (theme registration) at
// module load.
import '@openheaders/ui/workbench/components/monaco/bootstrap';
import { useT } from '@openheaders/ui/context/LocaleContext';
import {
  DEFAULT_DIFF_VIEWER_OPTIONS,
  type DiffViewerOptions,
  RichDiffEditor,
} from '@openheaders/ui/workbench/components/diff-viewer';
import { canPrettyPrint, detectLanguage } from '../../data/mime';
import { SwapSidesButton } from './DualViewControls';
import { prettyPrintCode } from './pretty-print';
import Skeleton from './Skeleton';

interface DiffBodyViewProps {
  /** The untouched body (left side, `−` marks). */
  original: string;
  /** The post-rule body (right side, `+` marks). */
  modified: string;
  /** Caption over the left (original) column. */
  originalLabel: string;
  /** Caption over the right (modified) column. */
  modifiedLabel: string;
  /** MIME driving syntax highlight + pretty-print eligibility. */
  declaredMime: string;
  /** The caller's right-aligned controls (the mode buttons) — pinned at
   *  the end of the bar. */
  controls?: React.ReactNode;
  /** Flip the diff sides — renders the swap button on the caption row,
   *  next to the titles it swaps. */
  onSwapSides?: () => void;
  /** The caller's override CTA — trails the bar behind a divider. */
  overrideAction?: React.ReactNode;
}

export default function DiffBodyView({
  original,
  modified,
  originalLabel,
  modifiedLabel,
  declaredMime,
  controls,
  onSwapSides,
  overrideAction,
}: DiffBodyViewProps) {
  const t = useT();
  const lang = detectLanguage(declaredMime);
  const shouldFormat = lang !== null && canPrettyPrint(declaredMime);
  const [pretty, setPretty] = useState<{ original: string; modified: string } | null>(null);
  const [options, setOptions] = useState<DiffViewerOptions>(DEFAULT_DIFF_VIEWER_OPTIONS);

  useEffect(() => {
    if (!shouldFormat || !lang) {
      setPretty(null);
      return;
    }
    let cancelled = false;
    Promise.all([prettyPrintCode(original, lang), prettyPrintCode(modified, lang)]).then(([o, m]) => {
      if (!cancelled) setPretty({ original: o, modified: m });
    });
    return () => {
      cancelled = true;
    };
  }, [shouldFormat, lang, original, modified]);

  // Hold the skeleton until both sides are formatted — diffing the raw
  // text first would flash a noise-heavy diff, then reflow.
  if (shouldFormat && pretty === null) return <Skeleton />;

  return (
    <>
      <div className="dt-codemirror-wrap">
        <RichDiffEditor
          original={pretty?.original ?? original}
          modified={pretty?.modified ?? modified}
          language={lang ?? 'plaintext'}
          options={options}
          onOptionsChange={setOptions}
          showToolbar={false}
          header={
            <div className="dt-body-diff-labels">
              <span>{originalLabel}</span>
              <span>{modifiedLabel}</span>
              {onSwapSides && <SwapSidesButton onSwap={onSwapSides} />}
            </div>
          }
        />
      </div>
      <div className="dt-body-dual-bar">
        <div className="dt-response-toolbar-left">
          <button
            type="button"
            className={`dt-response-toolbar-btn ${options.collapseUnchanged ? 'active' : ''}`}
            onClick={() => setOptions({ ...options, collapseUnchanged: !options.collapseUnchanged })}
          >
            {t('panel.inspector.dualView.hideUnchanged')}
          </button>
          {overrideAction && (
            <>
              <span className="dt-toolbar-divider" aria-hidden="true" />
              {overrideAction}
            </>
          )}
        </div>
        {controls}
      </div>
    </>
  );
}
