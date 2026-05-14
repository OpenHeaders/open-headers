/**
 * Request-bound binding around the generic `useEntityConflicts` hook.
 * Mirrors `use-template-conflicts.ts` — same shape, swap adapter +
 * entity type.
 */

import { REQUEST_ENTITY_TYPE } from '@openheaders/core/sync';
import type { Request } from '@openheaders/core/types';
import {
  type EntityConflictsApi,
  useEntityConflicts,
} from '@openheaders/ui/shared/conflicts/use-entity-conflicts';
import { requestConflictAdapter } from './request-conflict-adapter';

export interface UseRequestConflictsArgs {
  liveRequest: Request | null | undefined;
  isDirty: boolean;
  enabled: boolean;
}

export function useRequestConflicts(args: UseRequestConflictsArgs): EntityConflictsApi<Request> {
  return useEntityConflicts<Request>({
    liveEntity: args.liveRequest,
    isDirty: args.isDirty,
    enabled: args.enabled,
    entityType: REQUEST_ENTITY_TYPE,
    adapter: requestConflictAdapter,
  });
}
