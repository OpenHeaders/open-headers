/**
 * The shared command-spec shape behind every table-driven verb beyond
 * the read table: writes (Phase 2) and execute/diff (Phase 3). One
 * `tools/call` per command; positionals + flags map onto tool args in
 * `buildArgs`, `resolveArgs` hosts the sanctioned name → uid pre-read,
 * and `checkFailure` classifies in-band unsuccessful outcomes (a failed
 * send/run) as exit 1 without losing the `--json` payload.
 */

import type { Connection } from './connection';

export type CommandOptionValues = Record<string, string | boolean | undefined>;

export interface CommandSpec {
  readonly group: string;
  readonly verb: string;
  readonly tool: string;
  readonly summary: string;
  /** Positional/flag shape shown in help (after `oh <group> <verb>`). */
  readonly argsHelp: string;
  /** Per-command flags beyond the shared connection options. */
  readonly extraOptions?: Record<string, { readonly type: 'string' | 'boolean' }>;
  /** Map positionals + flags onto tool args; throws UsageError on shape mistakes. */
  readonly buildArgs: (positionals: readonly string[], values: CommandOptionValues) => Record<string, unknown>;
  /** Pre-call resolution that needs the daemon (name → uid). */
  readonly resolveArgs?: (args: Record<string, unknown>, conn: Connection) => Promise<Record<string, unknown>>;
  /** A returned message means the tool reported an unsuccessful outcome in-band → exit 1. */
  readonly checkFailure?: (payload: unknown) => string | undefined;
  readonly format: (payload: unknown) => string[];
}
