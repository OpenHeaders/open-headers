/**
 * MqttRequest mutator catalog — routing constants.
 *
 * Three set-modeled paths live on the MqttRequest entity:
 *
 *   - `topics`         — subscription rows (`{ topicFilter, qos?, subscribe?, … }`)
 *   - `savedMessages`  — reusable publish presets (`{ name, topic, payload, … }`)
 *   - `userProperties` — CONNECT-level user-property rows (`{ key, value, … }`)
 *
 * Every other field — `name`, `description`, `url`, `protocolVersion`,
 * the publish-compose scalars, the connect knobs — flows through
 * `setField` scalars. `publishProperties`, `lastWill` and `specLink`
 * are container-valued; they route through the per-leaf flatten-diff
 * at the write site (the same treatment `auth` / `body` get on the
 * HTTP request) so edits share create's leaf representation.
 *
 * No side effects: MQTT requests don't feed DNR and don't touch the
 * variables resolver.
 */

/** Routing key carried on every MQTT-request mutation envelope. */
export const MQTT_REQUEST_ENTITY_TYPE = 'mqttRequest';

/** Set path for subscription rows (the Topics tab). */
export const MQTT_REQUEST_TOPICS_PATH = 'topics';

/** Set path for Saved-messages rail rows. */
export const MQTT_REQUEST_SAVED_MESSAGES_PATH = 'savedMessages';

/** Set path for CONNECT-level user-property rows (the Properties tab). */
export const MQTT_REQUEST_USER_PROPERTIES_PATH = 'userProperties';

/**
 * Wire shape for a user-property row. Mirrors `MqttUserPropertyRow`
 * field-for-field but typed locally so the catalog stays decoupled
 * from `@openheaders/core/types` (the same way other catalogs keep
 * their row shapes local).
 */
export interface MqttUserPropertyRowRow {
  /** Persisted per-row identity; doubles as the sync engine's itemId. */
  uid: string;
  key: string;
  value: string;
  description?: string;
  enabled?: boolean;
}

/** Wire shape for a Topics-tab subscription row. See {@link MqttUserPropertyRowRow}. */
export interface MqttTopicRowRow {
  uid: string;
  topicFilter: string;
  qos?: 0 | 1 | 2;
  subscribe?: boolean;
  description?: string;
  noLocal?: boolean;
  retainAsPublished?: boolean;
  retainHandling?: 0 | 1 | 2;
  subscriptionId?: number;
  userProperties?: MqttUserPropertyRowRow[];
}

/** Wire shape for a Saved-messages rail row. See {@link MqttUserPropertyRowRow}. */
export interface MqttSavedMessageRow {
  uid: string;
  name: string;
  topic: string;
  payload: string;
  format?: 'text' | 'json' | 'base64' | 'hex';
  qos?: 0 | 1 | 2;
  retain?: boolean;
  properties?: Record<string, unknown>;
}

/** Set path on an MQTT request holding its response examples' ordered slots. */
export const MQTT_REQUEST_EXAMPLES_PATH = 'examples';
