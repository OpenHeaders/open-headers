/**
 * FolderCrud — folder CRUD operations.
 *
 * Folders are standalone organizational entities that don't interact
 * with source refresh, proxy, WebSocket, or environment services.
 * Only state + persistence + broadcast to renderers.
 */

import type { Folder } from '@openheaders/core';
import { sendPatchToRenderers } from './StateBroadcaster';
import type { StateContext } from './types';

export async function addFolder(ctx: StateContext, folderData: Omit<Folder, 'id'>): Promise<Folder> {
  const newFolder: Folder = {
    ...folderData,
    id: `f-${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  ctx.state.folders.push(newFolder);
  ctx.dirty.folders = true;
  await ctx.saveFolders();
  sendPatchToRenderers(ctx.state, ['folders']);
  return newFolder;
}

export async function updateFolder(ctx: StateContext, folderId: string, updates: Partial<Folder>): Promise<void> {
  ctx.state.folders = ctx.state.folders.map((f) => (f.id === folderId ? { ...f, ...updates } : f));
  ctx.dirty.folders = true;
  ctx.scheduleDebouncedSave();
  sendPatchToRenderers(ctx.state, ['folders']);
}

export async function removeFolder(ctx: StateContext, folderId: string): Promise<void> {
  // Collect all descendant folder IDs
  const allIds = new Set<string>([folderId]);
  const collectDescendants = (parentId: string) => {
    for (const f of ctx.state.folders) {
      if (f.parentFolderId === parentId && !allIds.has(f.id)) {
        allIds.add(f.id);
        collectDescendants(f.id);
      }
    }
  };
  collectDescendants(folderId);

  // Clear folderId on sources in deleted folders
  let sourcesChanged = false;
  ctx.state.sources = ctx.state.sources.map((s) => {
    if (s.folderId && allIds.has(s.folderId)) {
      sourcesChanged = true;
      return { ...s, folderId: undefined };
    }
    return s;
  });

  // Clear folderId on rules in deleted folders
  let rulesChanged = false;
  const updatedHeader = ctx.state.rules.header.map((r) => {
    if (r.folderId && allIds.has(r.folderId)) {
      rulesChanged = true;
      return { ...r, folderId: undefined };
    }
    return r;
  });
  if (rulesChanged) {
    ctx.state.rules = { ...ctx.state.rules, header: updatedHeader };
    ctx.dirty.rules = true;
  }

  // Remove folder definitions
  ctx.state.folders = ctx.state.folders.filter((f) => !allIds.has(f.id));
  ctx.dirty.folders = true;

  if (sourcesChanged) ctx.dirty.sources = true;

  ctx.scheduleDebouncedSave();

  const changedKeys = ['folders'];
  if (sourcesChanged) changedKeys.push('sources');
  if (rulesChanged) changedKeys.push('rules');
  sendPatchToRenderers(ctx.state, changedKeys);
}
