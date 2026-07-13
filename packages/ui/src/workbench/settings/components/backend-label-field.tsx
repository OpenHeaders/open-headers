/** Display-name editor for one `OH.backends` record — bookkeeping, never re-dials. */

import { Input } from 'antd';
import type React from 'react';
import { useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import FieldRow from '../fields/FieldRow';
import { useBackendRecord } from './backend-record-context';

const BackendLabelField: React.FC = () => {
  const t = useT();
  const handle = useBackendRecord();
  const [draft, setDraft] = useState(handle?.record.label ?? '');
  if (!handle) return null;
  const commit = (): void => {
    if (draft !== handle.record.label) void handle.patch({ label: draft });
  };
  return (
    <FieldRow
      settingKey="backend.label"
      label={t('workbench.settings.backendPane.field.label.label')}
      description={t('workbench.settings.backendPane.field.label.description')}
      block
    >
      <Input
        style={{ width: '100%' }}
        value={draft}
        placeholder={t('workbench.settings.backendPane.field.label.placeholder')}
        aria-label={t('workbench.settings.backendPane.field.label.aria')}
        maxLength={64}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onPressEnter={commit}
      />
    </FieldRow>
  );
};

export default BackendLabelField;
