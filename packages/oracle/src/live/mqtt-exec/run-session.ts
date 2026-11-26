/**
 * The MQTT adapter behind the session port (the workflow runs plan, The
 * model — the kinds table's MQTT row): a `listen` step's session is one
 * `executeMqttSession`, read through its observer and driven through its
 * handle.
 *
 *   - Ready when every SUBSCRIBE the session sent as it opened is
 *     answered and none is refused — the executor's fact, never inferred
 *     from the request's rows.
 *   - A message is an inbound PUBLISH as the capture recorded it: its
 *     topic is its address, the retain flag marks it stored, and its
 *     flags and 5.0 properties are its named fields.
 *   - A `send` publishes a message saved on the request and is done at
 *     the broker's acknowledgement, under the `listen` step's deadline.
 *   - A drop ends the session for the run: the request is opened with no
 *     reconnect, whatever it or an ancestor asks for.
 *   - The request's scripts run only for a `listen` that opts in, under
 *     the run's tier. A Before connect that errors fails the `listen`;
 *     what the other hooks did not do cleanly is the close's warning,
 *     and never a verdict.
 */

import {
  formatWait,
  type RunSession,
  type SessionHost,
  type SessionMessage,
  type SessionOpenResult,
} from '@openheaders/core/live';
import { type MqttProperties, mqttReasonCodeName, topicMatchesFilter } from '@openheaders/core/mqtt';
import { SCRIPT_ERROR_ASSERTION } from '@openheaders/core/scripts';
import type { ExecutedMqttEnd, ExecutedMqttSnapshot, MqttRequest } from '@openheaders/core/types';
import { encodeBase64Bytes, generateUid } from '@openheaders/core/utils';
import type { SessionScriptHost } from '../request-exec/script-hooks';
import { stopActiveSend } from '../request-exec/send-stream';
import { decodeUtf8Text, type ExecuteMqttSessionOptions, executeMqttSession } from './execute';
import {
  activeMqttSessionPosition,
  closeActiveMqttSession,
  type MqttSessionObserver,
  publishActiveMqttMessageAcked,
} from './session-plane';
import type { MqttByteTransport } from './transport';

/**
 * A session's scopes as a realm outside the engine's stores holds them —
 * the executor's injected contract, whole: its resolution reads the run's
 * captures itself.
 */
export type MqttRunSessionScope = Pick<
  ExecuteMqttSessionOptions,
  'prepareResolution' | 'referencesSecret' | 'totp' | 'authChain' | 'scriptChain' | 'settingsChain'
> & { resolution: NonNullable<ExecuteMqttSessionOptions['resolution']> };

export interface MqttRunSessionHostOptions {
  /** `null` = a realm that pins none of the engine's workspaces and hands its scopes in. */
  workspaceId: string | null;
  /** `null` = "No environment". */
  environmentId: string | null;
  transport: MqttByteTransport;
  /** A realm where a request's stream may open on another host names that transport; `null` = `transport`. */
  transportFor?: (request: MqttRequest) => MqttByteTransport | null;
  /** The MQTT request a `listen` step names; `null` when the workspace holds none by that uid. */
  findRequest(uid: string): MqttRequest | null;
  /**
   * The scopes of a realm whose engine stores are empty, built for one
   * session over the run's captures, kept by reference. Absent = the
   * engine resolves from its own stores.
   */
  sessionScope?: (
    request: MqttRequest,
    stepCaptures: ReadonlyMap<string, ReadonlyMap<string, string>>,
  ) => Promise<MqttRunSessionScope>;
  /** The run's script host, asked for a `listen` that runs its request's scripts; `null` = this host runs none. */
  resolveScriptHost?: () => Promise<SessionScriptHost | null>;
  /** Injectable deadline — settles after `ms`, dropped when `signal` aborts first. Defaults to `setTimeout`. */
  timer?: (ms: number, signal: AbortSignal) => Promise<void>;
}

