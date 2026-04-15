/**
 * EnumField — renders a picklist setting.
 *
 * ≤4 options → Radio.Group (better scannability)
 * >4 options → Select (avoids line overflow)
 */

import { Radio, Select, Tooltip } from 'antd';
import type React from 'react';
import { useUntypedSetting } from '../hooks';
import type { SettingDef } from '../types';
import FieldRow from './FieldRow';

interface EnumFieldProps {
  def: SettingDef;
}

const EnumField: React.FC<EnumFieldProps> = ({ def }) => {
  const [value, setValue] = useUntypedSetting(def.key);
  const options = def.enumOptions ?? [];

  const control =
    options.length <= 4 ? (
      <Radio.Group
        value={value}
        onChange={(e) => setValue(e.target.value)}
        optionType="button"
        buttonStyle="solid"
      >
        {options.map((opt) => {
          const button = <Radio.Button value={opt.value}>{opt.label}</Radio.Button>;
          return opt.description ? (
            <Tooltip key={String(opt.value)} title={opt.description}>
              {button}
            </Tooltip>
          ) : (
            <span key={String(opt.value)}>{button}</span>
          );
        })}
      </Radio.Group>
    ) : (
      <Select
        value={value as string | number}
        onChange={(next) => setValue(next)}
        style={{ width: '100%' }}
        options={options.map((opt) => ({
          value: opt.value as string | number,
          label: opt.label,
          title: opt.description,
        }))}
      />
    );

  return (
    <FieldRow
      settingKey={def.key}
      label={def.label}
      description={def.description}
      experimental={def.experimental}
      requiresConnection={def.requiresConnection}
    >
      {control}
    </FieldRow>
  );
};

export default EnumField;
