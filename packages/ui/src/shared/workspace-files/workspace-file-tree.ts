/**
 * workspace-file-tree — files of the workspace's tree, listed as the
 * workbench lists what they belong to: by surface (the Browser
 * Interceptor, API Requests, Workflows, Variables — and Files for
 * everything that is the user's own), by the section a surface's panel
 * shows it under (RULES, TEMPLATES, REQUESTS, SPECS, …), then down the
 * collections and folders to the entity, in the panel's own order.
 *
 * A file is matched to its entity by its path: every entity of the tree
 * owns a directory whose name ends in its uid, an environment files
 * whose name does. What the workspace keeps in one file of its own — the
 * vault, its variables, the workspace itself (its name and the order of
 * its collections), its trusted certificates — is a page: a section
 * that is one row. An entity's
 * directory keeps its name through a rename and changes place on a
 * move, so a file under a directory no entity is at now is its
 * entity's by that uid — where it was before a move. Only what holds a
 * listed file is listed, with the containers above it, and every file
 * exactly once.
 *
 * A file of an entity the workspace no longer holds — deleted since, or
 * living on another branch — is named by what the caller learned of it
 * from the commit (`FormerFiles`): the entity as the commit called it,
 * under the collection and folders that held it — a container the
 * workspace still holds is its own row, one it does not is a former row
 * too. Without that it is listed under Files, by its directory.
 *
 *   - an entity with one file is the row that stands for it;
 *   - one with several lists them under it by the part of the entity
 *     each holds (its details, its body, a script), a part with no name
 *     of its own by its file name;
 *   - a collection or a folder lists its own parts ahead of what it
 *     holds;
 *   - an environment lists its secrets' names (the committed template)
 *     and their values (the ignored file) as parts beside its details;
 *   - a file no entity owns is listed under Files by its directory.
 *
 * Pure data: the names and the glyphs are the caller's.
 */

import { type ScriptKind, scriptKindOfFile } from '@openheaders/core/scripts';
import type { TreeNode as CoreTreeNode, FolderNode } from '@openheaders/core/types';
import { extractUid, isUid } from '@openheaders/core/utils';
import {
  ENTITY_MANIFEST_FILES,
  ENVIRONMENTS_DIR,
  SECRET_FILE_SUFFIX,
  SECRET_TEMPLATE_FILE_SUFFIX,
  TRUSTED_ROOTS_FILE,
  VAULT_FILE,
  WORKSPACE_MANIFEST_FILE,
  WORKSPACE_VARS_FILE,
} from '@openheaders/core/workspace-tree';

export type WorkspaceFileSurface = 'http-rules' | 'api-requests' | 'workflows' | 'variables' | 'files';

/** The surfaces in listing order — the activity bar's own, the user's files last. */
export const WORKSPACE_FILE_SURFACES: readonly WorkspaceFileSurface[] = [
  'http-rules',
  'api-requests',
  'workflows',
  'variables',
  'files',
];

/** What the workspace keeps in one file of its own — a section that is one row. */
export type WorkspaceFilePage = 'vault' | 'workspace-variables' | 'workspace' | 'trusted-roots';

export type WorkspaceFileSectionId =
  | 'rules'
  | 'templates'
  | 'requests'
  | 'specs'
  | 'workflows'
  | 'live-variables'
  | 'environments'
  | WorkspaceFilePage
  | 'files';

const PAGE_FILES: Readonly<Record<WorkspaceFilePage, string>> = {
  vault: VAULT_FILE,
  'workspace-variables': WORKSPACE_VARS_FILE,
  workspace: WORKSPACE_MANIFEST_FILE,
  'trusted-roots': TRUSTED_ROOTS_FILE,
};

export function isWorkspaceFilePage(id: WorkspaceFileSectionId): id is WorkspaceFilePage {
  return Object.hasOwn(PAGE_FILES, id);
}

/**
 * The sections in listing order, each under the surface whose panel
 * shows it; the two pages no panel shows — the workspace and its
 * trusted certificates — sit with the user's own files, ahead of them.
 */
