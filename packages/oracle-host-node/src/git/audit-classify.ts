/**
 * Audit classification of git invocations — decides, from the arg
 * vector alone, whether a command mutates repo state and therefore
 * belongs in the audit stream (the Console tab feed). Reads (`status`,
 * `rev-parse`, `version`, `diff`, ref listing) stay out by design;
 * dual-use subcommands (`config`, `symbolic-ref`) audit only their
 * write forms via a per-subcommand discriminator.
 */

/** Global options that precede the subcommand in an arg vector — each consumes one value argument. */
const VALUED_GLOBAL_OPTIONS = new Set(['--git-dir', '--work-tree', '-C', '-c']);

/** The subcommand of an invocation, skipping `--git-dir <p> --work-tree <p>`-style global options. */
export function subcommandOf(args: readonly string[]): string | null {
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (VALUED_GLOBAL_OPTIONS.has(arg)) {
      i += 1;
      continue;
    }
    if (arg.startsWith('-')) continue;
    return arg;
  }
  return null;
}

/**
 * Operand (non-option) count after the subcommand — distinguishes the
 * read and write forms of dual-use subcommands: `symbolic-ref HEAD`
 * reads, `symbolic-ref HEAD <ref>` writes.
 */
function operandsAfterSubcommand(args: readonly string[]): number {
  let pastSubcommand = false;
  let count = 0;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!pastSubcommand) {
      if (VALUED_GLOBAL_OPTIONS.has(arg)) {
        i += 1;
        continue;
      }
      if (arg.startsWith('-')) continue;
      pastSubcommand = true;
      continue;
    }
    if (arg.startsWith('-')) continue;
    count += 1;
  }
  return count;
}

/** Discriminator over the full arg vector: does this invocation of the subcommand mutate state? */
type WriteForm = (args: readonly string[]) => boolean;

const always: WriteForm = () => true;

/** `config --get` / `config --list` read; every other config form writes. */
const configWrites: WriteForm = (args) => !args.includes('--get') && !args.includes('--list');

/** `symbolic-ref [--short] [-q] <name>` reads; a second operand or a delete flag writes. */
const symbolicRefWrites: WriteForm = (args) =>
  args.includes('--delete') || args.includes('-d') || operandsAfterSubcommand(args) >= 2;

/**
 * Subcommands that can mutate repo state, each with its write-form
 * discriminator. Subcommands absent from this table never audit.
 */
const WRITE_FORMS: Record<string, WriteForm> = {
  init: always,
  add: always,
  rm: always,
  mv: always,
  commit: always,
  'read-tree': always,
  'write-tree': always,
  'commit-tree': always,
  'update-ref': always,
  'symbolic-ref': symbolicRefWrites,
  checkout: always,
  switch: always,
  restore: always,
  merge: always,
  fetch: always,
  pull: always,
  push: always,
  branch: always,
  tag: always,
  reset: always,
  'update-index': always,
  config: configWrites,
};

/** Whether this invocation mutates repo state — the audit-stream gate. */
export function isStateChanging(args: readonly string[]): boolean {
  const subcommand = subcommandOf(args);
  if (subcommand === null) return false;
  const writes = WRITE_FORMS[subcommand];
  return writes !== undefined && writes(args);
}
