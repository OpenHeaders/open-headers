/**
 * Product-telemetry toggle row — the anonymous usage counting checkbox
 * with the "view every event, byte for byte" affordance folded into its
 * `(i)` popover (the telemetry plan §6): the popover's "View events"
 * action opens the shared telemetry inspector on its usage-events
 * section, so the toggle and the transparency affordance ship as one
 * row.
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
import { Button, Checkbox, Modal, theme, Typography } from 'antd';
import type React from 'react';
import { useState } from 'react';
import { useLocale } from '@openheaders/ui/context/LocaleContext';
import FieldRow from '../fields/FieldRow';
import { useUntypedSetting } from '../hooks';
import { resolveDescription, resolveLabel } from '../localize';
import type { SettingDef } from '../types';
import TelemetryInspectorModal from './telemetry-inspector-modal';

const { Text } = Typography;

const ProductTelemetryToggleRow: React.FC<{ def: SettingDef }> = ({ def }) => {
  const { t } = useLocale();
  const { token } = theme.useToken();
  const [value, setValue] = useUntypedSetting(def.key);
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const label = resolveLabel(def, t);

  return (
    <FieldRow
      settingKey={def.key}
      label={label}
      description={resolveDescription(def, t)}
      labelInControl
      infoActions={[
        { label: t('workbench.settings.telemetryRow.viewEvents'), onClick: () => setOpen(true), primary: true },
      ]}
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
      <TelemetryInspectorModal open={open} section="events" onClose={() => setOpen(false)} />
    </FieldRow>
  );
};

export default ProductTelemetryToggleRow;
