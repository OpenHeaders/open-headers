/**
 * The subscription's tags — what the session pane's meta strip leads
 * with when the WebSocket session carries a GraphQL subscription: the
 * PROTOCOL phase (Subscribing… / Subscribed while live; Completed,
 * Stopped, Error, or the Close code with its protocol meaning once
 * settled — the socket's own pill beside it stays the socket's story),
 * the events count, and the `errors[]` tag over the latest event or
 * the server's error message (the HTTP answer's tag, same list). The
 * facts come off the core machine's state, replayed from the capture.
 */

import { type GraphqlWsClientState, type GraphqlWsCloseMeaning, graphqlWsCloseMeaning } from '@openheaders/core/graphql';
import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import { InfoPopover } from '@openheaders/ui/shared/info-popover';
import { Tag, Tooltip } from 'antd';
import type React from 'react';
import { useMemo } from 'react';
import { type GraphqlResponseFacts, graphqlEnvelopeFacts } from '../request-editor/response/graphql-response';
import { GraphqlErrorList } from '../request-editor/response/GraphqlResponseTags';
import { useTonePillStyle } from '../request-editor/response/response-status';

const CLOSE_MEANING_KEYS = {
  'bad-request': 'workbench.editors.graphql.subscription.close.badRequest',
  unauthorized: 'workbench.editors.graphql.subscription.close.unauthorized',
  forbidden: 'workbench.editors.graphql.subscription.close.forbidden',
  'subprotocol-not-acceptable': 'workbench.editors.graphql.subscription.close.subprotocolNotAcceptable',
  'connection-init-timeout': 'workbench.editors.graphql.subscription.close.connectionInitTimeout',
  'subscriber-already-exists': 'workbench.editors.graphql.subscription.close.subscriberAlreadyExists',
  'too-many-init-requests': 'workbench.editors.graphql.subscription.close.tooManyInitRequests',
} as const satisfies Record<GraphqlWsCloseMeaning, string>;

/** The Close's protocol meaning and the server's reason, for the pill's hover. */
function closeDetail(close: { code: number; reason: string }, t: Translate): string | null {
  const meaning = graphqlWsCloseMeaning(close.code);
  const parts = [meaning === null ? null : t(CLOSE_MEANING_KEYS[meaning]), close.reason === '' ? null : close.reason];
  const text = parts.filter((part): part is string => part !== null).join(' — ');
  return text === '' ? null : text;
}

/** The errors[] the tag lists: the server's `error` message first
 *  (the subscription never started), else the latest event's own. */
function errorFacts(state: GraphqlWsClientState): GraphqlResponseFacts | null {
  if (state.errors !== null) return graphqlEnvelopeFacts({ errors: state.errors });
  if (state.latest === null) return null;
  const facts = graphqlEnvelopeFacts(state.latest);
  return facts !== null && facts.errors.length > 0 ? facts : null;
}

interface GraphqlSubscriptionTagsProps {
  state: GraphqlWsClientState;
  /** The session is still open — the phase reads live. */
  live: boolean;
}

const GraphqlSubscriptionTags: React.FC<GraphqlSubscriptionTagsProps> = ({ state, live }) => {
  const t = useT();
  const facts = useMemo(() => errorFacts(state), [state]);
  const closed = state.phase === 'closed' && state.close !== null;
  const tone =
    state.phase === 'errored' || closed
      ? 'error'
      : state.stopped
        ? 'neutral'
        : state.phase === 'subscribed' || state.phase === 'completed'
          ? 'success'
          : 'neutral';
  const pill = useTonePillStyle(tone);
  const label = state.stopped
    ? t('workbench.editors.graphql.subscription.stopped')
    : state.phase === 'subscribed'
      ? t('workbench.editors.graphql.subscription.subscribed')
      : state.phase === 'completed'
        ? t('workbench.editors.graphql.subscription.completed')
        : state.phase === 'errored'
          ? t('workbench.editors.graphql.subscription.errored')
          : closed && state.close !== null
            ? t('workbench.editors.graphql.subscription.closed', { code: state.close.code })
            : live
              ? t('workbench.editors.graphql.subscription.subscribing')
              : null;
  const detail = closed && state.close !== null ? closeDetail(state.close, t) : null;
  const phaseTag =
    label === null ? null : (
      <Tag color="default" style={pill} data-testid="graphql-subscription-phase">
        {label}
      </Tag>
    );
  return (
    <>
      {phaseTag !== null && detail !== null ? <Tooltip title={detail}>{phaseTag}</Tooltip> : phaseTag}
      {state.events > 0 && (
        <Tag color="default" style={{ marginInlineEnd: 0 }} data-testid="graphql-subscription-events">
          {t('workbench.editors.graphql.subscription.events', { count: state.events })}
        </Tag>
      )}
      {facts !== null && (
        <InfoPopover
          content={{
            title: t('workbench.editors.graphql.response.errorsTitle'),
            kicker: t('workbench.editors.request.response.meta.kicker'),
            summary: t('workbench.editors.graphql.subscription.errorsSummary'),
            description: <GraphqlErrorList facts={facts} />,
          }}
          trigger="hover"
        >
          <Tag color="error" data-testid="graphql-subscription-errors" style={{ marginInlineEnd: 0, cursor: 'help' }}>
            {t('workbench.editors.graphql.response.errors', { count: facts.errors.length })}
          </Tag>
        </InfoPopover>
      )}
    </>
  );
};

export default GraphqlSubscriptionTags;
