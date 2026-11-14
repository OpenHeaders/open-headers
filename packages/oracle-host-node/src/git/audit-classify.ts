/**
 * Audit classification of git invocations — decides, from the arg
 * vector alone, whether a command belongs in the audit stream (the
 * Console tab feed): it mutates repo state, or it asks something of a
 * remote (`ls-remote` — what went over the network is the person's to
 * see, with the remote's answer). Local reads (`status`, `rev-parse`,
 * `version`, `diff`, ref listing) stay out by design; dual-use
 * subcommands (`config`, `symbolic-ref`, `remote`) audit only their
 * write forms via a per-subcommand discriminator.
 */

/** Global options that precede the subcommand in an arg vector — each consumes one value argument. */
const VALUED_GLOBAL_OPTIONS = new Set(['--git-dir', '--work-tree', '-C', '-c']);

/** Index of the subcommand in an arg vector, skipping `--git-dir <p> --work-tree <p>`-style global options; -1 when none. */
export function subcommandIndexOf(args: readonly string[]): number {
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (VALUED_GLOBAL_OPTIONS.has(arg)) {
      i += 1;
      continue;
    }
    if (arg.startsWith('-')) continue;
    return i;
  }
  return -1;
}

/** The subcommand of an invocation, skipping its global options. */
export function subcommandOf(args: readonly string[]): string | null {
  const index = subcommandIndexOf(args);
  return index === -1 ? null : args[index];
}

/** An arg vector split at git's own seam: the global options before the subcommand, then the subcommand with its operands. */
export function splitAtSubcommand(args: readonly string[]): { options: readonly string[]; command: readonly string[] } {
  const index = subcommandIndexOf(args);
  if (index === -1) return { options: args, command: [] };
  return { options: args.slice(0, index), command: args.slice(index) };
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

/** Discriminator over the full arg vector: does this invocation of the subcommand belong in the stream? */
type AuditedForm = (args: readonly string[]) => boolean;

const always: AuditedForm = () => true;

/** Every `config --get…` form (`--get`, `--get-all`, `--get-regexp`, `--get-urlmatch`) and `--list` / `-l` read; every other config form writes. */
const configWrites: AuditedForm = (args) =>
  !args.some((arg) => arg === '--get' || arg.startsWith('--get-') || arg === '--list' || arg === '-l');

/** `symbolic-ref [--short] [-q] <name>` reads; a second operand or a delete flag writes. */
const symbolicRefWrites: AuditedForm = (args) =>
  args.includes('--delete') || args.includes('-d') || operandsAfterSubcommand(args) >= 2;

/** The first operand after the subcommand — a many-verbed subcommand's own verb (`remote add`); null when it has none. */
function verbAfterSubcommand(args: readonly string[]): string | null {
  const index = subcommandIndexOf(args);
  if (index === -1) return null;
  return args.slice(index + 1).find((arg) => !arg.startsWith('-')) ?? null;
}

const REMOTE_WRITE_VERBS = new Set([
  'add',
  'rename',
  'remove',
  'rm',
  'set-head',
  'set-branches',
  'set-url',
  'prune',
  'update',
]);

/** Bare `remote` (and `-v`) lists, `remote show` / `get-url` read; the verbs that define, rename, drop or refetch a remote write. */
const remoteWrites: AuditedForm = (args) => {
  const verb = verbAfterSubcommand(args);
  return verb !== null && REMOTE_WRITE_VERBS.has(verb);
};

/**
 * Subcommands that can mutate repo state or that reach a remote, each
 * with the discriminator of its audited forms. Subcommands absent from
 * this table never audit.
 */
const AUDITED_FORMS: Record<string, AuditedForm> = {
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
  rebase: always,
  'cherry-pick': always,
  revert: always,
  bisect: always,
  fetch: always,
  pull: always,
  push: always,
  'ls-remote': always,
  branch: always,
  tag: always,
  reset: always,
  'update-index': always,
  config: configWrites,
  remote: remoteWrites,
};

/** Whether this invocation mutates repo state or reaches a remote — the audit-stream gate. */
export function isAudited(args: readonly string[]): boolean {
  const subcommand = subcommandOf(args);
  if (subcommand === null) return false;
  const audited = AUDITED_FORMS[subcommand];
  return audited !== undefined && audited(args);
}
