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
 *
 * Unchecking asks first: a retention dialog restates what counting is
 * (and is not) before the switch actually flips — "Turn off anyway"
 * commits the disable, everything else leaves counting on. Checking
 * back on is immediate.
 */

import {
  BarChartOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  LockOutlined,
  RocketOutlined,
  SafetyCertificateOutlined,
  SafetyOutlined,
} from '@ant-design/icons';
import type { ProductTelemetrySnapshot } from '@openheaders/core/bridge';
import { getHostBridge } from '@openheaders/core/bridge';
import { getDateTimeFormat } from '@openheaders/i18n';
import { Button, Checkbox, Empty, Modal, Tag, theme, Typography } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useLocale } from '@openheaders/ui/context/LocaleContext';
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
  const { locale, t } = useLocale();
  const { token } = theme.useToken();
  const [value, setValue] = useUntypedSetting(def.key);
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
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
      infoActions={[{ label: t('workbench.settings.telemetryRow.viewEvents'), onClick: show, primary: true }]}
    >
      <Checkbox
        checked={Boolean(value)}
        onChange={(e) => (e.target.checked ? setValue(true) : setConfirmOpen(true))}
        style={{ fontSize: 13 }}
      >
        {label}
      </Checkbox>
      <Modal
        title={t('workbench.settings.telemetryRow.confirmTitle')}
        open={confirmOpen}
        onCancel={() => setConfirmOpen(false)}
        footer={null}
        width={480}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '12px 0 4px' }}>
          <SafetyOutlined style={{ fontSize: 40, color: token.colorPrimary }} />
          <div style={{ textAlign: 'center' }}>
            <Text strong style={{ fontSize: 16, display: 'block', marginBottom: 4 }}>
              {t('workbench.settings.telemetryRow.confirmHeading')}
            </Text>
            <Text type="secondary">{t('workbench.settings.telemetryRow.confirmIntro')}</Text>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignSelf: 'stretch' }}>
            {(
              [
                [RocketOutlined, 'workbench.settings.telemetryRow.confirmPointFeatures'],
                [BarChartOutlined, 'workbench.settings.telemetryRow.confirmPointScope'],
                [EyeOutlined, 'workbench.settings.telemetryRow.confirmPointInspect'],
              ] as const
            ).map(([Icon, key]) => (
              <div
                key={key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 14px',
                  border: `1px solid ${token.colorBorderSecondary}`,
                  borderRadius: token.borderRadiusLG,
                }}
              >
                <Icon style={{ fontSize: 16, color: token.colorPrimary }} />
                <Text style={{ fontSize: 13 }}>{t(key)}</Text>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
            {(
              [
                [SafetyCertificateOutlined, 'workbench.settings.telemetryRow.confirmBadgePersonal'],
                [LockOutlined, 'workbench.settings.telemetryRow.confirmBadgeUrls'],
                [EyeInvisibleOutlined, 'workbench.settings.telemetryRow.confirmBadgeContent'],
              ] as const
            ).map(([Icon, key]) => (
              <Text key={key} type="secondary" style={{ fontSize: 12 }}>
                <Icon style={{ marginRight: 4 }} />
                {t(key)}
              </Text>
            ))}
          </div>
          <Button type="primary" onClick={() => setConfirmOpen(false)}>
            {t('workbench.settings.telemetryRow.confirmKeep')}
          </Button>
          <Button
            type="link"
            size="small"
            style={{ color: token.colorTextSecondary, marginTop: -8 }}
            onClick={() => {
              setValue(false);
              setConfirmOpen(false);
            }}
          >
            {t('workbench.settings.telemetryRow.confirmDisable')}
          </Button>
        </div>
      </Modal>
      <Modal
        title={t('workbench.settings.telemetryRow.modalTitle')}
        open={open}
        onCancel={() => setOpen(false)}
        footer={null}
        width={720}
      >
        {snapshot && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {snapshot.enabled
                ? t('workbench.settings.telemetryRow.sessionOn', { sessionId: snapshot.sessionId })
                : t('workbench.settings.telemetryRow.sessionOff', { sessionId: snapshot.sessionId })}
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {snapshot.installId
                ? t('workbench.settings.telemetryRow.install', { installId: snapshot.installId })
                : t('workbench.settings.telemetryRow.noInstall')}
            </Text>
          </div>
        )}
        {!snapshot || snapshot.entries.length === 0 ? (
          <Empty description={t('workbench.settings.telemetryRow.empty')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
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
                  {getDateTimeFormat(locale, { timeStyle: 'medium' }).format(new Date(entry.at))}
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
