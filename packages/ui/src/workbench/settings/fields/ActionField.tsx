import { Button } from 'antd';
import type React from 'react';
import type { SettingDef } from '../types';
import FieldRow from './FieldRow';

interface ActionFieldProps {
  def: SettingDef;
}

const ActionField: React.FC<ActionFieldProps> = ({ def }) => {
  const action = def.action;
  return (
    <FieldRow
      settingKey={def.key}
      label={def.label}
      description={def.description}
      experimental={def.experimental}
      requiresConnection={def.requiresConnection}
      resettable={false}
    >
      <Button
        danger={action?.danger}
        onClick={() => {
          void action?.run();
        }}
      >
        {action?.label ?? 'Run'}
      </Button>
    </FieldRow>
  );
};

export default ActionField;
