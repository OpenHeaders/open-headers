/**
 * useCollectionMutator — write-only API for collection edits.
 *
 * Thin React adapter over `collection-write-client.ts`.
 */

import type { V5 } from '@openheaders/core/types';
import type { VariableType } from '@openheaders/core/sync';
import { useMemo } from 'react';
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
import { useGuardedMutation } from './use-guarded-mutation';

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

export function useCollectionMutator(opts: UseCollectionMutatorOptions): UseCollectionMutatorApi {
  const { workspaceId, surfaceId } = opts;

  const setVariable = useGuardedMutation(
    workspaceId,
    surfaceId,
    (writeOpts, collectionUid: string, name: string, value: string, type?: VariableType) =>
      applyCollectionSetVar({ collectionUid, name, value, type }, writeOpts),
  );

  const removeVariable = useGuardedMutation(
    workspaceId,
    surfaceId,
    (writeOpts, collectionUid: string, name: string) =>
      applyCollectionRemoveVar({ collectionUid, name }, writeOpts),
  );

  const renameVariable = useGuardedMutation(
    workspaceId,
    surfaceId,
    (
      writeOpts,
      collectionUid: string,
      oldName: string,
      newName: string,
      value: string,
      type?: VariableType,
    ) => applyCollectionRenameVar({ collectionUid, oldName, newName, value, type }, writeOpts),
  );

  const setVariableType = useGuardedMutation(
    workspaceId,
    surfaceId,
    (writeOpts, collectionUid: string, name: string, value: string, type: VariableType) =>
      applyCollectionSetVarType({ collectionUid, name, value, type }, writeOpts),
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
