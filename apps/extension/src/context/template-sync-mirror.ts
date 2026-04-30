/**
 * Renderer-side template sync mirror.
 *
 * Thin adapter over {@link createFlatEntityMirror}. Renderer write
 * helpers consult this mirror to read the canonical template shape
 * synchronously (§19.4) and to enumerate live `(itemId, orderKey)`
 * pairs at the set-modeled `conditions` path for the unified set-diff
 * synthesizer.
 */

import { TEMPLATE_ENTITY_TYPE } from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { call } from '@utils/bridge';
import {
  createFlatEntityMirror,
  type CreateFlatMirrorOptions,
} from './flat-entity-mirror';

export interface TemplateMirrorEntry {
  template: V5.Template;
  /** Map keyed by set path (e.g. `conditions`). */
  setItemIds: Record<string, string[]>;
  /** Per-set ordered `(itemId, orderKey)` pairs for synthesizer-driven writes. */
  setOrderKeys: Record<string, Array<{ itemId: string; orderKey: string }>>;
}

export type TemplateMirrorListener = (uid: string) => void;

export interface TemplateSyncMirror {
  getTemplateMirror(uid: string): TemplateMirrorEntry | null;
  listTemplates(): V5.Template[];
  liveSetItems(uid: string, setPath: string): string[];
  liveOrderedSetItems(uid: string, setPath: string): Array<{ itemId: string; orderKey: string }>;
  subscribeTemplateMirror(uid: string, listener: TemplateMirrorListener): () => void;
  subscribeAny(listener: TemplateMirrorListener): () => void;
  dispose(): void;
}

export type CreateTemplateSyncMirrorOptions = CreateFlatMirrorOptions;

export function createTemplateSyncMirror(
  options: CreateTemplateSyncMirrorOptions = {},
): TemplateSyncMirror {
  const core = createFlatEntityMirror<TemplateMirrorEntry>(
    {
      loggerTag: 'TemplateSyncMirror',
      extractFromBroadcast: (event) => {
        const { envelope, templatePostState } = event;
        if (!templatePostState && envelope.body.type !== TEMPLATE_ENTITY_TYPE) return null;
        const uid = envelope.body.id;
        if (!templatePostState) return { uid, entry: null };
        return {
          uid,
          entry: {
            template: templatePostState.template,
            setItemIds: templatePostState.setItemIds,
            setOrderKeys: templatePostState.setOrderKeys,
          },
        };
      },
      fetchSnapshot: async () => {
        const resp = await call('oh.sync.snapshotTemplates');
        return resp.entries.map((e) => ({
          uid: e.template.uid,
          entry: {
            template: e.template,
            setItemIds: e.setItemIds,
            setOrderKeys: e.setOrderKeys,
          },
        }));
      },
    },
    options,
  );
  return {
    getTemplateMirror: core.get,
    listTemplates: () =>
      core
        .list()
        .map((e) => e.template)
        .sort((a, b) => (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0)),
    liveSetItems: (uid, setPath) => core.get(uid)?.setItemIds[setPath] ?? [],
    liveOrderedSetItems: (uid, setPath) => core.get(uid)?.setOrderKeys[setPath] ?? [],
    subscribeTemplateMirror: core.subscribe,
    subscribeAny: core.subscribeAny,
    dispose: core.dispose,
  };
}

let active: TemplateSyncMirror | null = null;

export function getActiveTemplateSyncMirror(): TemplateSyncMirror {
  if (!active) active = createTemplateSyncMirror();
  return active;
}

export function disposeActiveTemplateSyncMirror(): void {
  if (!active) return;
  active.dispose();
  active = null;
}