export function createMqttRunSessionHost(options: MqttRunSessionHostOptions): SessionHost {
  const {
    workspaceId,
    environmentId,
    transport,
    transportFor,
    findRequest,
    sessionScope,
    resolveScriptHost,
    timer = deadlineTimer,
  } = options;
  return {
    async open(step, opening) {
      const request = findRequest(step.sessionRequestUid);
      if (request === null) return { ok: false, reason: `Session request ${step.sessionRequestUid} was not found.` };
      const scriptHost = step.runScripts === true ? ((await resolveScriptHost?.()) ?? null) : null;
      if (step.runScripts === true && scriptHost === null) {
        return { ok: false, reason: `Step "${step.id}" cannot run here: this host runs no script on a run's session.` };
      }
      const scope = sessionScope !== undefined ? await sessionScope(request, opening.stepCaptures) : null;
      const namesReasons = request.protocolVersion !== '3.1.1';
      const sendId = `run-${generateUid()}`;
      let ready = false;
      let closing = false;
      let lastPosition = 0;
      let running: Promise<ExecutedMqttSnapshot> | null = null;

      const session: RunSession = {
        position() {
          lastPosition = activeMqttSessionPosition(sendId) ?? lastPosition;
          return lastPosition;
        },
        matchesAddress: (address, message) => message.address !== null && topicMatchesFilter(message.address, address),
        async send(sendStep) {
          const saved = request.savedMessages.find((message) => message.uid === sendStep.messageUid);
          if (saved === undefined) {
            return { ok: false, reason: `Message ${sendStep.messageUid} is not saved on "${request.name}".` };
          }
          const { uid: _uid, name: _name, ...message } = saved;
          const waiting = new AbortController();
          const result = await Promise.race([
            publishActiveMqttMessageAcked(sendId, message),
            timer(step.timeoutMs, waiting.signal).then(() => null),
          ]);
          waiting.abort();
          if (result === null) {
            return {
              ok: false,
              reason: `The broker did not acknowledge the publish within ${formatWait(step.timeoutMs)}.`,
            };
          }
          if (!result.success || result.sent === undefined) {
            return { ok: false, reason: result.error ?? 'The publish was not sent.' };
          }
          return {
            ok: true,
            message: sessionMessageOf(result.sent, false),
            ...(result.ackMs !== undefined ? { ackMs: result.ackMs } : {}),
          };
        },
        async endInput() {
          throw new Error('An MQTT session has no end of input.');
        },
        async end() {
          closing = true;
          closeActiveMqttSession(sendId);
          if (running === null) return {};
          const warning = scriptsWarning(await running);
          return warning !== null ? { warning } : {};
        },
      };

      return new Promise<SessionOpenResult>((answer) => {
        let refusal: string | null = null;
        const observer: MqttSessionObserver = {
          ready(facts) {
            refusal = subscriptionRefusal(facts, namesReasons);
            if (refusal !== null) {
              // Answered once the session is closed: it never outlives the step that refused it.
              closing = true;
              closeActiveMqttSession(sendId);
              return;
            }
            ready = true;
            answer({
              ok: true,
              session,
              facts: {
                identityGenerated: facts.clientIdGenerated === true,
                cleanStart: facts.keptSession !== true,
                resumed: facts.sessionPresent,
                granted: facts.grants.length,
              },
            });
          },
          message(observed) {
            lastPosition = observed.position + 1;
            opening.onMessage(sessionMessageOf(observed, observed.retain));
          },
          ended(facts) {
            if (ready && !closing) opening.onEnded(endedReason(facts, namesReasons));
          },
        };
        running = executeMqttSession(
          // The request's own knob outranks an ancestor's: nothing redials in a run.
          { ...request, autoReconnect: false },
          {
            workspaceId,
            environmentId,
            transport: transportFor?.(request) ?? transport,
            sendId,
            observer,
            ...(scope !== null ? scope : { stepCaptures: opening.stepCaptures }),
            ...(scriptHost !== null ? { scriptHost, strictBeforeConnect: true } : {}),
          },
        );
        // A session that settles before it was ready answers with why it never was.
        void running.then((snapshot) =>
          answer({ ok: false, reason: refusal ?? notReadyReason(snapshot, namesReasons) }),
        );
        opening.signal.addEventListener(
          'abort',
          () => {
            closing = true;
            stopActiveSend(sendId);
          },
          { once: true },
        );
      });
    },
  };
}

function deadlineTimer(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise<void>((resolve) => {
    const handle = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => clearTimeout(handle), { once: true });
  });
}

