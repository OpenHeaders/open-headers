import type { PullFetchFn } from '@openheaders/oracle/migration';
import { fetch as undiciFetch } from 'undici';

/** Node's fetch port for the host-neutral Data API puller. */
export const nodePullFetch: PullFetchFn = (url, init) => undiciFetch(url, init);
