/**
 * MultiSelectField — Ant Select in `multiple` mode.
 *
 * The schema's `enumOptions` provides the full candidate list; the
 * user picks any subset. Backing value is an array of option values.
 */

import { Select } from 'antd';
import type React from 'react';
import { useUntypedSetting } from '../hooks';
import type { SettingDef } from '../types';
import FieldRow from './FieldRow';

interface MultiSelectFieldProps {
  def: SettingDef;
}

const MultiSelectField: React.FC<MultiSelectFieldProps> = ({ def }) => {
  const [value, setValue] = useUntypedSetting(def.key);
  const options = def.enumOptions ?? [];
  const current = Array.isArray(value) ? (value as unknown[]) : [];

  return (
    <FieldRow
      settingKey={def.key}
      label={def.label}
      description={def.description}
      experimental={def.experimental}
      requiresConnection={def.requiresConnection}
    >
      <Select
        mode="multiple"
        value={current as (string | number)[]}
        onChange={(next) => setValue(next)}
        style={{ minWidth: 240, maxWidth: 400, width: 280 }}
        popupMatchSelectWidth={false}
        options={options.map((opt) => ({
          value: opt.value as string | number,
          label: opt.label,
          title: opt.description,
        }))}
      />
    </FieldRow>
  );
};

export default MultiSelectField;
