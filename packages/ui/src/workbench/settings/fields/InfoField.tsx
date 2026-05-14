import { theme } from 'antd';
import type React from 'react';
import { useSettingValue } from '../hooks';
import type { SettingDef, SettingKey } from '../types';
import FieldRow from './FieldRow';

interface InfoFieldProps {
  def: SettingDef;
}

const InfoField: React.FC<InfoFieldProps> = ({ def }) => {
  const { token } = theme.useToken();
  const stored = useSettingValue(def.key as SettingKey);
  const resolved = def.infoValue?.();
  const display = resolved !== undefined ? resolved : stored != null && stored !== '' ? String(stored) : '—';
  return (
    <FieldRow
      settingKey={def.key}
      label={def.label}
      description={def.description}
      experimental={def.experimental}
      requiresConnection={def.requiresConnection}
      resettable={false}
    >
      <div
        style={{
          fontSize: 13,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          color: token.colorText,
          padding: '6px 11px',
          background: token.colorBgContainer,
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: token.borderRadius,
          wordBreak: 'break-all',
        }}
      >
        {display}
      </div>
    </FieldRow>
  );
};

export default InfoField;