const SECTIONS: ReadonlyArray<readonly [WorkspaceFileSectionId, WorkspaceFileSurface]> = [
  ['rules', 'http-rules'],
  ['templates', 'http-rules'],
  ['requests', 'api-requests'],
  ['specs', 'api-requests'],
  ['workflows', 'workflows'],
  ['vault', 'variables'],
  ['workspace-variables', 'variables'],
  ['live-variables', 'variables'],
  ['environments', 'variables'],
  ['workspace', 'files'],
  ['trusted-roots', 'files'],
  ['files', 'files'],
];

/** The part of an entity one of its files holds. */
export type WorkspaceFilePart =
  | 'details'
  | 'body'
  | 'variables'
  | 'query'
  | 'message'
  | 'secret-names'
  | 'secret-values'
  | ScriptKind;

export type WorkspaceLeafNode = Exclude<CoreTreeNode, FolderNode>;

/** What a row stands for — enough for the caller to name and draw it as its panel does. */
export type WorkspaceFileEntity =
  | { kind: 'collection' | 'folder'; uid: string; name: string }
  | { kind: 'node'; node: WorkspaceLeafNode }
  | { kind: 'spec' | 'workflow' | 'live-variable' | 'environment'; uid: string; name: string }
  | { kind: WorkspaceFilePage }
  /** One the workspace no longer holds, as a commit names it. */
  | { kind: 'former'; was: FormerEntity };

/** An entity as a commit's own manifest names it. */
export interface FormerEntity {
  kind:
    | 'collection'
    | 'folder'
    | 'rule'
    | 'template'
    | 'request'
    | 'graphql'
    | 'grpc'
    | 'websocket'
    | 'mqtt'
    | 'spec'
    | 'workflow'
    | 'live-variable'
    | 'environment';
  uid: string;
  name: string;
  /** An HTTP request's method. */
  method?: string;
}

/** What a file belonged to in the commit that changed it. */
export interface FormerFile {
  entity: FormerEntity;
  /** The collection and the folders that held it, outermost first. */
  containers: readonly FormerEntity[];
}

/** By path: the files the caller could name from their commit. */
export type FormerFiles = ReadonlyMap<string, FormerFile>;

const NO_FORMER_FILES: FormerFiles = new Map();

/** The section an entity's files sit under, by the tree's directory they are in. */
const TREE_SECTIONS: Readonly<Record<string, WorkspaceFileSectionId>> = {
  rules: 'rules',
  templates: 'templates',
  requests: 'requests',
  specs: 'specs',
  'live-workflows': 'workflows',
  'live-variables': 'live-variables',
  [ENVIRONMENTS_DIR]: 'environments',
};

/** A path inside one of the directories the workspace keeps its entities in. */
export function isEntityTreePath(path: string): boolean {
  return Object.hasOwn(TREE_SECTIONS, rootOf(path));
}

/** An entity the workspace no longer holds, with what it held. */
interface FormerRow {
  was: FormerEntity;
  /** The directories its listed files are in. */
  dirs: Set<string>;
  held: Map<string, FormerRow>;
}

export type WorkspaceFileNode =
  /** `file` set: the row stands for that file. Otherwise its parts and what it holds are under it. */
  | { type: 'entity'; id: string; entity: WorkspaceFileEntity; file?: string; children: WorkspaceFileNode[] }
  /** One file of an entity that lists several; `part` null = named by its file. */
  | { type: 'part'; id: string; part: WorkspaceFilePart | null; name: string; file: string }
  | { type: 'directory'; id: string; path: string; children: WorkspaceFileNode[] }
  | { type: 'file'; id: string; name: string; file: string };

type PartNode = Extract<WorkspaceFileNode, { type: 'part' }>;

export interface WorkspaceFileSection {
  id: WorkspaceFileSectionId;
  surface: WorkspaceFileSurface;
  nodes: WorkspaceFileNode[];
}

interface Listed {
  uid: string;
  name: string;
  path: string;
}

