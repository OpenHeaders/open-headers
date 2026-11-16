/**
 * commit-object — a commit read off its own object (`git cat-file`) as
 * `git log` prints it under `LOG_FORMAT`: its parents, its author, the
 * author's date in the author's own offset, its subject and the
 * co-authors its body names. No files — those are a diff, and git's.
 *
 * EXACT OR NOTHING. What git does to a commit on its way out is
 * followed here for the commits that are the rule: no `encoding`
 * header (so UTF-8), an author line of the one shape git writes, a date
 * a calendar holds. Any other commit answers null, and whoever asked
 * reads it from git itself — never a guess at what git would print.
 *
 * Git's rules, as followed: the subject is the message's first
 * paragraph, its lines joined by a space, each without the blanks at
 * its end; blank lines before it are no part of it, and the body is
 * what follows it; a blank is a space, a tab, a carriage return; a
 * header that runs on (a signature) does so on lines that start with a
 * space, so none of them is a header by its first word; the author's
 * name ends before the blanks that precede `<`; a zero offset reads
 * `Z`.
 *
 * Pure.
 */

import { type CommitLogHead, coAuthorsOf } from './repo';

/** `name <email> seconds ±hhmm` — the one shape git writes an author line in. */
const AUTHOR = /^([^<]*)<([^>]*)> (\d{1,12}) ([+-])(\d{2})(\d{2})$/;

/** The last second a four-digit year holds. */
const LAST_SECOND = 253_402_300_799;

const BLANK = /^[ \t\r]*$/;
const BLANKS_AT_END = /[ \t\r]+$/;

/** The author's date in the author's own offset, strict ISO-8601 (`%aI`); null for one no calendar holds. */
function authoredAt(seconds: number, sign: string, hours: number, minutes: number): string | null {
  if (seconds > LAST_SECOND || hours > 14 || minutes > 59) return null;
  const offset = (sign === '-' ? -1 : 1) * (hours * 60 + minutes);
  const local = new Date((seconds + offset * 60) * 1000).toISOString().slice(0, 19);
  if (offset === 0) return `${local}Z`;
  return `${local}${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/** A message's subject as `%s` prints it, and what follows its paragraph. */
function splitMessage(message: string): { subject: string; body: string } {
  const lines = message.split('\n');
  let at = 0;
  while (at < lines.length && BLANK.test(lines[at])) at += 1;
  const subject: string[] = [];
  while (at < lines.length && !BLANK.test(lines[at])) {
    subject.push(lines[at].replace(BLANKS_AT_END, ''));
    at += 1;
  }
  return { subject: subject.join(' '), body: lines.slice(at).join('\n') };
}

/**
 * The commit `sha` from its object's `bytes`, without its files; null
 * for a commit this file does not read exactly as git prints it.
 */
export function parseCommitObject(sha: string, bytes: Buffer): CommitLogHead | null {
  const text = bytes.toString('utf8');
  // Git's own reading of a message ends at a NUL.
  if (text.includes('\0')) return null;
  const headEnd = text.indexOf('\n\n');
  if (headEnd === -1) return null;

  const parents: string[] = [];
  let author: RegExpExecArray | null = null;
  for (const line of text.slice(0, headEnd).split('\n')) {
    if (line.startsWith('parent ')) parents.push(line.slice(7));
    else if (line.startsWith('author ')) author = AUTHOR.exec(line.slice(7));
    else if (line.startsWith('encoding ') && !/^utf-?8$/i.test(line.slice(9))) return null;
  }
  if (author === null) return null;
  const at = authoredAt(Number(author[3]), author[4], Number(author[5]), Number(author[6]));
  if (at === null) return null;

  const { subject, body } = splitMessage(text.slice(headEnd + 2));
  return {
    sha,
    parents,
    authorName: author[1].replace(BLANKS_AT_END, ''),
    authorEmail: author[2],
    authoredAt: at,
    subject,
    coAuthors: coAuthorsOf(body),
  };
}
