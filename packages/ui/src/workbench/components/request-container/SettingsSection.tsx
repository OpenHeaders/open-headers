/**
 * SettingsSection — the container editor's Settings section: the
 * `settings` record a collection / folder carries for the requests
 * under it, ONE SLICE PER REQUEST KIND (the per-knob cascade within a
 * kind — `@openheaders/core/settings-inheritance`), edited through
 * per-kind sub-tabs (HTTP · WebSocket · MQTT · gRPC) that render the
 * request Settings tabs' own rows over the kind's slice. A knob set
 * under one sub-tab is that kind's alone: the HTTP timeout never
 * reaches a WebSocket session under the same collection, and the
 * sub-tabs dot their own unsaved knobs.
 *
 * A folder's rows read the nearest ancestor's values OF THE KIND as
 * placeholders with the "Inherited from …" line, and its own values
 * over an ancestor's with the "Overrides …" line (the request anatomy
 * one level up); a collection's rows read the runtime defaults. Pure
 * draft surface: every gesture goes through `onChange`; the container
 * editor's one Save persists the knobs that changed. Per-kind unsaved
 * dots on the sub-tabs, per-row on the rows (the scripts S9 law).
 */

import type { AuthProtocolKind } from '@openheaders/core/auth-inheritance';
import { definedSettingKeys, SETTINGS_KINDS } from '@openheaders/core/schemas';
import type { ContainerSettingUpdate, KindSettings, SettingsCarrier } from '@openheaders/core/settings-inheritance';
import type { ContainerSettings } from '@openheaders/core/types';
import type { MessageKey } from '@openheaders/i18n';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Tabs } from 'antd';
import type React from 'react';
import { useMemo, useState } from 'react';
import GrpcSettingsRows from '../grpc-request-editor/GrpcSettingsRows';
import MqttSettingsRows from '../mqtt-request-editor/MqttSettingsRows';
import { TabDot } from '../request-editor/request-tab-items';
import SettingsTab from '../request-editor/SettingsTab';
import {
  type InheritedSettingsView,
  inheritedSettingsViewFor,
  NO_INHERITED_SETTINGS,
} from '../shared/inherited-settings/inherited-settings';
import WebSocketSettingsRows from '../websocket-request-editor/WebSocketSettingsRows';

const KIND_LABEL_KEY: Record<AuthProtocolKind, MessageKey> = {
  http: 'shared.requestKinds.http.label',
  websocket: 'shared.requestKinds.websocket.label',
  mqtt: 'shared.requestKinds.mqtt.label',
  grpc: 'shared.requestKinds.grpc.label',
};

const EMPTY_SLICE: KindSettings<AuthProtocolKind> = {};

/** Session-scoped memory of the picked sub-tab: the section unmounts
 *  on every section switch, and the pick must survive that — a
 *  reading preference, not container state. */
let sessionKind: AuthProtocolKind = 'http';

interface SettingsSectionProps {
  settings: ContainerSettings;
  onChange: (next: ContainerSettings) => void;
  /** The knobs whose draft value differs from the saved record, each
   *  on its kind — the Save's own diff. */
  unsaved: ReadonlyArray<ContainerSettingUpdate>;
  /** The chain above this container (outer → inner) — a folder's
   *  ancestors; empty for a collection. Every sub-tab sits on the
   *  ancestor plane (explicit wins). */
  chain: readonly SettingsCarrier[];
  onOpenSource: InheritedSettingsView['onOpenSource'];
  /** Editing-scope workspace, threaded to the HTTP rows. */
  workspaceId: string | null;
}

const SettingsSection: React.FC<SettingsSectionProps> = ({
  settings,
  onChange,
  unsaved,
  chain,
  onOpenSource,
  workspaceId,
}) => {
  const t = useT();
  const [kind, setKind] = useState<AuthProtocolKind>(sessionKind);
  const pickKind = (next: AuthProtocolKind): void => {
    sessionKind = next;
    setKind(next);
  };
  const kindUnsaved = (k: AuthProtocolKind): boolean => unsaved.some((update) => update.kind === k);
  const unsavedKeys = useMemo(
    () => new Set<string>(unsaved.filter((update) => update.kind === kind).map((update) => update.key)),
    [unsaved, kind],
  );
  const inherited = useMemo(
    (): InheritedSettingsView =>
      chain.length === 0
        ? { ...NO_INHERITED_SETTINGS, subject: 'folder', onOpenSource }
        : inheritedSettingsViewFor(kind, chain, 'folder', onOpenSource),
    [kind, chain, onOpenSource],
  );
  const items = SETTINGS_KINDS.map((k) => ({
    key: k,
    label: (
      <span data-testid={`oh-container-settings-kind-${k}`}>
        {t(KIND_LABEL_KEY[k])}
        {kindUnsaved(k) ? <TabDot tone="unsaved" /> : null}
      </span>
    ),
  }));

  // The sub-tabs hand back the kind's whole slice; a cleared knob
  // lands as `undefined` in it (the per-knob unset the Save diff
  // emits), and a slice left with nothing set leaves the record — the
  // editor's derived dirty compares the draft whole, and an empty
  // slice is the absent one (the projection's own reading).
  const slice = <K extends AuthProtocolKind>(k: K): KindSettings<K> => settings[k] ?? EMPTY_SLICE;
  const replace = <K extends AuthProtocolKind>(k: K, next: KindSettings<K>): void => {
    const record: ContainerSettings = { ...settings };
    if (definedSettingKeys(k, next).length > 0) record[k] = next;
    else delete record[k];
    onChange(record);
  };

  const body = (() => {
    switch (kind) {
      case 'http':
        return (
          <SettingsTab
            scope="container"
            value={slice('http')}
            onChange={(next) => replace('http', next)}
            unsaved={unsavedKeys}
            inherited={inherited}
            workspaceId={workspaceId}
          />
        );
      case 'websocket':
        return (
          <WebSocketSettingsRows
            scope="container"
            flavor="raw"
            value={slice('websocket')}
            onChange={(next) => replace('websocket', next)}
            unsaved={unsavedKeys}
            inherited={inherited}
          />
        );
      case 'mqtt':
        return (
          <MqttSettingsRows
            scope="container"
            v5
            value={slice('mqtt')}
            onChange={(next) => replace('mqtt', next)}
            unsaved={unsavedKeys}
            inherited={inherited}
          />
        );
      case 'grpc':
        return (
          <GrpcSettingsRows
            scope="container"
            value={slice('grpc')}
            onChange={(next) => replace('grpc', next)}
            unsaved={unsavedKeys}
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
