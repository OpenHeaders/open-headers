/**
 * ColorField — Ant ColorPicker wrapper that commits a 6-digit hex
 * string to the store. Uses `onChangeComplete` so the store only
 * receives one write when the user finishes picking, not one per
 * preview step.
 */

import { ColorPicker } from 'antd';
import type React from 'react';
import { useUntypedSetting } from '../hooks';
import type { SettingDef } from '../types';
import FieldRow from './FieldRow';

interface ColorFieldProps {
  def: SettingDef;
}

const ColorField: React.FC<ColorFieldProps> = ({ def }) => {
  const [value, setValue] = useUntypedSetting(def.key);
  const hex = typeof value === 'string' ? value : '#000000';

  return (
    <FieldRow
      settingKey={def.key}
      label={def.label}
      description={def.description}
      experimental={def.experimental}
      requiresConnection={def.requiresConnection}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <ColorPicker
          value={hex}
          format="hex"
          disabledAlpha
          onChangeComplete={(color) => {
            setValue(`#${color.toHex()}`);
          }}
          showText
        />
      </div>
    </FieldRow>
  );
};

export default ColorField;
