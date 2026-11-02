/**
 * runEntityAtPath — the Jump to Source read: the entity a tree path
 * belongs to, resolved from the WORKING tree. Core classifies the
 * path; this half reads the manifest it names — the file itself, or
 * for a sibling each candidate manifest of its directory in turn —
 * and hands core's parse the YAML. Pure read, no git involved.
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { classifyTreePath, entityRefOfManifest } from '@openheaders/core/workspace-tree';
import { isSafeTreePath } from '../../git/repo';
import type { RuntimeCtx } from './core';
import type { WorkspaceTreeEntityAtPathRpcResult } from './types';

export async function runEntityAtPath(
  ctx: RuntimeCtx,
  workspaceId: string,
  filePath: string,
): Promise<WorkspaceTreeEntityAtPathRpcResult> {
  const binding = ctx.open.get(workspaceId);
  if (!binding) return { ok: false, reason: 'not-bound' };
  if (!isSafeTreePath(filePath)) return { ok: false, reason: 'unknown-path' };
  const classified = classifyTreePath(filePath);
  if (classified.kind === 'none') return { ok: false, reason: 'not-an-entity' };
  const candidates = classified.kind === 'manifest' ? [classified.candidate] : classified.candidates;
  for (const candidate of candidates) {
    let yaml: string;
    try {
      yaml = await fs.readFile(path.join(binding.record.rootDir, candidate.manifestPath), 'utf8');
    } catch {
      continue;
    }
    const entity = entityRefOfManifest(candidate, yaml);
    if (entity !== null) return { ok: true, entity };
  }
  return { ok: false, reason: 'not-an-entity' };
}
