/**
 * Phase B Template — projector reads post-commit state for Template
 * envelopes; returns null for non-Template envelopes / deletes /
 * unknown ids. Mirrors request-post-state.
 */

import {
  addTemplateCondition,
  deleteTemplate,
  type MutationEnvelope,
  type MutatorContext,
  setTemplateField,
  TEMPLATE_CONDITIONS_PATH,
} from '@openheaders/core/sync';
import type { Template } from '@openheaders/core/types';
import { describe, expect, it } from 'vitest';
import { InMemoryBroadcast } from '@openheaders/oracle/sync/broadcast';
import { InMemoryMutationLog } from '@openheaders/oracle/sync/mutation-log';
import { type LockAcquirer, EntityOracle } from '@openheaders/oracle/sync/oracle';
import { InMemoryPendingIntents } from '@openheaders/oracle/sync/pending-intents';
import {
  projectTemplateByUid,
  projectTemplatePostState,
} from '@openheaders/oracle/sync/template-post-state';
import { seedTemplate } from '@openheaders/oracle/sync-builders/template-projection';

const wsId = 'ws-1';
const lock: LockAcquirer = async (_ws, _t, _id, fn) => fn();
const ctx = (ms: number): MutatorContext => ({
  workspaceId: wsId,
  hlc: { physicalMs: ms, logical: 0, nodeId: 'n0' },
  surfaceId: 's',
  deviceId: 'd',
});

const makeTemplate = (uid: string): Template =>
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
  }) as unknown as Template;

function newOracle(): EntityOracle {
  return new EntityOracle({
    workspaceId: wsId,
    lock,
    log: new InMemoryMutationLog(),
    intents: new InMemoryPendingIntents(),
    broadcast: new InMemoryBroadcast(),
  });
}

describe('projectTemplatePostState', () => {
  it('returns post-state for a Template envelope after seed + add condition', async () => {
    const oracle = newOracle();
    const tpl = makeTemplate('tp1');
    await oracle.apply(seedTemplate(tpl, ctx(1)), []);

    const intent = addTemplateCondition(ctx(2), {
      templateUid: 'tp1',
      condition: { uid: 'cnd00002', type: 'method', values: ['POST'] },
      itemId: 'c-method',
    });
    await oracle.apply(intent.batch, []);

    const env = intent.batch.mutations[0];
    const post = projectTemplatePostState(oracle, env);
    expect(post).not.toBeNull();
    expect(post?.template.conditions.length).toBe(2);
    expect(post?.setItemIds[TEMPLATE_CONDITIONS_PATH]).toContain('c-method');
  });

  it('returns null for non-Template envelopes', () => {
    const oracle = newOracle();
    const env: MutationEnvelope = {
      mutationId: 'm-1',
      hlc: { physicalMs: 1, logical: 0, nodeId: 'n0' },
      origin: { surfaceId: 's', deviceId: 'd' },
      workspaceId: wsId,
      mutatorVersion: 1,
      body: { kind: 'setField', type: 'rule', id: 'rule-x', path: 'name', value: 'x' },
    };
    expect(projectTemplatePostState(oracle, env)).toBeNull();
  });

  it('returns null for unknown template id', () => {
    const oracle = newOracle();
    expect(projectTemplateByUid(oracle, 'no-such-uid')).toBeNull();
  });

  it('returns null after the template is deleted (tombstone)', async () => {
    const oracle = newOracle();
    await oracle.apply(seedTemplate(makeTemplate('tp-del'), ctx(1)), []);
    await oracle.apply(deleteTemplate(ctx(2), { templateUid: 'tp-del' }).batch, []);
    expect(projectTemplateByUid(oracle, 'tp-del')).toBeNull();
  });

  it('omits conditions from setItemIds when empty', async () => {
    const oracle = newOracle();
    const tpl = makeTemplate('tp-empty');
    tpl.conditions = [];
    await oracle.apply(seedTemplate(tpl, ctx(1)), []);
    const post = projectTemplateByUid(oracle, 'tp-empty');
    expect(post?.setItemIds[TEMPLATE_CONDITIONS_PATH]).toBeUndefined();
  });

  it('reflects scalar setField on the template shape', async () => {
    const oracle = newOracle();
    await oracle.apply(seedTemplate(makeTemplate('tp-s'), ctx(1)), []);
    await oracle.apply(
      setTemplateField(ctx(2), { templateUid: 'tp-s', path: 'name', value: 'updated' }).batch,
      [],
    );
    const post = projectTemplateByUid(oracle, 'tp-s');
    expect(post?.template.name).toBe('updated');
  });
});
