import { theme } from 'antd';
import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { InfoTrigger } from '@openheaders/ui/shared/info-popover';
import { useSettingValue } from '../hooks';
import type { ResolvedSettingDef, SettingKey } from '../types';
import FieldRow from './FieldRow';

// Shared fixed label column so consecutive info rows (the About page)
// align into a definition list; sized for the longest localized label.
const LABEL_COLUMN_WIDTH = 96;

interface InfoFieldProps {
  def: ResolvedSettingDef;
}

const InfoField: React.FC<InfoFieldProps> = ({ def }) => {
  const { token } = theme.useToken();
  const t = useT();
  const stored = useSettingValue(def.key as SettingKey);
  const resolved = def.infoValue?.();
  const display = resolved !== undefined ? resolved : stored != null && stored !== '' ? String(stored) : '—';
  return (
    <FieldRow
      settingKey={def.key}
      label={def.label}
      // The info trigger renders beside the label in the column below,
      // so FieldRow's own trailing one is suppressed.
      description=""
      experimental={def.experimental}
      requiresConnection={def.requiresConnection}
      resettable={false}
      labelInControl
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            width: LABEL_COLUMN_WIDTH,
            flex: 'none',
            fontSize: 13,
            color: token.colorTextSecondary,
          }}
        >
          {def.label}
          {def.description && (
            <InfoTrigger
              content={{ title: def.label, summary: def.description }}
              ariaLabel={t('workbench.settings.row.aboutAria', { label: def.label })}
            />
          )}
        </span>
        <span style={{ fontSize: 13, color: token.colorText, minWidth: 0, overflowWrap: 'anywhere' }}>{display}</span>
      </div>
    </FieldRow>
  );
};

export default InfoField;
