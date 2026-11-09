/**
 * Tree hygiene — what the engine asks of the two root files that keep
 * git safe around a bound folder: `.gitignore` holds the sidecar and
 * every secret file out of a commit, `.gitattributes` keeps the YAML
 * byte-deterministic. Both are authored when absent and are the user's
 * from then on — their own entries are never rewritten. The one
 * standing demand is that the ignore entries stay: a `.gitignore`
 * missing one gets it appended, and nothing else in the file moves.
 */

import { WORKSPACE_GITIGNORE_CONTENT } from './layout';

const REQUIRED_IGNORE_ENTRIES: readonly string[] = WORKSPACE_GITIGNORE_CONTENT.split('\n').filter(
  (line) => line.length > 0,
);

/**
 * `content` with every required ignore entry present — the missing
 * ones appended on lines of their own, in the file's own line ending.
 * The same string when none is missing.
 */
export function withRequiredIgnoreEntries(content: string): string {
  const present = new Set(content.split(/\r?\n/).map((line) => line.trim()));
  const missing = REQUIRED_IGNORE_ENTRIES.filter((entry) => !present.has(entry));
  if (missing.length === 0) return content;
  const eol = content.includes('\r\n') ? '\r\n' : '\n';
  const lead = content.length === 0 || content.endsWith('\n') ? '' : eol;
  return `${content}${lead}${missing.join(eol)}${eol}`;
}
