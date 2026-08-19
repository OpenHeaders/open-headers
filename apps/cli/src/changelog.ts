/**
 * `oh changelog` — this release's notes, embedded at build
 * (the changelog plan §4.3): the bundle configs stamp the canonical
 * entry body into `__CLI_CHANGELOG__`, so the command works air-gapped.
 * A version without an entry ships the empty string (entry-existence
 * law) and the command says so instead of inventing prose; history
 * beyond the running version lives on the website changelog page.
 */

import { parseArgs } from 'node:util';
import { UsageError } from './exit-codes';
import { CLI_VERSION } from './version';

/** Build-time embedded entry body; empty when unbundled or entry-less. */
declare const __CLI_CHANGELOG__: string | undefined;

export const CLI_CHANGELOG: string = typeof __CLI_CHANGELOG__ === 'string' ? __CLI_CHANGELOG__ : '';

const FULL_CHANGELOG_URL = 'https://openheaders.com/changelog';

export function commandChangelog(argv: readonly string[], entry: string = CLI_CHANGELOG): string[] {
  let parsed: { values: { json?: boolean }; positionals: string[] };
  try {
    parsed = parseArgs({ args: [...argv], options: { json: { type: 'boolean' } }, allowPositionals: true });
  } catch (err) {
    throw new UsageError(err instanceof Error ? err.message : String(err));
  }
  if (parsed.positionals.length > 0) throw new UsageError(`unexpected argument: ${parsed.positionals[0]}`);

  const notes = entry === '' ? null : entry;
  if (parsed.values.json === true) {
    return [JSON.stringify({ version: CLI_VERSION, notes }, null, 2)];
  }
  if (notes === null) {
    const reason =
      CLI_VERSION === 'dev'
        ? 'no release notes in an unbundled dev run'
        : `no release notes for oh v${CLI_VERSION} — this build shipped without user-visible changes`;
    return [reason, `full changelog: ${FULL_CHANGELOG_URL}`];
  }
  return [`oh v${CLI_VERSION} — release notes`, '', ...notes.split('\n'), '', `full changelog: ${FULL_CHANGELOG_URL}`];
}
