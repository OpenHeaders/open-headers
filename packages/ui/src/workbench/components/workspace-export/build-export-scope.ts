import type { ExportSelection } from '@openheaders/core/types';
import { slugify } from '@openheaders/core/utils';
import type { ExportModalScope } from './ExportModal';

// ── Sidebar "Export…" — single callback shape for every entity type ─

/**
 * Argument shape for the sidebar's `onExportEntity` callback. The kind
 * decides whether the SW gatherer treats the uid as a literal pick (leaf
 * entities) or as an expander (collections / folders pull descendants
 * and parent containers).
 */
export type SidebarExportEntity =
  | {
      kind: 'rule' | 'request' | 'template' | 'environment' | 'liveWorkflow' | 'liveVariable';
      uid: string;
      name: string;
    }
  | { kind: 'collection' | 'folder'; uid: string; name: string };

/**
 * Translate a sidebar entity ref into the modal-level `ExportModalScope`.
 * Centralized here so every tree-nodes hook just yells "export this thing"
 * and the wiring around filename slugs / preview labels lives in one place.
 */
export function buildEntityExportScope(entity: SidebarExportEntity): ExportModalScope {
  const slug = slugify(entity.name) || 'untitled';
  switch (entity.kind) {
    case 'rule':
      return {
        kind: 'selection',
        label: `Rule — ${entity.name}`,
        slug: `rule-${slug}`,
        selection: { rules: [entity.uid] },
      };
    case 'request':
      return {
        kind: 'selection',
        label: `Request — ${entity.name}`,
        slug: `request-${slug}`,
        selection: { requests: [entity.uid] },
      };
    case 'template':
      return {
        kind: 'selection',
        label: `Template — ${entity.name}`,
        slug: `template-${slug}`,
        selection: { templates: [entity.uid] },
      };
    case 'environment':
      return {
        kind: 'selection',
        label: `Environment — ${entity.name}`,
        slug: `env-${slug}`,
        selection: { environments: [entity.uid] },
      };
    case 'liveWorkflow':
      return {
        kind: 'selection',
        label: `Live workflow — ${entity.name}`,
        slug: `workflow-${slug}`,
        selection: { liveWorkflows: [entity.uid] },
      };
    case 'liveVariable':
      return {
        kind: 'selection',
        label: `Live variable — ${entity.name}`,
        slug: `live-var-${slug}`,
        selection: { liveVariables: [entity.uid] },
      };
    case 'collection':
      return {
        kind: 'selection',
        label: `Collection — ${entity.name}`,
        slug: `collection-${slug}`,
        selection: { collections: [entity.uid] },
      };
    case 'folder':
      return {
        kind: 'selection',
        label: `Folder — ${entity.name}`,
        slug: `folder-${slug}`,
        selection: { folders: [entity.uid] },
      };
  }
}

/**
 * Aggregate a multi-select set of sidebar entities into a single
 * `selection` scope. Per-type uid lists fall out naturally — the gatherer
 * already accepts heterogeneous picks (rules + collections + envs in one
 * call) and auto-expands collections/folders to descendants. Label and
 * slug summarize the mix; the underlying envelope is the same one-file
 * shape (design §1.2 — one format, three callers).
 */
export function buildSelectionExportScope(entities: SidebarExportEntity[]): ExportModalScope {
  const sel: ExportSelection = {};
  const pushUid = (key: keyof typeof sel, uid: string) => {
    const arr = (sel[key] as string[] | undefined) ?? [];
    if (!arr.includes(uid)) arr.push(uid);
    (sel[key] as string[]) = arr;
  };
  for (const e of entities) {
    switch (e.kind) {
      case 'rule':
        pushUid('rules', e.uid);
        break;
      case 'request':
        pushUid('requests', e.uid);
        break;
      case 'template':
        pushUid('templates', e.uid);
        break;
      case 'environment':
        pushUid('environments', e.uid);
        break;
      case 'liveWorkflow':
        pushUid('liveWorkflows', e.uid);
        break;
      case 'liveVariable':
        pushUid('liveVariables', e.uid);
        break;
      case 'collection':
        pushUid('collections', e.uid);
        break;
      case 'folder':
        pushUid('folders', e.uid);
        break;
    }
  }
  const total = entities.length;
  const label = total === 1 ? `Selection — ${entities[0]!.name}` : `Selection — ${total} items`;
  const slug = `selection-${total}`;
  return { kind: 'selection', label, slug, selection: sel };
}
