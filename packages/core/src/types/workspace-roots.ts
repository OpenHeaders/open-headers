import type * as v from 'valibot';
import type { WorkspaceRootsSchema } from '../schemas/workspace-roots';

export type WorkspaceRoots = v.InferOutput<typeof WorkspaceRootsSchema>;

export const EMPTY_WORKSPACE_ROOTS: WorkspaceRoots = {
  schemaVersion: 5,
  ruleCollections: [],
  requestCollections: [],
  templateCollections: [],
};
