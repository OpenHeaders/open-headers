/**
 * Product-telemetry inspector row — the "view every event, byte for
 * byte" affordance that ships beside the telemetry toggle
 * (`TELEMETRY_PLAN.md` §6). Reads the host client's session log over
 * `productTelemetryRead`: every event since launch, including the ones
 * suppressed while the switch was off, rendered exactly as they travel
 * on the wire.
 */

import { EyeOutlined, ReloadOutlined } from '@ant-design/icons';
import type { ProductTelemetrySnapshot } from '@openheaders/core/bridge';
import { getHostBridge } from '@openheaders/core/bridge';
import { Button, Empty, Modal, Tag, Typography } from 'antd';
import type React from 'react';
import { useCallback, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import FieldRow from '../fields/FieldRow';
import { resolveDescription, resolveLabel } from '../localize';
import type { SettingDef } from '../types';

const { Text } = Typography;

const DISPOSITION_COLOR: Record<string, string> = {
  sent: 'green',
  pending: 'blue',
  suppressed: 'default',
  dropped: 'orange',
};

const ProductTelemetryEventsRow: React.FC<{ def: SettingDef }> = ({ def }) => {
  const t = useT();
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

  return (
    <FieldRow settingKey={def.key} label={resolveLabel(def, t)} description={resolveDescription(def, t)} resettable={false}>
      <Button size="small" icon={<EyeOutlined />} onClick={show} data-testid="product-telemetry-view-events">
        View events
      </Button>
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
            <Button size="small" icon={<ReloadOutlined />} onClick={refresh}>
              Refresh
            </Button>
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

export default ProductTelemetryEventsRow;
