import { Input } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useUntypedSetting } from '../hooks';
import type { SettingDef } from '../types';
import FieldRow from './FieldRow';

interface StringFieldProps {
  def: SettingDef;
}

/**
 * Maintains a local draft so the user can type freely without hitting
 * the store on every keystroke. Commits on blur and on Enter. If the
 * underlying store value changes (e.g. from another context) we reset
 * the draft to match.
 */
const StringField: React.FC<StringFieldProps> = ({ def }) => {
  const [storeValue, setStoreValue] = useUntypedSetting(def.key);
  const persisted = typeof storeValue === 'string' ? storeValue : '';
  const [draft, setDraft] = useState(persisted);

  useEffect(() => {
    setDraft(persisted);
  }, [persisted]);

  const commit = useCallback(() => {
    if (draft !== persisted) {
      setStoreValue(draft);
    }
  }, [draft, persisted, setStoreValue]);

  return (
    <FieldRow
      settingKey={def.key}
      label={def.label}
      description={def.description}
      experimental={def.experimental}
      requiresConnection={def.requiresConnection}
    >
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onPressEnter={commit}
      />
    </FieldRow>
  );
};

export default StringField;
