/**
 * Phase B Template — template cache subscribes to broadcast,
 * re-projects, persists to chrome.storage.local. Mirrors
 * request-cache's contract.
 */

import {
  addTemplateCondition,
  deleteTemplate,
  setTemplateField,
  TEMPLATE_ENTITY_TYPE,
} from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryBroadcast } from '@/background/sync/broadcast';
import { InMemoryMutationLog } from '@/background/sync/mutation-log';
import { type LockAcquirer, EntityOracle } from '@/background/sync/oracle';
import { InMemoryPendingIntents } from '@/background/sync/pending-intents';
import { createTemplateCache } from '@/background/sync/template-cache';

const lock: LockAcquirer = async (_ws, _t, _id, fn) => fn();

const makeTemplate = (uid: string, overrides: Partial<V5.Template> = {}): V5.Template =>
  ({
    schemaVersion: 5,
    uid,
    path: `templates/col-1/tpl-${uid}`,
    name: `tpl-${uid}`,
    ruleType: 'header',
    icon: '',
    description: '',
    includes: { conditions: true, formValues: true },
    conditions: [{ uid: 'cnd00001', type: 'urlContains', values: ['openheaders.io'] }],
    formValues: {},
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }) as unknown as V5.Template;

let hlcCounter = 0;
const ctxFactory = () => {
  hlcCounter += 1;
  return {
    workspaceId: 'ws-1',
    hlc: { physicalMs: 1_000 + hlcCounter, logical: 0, nodeId: 'n0' },
    surfaceId: 's',
    deviceId: 'd',
  };
};

let oracle: EntityOracle;
let broadcast: InMemoryBroadcast;

beforeEach(() => {
  hlcCounter = 0;
  broadcast = new InMemoryBroadcast();
  oracle = new EntityOracle({
    workspaceId: 'ws-1',
    lock,
    log: new InMemoryMutationLog(),
    intents: new InMemoryPendingIntents(),
    broadcast,
  });
});

describe('TemplateCache', () => {
  it('seeds templates + projects them with conditions as an array', async () => {
    const cache = createTemplateCache('ws-1', oracle, broadcast, ctxFactory);
    await cache.seedFromPersistedTemplates([makeTemplate('a'), makeTemplate('b')]);
    const templates = cache.getTemplates();
    expect(templates.map((t) => t.uid).sort()).toEqual(['a', 'b']);
    const a = templates.find((t) => t.uid === 'a');
    expect(a?.conditions).toEqual([{ uid: 'cnd00001', type: 'urlContains', values: ['openheaders.io'] }]);
    cache.dispose();
  });

  it('refreshes when a condition is added through the catalog', async () => {
    const cache = createTemplateCache('ws-1', oracle, broadcast, ctxFactory);
    await cache.seedFromPersistedTemplates([makeTemplate('tp')]);
    const intent = addTemplateCondition(ctxFactory(), {
      templateUid: 'tp',
      condition: { type: 'method', values: ['GET'] },
    });
    await oracle.apply(intent.batch, []);
    expect(cache.getTemplates()[0].conditions.length).toBe(2);
    cache.dispose();
  });

  it('reflects scalar setField on name', async () => {
    const cache = createTemplateCache('ws-1', oracle, broadcast, ctxFactory);
    await cache.seedFromPersistedTemplates([makeTemplate('tp')]);
    await oracle.apply(
      setTemplateField(ctxFactory(), { templateUid: 'tp', path: 'name', value: 'updated' }).batch,
      [],
    );
    expect(cache.getTemplates()[0].name).toBe('updated');
    cache.dispose();
  });

  it('drops a template after delete (tombstone wins)', async () => {
    const cache = createTemplateCache('ws-1', oracle, broadcast, ctxFactory);
    await cache.seedFromPersistedTemplates([makeTemplate('tp'), makeTemplate('alt')]);
    await oracle.apply(deleteTemplate(ctxFactory(), { templateUid: 'tp' }).batch, []);
    expect(cache.getTemplates().map((t) => t.uid)).toEqual(['alt']);
    cache.dispose();
  });

  it('notifies listeners on cache change', async () => {
    const cache = createTemplateCache('ws-1', oracle, broadcast, ctxFactory);
    let fires = 0;
    cache.onChange(() => {
      fires += 1;
    });
    await cache.seedFromPersistedTemplates([makeTemplate('tp')]);
    const before = fires;
    await oracle.apply(
      setTemplateField(ctxFactory(), { templateUid: 'tp', path: 'name', value: 'b' }).batch,
      [],
    );
    expect(fires).toBeGreaterThan(before);
    cache.dispose();
  });

  it('dispose drops the broadcast subscription', async () => {
    const cache = createTemplateCache('ws-1', oracle, broadcast, ctxFactory);
    await cache.seedFromPersistedTemplates([makeTemplate('tp')]);
    cache.dispose();
    await oracle.apply(
      setTemplateField(ctxFactory(), { templateUid: 'tp', path: 'name', value: 'after' }).batch,
      [],
    );
    expect(cache.getTemplates()[0].name).toBe('tpl-tp');
  });

  it('only emits the template shape, ignoring non-template entities', async () => {
    const cache = createTemplateCache('ws-1', oracle, broadcast, ctxFactory);
    await cache.seedFromPersistedTemplates([makeTemplate('tp')]);
    broadcast.publish({
      envelope: {
        mutationId: 'm-x',
        hlc: { physicalMs: 9_000, logical: 0, nodeId: 'n0' },
        origin: { surfaceId: 's', deviceId: 'd' },
        workspaceId: 'ws-1',
        mutatorVersion: 1,
        body: { kind: 'setField', type: 'rule', id: 'rule-x', path: 'name', value: 'foreign' },
      },
      outcome: { status: 'applied' },
    });
    const templates = cache.getTemplates();
    expect(templates).toHaveLength(1);
    expect(templates[0].uid).toBe('tp');
    void TEMPLATE_ENTITY_TYPE;
    cache.dispose();
  });
});
