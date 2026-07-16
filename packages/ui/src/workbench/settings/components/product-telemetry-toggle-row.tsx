/**
 * Product-telemetry toggle row — the anonymous usage counting checkbox
 * with the "view every event, byte for byte" affordance folded into its
 * `(i)` popover (`TELEMETRY_PLAN.md` §6): the popover's "View events"
 * action opens the inspector modal, so the toggle and the transparency
 * affordance ship as one row. The modal reads the host client's session
 * log over `productTelemetryRead`: every event since launch, including
 * the ones suppressed while the switch was off, rendered exactly as
 * they travel on the wire. The log lives with the host client, so the
 * open modal re-polls the snapshot — the poll only runs while the modal
 * is on screen, keeping the read path one-shot RPCs with no standing
 * wire.
 */

import type { ProductTelemetrySnapshot } from '@openheaders/core/bridge';
import { getHostBridge } from '@openheaders/core/bridge';
import { Checkbox, Empty, Modal, Tag, Typography } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import FieldRow from '../fields/FieldRow';
import { useUntypedSetting } from '../hooks';
import { resolveDescription, resolveLabel } from '../localize';
import type { SettingDef } from '../types';

const { Text } = Typography;

const REFRESH_INTERVAL_MS = 3000;

const DISPOSITION_COLOR: Record<string, string> = {
  sent: 'green',
  pending: 'blue',
  suppressed: 'default',
  dropped: 'orange',
};

const ProductTelemetryToggleRow: React.FC<{ def: SettingDef }> = ({ def }) => {
  const t = useT();
  const [value, setValue] = useUntypedSetting(def.key);
  const [open, setOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<ProductTelemetrySnapshot | null>(null);

  const refresh = useCallback(() => {
    const bridge = getHostBridge();
    if (!bridge) return;
    void bridge
      .call('productTelemetryRead')
      .then(setSnapshot)
      .catch(() => setSnapshot(null));
  }, []);

  const show = useCallback(() => {
    setOpen(true);
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!open) return;
    const timer = setInterval(refresh, REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [open, refresh]);

  const label = resolveLabel(def, t);

  return (
    <FieldRow
      settingKey={def.key}
      label={label}
      description={resolveDescription(def, t)}
      labelInControl
      infoActions={[{ label: 'View events', onClick: show, primary: true }]}
    >
      <Checkbox checked={Boolean(value)} onChange={(e) => setValue(e.target.checked)} style={{ fontSize: 13 }}>
        {label}
      </Checkbox>
      <Modal
        title="Telemetry events this session"
        open={open}
        onCancel={() => setOpen(false)}
        footer={null}
        width={720}
      >
        {snapshot && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {`Session ${snapshot.sessionId} — counting is ${snapshot.enabled ? 'on' : 'off'}`}
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {snapshot.installId
                ? `Install ${snapshot.installId} (random — identifies this install, not you)`
                : 'No install identifier — counting is off'}
            </Text>
          </div>
        )}
        {!snapshot || snapshot.entries.length === 0 ? (
          <Empty description="No telemetry events recorded this session." image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <div style={{ maxHeight: 420, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {snapshot.entries.map((entry, index) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: the log is append-only and re-rendered whole per snapshot
                key={index}
                data-testid="product-telemetry-event"
                style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}
              >
                <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                  {new Date(entry.at).toLocaleTimeString()}
                </Text>
                <Tag color={DISPOSITION_COLOR[entry.disposition] ?? 'default'}>{entry.disposition}</Tag>
                <Text code style={{ fontSize: 12, wordBreak: 'break-all' }}>
                  {JSON.stringify(entry.event)}
                </Text>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </FieldRow>
  );
};

export default ProductTelemetryToggleRow;
