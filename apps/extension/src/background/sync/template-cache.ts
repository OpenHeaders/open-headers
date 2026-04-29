/**
 * Template cache + persistence sink.
 *
 * Mirrors {@link request-cache.ts}. Subscribes to the oracle's
 * broadcast bus, re-projects every template the oracle holds on every
 * committed envelope, and persists the projected `V5.Template[]` back
 * to `chrome.storage.local` under `wsKeys(ws).templates`.
 *
 * Hydration: `seedFromPersistedTemplates(templates)` walks each
 * persisted template, builds a `seedTemplate` batch via the projection,
 * and applies it through the oracle.
 */

import type { MaterializedEntity } from '@openheaders/core/sync';
import { TEMPLATE_ENTITY_TYPE } from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { logger } from '@utils/logger';
import { extensionStorage, wsKeys } from '@/shared/storage';
import type { BroadcastEvent, InMemoryBroadcast } from './broadcast';
import type { EntityOracle } from './oracle';
import { projectTemplate, seedTemplate } from '@/shared/sync/template-projection';
import type { SwMutatorContextFactory } from './sw-context';

export type TemplateCacheListener = () => void;

export interface TemplateCache {
  readonly workspaceId: string;
  /** Snapshot of the cached templates in stable (uid) order. */
  getTemplates(): V5.Template[];
  /** Replace the cache from a list of template snapshots and seed the
   *  oracle. Drives boot-time hydration and the workspace-switch path. */
  seedFromPersistedTemplates(templates: V5.Template[]): Promise<void>;
  /** Subscribe to cache changes — fires after every broadcast-driven
   *  re-projection. */
  onChange(listener: TemplateCacheListener): () => void;
  /** Drop the broadcast subscription. Idempotent. */
  dispose(): void;
}

export function createTemplateCache(
  workspaceId: string,
  oracle: EntityOracle,
  broadcast: InMemoryBroadcast,
  contextFactory: SwMutatorContextFactory,
): TemplateCache {
  let templates: V5.Template[] = [];
  const listeners = new Set<TemplateCacheListener>();

  const refreshFromOracle = (): void => {
    const next = projectAllTemplates(oracle.materializeAll());
    templates = next;
    void persist(workspaceId, next);
    for (const l of listeners) {
      try {
        l();
      } catch (err) {
        logger.info('TemplateCache', 'listener threw:', (err as Error).message);
      }
    }
  };

  const unsubscribe = broadcast.subscribe((event: BroadcastEvent) => {
    if (event.envelope.body.type !== TEMPLATE_ENTITY_TYPE) return;
    refreshFromOracle();
  });

  return {
    workspaceId,
    getTemplates: () => templates,

    async seedFromPersistedTemplates(persisted: V5.Template[]): Promise<void> {
      for (const template of persisted) {
        const batch = seedTemplate(template, contextFactory());
        const result = await oracle.apply(batch, []);
        if (!result.ok) {
          logger.info(
            'TemplateCache',
            `seed: template ${template.uid} failed (${result.failure?.status} — ${result.failure?.detail ?? 'no detail'})`,
          );
        }
      }
      refreshFromOracle();
      logger.info('TemplateCache', `Seeded ${persisted.length} templates for ws=${workspaceId}`);
    },

    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    dispose() {
      unsubscribe();
      listeners.clear();
    },
  };
}

// ── module-level singleton glue ───────────────────────────────────

let active: TemplateCache | null = null;

export function setActiveTemplateCache(cache: TemplateCache | null): void {
  active = cache;
}

export function getActiveTemplateCache(): TemplateCache | null {
  return active;
}

// ── helpers ───────────────────────────────────────────────────────

function projectAllTemplates(materialized: MaterializedEntity[]): V5.Template[] {
  const out: V5.Template[] = [];
  for (const m of materialized) {
    if (m.type !== TEMPLATE_ENTITY_TYPE) continue;
    const t = projectTemplate(m);
    if (t) out.push(t);
  }
  out.sort((a, b) => (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0));
  return out;
}

async function persist(workspaceId: string, templates: V5.Template[]): Promise<void> {
  try {
    await extensionStorage.set(wsKeys(workspaceId).templates, templates);
  } catch (err) {
    logger.info('TemplateCache', `persist failed (ws=${workspaceId}):`, (err as Error).message);
  }
}
