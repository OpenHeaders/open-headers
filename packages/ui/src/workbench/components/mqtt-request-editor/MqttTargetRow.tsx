/**
 * MqttTargetRow — the editor header's title slot (the WS editor's
 * discipline): version select (V5 default / V3.1.1) + scheme select
 * (mqtt/mqtts/ws/wss string surgery) + URL. The version knob locks
 * while a session is in flight — the open session speaks the version
 * it connected with, so a live flip could only misstate it.
 */

import { useT } from '@openheaders/ui/context/LocaleContext';
import { Input, Select, Tooltip } from 'antd';
import type React from 'react';
import { type Dispatch, type SetStateAction, useState } from 'react';
import { MQTT_SCHEMES, type MqttScheme, schemeOf, withScheme } from './compose';
import type { MqttDraft } from './draft';

interface MqttTargetRowProps {
  draft: MqttDraft;
  setDraft: Dispatch<SetStateAction<MqttDraft>>;
  /** A session is in flight — the version knob locks. */
  inFlight: boolean;
}

const MqttTargetRow: React.FC<MqttTargetRowProps> = ({ draft, setDraft, inFlight }) => {
  const t = useT();
  const scheme = schemeOf(draft.url);

  // The hover tooltips yield to the dropdowns: suppressed while a
  // menu is open AND after a pick until the pointer leaves — never a
  // tooltip stacked over (or straight after) the menu. Options carry
  // an empty `title` so the browser-native label tooltip never
  // doubles the antd one.
  const [versionMenuOpen, setVersionMenuOpen] = useState(false);
  const [versionTipSuppressed, setVersionTipSuppressed] = useState(false);
  const [schemeMenuOpen, setSchemeMenuOpen] = useState(false);
  const [schemeTipSuppressed, setSchemeTipSuppressed] = useState(false);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
      <Tooltip
        open={versionMenuOpen || versionTipSuppressed ? false : undefined}
        styles={{ root: { maxWidth: 420 } }}
        title={
          inFlight ? (
            t('workbench.editors.mqtt.version.lockedWhileConnected')
          ) : (
            // The catalog value carries its line breaks — one line per
            // version's explanation, never one continuous sentence.
            <span style={{ whiteSpace: 'pre-line' }}>{t('workbench.editors.mqtt.version.tooltip')}</span>
          )
        }
      >
        <Select
          size="small"
          style={{ width: 84, flexShrink: 0 }}
          value={draft.protocolVersion}
          disabled={inFlight}
          options={[
            { value: '5.0', label: t('workbench.editors.mqtt.version.v5'), title: '' },
            { value: '3.1.1', label: t('workbench.editors.mqtt.version.v311'), title: '' },
          ]}
          onOpenChange={setVersionMenuOpen}
          onChange={(protocolVersion: '5.0' | '3.1.1') => {
            setVersionTipSuppressed(true);
            setDraft((d) => ({ ...d, protocolVersion }));
          }}
          onMouseLeave={() => setVersionTipSuppressed(false)}
          data-testid="mqtt-version-select"
        />
      </Tooltip>
      <Tooltip
        open={schemeMenuOpen || schemeTipSuppressed ? false : undefined}
        styles={{ root: { maxWidth: 420 } }}
        title={<span style={{ whiteSpace: 'pre-line' }}>{t('workbench.editors.mqtt.scheme.tooltip')}</span>}
      >
        <Select
          size="small"
          style={{ width: 92, flexShrink: 0 }}
          value={scheme}
          options={MQTT_SCHEMES.map((s) => ({ value: s, label: `${s}://`, title: '' }))}
          onOpenChange={setSchemeMenuOpen}
          onChange={(next: MqttScheme) => {
            setSchemeTipSuppressed(true);
            setDraft((d) => ({ ...d, url: withScheme(d.url, next) }));
          }}
          onMouseLeave={() => setSchemeTipSuppressed(false)}
          data-testid="mqtt-scheme-select"
        />
      </Tooltip>
      <Input
        style={{ flex: 1, minWidth: 0, fontFamily: "'SF Mono', monospace", fontSize: 12 }}
        placeholder={t('workbench.editors.mqtt.urlPlaceholder')}
        value={draft.url}
        onChange={(e) => setDraft((d) => ({ ...d, url: e.target.value }))}
        data-testid="mqtt-url-input"
      />
    </div>
  );
};

export default MqttTargetRow;