interface CollectionOfNodes extends Listed {
  tree: readonly CoreTreeNode[];
}

/** The workspace as its panels list it. */
export interface ListedWorkspace {
  ruleCollections: readonly CollectionOfNodes[];
  templateCollections: readonly CollectionOfNodes[];
  requestCollections: readonly CollectionOfNodes[];
  specs: readonly Listed[];
  workflows: readonly Listed[];
  liveVariables: readonly Listed[];
  environments: ReadonlyArray<{ uid: string; name: string }>;
}

/** One file where the tree lists it. */
export interface ListedWorkspaceFile {
  path: string;
  surface: WorkspaceFileSurface;
  /** The entity the file belongs to; absent for one of the user's own files. */
  entity?: WorkspaceFileEntity;
  /** Set when the entity lists several files: this one's part, null = named by its file. */
  part?: WorkspaceFilePart | null;
  /** The file's name. */
  name: string;
}

function split(path: string): { dir: string; name: string } {
  const cut = path.lastIndexOf('/');
  return cut === -1 ? { dir: '', name: path } : { dir: path.slice(0, cut), name: path.slice(cut + 1) };
}

const nameOf = (path: string): string => split(path).name;

const rootOf = (path: string): string => path.slice(0, Math.max(path.indexOf('/'), 0));

/** The uid a directory's or a file's `<slug>-<uid>` name ends in. */
function uidOf(name: string): string | null {
  const uid = extractUid(name);
  return isUid(uid) ? uid : null;
}

/** The part a file of an entity's directory holds, by the name its codec writes it under. */
export function workspaceFilePartOf(fileName: string): WorkspaceFilePart | null {
  if (ENTITY_MANIFEST_FILES.has(fileName)) return 'details';
  const script = scriptKindOfFile(fileName);
  if (script !== null) return script;
  if (/^body\.\w+$/.test(fileName)) return 'body';
  if (fileName === 'variables.json') return 'variables';
  if (fileName === 'query.graphql') return 'query';
  if (/^(message|payload)\.(json|txt)$/.test(fileName)) return 'message';
  return null;
}

/** An environment's parts in listing order. */
const ENVIRONMENT_PARTS: readonly WorkspaceFilePart[] = ['details', 'secret-names', 'secret-values'];

/** What a file of the environments directory holds, and the `<slug>-<uid>` stem of its name. */
function environmentFile(name: string): { part: WorkspaceFilePart; stem: string } | null {
  const held = (suffix: string, part: WorkspaceFilePart) =>
    name.endsWith(suffix) ? { part, stem: name.slice(0, -suffix.length) } : null;
  return (
    held(SECRET_TEMPLATE_FILE_SUFFIX, 'secret-names') ??
    held(SECRET_FILE_SUFFIX, 'secret-values') ??
    held('.yaml', 'details')
  );
}

/**
 * The part of its entity a file holds, by where it is and what it is
 * called alone — null for one with no name of its own, undefined for a
 * file outside the directories the workspace keeps its entities in.
 */
export function workspaceFilePartAt(path: string): WorkspaceFilePart | null | undefined {
  const root = rootOf(path);
  if (!Object.hasOwn(TREE_SECTIONS, root)) return undefined;
  const name = nameOf(path);
  return root === ENVIRONMENTS_DIR ? (environmentFile(name)?.part ?? null) : workspaceFilePartOf(name);
}

function partNode(file: string, part: WorkspaceFilePart | null): PartNode {
  return { type: 'part', id: file, part, name: nameOf(file), file };
}

/** An entity's own files as rows: the details first, then by name. */
function partsOf(files: readonly string[]): PartNode[] {
  return files
    .map((file) => ({ file, name: nameOf(file), part: workspaceFilePartOf(nameOf(file)) }))
    .sort(
      (a, b) =>
        Number(b.part === 'details') - Number(a.part === 'details') ||
        a.name.localeCompare(b.name) ||
        a.file.localeCompare(b.file),
    )
    .map(({ file, part }) => partNode(file, part));
}

