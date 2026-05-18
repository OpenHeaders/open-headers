/** Layout mode for the header lists — `grouped` keeps the existing
 *  per-category collapsible sections; `flat` renders a single list in
 *  the chosen sort order (matches Chrome's behavior). */
export type HeaderLayoutMode = 'grouped' | 'flat';

/** Sort applied to header rows. `original` preserves the order the
 *  server sent + rule-added rows appended (HAR order). `az` sorts by
 *  name. `rule-first` floats rule-modified rows to the top, preserving
 *  HAR order within each bucket. Stable in all modes. */
export type HeaderSortMode = 'original' | 'az' | 'rule-first';

export type SectionLabel = 'Response Headers' | 'Request Headers';
