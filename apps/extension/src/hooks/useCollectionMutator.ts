/**
 * useCollectionMutator — write-only API for collection edits.
 *
 * Thin React adapter over the imperative helpers in
 * `collection-write-client.ts`. Mirrors `useEnvironmentMutator`.
 */

import type { V5 } from '@openheaders/core/types';
import type { VariableType } from '@openheaders/core/sync';
import { useCallback, useMemo } from 'react';
import {
  applyCollectionRemoveVar,
  applyCollectionRenameVar,
  applyCollectionSetVar,
  applyCollectionSetVarType,
  applyCollectionVariablesReplacement,
  applyRenameCollection,
  applySetDefaultEnvironmentId,
  applySetPinnedAndDefault,
  applySetPinnedEnvironments,
  type CollectionSimpleResult,
} from '@/shared/sync/collection-write-client';

export type { CollectionSimpleResult };

export interface UseCollectionMutatorOptions {
  workspaceId: string | null;
  surfaceId: string;
}

export interface UseCollectionMutatorApi {
  setVariable(
    collectionUid: string,
    name: string,
    value: string,
    type?: VariableType,
  ): Promise<CollectionSimpleResult>;
  removeVariable(collectionUid: string, name: string): Promise<CollectionSimpleResult>;
  renameVariable(
    collectionUid: string,
    oldName: string,
    newName: string,
    value: string,
    type?: VariableType,
  ): Promise<CollectionSimpleResult>;
  setVariableType(
    collectionUid: string,
    name: string,
    value: string,
    type: VariableType,
  ): Promise<CollectionSimpleResult>;
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

const NO_WORKSPACE = { ok: false, reason: 'other', message: 'no active workspace' } as const;

export function useCollectionMutator(opts: UseCollectionMutatorOptions): UseCollectionMutatorApi {
  const { workspaceId, surfaceId } = opts;

  const setVariable = useCallback<UseCollectionMutatorApi['setVariable']>(
    async (collectionUid, name, value, type) => {
      if (!workspaceId) return NO_WORKSPACE;
      return applyCollectionSetVar({ collectionUid, name, value, type }, { workspaceId, surfaceId });
    },
    [workspaceId, surfaceId],
  );

  const removeVariable = useCallback<UseCollectionMutatorApi['removeVariable']>(
    async (collectionUid, name) => {
      if (!workspaceId) return NO_WORKSPACE;
      return applyCollectionRemoveVar({ collectionUid, name }, { workspaceId, surfaceId });
    },
    [workspaceId, surfaceId],
  );

  const renameVariable = useCallback<UseCollectionMutatorApi['renameVariable']>(
    async (collectionUid, oldName, newName, value, type) => {
      if (!workspaceId) return NO_WORKSPACE;
      return applyCollectionRenameVar(
        { collectionUid, oldName, newName, value, type },
        { workspaceId, surfaceId },
      );
    },
    [workspaceId, surfaceId],
  );

  const setVariableType = useCallback<UseCollectionMutatorApi['setVariableType']>(
    async (collectionUid, name, value, type) => {
      if (!workspaceId) return NO_WORKSPACE;
      return applyCollectionSetVarType(
        { collectionUid, name, value, type },
        { workspaceId, surfaceId },
      );
    },
    [workspaceId, surfaceId],
  );

  const renameCollection = useCallback<UseCollectionMutatorApi['renameCollection']>(
    async (collectionUid, name) => {
      if (!workspaceId) return NO_WORKSPACE;
      return applyRenameCollection({ collectionUid, name }, { workspaceId, surfaceId });
    },
    [workspaceId, surfaceId],
  );

  const setPinnedEnvironments = useCallback<UseCollectionMutatorApi['setPinnedEnvironments']>(
    async (collectionUid, pinnedEnvironmentIds) => {
      if (!workspaceId) return NO_WORKSPACE;
      return applySetPinnedEnvironments(
        { collectionUid, pinnedEnvironmentIds },
        { workspaceId, surfaceId },
      );
    },
    [workspaceId, surfaceId],
  );

  const setDefaultEnvironmentId = useCallback<UseCollectionMutatorApi['setDefaultEnvironmentId']>(
    async (collectionUid, defaultEnvironmentId) => {
      if (!workspaceId) return NO_WORKSPACE;
      return applySetDefaultEnvironmentId(
        { collectionUid, defaultEnvironmentId },
        { workspaceId, surfaceId },
      );
    },
    [workspaceId, surfaceId],
  );

  const setPinnedAndDefault = useCallback<UseCollectionMutatorApi['setPinnedAndDefault']>(
    async (collectionUid, pinnedEnvironmentIds, defaultEnvironmentId) => {
      if (!workspaceId) return NO_WORKSPACE;
      return applySetPinnedAndDefault(
        { collectionUid, pinnedEnvironmentIds, defaultEnvironmentId },
        { workspaceId, surfaceId },
      );
    },
    [workspaceId, surfaceId],
  );

  const replaceVariables = useCallback<UseCollectionMutatorApi['replaceVariables']>(
    async (collectionUid, newVars, oldVars) => {
      if (!workspaceId) return NO_WORKSPACE;
      return applyCollectionVariablesReplacement(collectionUid, newVars, oldVars, {
        workspaceId,
        surfaceId,
      });
    },
    [workspaceId, surfaceId],
  );

  return useMemo(
    () => ({
      setVariable,
      removeVariable,
      renameVariable,
      setVariableType,
      renameCollection,
      setPinnedEnvironments,
      setDefaultEnvironmentId,
      setPinnedAndDefault,
      replaceVariables,
    }),
    [
      setVariable,
      removeVariable,
      renameVariable,
      setVariableType,
      renameCollection,
      setPinnedEnvironments,
      setDefaultEnvironmentId,
      setPinnedAndDefault,
      replaceVariables,
    ],
  );
}
