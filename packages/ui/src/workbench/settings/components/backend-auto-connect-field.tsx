/**
 * Auto-connect checkbox for the primary `OH.backends` record
 * (registry-backed since the multi-backend Phase-1 settings retirement).
 * Mirrors the generic BooleanField chrome; modified/reset are supplied
 * explicitly because the store can't derive them for a registry field.
 */

import { updatePrimaryBackend } from '@openheaders/core/backends';
import { Checkbox } from 'antd';
import type React from 'react';
import { usePrimaryBackend } from '../../../shared/backend';
import FieldRow from '../fields/FieldRow';

const FIELD_LABEL = 'Auto-connect';
const FIELD_DESCRIPTION = 'Connect to the back-end automatically whenever the extension starts.';
const DEFAULT_AUTO_CONNECT = true;

const BackendAutoConnectField: React.FC = () => {
  const autoConnect = usePrimaryBackend()?.autoConnect ?? DEFAULT_AUTO_CONNECT;
  const setAutoConnect = (next: boolean): void => {
    void updatePrimaryBackend({ autoConnect: next });
  };
  return (
    <FieldRow
      settingKey="backend.autoConnect"
      label={FIELD_LABEL}
      description={FIELD_DESCRIPTION}
      modified={autoConnect !== DEFAULT_AUTO_CONNECT}
      onReset={() => setAutoConnect(DEFAULT_AUTO_CONNECT)}
      labelInControl
    >
      <Checkbox checked={autoConnect} onChange={(e) => setAutoConnect(e.target.checked)} style={{ fontSize: 13 }}>
        {FIELD_LABEL}
      </Checkbox>
    </FieldRow>
  );
};

export default BackendAutoConnectField;
