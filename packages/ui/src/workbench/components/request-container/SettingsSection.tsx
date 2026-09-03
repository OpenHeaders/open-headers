/**
 * SettingsSection — the container editor's Settings section: the ONE
 * `settings` object a collection / folder carries for the requests
 * under it (the per-knob cascade — `@openheaders/core/settings-inheritance`),
 * edited through per-kind sub-tabs (HTTP · WebSocket · MQTT · gRPC)
 * that render the request Settings tabs' own rows over the kind's
 * slice of the object. A shared knob (`timeoutMs`) is one row on every
 * sub-tab — edited on one, it shows on the others; a kind-only knob
 * (`keepAlive`) sits on its kind's sub-tab alone. Never a per-kind
 * sub-object in storage: the sub-tabs are views over the one record.
 *
 * A folder's rows read the nearest ancestor's values as placeholders
 * with the "Inherited from …" line (the request anatomy one level
 * up); a collection's rows read the runtime defaults. Pure draft
 * surface: every gesture goes through `onChange`; the container
 * editor's one Save persists the knobs that changed. Per-kind unsaved
 * dots on the sub-tabs, per-row on the rows (the scripts S9 law).
 */

import type { AuthProtocolKind } from '@openheaders/core/auth-inheritance';
import { INHERITABLE_SETTING_KEYS_BY_KIND } from '@openheaders/core/schemas';
import type { InheritableSettingKey, InheritableSettings } from '@openheaders/core/types';
import type { MessageKey } from '@openheaders/i18n';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Tabs } from 'antd';
import type React from 'react';
import { useState } from 'react';
import GrpcSettingsRows from '../grpc-request-editor/GrpcSettingsRows';
import MqttSettingsRows from '../mqtt-request-editor/MqttSettingsRows';
import { TabDot } from '../request-editor/request-tab-items';
import SettingsTab from '../request-editor/SettingsTab';
import { type InheritedSettingsView, sliceOf } from '../shared/inherited-settings/inherited-settings';
import WebSocketSettingsRows from '../websocket-request-editor/WebSocketSettingsRows';

const KINDS: readonly AuthProtocolKind[] = ['http', 'websocket', 'mqtt', 'grpc'];

const KIND_LABEL_KEY: Record<AuthProtocolKind, MessageKey> = {
  http: 'shared.requestKinds.http.label',
  websocket: 'shared.requestKinds.websocket.label',
  mqtt: 'shared.requestKinds.mqtt.label',
  grpc: 'shared.requestKinds.grpc.label',
};

/** Session-scoped memory of the picked sub-tab: the section unmounts
 *  on every section switch, and the pick must survive that — a
 *  reading preference, not container state. */
let sessionKind: AuthProtocolKind = 'http';

interface SettingsSectionProps {
  settings: InheritableSettings;
  onChange: (next: InheritableSettings) => void;
  /** The knobs whose draft value differs from the saved record. */
  unsaved: ReadonlySet<InheritableSettingKey>;
  /** The ancestor plane — a folder's nearest-ancestor values, a
   *  collection's empty view (explicit wins on both). */
  inherited: InheritedSettingsView;
  /** Editing-scope workspace, threaded to the HTTP rows. */
  workspaceId: string | null;
}

const SettingsSection: React.FC<SettingsSectionProps> = ({ settings, onChange, unsaved, inherited, workspaceId }) => {
  const t = useT();
  const [kind, setKind] = useState<AuthProtocolKind>(sessionKind);
  const pickKind = (next: AuthProtocolKind): void => {
    sessionKind = next;
    setKind(next);
  };
  // The sub-tabs hand back the kind's whole slice; merged over the
  // one record, a cleared knob lands as `undefined` (the per-knob
  // unset the Save diff emits).
  const merge = (next: Partial<InheritableSettings>): void => onChange({ ...settings, ...next });
  const kindUnsaved = (k: AuthProtocolKind): boolean =>
    INHERITABLE_SETTING_KEYS_BY_KIND[k].some((key: InheritableSettingKey) => unsaved.has(key));
  const items = KINDS.map((k) => ({
    key: k,
    label: (
      <span data-testid={`oh-container-settings-kind-${k}`}>
        {t(KIND_LABEL_KEY[k])}
        {kindUnsaved(k) ? <TabDot tone="unsaved" /> : null}
      </span>
    ),
  }));

  const body = (() => {
    switch (kind) {
      case 'http':
        return (
          <SettingsTab
            scope="container"
            value={sliceOf(settings, INHERITABLE_SETTING_KEYS_BY_KIND.http)}
            onChange={merge}
            unsaved={unsaved}
            inherited={inherited}
            workspaceId={workspaceId}
          />
        );
      case 'websocket':
        return (
          <WebSocketSettingsRows
            scope="container"
            flavor="raw"
            value={sliceOf(settings, INHERITABLE_SETTING_KEYS_BY_KIND.websocket)}
            onChange={merge}
            unsaved={unsaved}
            inherited={inherited}
          />
        );
      case 'mqtt':
        return (
          <MqttSettingsRows
            scope="container"
            v5
            value={sliceOf(settings, INHERITABLE_SETTING_KEYS_BY_KIND.mqtt)}
            onChange={merge}
            unsaved={unsaved}
            inherited={inherited}
          />
        );
      case 'grpc':
        return (
          <GrpcSettingsRows
            scope="container"
            value={sliceOf(settings, INHERITABLE_SETTING_KEYS_BY_KIND.grpc)}
            onChange={merge}
            unsaved={unsaved}
            inherited={inherited}
          />
        );
    }
  })();

  return (
    <div data-testid="oh-container-settings" style={{ display: 'flex', flexDirection: 'column' }}>
      <Tabs
        size="small"
        activeKey={kind}
        onChange={(k) => pickKind(k as AuthProtocolKind)}
        items={items}
        className="rules-request-tabs"
        tabBarStyle={{ marginBottom: 12 }}
        data-testid="oh-container-settings-kinds"
      />
      {body}
    </div>
  );
};

export default SettingsSection;
