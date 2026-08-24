/**
 * MQTT topic grammar — validation for topic NAMES (publish side: no
 * wildcards) and topic FILTERS (subscribe side: the `+`/`#` placement
 * rules), shared by the encode paths and the editor's inline
 * validation so an invalid filter reports here, never at the broker.
 * Returns a human-readable error or null. `$share/…` passes through
 * as an ordinary filter — no special handling (the ratified scope).
 */
import { MQTT_STRING_MAX_BYTES, utf8ByteLength } from './wire';

const NUL = String.fromCharCode(0);

function commonTopicError(text: string, what: string): string | null {
  if (text === '') return `${what} is empty.`;
  if (text.includes(NUL)) return `${what} contains U+0000.`;
  if (utf8ByteLength(text) > MQTT_STRING_MAX_BYTES) return `${what} exceeds ${MQTT_STRING_MAX_BYTES} bytes.`;
  return null;
}

/** Validate a topic NAME (PUBLISH / will topic): wildcards illegal. */
export function topicNameError(topic: string): string | null {
  const common = commonTopicError(topic, 'Topic');
  if (common !== null) return common;
  if (topic.includes('+') || topic.includes('#')) return 'Topic names cannot contain wildcards.';
  return null;
}

/** Validate a topic FILTER (SUBSCRIBE / UNSUBSCRIBE): `+` fills a
 *  whole level, `#` fills the whole LAST level. */
export function topicFilterError(filter: string): string | null {
  const common = commonTopicError(filter, 'Topic filter');
  if (common !== null) return common;
  const levels = filter.split('/');
  for (let i = 0; i < levels.length; i++) {
    const level = levels[i];
    if (level.includes('+') && level !== '+') return '"+" must fill a whole topic level.';
    if (level.includes('#')) {
      if (level !== '#') return '"#" must fill a whole topic level.';
      if (i !== levels.length - 1) return '"#" is only legal as the last topic level.';
    }
  }
  return null;
}
