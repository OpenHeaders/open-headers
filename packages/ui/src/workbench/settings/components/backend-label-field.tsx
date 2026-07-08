/** Display-name editor for one `OH.backends` record — bookkeeping, never re-dials. */

import { Input } from 'antd';
import type React from 'react';
import { useState } from 'react';
import FieldRow from '../fields/FieldRow';
import { useBackendRecord } from './backend-record-context';

const BackendLabelField: React.FC = () => {
  const handle = useBackendRecord();
  const [draft, setDraft] = useState(handle?.record.label ?? '');
  if (!handle) return null;
  const commit = (): void => {
    if (draft !== handle.record.label) void handle.patch({ label: draft });
  };
  return (
    <FieldRow
      settingKey="backend.label"
      label="Name"
      description="What this back-end is called across the app. Defaults to its address."
      block
    >
      <Input
        style={{ width: '100%' }}
        value={draft}
        placeholder="Work VM"
        aria-label="Back-end name"
        maxLength={64}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onPressEnter={commit}
      />
    </FieldRow>
  );
};

export default BackendLabelField;