/** An entity's row: the file itself when it is all there is, its parts and what it holds otherwise. */
function entityNode(
  id: string,
  entity: WorkspaceFileEntity,
  parts: PartNode[],
  held: WorkspaceFileNode[],
): WorkspaceFileNode | null {
  if (parts.length === 0 && held.length === 0) return null;
  if (parts.length === 1 && held.length === 0) return { type: 'entity', id, entity, file: parts[0].file, children: [] };
  return { type: 'entity', id, entity, children: [...parts, ...held] };
}

/** Every directory an entity of the workspace is at, and every entity's uid. */
function entitiesOf(workspace: ListedWorkspace): { dirs: Set<string>; uids: Set<string> } {
  const dirs = new Set<string>();
  const uids = new Set<string>();
  const hold = (entity: { uid: string; path: string }): void => {
    dirs.add(entity.path);
    uids.add(entity.uid);
  };
  const walk = (nodes: readonly CoreTreeNode[]): void => {
    for (const node of nodes) {
      hold(node);
      if (node.type === 'folder') walk(node.children);
    }
  };
  for (const collection of [
    ...workspace.ruleCollections,
    ...workspace.templateCollections,
    ...workspace.requestCollections,
  ]) {
    hold(collection);
    walk(collection.tree);
  }
  for (const item of [...workspace.specs, ...workspace.workflows, ...workspace.liveVariables]) hold(item);
  for (const environment of workspace.environments) uids.add(environment.uid);
  return { dirs, uids };
}

