/**
 * CollectionCrud — collection CRUD operations.
 *
 * Collections are top-level organizational containers. They don't
 * interact with source refresh, proxy, WebSocket, or environment
 * services. Only state + persistence + broadcast to renderers.
 */

import type { Collection, CollectionSection } from '@openheaders/core';
import { sendPatchToRenderers } from './StateBroadcaster';
import type { StateContext } from './types';

export async function addCollection(ctx: StateContext, data: Omit<Collection, 'id'>): Promise<Collection> {
  const newCollection: Collection = {
    ...data,
    id: `col-${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  ctx.state.collections.push(newCollection);
  ctx.dirty.collections = true;
  await ctx.saveCollections();
  sendPatchToRenderers(ctx.state, ['collections']);
  return newCollection;
}

export async function updateCollection(
  ctx: StateContext,
  collectionId: string,
  updates: Partial<Collection>,
): Promise<void> {
  ctx.state.collections = ctx.state.collections.map((c) => (c.id === collectionId ? { ...c, ...updates } : c));
  ctx.dirty.collections = true;
  ctx.scheduleDebouncedSave();
  sendPatchToRenderers(ctx.state, ['collections']);
}

export async function removeCollection(ctx: StateContext, collectionId: string): Promise<void> {
  const collection = ctx.state.collections.find((c) => c.id === collectionId);
  if (!collection) return;

  // Remove all folders belonging to this collection
  const hadFolders = ctx.state.folders.some((f) => f.collectionId === collectionId);
  if (hadFolders) {
    ctx.state.folders = ctx.state.folders.filter((f) => f.collectionId !== collectionId);
    ctx.dirty.folders = true;
  }

  // Remove sources belonging to this collection
  const hadSources = ctx.state.sources.some((s) => s.collectionId === collectionId);
  if (hadSources) {
    ctx.state.sources = ctx.state.sources.filter((s) => s.collectionId !== collectionId);
    ctx.dirty.sources = true;
  }

  // Remove rules belonging to this collection
  const hadRules = ctx.state.rules.header.some((r) => r.collectionId === collectionId);
  if (hadRules) {
    ctx.state.rules = {
      ...ctx.state.rules,
      header: ctx.state.rules.header.filter((r) => r.collectionId !== collectionId),
    };
    ctx.dirty.rules = true;
  }

  // Remove the collection
  ctx.state.collections = ctx.state.collections.filter((c) => c.id !== collectionId);
  ctx.dirty.collections = true;
  ctx.scheduleDebouncedSave();

  const changedKeys = ['collections'];
  if (hadFolders) changedKeys.push('folders');
  if (hadSources) changedKeys.push('sources');
  if (hadRules) changedKeys.push('rules');
  sendPatchToRenderers(ctx.state, changedKeys);
}
