import { Button } from 'antd';
import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import type { ResolvedSettingDef } from '../types';
import FieldRow from './FieldRow';

interface ActionFieldProps {
  def: ResolvedSettingDef;
}

const ActionField: React.FC<ActionFieldProps> = ({ def }) => {
  const t = useT();
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
        {action?.label ?? t('workbench.settings.row.run')}
      </Button>
    </FieldRow>
  );
};

export default ActionField;