export function workspaceFileTree(
  paths: readonly string[],
  workspace: ListedWorkspace,
  former: FormerFiles = NO_FORMER_FILES,
): WorkspaceFileSection[] {
  const left = new Set(paths);
  const byDir = new Map<string, string[]>();
  for (const path of left) {
    const { dir } = split(path);
    const files = byDir.get(dir);
    if (files) files.push(path);
    else byDir.set(dir, [path]);
  }

  /** Where an entity was before a move: the directories no entity is at now, by the uid their name ends in. */
  const formerByUid = new Map<string, string[]>();
  const { dirs: at, uids: heldUids } = entitiesOf(workspace);
  for (const dir of byDir.keys()) {
    if (dir === '' || at.has(dir)) continue;
    const uid = uidOf(nameOf(dir));
    if (uid === null) continue;
    const dirs = formerByUid.get(uid);
    if (dirs) dirs.push(dir);
    else formerByUid.set(uid, [dir]);
  }

  /** A directory's listed files — taken, so no other row lists them. */
  const take = (dir: string): string[] => {
    const files = byDir.get(dir) ?? [];
    byDir.delete(dir);
    for (const file of files) left.delete(file);
    return files;
  };

  /** An entity's listed files: those in its directory, and in one it left by a move within its tree. */
  const claim = (entity: { uid: string; path: string }): PartNode[] => {
    const files = entity.path === '' ? [] : take(entity.path);
    for (const dir of formerByUid.get(entity.uid) ?? []) {
      if (rootOf(dir) === rootOf(entity.path)) files.push(...take(dir));
    }
    return partsOf(files);
  };

  /**
   * What the workspace no longer holds, by the row it goes under: the
   * deepest container of its chain the workspace still holds, else its
   * section. The containers below that one are former rows above it.
   */
  const formerRows = new Map<string, Map<string, FormerRow>>();
  for (const [path, file] of former) {
    const section = TREE_SECTIONS[rootOf(path)];
    if (section === undefined || !left.has(path) || heldUids.has(file.entity.uid)) continue;
    const chain = file.containers;
    let anchor = chain.length - 1;
    while (anchor >= 0 && !heldUids.has(chain[anchor].uid)) anchor -= 1;
    const key = anchor === -1 ? section : `${section}:${chain[anchor].uid}`;
    let rows = formerRows.get(key);
    if (rows === undefined) {
      rows = new Map();
      formerRows.set(key, rows);
    }
    let row: FormerRow | undefined;
    for (const was of [...chain.slice(anchor + 1), file.entity]) {
      row = rows.get(was.uid);
      if (row === undefined) {
        row = { was, dirs: new Set(), held: new Map() };
        rows.set(was.uid, row);
      }
      rows = row.held;
    }
    if (row === undefined) continue;
    row.dirs.add(split(path).dir);
    // Its own manifest's answer names it: across several commits that is the name it had last.
    if (ENTITY_MANIFEST_FILES.has(nameOf(path)) || section === 'environments') row.was = file.entity;
  }

  /** The former rows under a live container, or under the section itself. */
  const formerUnder = (section: WorkspaceFileSectionId, uid?: string): WorkspaceFileNode[] => {
    const emit = (rows: ReadonlyMap<string, FormerRow>): WorkspaceFileNode[] =>
      [...rows.values()]
        .sort((a, b) => a.was.name.localeCompare(b.was.name) || a.was.uid.localeCompare(b.was.uid))
        .flatMap((row) => {
          // An environment is files of one shared directory, told apart by the uid in their names.
          const parts =
            section === 'environments' ? environmentParts(row.was.uid) : partsOf([...row.dirs].flatMap(take));
          const built = entityNode(
            `${section}:${row.was.uid}`,
            { kind: 'former', was: row.was },
            parts,
            emit(row.held),
          );
          return built === null ? [] : [built];
        });
    return emit(formerRows.get(uid === undefined ? section : `${section}:${uid}`) ?? new Map());
  };

  const walk = (section: WorkspaceFileSectionId, nodes: readonly CoreTreeNode[]): WorkspaceFileNode[] => {
    const out: WorkspaceFileNode[] = [];
    for (const node of nodes) {
      const id = `${section}:${node.uid}`;
      const built =
        node.type === 'folder'
          ? entityNode(id, { kind: 'folder', uid: node.uid, name: node.name }, claim(node), [
              ...walk(section, node.children),
              ...formerUnder(section, node.uid),
            ])
          : entityNode(id, { kind: 'node', node }, claim(node), []);
      if (built !== null) out.push(built);
    }
    return out;
  };

  const collections = (section: WorkspaceFileSectionId, listed: readonly CollectionOfNodes[]): WorkspaceFileNode[] => {
    const out: WorkspaceFileNode[] = [];
    for (const collection of listed) {
      const built = entityNode(
        `${section}:${collection.uid}`,
        { kind: 'collection', uid: collection.uid, name: collection.name },
        claim(collection),
        [...walk(section, collection.tree), ...formerUnder(section, collection.uid)],
      );
      if (built !== null) out.push(built);
    }
    return [...out, ...formerUnder(section)];
  };

  const flat = (
    section: WorkspaceFileSectionId,
    kind: 'spec' | 'workflow' | 'live-variable',
    listed: readonly Listed[],
  ): WorkspaceFileNode[] => {
    const out: WorkspaceFileNode[] = [];
    for (const item of listed) {
      const built = entityNode(`${section}:${item.uid}`, { kind, uid: item.uid, name: item.name }, claim(item), []);
      if (built !== null) out.push(built);
    }
    return [...out, ...formerUnder(section)];
  };

  /**
   * An environment's files by its uid — its document under any name it
   * has had, then its secrets' names (the template), then their values.
   */
  const environmentFiles = (): Map<string, PartNode[]> => {
    const byUid = new Map<string, PartNode[]>();
    const files = (byDir.get(ENVIRONMENTS_DIR) ?? [])
      .flatMap((file) => {
        const name = nameOf(file);
        const held = environmentFile(name);
        const uid = held === null ? null : uidOf(held.stem);
        return held === null || uid === null ? [] : [{ file, name, part: held.part, uid }];
      })
      .sort(
        (a, b) => ENVIRONMENT_PARTS.indexOf(a.part) - ENVIRONMENT_PARTS.indexOf(b.part) || a.name.localeCompare(b.name),
      );
    for (const { file, part, uid } of files) {
      const node = partNode(file, part);
      const nodes = byUid.get(uid);
      if (nodes) nodes.push(node);
      else byUid.set(uid, [node]);
    }
    return byUid;
  };

  let environmentFilesByUid: Map<string, PartNode[]> | null = null;
  /** An environment's listed files — taken, so no other row lists them. */
  const environmentParts = (uid: string): PartNode[] => {
    environmentFilesByUid ??= environmentFiles();
    const parts = environmentFilesByUid.get(uid) ?? [];
    for (const part of parts) left.delete(part.file);
    return parts;
  };

  /** A page's row, when its file is listed. */
  const page = (kind: WorkspaceFilePage) => (): WorkspaceFileNode[] => {
    const file = PAGE_FILES[kind];
    if (!left.delete(file)) return [];
    return [{ type: 'entity', id: kind, entity: { kind }, file, children: [] }];
  };

  const nodesOf: Record<WorkspaceFileSectionId, () => WorkspaceFileNode[]> = {
    rules: () => collections('rules', workspace.ruleCollections),
    templates: () => collections('templates', workspace.templateCollections),
    requests: () => collections('requests', workspace.requestCollections),
    specs: () => flat('specs', 'spec', workspace.specs),
    workflows: () => flat('workflows', 'workflow', workspace.workflows),
    vault: page('vault'),
    'workspace-variables': page('workspace-variables'),
    workspace: page('workspace'),
    'trusted-roots': page('trusted-roots'),
    'live-variables': () => flat('live-variables', 'live-variable', workspace.liveVariables),
    environments: () => {
      const out: WorkspaceFileNode[] = [];
      for (const environment of workspace.environments) {
        const node = entityNode(
          `environments:${environment.uid}`,
          { kind: 'environment', uid: environment.uid, name: environment.name },
          environmentParts(environment.uid),
          [],
        );
        if (node !== null) out.push(node);
      }
      return [...out, ...formerUnder('environments')];
    },
    // Last: whatever no entity claimed, by directory.
    files: () => {
      const dirs = new Map<string, string[]>();
      for (const path of [...left].sort((a, b) => a.localeCompare(b))) {
        const { dir, name } = split(path);
        const names = dirs.get(dir);
        if (names) names.push(name);
        else dirs.set(dir, [name]);
      }
      const out: WorkspaceFileNode[] = [];
      for (const [dir, names] of dirs) {
        const files = names.map((name): WorkspaceFileNode => {
          const path = dir === '' ? name : `${dir}/${name}`;
          return { type: 'file', id: path, name, file: path };
        });
        if (dir === '') out.push(...files);
        else out.push({ type: 'directory', id: `dir:${dir}`, path: dir, children: files });
      }
      return out;
    },
  };

  const sections: WorkspaceFileSection[] = [];
  for (const [id, surface] of SECTIONS) {
    const nodes = nodesOf[id]();
    if (nodes.length > 0) sections.push({ id, surface, nodes });
  }
  return sections;
}

/** Every listed file in listing order, with what it belongs to. */
export function listedWorkspaceFiles(sections: readonly WorkspaceFileSection[]): ListedWorkspaceFile[] {
  const out: ListedWorkspaceFile[] = [];
  const visit = (
    surface: WorkspaceFileSurface,
    nodes: readonly WorkspaceFileNode[],
    owner: WorkspaceFileEntity | undefined,
  ): void => {
    for (const node of nodes) {
      if (node.type === 'entity') {
        if (node.file !== undefined) {
          out.push({ path: node.file, surface, entity: node.entity, name: nameOf(node.file) });
        }
        visit(surface, node.children, node.entity);
      } else if (node.type === 'directory') {
        visit(surface, node.children, undefined);
      } else if (node.type === 'part') {
        out.push({
          path: node.file,
          surface,
          ...(owner !== undefined ? { entity: owner } : {}),
          part: node.part,
          name: node.name,
        });
      } else {
        out.push({ path: node.file, surface, name: node.name });
      }
    }
  };
  for (const section of sections) visit(section.surface, section.nodes, undefined);
  return out;
}
