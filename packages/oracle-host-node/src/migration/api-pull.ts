/**
 * Node face of the host-neutral Data API puller
 * (`@openheaders/oracle/migration`): the same pipeline with undici as
 * the default fetch port, keeping the historical optional-`fetchFn`
 * signature for desktop callers and the existing suites.
 */

import type { PostmanPullResult, PostmanWorkspaceListResult } from '@openheaders/core/import';
import {
  listPostmanWorkspaces as listPostmanWorkspacesNeutral,
  type ListPostmanWorkspacesOptions as NeutralListPostmanWorkspacesOptions,
  type PullPostmanDataOptions as NeutralPullPostmanDataOptions,
  type PullFetchFn,
  pullPostmanData as pullPostmanDataNeutral,
} from '@openheaders/oracle/migration';
import { nodePullFetch } from './node-pull-fetch';

export type { PullFetchFn, PullHttpResponse, SleepFn } from '@openheaders/oracle/migration';

export interface PullPostmanDataOptions extends Omit<NeutralPullPostmanDataOptions, 'fetchFn'> {
  fetchFn?: PullFetchFn;
}

export interface ListPostmanWorkspacesOptions extends Omit<NeutralListPostmanWorkspacesOptions, 'fetchFn'> {
  fetchFn?: PullFetchFn;
}

export function listPostmanWorkspaces(options: ListPostmanWorkspacesOptions): Promise<PostmanWorkspaceListResult> {
  return listPostmanWorkspacesNeutral({ ...options, fetchFn: options.fetchFn ?? nodePullFetch });
}

export function pullPostmanData(options: PullPostmanDataOptions): Promise<PostmanPullResult> {
  return pullPostmanDataNeutral({ ...options, fetchFn: options.fetchFn ?? nodePullFetch });
}
