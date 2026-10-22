/**
 * MQTT session display vocabulary — component-free labels shared by
 * the message timeline and the Topics grid's live grant marks (a
 * label module, so consumers that never mount an editor can import it
 * without pulling the component tree along).
 */

import { MQTT_CONNACK_RETURN_CODE_NAMES, mqttReasonCodeName } from '@openheaders/core/mqtt';
import type { ExecutedMqttSnapshot } from '@openheaders/core/types';
import type { MessageKey } from '@openheaders/i18n';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
import type { PillTone } from '../request-editor/response/response-status';

/** CONNACK reason name — the version scopes which numeric space names
 *  the verbatim code. On a 5.0 session a non-zero code BELOW 0x80 is a
 *  3.1.1-form answer (a 3.1.1-only broker refusing the protocol level
 *  in its own numeric space — the executor's refusal rule), named from
 *  the 3.1.1 table. */
export function connackReasonName(reasonCode: number, v5: boolean): string | undefined {
  if (!v5 || (reasonCode !== 0 && reasonCode < 0x80)) return MQTT_CONNACK_RETURN_CODE_NAMES[reasonCode];
  return mqttReasonCodeName(reasonCode, 'connack');
}

/** CONNACK reason display: the spec name beside the verbatim code. */
export function connackReasonLabel(reasonCode: number, v5: boolean): string {
  const name = connackReasonName(reasonCode, v5);
  return name !== undefined ? `${name} (${reasonCode})` : String(reasonCode);
}

/** A dropped connection's end, phrased for a timeline row — the
 *  broker's verbatim DISCONNECT reason, or the severed absence. */
export function connectionEndMessage(end: { by: 'broker'; reasonCode: number | null } | null, t: Translate): string {
  if (end === null) return t('workbench.editors.mqtt.session.severed');
  if (end.reasonCode === null) return t('workbench.editors.mqtt.session.brokerDisconnectBare');
  const name = mqttReasonCodeName(end.reasonCode, 'disconnect');
  return t('workbench.editors.mqtt.session.brokerDisconnect', {
    reason: name !== undefined ? `${name} (${end.reasonCode})` : String(end.reasonCode),
  });
}

/** The end pill's key for a session whose auto-reconnect loop ended
 *  on its own — the broker refused, or the attempt cap was spent. */
export function reconnectLoopEndTagKey(session: {
  reconnectRefused?: { attempt: number; error: string };
  reconnectExhausted?: { attempts: number; error?: string };
}): MessageKey {
  return session.reconnectRefused !== undefined
    ? 'workbench.editors.mqtt.session.reconnectRefusedTag'
    : 'workbench.editors.mqtt.session.reconnectExhaustedTag';
}

/** The ended row's detail for a settled session that opened: the
 *  clean Disconnect, the broker's verbatim reason, the severed note —
 *  or the reconnect refusal / spent attempt cap that ended the
 *  auto-reconnect loop; absent on a Stop (the row's own label is the
 *  story). */
export function sessionEndedMessage(
  session: {
    end: { by: 'client' } | { by: 'broker'; reasonCode: number | null } | null;
    stopped?: boolean;
    reconnectRefused?: { attempt: number; error: string };
    reconnectExhausted?: { attempts: number; error?: string };
  },
  t: Translate,
): string | undefined {
  if (session.reconnectRefused !== undefined) {
    return t('workbench.editors.mqtt.session.reconnectRefused', { reason: session.reconnectRefused.error });
  }
  if (session.reconnectExhausted !== undefined) {
    const { attempts, error } = session.reconnectExhausted;
    const attemptsText =
      attempts === 1
        ? t('workbench.editors.mqtt.session.reconnectAttemptsOne')
        : t('workbench.editors.mqtt.session.reconnectAttemptsMany', { count: attempts });
    return error === undefined
      ? t('workbench.editors.mqtt.session.reconnectExhausted', { attempts: attemptsText })
      : t('workbench.editors.mqtt.session.reconnectExhaustedReason', { attempts: attemptsText, reason: error });
  }
  if (session.stopped === true) return undefined;
  if (session.end !== null && session.end.by === 'client') return t('workbench.editors.mqtt.session.cleanDisconnect');
  return connectionEndMessage(session.end, t);
}

/** How a closed session's connection ended, for the ended row's glyph
 *  — the same reading the end pill and `sessionEndedMessage` give. */
export function sessionEndedKind(session: {
  end: { by: 'client' } | { by: 'broker'; reasonCode: number | null } | null;
  reconnectRefused?: { attempt: number; error: string };
  reconnectExhausted?: { attempts: number; error?: string };
}): 'clean' | 'broker' | 'severed' {
  if (session.reconnectRefused !== undefined) return 'broker';
  if (session.reconnectExhausted !== undefined) return 'severed';
  if (session.end === null) return 'severed';
  return session.end.by === 'client' ? 'clean' : 'broker';
}

/** A FAILED grant's display label — the failure code with its spec
 *  name beside the verbatim number. Success grants (0–2) return null:
 *  the subscribed state itself is the answer, so success renders as
 *  silence (failure-only honesty — the Postman posture). */
export function grantFailureLabel(reasonCode: number, t: Translate): string | null {
  if (reasonCode <= 2) return null;
  const name = mqttReasonCodeName(reasonCode, 'suback');
  return name !== undefined
    ? t('workbench.editors.mqtt.timeline.grantFailedNamed', { name, code: reasonCode })
    : t('workbench.editors.mqtt.timeline.grantFailed', { code: reasonCode });
}

/** The end pill's tone for a settled session — the one reading the
 *  pill and the pane's send pulse both paint, by whose doing the end
 *  was: what the user asked for (the clean Disconnect, Stop, a cancel
 *  before the session opened) neutral; the broker's own DISCONNECT on
 *  the warning tint; a pre-open failure, the severed socket and a
 *  spent or refused reconnect loop on the error tint. */
export function sessionEndTone(
  snapshot: Pick<ExecutedMqttSnapshot, 'outcome' | 'end' | 'stopped' | 'reconnectRefused' | 'reconnectExhausted'>,
): PillTone {
  if (snapshot.reconnectRefused !== undefined || snapshot.reconnectExhausted !== undefined) return 'error';
  if (snapshot.outcome.kind === 'aborted') return 'neutral';
  if (snapshot.outcome.kind === 'failed') return 'error';
  if (snapshot.stopped === true) return 'neutral';
  if (snapshot.end === null) return 'error';
  return snapshot.end.by === 'client' ? 'neutral' : 'warning';
}
