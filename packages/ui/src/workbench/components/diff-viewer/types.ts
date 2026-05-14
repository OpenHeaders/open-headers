/**
 * Public option surface for the rich diff viewer.
 *
 * The viewer is a thin wrapper around Monaco's `DiffEditor` plus an
 * IDE-style toolbar. Only knobs Monaco genuinely honours are exposed —
 * there is no point shipping a toggle the user clicks and nothing
 * happens. Persistence is the consumer's concern; the component is
 * controlled (options + onChange) or uncontrolled (internal state from
 * `defaultOptions`).
 */

export type DiffViewerMode = 'side-by-side' | 'unified';

export type DiffViewerWhitespace = 'none' | 'ignore';

export interface DiffViewerOptions {
  /** Side-by-side panes vs single inline pane. */
  mode: DiffViewerMode;
  /** Trim/ignore whitespace when computing the diff. */
  whitespace: DiffViewerWhitespace;
  /** Collapse runs of unchanged lines to a click-to-expand stub. */
  collapseUnchanged: boolean;
  /** Render whitespace characters (·, →) in both panes. */
  showWhitespaces: boolean;
  /** Show the gutter line-number column. */
  showLineNumbers: boolean;
  /** Render indent guides. */
  showIndentGuides: boolean;
  /** Wrap long lines vs horizontal scroll. */
  softWrap: boolean;
}

export const DEFAULT_DIFF_VIEWER_OPTIONS: DiffViewerOptions = {
  mode: 'side-by-side',
  whitespace: 'none',
  collapseUnchanged: true,
  showWhitespaces: false,
  showLineNumbers: true,
  showIndentGuides: true,
  softWrap: false,
};
