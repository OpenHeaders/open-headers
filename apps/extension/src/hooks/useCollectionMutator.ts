/**
 * useCollectionMutator — write-only API for collection edits.
 *
 * Thin React adapter over `collection-write-client.ts`. Identity for
 * variable rows is `variable.uid`; `setVariable` upserts the whole
 * record (handles add, edit, rename, type-toggle uniformly),
 * `removeVariable` keys by uid.
 */

import type { V5 } from '@openheaders/core/types';
import { useMemo } from 'react';
import {
  applyCollectionRemoveVar,
  applyCollectionSetVar,
  applyCollectionVariablesReplacement,
  applyRenameCollection,
  applySetDefaultEnvironmentId,
  applySetPinnedAndDefault,
  applySetPinnedEnvironments,
  type CollectionSimpleResult,
} from '@/shared/sync/collection-write-client';
import { useGuardedMutation } from './use-guarded-mutation';

export type { CollectionSimpleResult };

export interface UseCollectionMutatorOptions {
  workspaceId: string | null;
  surfaceId: string;
}

export interface UseCollectionMutatorApi {
  /** Upsert a variable row — handles add, edit, rename, type-toggle. */
  setVariable(collectionUid: string, variable: V5.Variable): Promise<CollectionSimpleResult>;
  /** Remove a variable row by its persisted uid. */
  removeVariable(collectionUid: string, uid: string): Promise<CollectionSimpleResult>;
  renameCollection(collectionUid: string, name: string): Promise<CollectionSimpleResult>;
  setPinnedEnvironments(
    collectionUid: string,
    pinnedEnvironmentIds: readonly string[],
  ): Promise<CollectionSimpleResult>;
  setDefaultEnvironmentId(
    collectionUid: string,
    defaultEnvironmentId: string | null,
  ): Promise<CollectionSimpleResult>;
  setPinnedAndDefault(
    collectionUid: string,
    pinnedEnvironmentIds: readonly string[],
    defaultEnvironmentId: string | null,
  ): Promise<CollectionSimpleResult>;
  replaceVariables(
    collectionUid: string,
    newVars: readonly V5.Variable[],
    oldVars: readonly V5.Variable[],
  ): Promise<CollectionSimpleResult>;
}

export function useCollectionMutator(opts: UseCollectionMutatorOptions): UseCollectionMutatorApi {
  const { workspaceId, surfaceId } = opts;

  const setVariable = useGuardedMutation(
    workspaceId,
    surfaceId,
    (writeOpts, collectionUid: string, variable: V5.Variable) =>
      applyCollectionSetVar({ collectionUid, variable }, writeOpts),
  );

  const removeVariable = useGuardedMutation(
    workspaceId,
    surfaceId,
    (writeOpts, collectionUid: string, uid: string) =>
      applyCollectionRemoveVar({ collectionUid, uid }, writeOpts),
  );

  const renameCollection = useGuardedMutation(
    workspaceId,
    surfaceId,
    (writeOpts, collectionUid: string, name: string) =>
      applyRenameCollection({ collectionUid, name }, writeOpts),
  );

  const setPinnedEnvironments = useGuardedMutation(
    workspaceId,
    surfaceId,
    (writeOpts, collectionUid: string, pinnedEnvironmentIds: readonly string[]) =>
      applySetPinnedEnvironments({ collectionUid, pinnedEnvironmentIds }, writeOpts),
  );

  const setDefaultEnvironmentId = useGuardedMutation(
    workspaceId,
    surfaceId,
    (writeOpts, collectionUid: string, defaultEnvironmentId: string | null) =>
      applySetDefaultEnvironmentId({ collectionUid, defaultEnvironmentId }, writeOpts),
  );

  const setPinnedAndDefault = useGuardedMutation(
    workspaceId,
    surfaceId,
    (
      writeOpts,
      collectionUid: string,
      pinnedEnvironmentIds: readonly string[],
      defaultEnvironmentId: string | null,
    ) =>
      applySetPinnedAndDefault(
        { collectionUid, pinnedEnvironmentIds, defaultEnvironmentId },
        writeOpts,
      ),
  );

  const replaceVariables = useGuardedMutation(
    workspaceId,
    surfaceId,
    (
      writeOpts,
      collectionUid: string,
      newVars: readonly V5.Variable[],
      oldVars: readonly V5.Variable[],
    ) => applyCollectionVariablesReplacement(collectionUid, newVars, oldVars, writeOpts),
  );

  return useMemo(
    () => ({
      setVariable,
      removeVariable,
      renameCollection,
      setPinnedEnvironments,
      setDefaultEnvironmentId,
      setPinnedAndDefault,
      replaceVariables,
    }),
    [
      setVariable,
      removeVariable,
      renameCollection,
      setPinnedEnvironments,
      setDefaultEnvironmentId,
      setPinnedAndDefault,
      replaceVariables,
    ],
  );
}
