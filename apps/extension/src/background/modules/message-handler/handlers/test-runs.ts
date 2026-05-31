/** Test-run lifecycle RPCs. */

import {
  deleteAllTestRunsForOwner,
  deleteTestRunById,
  getTestRunById,
  listAllTestRuns,
  listTestRunsForOwner,
  type TestRunOwner,
  type TestRunOwnerType,
} from '@openheaders/oracle/test-run/test-run-store';
import { broadcast } from '@utils/bridge';
import { startRun } from '../../test-runner';
import type { HandlerMap } from '../types';

export const testRunHandlers: HandlerMap = {
  startTestRun: ({ message, respond }) => {
    const owner: TestRunOwner = {
      type: message.ownerType as TestRunOwnerType,
      id: message.ownerId as string,
    };
    const scopeLabel = (message.scopeLabel as string | undefined) ?? '';
    const ruleUids = (message.ruleUids as string[]) ?? [];
    const url = message.url as string;
    const waitSeconds = (message.waitSeconds as number) ?? 5;
    startRun({ owner, scopeLabel, ruleUids, url, waitSeconds })
      .then((result) => respond({ success: true, result }))
      .catch((error: Error) => respond({ success: false, error: error.message }));
    return true;
  },

  listTestRunsForOwner: ({ message, respond }) => {
    const owner: TestRunOwner = {
      type: message.ownerType as TestRunOwnerType,
      id: message.ownerId as string,
    };
    listTestRunsForOwner(owner)
      .then((runs) => respond({ success: true, runs }))
      .catch((error: Error) => respond({ success: false, error: error.message }));
    return true;
  },

  listAllTestRuns: ({ respond }) => {
    listAllTestRuns()
      .then((runs) => respond({ success: true, runs }))
      .catch((error: Error) => respond({ success: false, error: error.message }));
    return true;
  },

  getTestRun: ({ message, respond }) => {
    getTestRunById(message.runId as string)
      .then((run) => respond({ success: true, run }))
      .catch((error: Error) => respond({ success: false, error: error.message }));
    return true;
  },

  deleteTestRun: ({ message, respond }) => {
    deleteTestRunById(message.runId as string)
      .then(() => {
        broadcast('testRunDeleted', { runId: message.runId as string });
        respond({ success: true });
      })
      .catch((error: Error) => respond({ success: false, error: error.message }));
    return true;
  },

  deleteAllTestRunsForOwner: ({ message, respond }) => {
    const owner: TestRunOwner = {
      type: message.ownerType as TestRunOwnerType,
      id: message.ownerId as string,
    };
    deleteAllTestRunsForOwner(owner)
      .then(() => {
        broadcast('testRunsClearedForOwner', { ownerType: owner.type, ownerId: owner.id });
        respond({ success: true });
      })
      .catch((error: Error) => respond({ success: false, error: error.message }));
    return true;
  },
};
