/**
 * document-paths — which paths of a tree listing belong to the
 * workspace's documents, by the conventions the planner writes and the
 * reader classifies with: the root singletons, the environment files,
 * and every file in a directory that holds an entity manifest (the
 * manifest and its siblings — a request's body and scripts, a spec's
 * files). Everything else is the user's own (a README, scripts,
 * assets, `.gitignore`).
 *
 * A pass that reads a tree from a listing it did not walk itself — a
 * commit's — selects the blobs to read with this. These are the files a
 * reading is handed, not the files it takes: a pass that carries the
 * user's own files across takes the complement of what the readings
 * answer for (`answered-paths.ts`).
 */

import {
  ENTITY_MANIFEST_FILES,
  ENVIRONMENTS_DIR,
  SECRET_TEMPLATE_FILE_SUFFIX,
  TRUSTED_ROOTS_FILE,
  VAULT_FILE,
  WORKSPACE_MANIFEST_FILE,
  WORKSPACE_VARS_FILE,
} from './layout';

const ROOT_DOCUMENT_FILES: ReadonlySet<string> = new Set([
  WORKSPACE_MANIFEST_FILE,
  WORKSPACE_VARS_FILE,
  VAULT_FILE,
  TRUSTED_ROOTS_FILE,
]);

const split = (path: string): { dir: string; base: string } => {
  const cut = path.lastIndexOf('/');
  return cut === -1 ? { dir: '', base: path } : { dir: path.slice(0, cut), base: path.slice(cut + 1) };
};

/**
 * Whether `path`, a document path of a listing, is one by its NAME
 * alone: a root document, an environment file, an entity's manifest. Any
 * other document path is a file beside a manifest — a document's only
 * where a reading takes it (`answered-paths.ts`).
 */
export function isDocumentByName(path: string): boolean {
  const { dir, base } = split(path);
  return dir === '' || dir === ENVIRONMENTS_DIR || ENTITY_MANIFEST_FILES.has(base);
}

/** The document paths among `paths` — one complete listing of a tree. */
export function treeDocumentPaths(paths: Iterable<string>): Set<string> {
  const listing = [...paths];

  const entityDirs = new Set<string>();
  for (const path of listing) {
    const { dir, base } = split(path);
    if (dir !== '' && ENTITY_MANIFEST_FILES.has(base)) entityDirs.add(dir);
  }

  const documents = new Set<string>();
  for (const path of listing) {
    const { dir, base } = split(path);
    if (dir === '') {
      if (ROOT_DOCUMENT_FILES.has(base) || ENTITY_MANIFEST_FILES.has(base)) documents.add(path);
    } else if (entityDirs.has(dir)) {
      documents.add(path);
    } else if (dir === ENVIRONMENTS_DIR && (base.endsWith('.yaml') || base.endsWith(SECRET_TEMPLATE_FILE_SUFFIX))) {
      documents.add(path);
    }
  }
  return documents;
}
