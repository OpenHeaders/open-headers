/**
 * Git commit adapter — projects the documents a picked (or reverted)
 * commit and the branch both changed into a generic `MergeSession`.
 *
 * Pure data; no UI imports. The host sends each file serialized the
 * same way on every side (`base` where the change starts, `theirs`
 * where it ends, `mine` as the branch holds it), so the editor diffs
 * like against like:
 *
 *   - a file opens with the branch's text as its result — the editor's
 *     contract — and the commit's hunks are accepted into it;
 *   - a file with no ancestor (`base` absent) renders two panes;
 *   - a file the change removes (`theirs` absent) is an empty incoming
 *     side: accepting it empties the result, and an empty result is
 *     the answer "gone".
 *
 * Files group by the directory that holds them, so the files of one
 * request (its manifest, its body, its scripts) sit together. One of
 * the user's own text files (a README, a script) rides the same shape.
 *
 * Apply hands every file's result to the caller as one answer set. A
 * refusal that names a file marks that file; any other marks them all.
 */

import type { MergeApplyOutcome, MergeFile, MergeSession } from '@openheaders/ui/shared/merge-editor';

/** One file of a conflicted document — the host's wire shape, structurally. */
export interface CommitMergeFile {
  /** The file's path on the branch. */
  path: string;
  base?: string;
  theirs?: string;
  mine?: string;
}

export interface CommitMergeAnswer {
  path: string;
  content: string;
}

export type CommitMergeApplyResult =
  | { ok: true }
  /** `path` names the one file the refusal is about, when it is about one. */
  | { ok: false; error: string; path?: string };

export interface BuildCommitMergeSessionArgs {
  title: string;
  files: readonly CommitMergeFile[];
  /** Send the answers. Resolve `ok` once the commit is recorded or the pass is otherwise over. */
  apply(answers: CommitMergeAnswer[]): Promise<CommitMergeApplyResult>;
  onCancel(): void;
}

const LANGUAGE_BY_EXTENSION: Readonly<Record<string, string>> = {
  yaml: 'yaml',
  yml: 'yaml',
  json: 'json',
  js: 'javascript',
  ts: 'typescript',
  md: 'markdown',
  sh: 'shell',
  xml: 'xml',
  html: 'html',
  graphql: 'graphql',
  gql: 'graphql',
  proto: 'protobuf',
};

function splitPath(path: string): { dir: string; name: string } {
  const cut = path.lastIndexOf('/');
  return cut === -1 ? { dir: '', name: path } : { dir: path.slice(0, cut), name: path.slice(cut + 1) };
}

function languageOf(name: string): string {
  const dot = name.lastIndexOf('.');
  const extension = dot === -1 ? '' : name.slice(dot + 1).toLowerCase();
  return LANGUAGE_BY_EXTENSION[extension] ?? 'plaintext';
}

/** The merge files of a conflict, in the host's order. */
export function commitMergeFiles(files: readonly CommitMergeFile[]): MergeFile[] {
  return files.map((file) => {
    const { dir, name } = splitPath(file.path);
    const mine = file.mine ?? '';
    return {
      id: file.path,
      label: name,
      language: languageOf(name),
      kind: 'modify',
      ...(dir !== '' ? { group: dir } : {}),
      ...(file.base !== undefined ? { base: file.base } : {}),
      theirs: file.theirs ?? '',
      mine,
      initialResult: mine,
    };
  });
}

export function buildCommitMergeSession(args: BuildCommitMergeSessionArgs): MergeSession {
  const { title, apply, onCancel } = args;
  return {
    title,
    files: commitMergeFiles(args.files),
    // The title names the pass, never the file — one file is listed too.
    alwaysListFiles: true,
    onApply: async (filesArg, results) => {
      const answers = filesArg.map((file) => ({ path: file.id, content: results.get(file.id) ?? file.initialResult }));
      const outcome = await apply(answers);
      return filesArg.map((file): MergeApplyOutcome => {
        if (outcome.ok || (outcome.path !== undefined && outcome.path !== file.id)) {
          return { fileId: file.id, ok: true, status: 'resolved' };
        }
        return { fileId: file.id, ok: false, status: 'resolved', error: outcome.error };
      });
    },
    onCancel,
  };
}
