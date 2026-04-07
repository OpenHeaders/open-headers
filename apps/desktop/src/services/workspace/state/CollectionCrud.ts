/**
 * CollectionCrud — collection CRUD operations.
 *
 * Collections organize requests or rules. They map to directories
 * on disk with _collection.yaml markers.
 */

import type { V5 } from '@openheaders/core/types';
import { sendPatchToRenderers } from './StateBroadcaster';
import type { StateContext } from './types';

function generateUid(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let uid = '';
  for (let i = 0; i < 4; i++) {
    uid += chars[Math.floor(Math.random() * chars.length)];
  }
  return uid;
}

export async function addCollection(
  ctx: StateContext,
  section: 'requests' | 'rules',
  data: Omit<V5.Collection, 'uid' | 'path'>,
): Promise<V5.Collection> {
  const uid = generateUid();
  const slug = data.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const folderName = slug ? `${slug}-${uid}` : uid;

  const newCollection: V5.Collection = {
    ...data,
    uid,
    path: `${section}/${folderName}`,
  };

  const target = section === 'requests' ? ctx.state.requestCollections : ctx.state.ruleCollections;
  target.push({ ...newCollection, tree: [] });

  const dirtyKey = section === 'requests' ? 'requestCollections' : 'ruleCollections';
  ctx.dirty[dirtyKey] = true;
  ctx.scheduleDebouncedSave();
  sendPatchToRenderers(ctx.state, [dirtyKey]);
  return newCollection;
}

export async function updateCollection(
  ctx: StateContext,
  section: 'requests' | 'rules',
  collectionUid: string,
  updates: Partial<V5.Collection>,
): Promise<void> {
  const target = section === 'requests' ? ctx.state.requestCollections : ctx.state.ruleCollections;
  const idx = target.findIndex((c) => c.uid === collectionUid);
  if (idx === -1) return;

  target[idx] = { ...target[idx], ...updates };
  const dirtyKey = section === 'requests' ? 'requestCollections' : 'ruleCollections';
  ctx.dirty[dirtyKey] = true;
  ctx.scheduleDebouncedSave();
  sendPatchToRenderers(ctx.state, [dirtyKey]);
}

export async function removeCollection(
  ctx: StateContext,
  section: 'requests' | 'rules',
  collectionUid: string,
): Promise<void> {
  if (section === 'requests') {
    ctx.state.requestCollections = ctx.state.requestCollections.filter((c) => c.uid !== collectionUid);
    ctx.dirty.requestCollections = true;
  } else {
    ctx.state.ruleCollections = ctx.state.ruleCollections.filter((c) => c.uid !== collectionUid);
    ctx.dirty.ruleCollections = true;
  }

  ctx.scheduleDebouncedSave();
  const dirtyKey = section === 'requests' ? 'requestCollections' : 'ruleCollections';
  sendPatchToRenderers(ctx.state, [dirtyKey]);
}
