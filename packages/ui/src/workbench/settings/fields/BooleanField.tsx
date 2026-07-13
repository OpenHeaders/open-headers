import { Checkbox } from 'antd';
import type React from 'react';
import { useUntypedSetting } from '../hooks';
import type { ResolvedSettingDef } from '../types';
import FieldRow from './FieldRow';

interface BooleanFieldProps {
  def: ResolvedSettingDef;
}

const BooleanField: React.FC<BooleanFieldProps> = ({ def }) => {
  const [value, setValue] = useUntypedSetting(def.key);
  return (
    <FieldRow
      settingKey={def.key}
      label={def.label}
      description={def.description}
      experimental={def.experimental}
      requiresConnection={def.requiresConnection}
      requiresCapability={def.requiresCapability}
      capabilityUnavailableHint={def.capabilityUnavailableHint}
      labelInControl
    >
      <Checkbox checked={Boolean(value)} onChange={(e) => setValue(e.target.checked)} style={{ fontSize: 13 }}>
        {def.label}
      </Checkbox>
    </FieldRow>
  );
};

export default BooleanField;
