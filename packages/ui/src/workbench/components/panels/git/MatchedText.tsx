/**
 * MatchedText — a row's text with the stretches the log's text filter
 * matched painted where they stand (the reference's amber). With no
 * filter, or nothing matched in this text, it is the text alone.
 */

import type React from 'react';
import type { TextRange } from './toolbar/log-filters';

export interface MatchedTextProps {
  text: string;
  /** The filter's matches in a text, in order; absent = no filter. */
  ranges?: (text: string) => readonly TextRange[];
}

const MatchedText: React.FC<MatchedTextProps> = ({ text, ranges }) => {
  const matched = ranges?.(text) ?? [];
  if (matched.length === 0) return text;
  const parts: React.ReactNode[] = [];
  let at = 0;
  for (const [start, end] of matched) {
    if (start > at) parts.push(text.slice(at, start));
    parts.push(
      <mark key={start} className="git-tool-match" data-testid="git-tool-match">
        {text.slice(start, end)}
      </mark>,
    );
    at = end;
  }
  if (at < text.length) parts.push(text.slice(at));
  return parts;
};

export default MatchedText;
