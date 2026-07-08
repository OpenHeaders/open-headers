/** Environment / workspace-variable / vault RPCs. */

import type { Variable } from '@openheaders/core/types';
import {
  createEnvironment,
  deleteEnvironment,
  getActiveEnvironmentId,
  getCollectionEnvOverrides,
  getDefaultEnvironmentId,
  getEnvironments,
  getManualEnvId,
  getVault,
  getWorkspaceVariables,
  isVaultLocked,
  renameEnvironment,
  updateEnvironmentVariables,
} from '@openheaders/oracle/entity/environment-store';
import { updateCollectionPinnedEnvs } from '@openheaders/oracle/entity/rule-store';
import type { HandlerMap } from '../types';

export const environmentHandlers: HandlerMap = {
  listEnvironments: ({ respond }) => {
    respond({
      environments: getEnvironments(),
      activeEnvironmentId: getActiveEnvironmentId(),
      defaultEnvironmentId: getDefaultEnvironmentId(),
      collectionEnvOverrides: getCollectionEnvOverrides(),
      manualEnvId: getManualEnvId(),
    });
  },

  createEnvironment: ({ message, respond }) => {
    const name = message.name as string;
    const variables = (message.variables as Variable[] | undefined) ?? [];
    const environment = createEnvironment(name, variables);
    respond({ success: true, environment });
  },

  renameEnvironment: ({ message, respond }) => {
    renameEnvironment(message.uid as string, message.name as string)
      .then((result) => respond(result))
      .catch((err: Error) => respond({ ok: false, reason: 'other', message: err.message }));
    return true;
  },

  updateEnvironmentVariables: ({ message, respond }) => {
    updateEnvironmentVariables(message.uid as string, message.variables as Variable[])
      .then((result) => respond(result))
      .catch((err: Error) => respond({ ok: false, reason: 'other', message: err.message }));
    return true;
  },

  deleteEnvironment: ({ message, respond }) => {
    deleteEnvironment(message.uid as string)
      .then((success) => respond({ success }))
      .catch((err: Error) => respond({ success: false, error: err.message }));
    return true;
  },

  setCollectionPinnedEnvs: ({ message, respond }) => {
    const collectionUid = message.collectionUid as string;
    const pinnedEnvironmentIds = message.pinnedEnvironmentIds as string[];
    const defaultEnvironmentId = message.defaultEnvironmentId as string | null;
    updateCollectionPinnedEnvs(collectionUid, pinnedEnvironmentIds, defaultEnvironmentId)
      .then((ok) => respond({ success: ok }))
      .catch((error: Error) => respond({ success: false, error: error.message }));
    return true;
  },

  getWorkspaceVariables: ({ respond }) => {
    respond({ workspaceVariables: getWorkspaceVariables() });
  },

  getVault: ({ respond }) => {
    respond({ vault: getVault(), vaultLocked: isVaultLocked() });
  },
};
