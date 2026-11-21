/**
 * Search-match rendering — how a results list shows WHY a row is in it.
 *
 *   SearchMatchText     a displayed text with the query's hits painted
 *   SearchMatchSnippet  one line of a row's description, for a match
 *                       the row's label doesn't show
 *
 * Both read the active terms from `SearchTermsContext`; outside a
 * results list there are none, the text renders plain and the snippet
 * renders nothing.
 */

import { theme } from 'antd';
import type React from 'react';
import { useMemo } from 'react';
import { excerptFrom, matchRanges, type TextRange, unmatchedTerms } from '../search/highlight';
import { useSearchTerms } from '../search/terms-context';

/** How much of the description is kept in front of the hit a snippet opens on. */
const SNIPPET_LEAD_CHARS = 32;

const MarkedText: React.FC<{ text: string; ranges: readonly TextRange[] }> = ({ text, ranges }) => {
  if (ranges.length === 0) return text;
  const parts: React.ReactNode[] = [];
  let at = 0;
  for (const [start, end] of ranges) {
    if (start > at) parts.push(text.slice(at, start));
    parts.push(
      <mark key={start} className="settings-search-match">
        {text.slice(start, end)}
      </mark>,
    );
    at = end;
  }
  if (at < text.length) parts.push(text.slice(at));
  return parts;
};

/** A text as a row displays it, with the active search's hits painted. */
export const SearchMatchText: React.FC<{ text: string }> = ({ text }) => {
  const terms = useSearchTerms();
  const ranges = useMemo(() => matchRanges(text, terms), [text, terms]);
  return <MarkedText text={text} ranges={ranges} />;
};

/**
 * The line under a row that explains a match its label doesn't: the
 * description — which a row otherwise keeps behind its `(i)` — cut to
 * open near the first term the label is missing, hits painted. Nothing
 * when the label already carries every term, or the description
 * carries none of the missing ones (a tag, key or category match).
 */
export const SearchMatchSnippet: React.FC<{ label: string; description: string }> = ({ label, description }) => {
  const { token } = theme.useToken();
  const terms = useSearchTerms();
  const excerpt = useMemo(() => {
    if (terms.length === 0 || description === '') return null;
    const [firstMissing] = matchRanges(description, unmatchedTerms(label, terms));
    if (firstMissing === undefined) return null;
    return excerptFrom(description, matchRanges(description, terms), firstMissing[0], SNIPPET_LEAD_CHARS);
  }, [label, description, terms]);

  if (excerpt === null) return null;
  return (
    <div
      className="settings-search-snippet"
      style={{
        padding: '0 0 4px',
        fontSize: 11.5,
        lineHeight: '16px',
        color: token.colorTextTertiary,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      <MarkedText text={excerpt.text} ranges={excerpt.ranges} />
    </div>
  );
};
