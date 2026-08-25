/**
 * MQTT session display vocabulary — component-free labels shared by
 * the message timeline and the Topics grid's live grant marks (a
 * label module, so consumers that never mount an editor can import it
 * without pulling the component tree along).
 */

import { mqttReasonCodeName } from '@openheaders/core/mqtt';
import type { Translate } from '@openheaders/ui/context/LocaleContext';

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
