/**
 * Diff view for a two-sided response override — original (what the
 * server sent) against modified (what Open Headers served to the
 * page). Rendered through the shared {@link RichDiffEditor}, which owns
 * the Monaco diff lifecycle (dispose-order, model swaps). Its built-in
 * toolbar stays hidden — the panel idiom is a single bottom bar, so
 * this component renders one: the caller's mode buttons (Diff / Full
 * response), a hide-unchanged toggle (default on — only changed hunks
 * show), and the caller's override CTA.
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
import {
  DEFAULT_DIFF_VIEWER_OPTIONS,
  type DiffViewerOptions,
  RichDiffEditor,
} from '@openheaders/ui/workbench/components/diff-viewer';
import { canPrettyPrint, detectLanguage } from '../../data/mime';
import { prettyPrintCode } from './pretty-print';
import Skeleton from './Skeleton';

interface DiffBodyViewProps {
  /** The server's untouched body. */
  original: string;
  /** The body the page actually received (post-rule). */
  modified: string;
  /** MIME driving syntax highlight + pretty-print eligibility. */
  declaredMime: string;
  /** The caller's Diff / Full-response mode buttons — leads the bar. */
  modeButtons?: React.ReactNode;
  /** The caller's override CTA — trails the bar behind a divider. */
  overrideAction?: React.ReactNode;
}

export default function DiffBodyView({
  original,
  modified,
  declaredMime,
  modeButtons,
  overrideAction,
}: DiffBodyViewProps) {
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
              <span>Original · server</span>
              <span>Modified · Open Headers</span>
            </div>
          }
        />
      </div>
      <div className="dt-body-dual-bar">
        {modeButtons}
        <button
          type="button"
          className={`dt-response-toolbar-btn ${options.collapseUnchanged ? 'active' : ''}`}
          onClick={() => setOptions({ ...options, collapseUnchanged: !options.collapseUnchanged })}
        >
          Hide unchanged
        </button>
        {overrideAction && (
          <>
            <span className="dt-toolbar-divider" aria-hidden="true" />
            {overrideAction}
          </>
        )}
      </div>
    </>
  );
}
