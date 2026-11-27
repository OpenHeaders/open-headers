/**
 * The requests a workflow's steps name, by uid — a call's HTTP or
 * GraphQL request, the MQTT request a listen opens. One index for every
 * part of the workflow view that says what a step does.
 */

import { useRequests } from '@openheaders/ui/shared/hooks/readers/useRequests';
import { useMemo } from 'react';

type Requests = ReturnType<typeof useRequests>;

export interface StepRequests {
  requestsByUid: ReadonlyMap<string, Requests['requests'][number]>;
  graphqlByUid: ReadonlyMap<string, Requests['graphqlRequests'][number]>;
  mqttRequests: Requests['mqttRequests'];
  /** The request stores were read: a request not found is gone, not unread. */
  ready: boolean;
}

export function useStepRequests(): StepRequests {
  const { requests, graphqlRequests, mqttRequests, isReady } = useRequests();
  return useMemo(
    () => ({
      requestsByUid: new Map(requests.map((request) => [request.uid, request])),
      graphqlByUid: new Map(graphqlRequests.map((request) => [request.uid, request])),
      mqttRequests,
      ready: isReady,
    }),
    [requests, graphqlRequests, mqttRequests, isReady],
  );
}