/** A PUBLISH as the run reads it — inbound as recorded, or outbound as sent. */
function sessionMessageOf(
  publish: {
    position: number;
    atMs: number;
    topic: string;
    payload: Uint8Array;
    qos: 0 | 1 | 2;
    retain: boolean;
    properties?: MqttProperties;
  },
  stored: boolean,
): SessionMessage {
  const text = decodeUtf8Text(publish.payload);
  const { properties } = publish;
  return {
    position: publish.position,
    at: publish.atMs,
    address: publish.topic,
    ...(text !== null ? { body: text } : { body: encodeBase64Bytes(publish.payload), bodyEncoding: 'base64' }),
    // The protocol's own fields first: a user property never shadows one.
    fields: [
      { key: 'topic', value: publish.topic },
      { key: 'qos', value: String(publish.qos) },
      { key: 'retain', value: String(publish.retain) },
      ...(properties?.responseTopic !== undefined ? [{ key: 'response-topic', value: properties.responseTopic }] : []),
      ...(properties?.correlationData !== undefined
        ? [{ key: 'correlation-data', value: new TextDecoder().decode(properties.correlationData) }]
        : []),
      ...(properties?.contentType !== undefined ? [{ key: 'content-type', value: properties.contentType }] : []),
      ...(properties?.userProperties ?? []).map((property) => ({ key: property.key, value: property.value })),
    ],
    stored,
  };
}

/** ` : name (code n)` on a 5.0 session; the bare code on 3.1.1, whose codes the 5.0 table does not name. */
function reasonSuffix(code: number, context: 'suback' | 'disconnect', named: boolean): string {
  const name = named ? mqttReasonCodeName(code, context) : undefined;
  return name !== undefined ? `: ${name} (code ${code}).` : ` (code ${code}).`;
}

/** Why a session whose open-time subscriptions are all answered is not ready, or `null`. */
function subscriptionRefusal(facts: Parameters<MqttSessionObserver['ready']>[0], named: boolean): string | null {
  const [unsent] = facts.unsent;
  if (unsent !== undefined) {
    return `The subscription to ${unsent.topicFilters.join(', ')} was not sent: ${unsent.error}`;
  }
  const refused = facts.grants.find((grant) => grant.reasonCode >= 0x80);
  if (refused === undefined) return null;
  return `The broker refused the subscription to ${refused.topicFilter}${reasonSuffix(refused.reasonCode, 'suback', named)}`;
}

function endedReason(facts: { end: ExecutedMqttEnd; stopped: boolean; error?: string }, named: boolean): string {
  if (facts.stopped) return 'The session was stopped.';
  if (facts.end === null) {
    return facts.error !== undefined ? `The connection dropped: ${facts.error}` : 'The connection dropped.';
  }
  if (facts.end.by === 'client') return 'The session was closed.';
  return facts.end.reasonCode === null
    ? 'The broker disconnected.'
    : `The broker disconnected${reasonSuffix(facts.end.reasonCode, 'disconnect', named)}`;
}

/**
 * What a closed session's scripts did not do cleanly, or `null`: an After
 * close that errored, the script tests that failed, the On message runs
 * that errored. The tests are counted off the recorded marks; the row
 * the runtime adds for a run that errored is that run's error, not a test.
 */
function scriptsWarning(snapshot: ExecutedMqttSnapshot): string | null {
  const { scripts } = snapshot;
  if (scripts === undefined) return null;
  const parts: string[] = [];
  if (scripts.afterClose?.succeeded === false) {
    parts.push(`After close script failed: ${scripts.afterClose.error?.message ?? 'script failed'}`);
  }
  let failedTests = 0;
  for (const event of snapshot.events) {
    if (event.kind !== 'script') continue;
    for (const assertion of event.assertions ?? []) {
      if (!assertion.passed && assertion.name !== SCRIPT_ERROR_ASSERTION) failedTests += 1;
    }
  }
  if (failedTests > 0) parts.push(`${failedTests} script ${failedTests === 1 ? 'test' : 'tests'} failed`);
  const failedRuns = scripts.onMessage?.failed ?? 0;
  if (failedRuns > 0) parts.push(`On message script failed ${failedRuns} ${failedRuns === 1 ? 'time' : 'times'}`);
  return parts.length > 0 ? parts.join(' · ') : null;
}

/** Why a session that settled before it was ready never was. */
function notReadyReason(snapshot: ExecutedMqttSnapshot, named: boolean): string {
  if (snapshot.outcome.kind === 'failed') return snapshot.outcome.error;
  if (snapshot.outcome.kind === 'aborted') return 'The session was stopped before it opened.';
  return endedReason({ end: snapshot.end, stopped: snapshot.stopped === true }, named);
}
