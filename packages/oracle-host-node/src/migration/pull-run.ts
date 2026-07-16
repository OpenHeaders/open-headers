/**
 * Node face of the host-neutral pull-run orchestrator
 * (`@openheaders/oracle/migration`): undici rides in as the default
 * fetch port, keeping the historical options shape for desktop callers
 * and the existing suites.
 */

import {
  createMigrationPullRunner as createMigrationPullRunnerNeutral,
  type MigrationPullRunner,
  type MigrationPullRunnerOptions as NeutralMigrationPullRunnerOptions,
  type PullFetchFn,
} from '@openheaders/oracle/migration';
import { nodePullFetch } from './node-pull-fetch';

export type { MigrationPullRunner, MigrationPullStartResult } from '@openheaders/oracle/migration';

export interface MigrationPullRunnerOptions extends Omit<NeutralMigrationPullRunnerOptions, 'fetchFn'> {
  fetchFn?: PullFetchFn;
}

export function createMigrationPullRunner(options: MigrationPullRunnerOptions): MigrationPullRunner {
  return createMigrationPullRunnerNeutral({ ...options, fetchFn: options.fetchFn ?? nodePullFetch });
}
