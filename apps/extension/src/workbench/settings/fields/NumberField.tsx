import { InputNumber, Slider } from 'antd';
import type React from 'react';
import { useUntypedSetting } from '../hooks';
import type { SettingDef } from '../types';
import FieldRow from './FieldRow';

interface NumberFieldProps {
  def: SettingDef;
}

const NumberField: React.FC<NumberFieldProps> = ({ def }) => {
  const [value, setValue] = useUntypedSetting(def.key);
  const range = def.numberRange ?? {};
  const numericValue = typeof value === 'number' ? value : 0;
  const isSlider = range.control === 'slider' && range.min !== undefined && range.max !== undefined;

  const control = isSlider ? (
    <Slider
      min={range.min}
      max={range.max}
      step={range.step ?? 1}
      value={numericValue}
      onChange={(next) => setValue(next)}
    />
  ) : (
    <InputNumber
      style={{ width: '100%' }}
      min={range.min}
      max={range.max}
      step={range.step}
      value={numericValue}
      onChange={(next) => {
        if (typeof next === 'number') setValue(next);
      }}
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

export default NumberField;
