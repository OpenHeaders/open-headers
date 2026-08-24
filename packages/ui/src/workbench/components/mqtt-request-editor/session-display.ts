/**
 * MQTT session display vocabulary — component-free labels shared by
 * the message timeline and the Topics grid's live grant marks (a
 * label module, so consumers that never mount an editor can import it
 * without pulling the component tree along).
 */

import { mqttReasonCodeName } from '@openheaders/core/mqtt';
import type { Translate } from '@openheaders/ui/context/LocaleContext';

/** One SUBACK grant's display label — the granted QoS, or the failure
 *  code with its spec name beside the verbatim number. */
export function grantLabel(reasonCode: number, t: Translate): string {
  if (reasonCode <= 2) return t('workbench.editors.mqtt.timeline.grantedQos', { qos: reasonCode });
  const name = mqttReasonCodeName(reasonCode, 'suback');
  return name !== undefined
    ? t('workbench.editors.mqtt.timeline.grantFailedNamed', { name, code: reasonCode })
    : t('workbench.editors.mqtt.timeline.grantFailed', { code: reasonCode });
}
