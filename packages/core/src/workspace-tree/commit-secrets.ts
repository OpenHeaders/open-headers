/**
 * commit-secrets — an environment's secret rows as a COMMIT holds them.
 *
 * The secret file is gitignored, so a commit's tree never carries one
 * and a plain read of it answers every environment without its secret
 * rows — laid over the branch, that reads as "the commit removed them".
 * What a commit does carry is the template beside the secret file: each
 * secret row's uid and name, the value blank. So the rows are taken
 * from the template and completed from the branch's own row of the same
 * uid (its value, and whatever else the template does not carry); a row
 * the branch does not have lands blank, to be filled in.
 *
 * A three-way integration knows which paths the commit's side changed.
 * A template outside them was not that side's to speak for, so the
 * branch's own secret rows stand as they are — the file-level
 * discipline every other document of the tree follows. Where both ends
 * of one change are read the same way (a pick), the template speaks
 * alone and the patch decides.
 */

import { parseEnvironmentSecretRows } from '../codec/yaml';
import type { Environment, Variable } from '../types/variable';
import { environmentSecretTemplateFilePath } from './layout';
import type { TreeFile } from './types';

export interface CommitSecretRowsArgs<S extends { environments: Environment[] }> {
  /** The commit's tree as read — its environments carry the committed rows only. */
  state: S;
  /** The listing the read came from; the templates are taken from it. */
  files: readonly TreeFile[];
  /** The branch's environments. */
  local: readonly Environment[];
  /**
   * Whether the commit's side changed a path (added, edited or removed
   * it) — a three-way integration's file diff. Absent = every template
   * is read as the commit holds it.
   */
  touched?: (path: string) => boolean;
}

const isSecret = (variable: Variable): boolean => variable.type === 'secret';

/** The template's rows, each completed from the branch's row of the same uid. */
function templateRows(template: string | undefined, mine: readonly Variable[]): Variable[] {
  if (template === undefined) return [];
  let named: Variable[];
  try {
    named = parseEnvironmentSecretRows(template);
  } catch {
    // An unreadable template names nothing — the branch's rows stand.
    return mine.filter(isSecret);
  }
  const mineByUid = new Map(mine.map((variable) => [variable.uid, variable] as const));
  return named.map((row) => {
    const own = mineByUid.get(row.uid);
    return own === undefined ? row : { ...own, name: row.name, type: 'secret' };
  });
}

/** `state` with every environment's secret rows as the commit holds them. */
export function withCommitSecretRows<S extends { environments: Environment[] }>(args: CommitSecretRowsArgs<S>): S {
  const { state, files, local, touched } = args;
  const contentByPath = new Map(files.map((file) => [file.path, file.content] as const));
  const localByUid = new Map(local.map((environment) => [environment.uid, environment] as const));

  const environments = state.environments.map((environment) => {
    const mine = localByUid.get(environment.uid)?.variables ?? [];
    const templatePath = environmentSecretTemplateFilePath(environment);
    const rows =
      touched !== undefined && !touched(templatePath)
        ? mine.filter(isSecret)
        : templateRows(contentByPath.get(templatePath), mine);
    const held = new Set(environment.variables.map((variable) => variable.uid));
    const added = rows.filter((row) => !held.has(row.uid));
    return added.length === 0 ? environment : { ...environment, variables: [...environment.variables, ...added] };
  });
  return { ...state, environments };
}
