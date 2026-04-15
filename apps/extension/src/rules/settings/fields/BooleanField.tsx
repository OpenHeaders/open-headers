import { Switch } from 'antd';
import type React from 'react';
import { useUntypedSetting } from '../hooks';
import type { SettingDef } from '../types';
import FieldRow from './FieldRow';

interface BooleanFieldProps {
  def: SettingDef;
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
    >
      <Switch checked={Boolean(value)} onChange={(next) => setValue(next)} />
    </FieldRow>
  );
};

export default BooleanField;
