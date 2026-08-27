/**
 * WsParamsTab — the handshake's query params, on the same table and
 * with the same anatomy as the HTTP editor's Params tab: Key / Value /
 * Description columns, the `key:value` bulk-edit format, and the
 * `hasEquals` annotation that keeps `?key=` in the URL once a value
 * has been typed. No auth-derived rows — WebSocket auth has no
 * query-borne form.
 */

import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import KeyValueTable, { type KeyValueRow } from '../request-editor/KeyValueTable';
import {
  annotateHasEquals,
  PARAMS_BULK_PLACEHOLDER,
  paramRowsToText,
  paramTextToRows,
} from '../request-editor/ParamsTab';

interface WsParamsTabProps {
  rows: KeyValueRow[];
  onChange: (rows: KeyValueRow[]) => void;
}

const WsParamsTab: React.FC<WsParamsTabProps> = ({ rows, onChange }) => {
  const t = useT();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <KeyValueTable
        rows={rows}
        onChange={(next) => onChange(annotateHasEquals(next))}
        keyPlaceholder={t('workbench.editors.grid.key')}
        bulkEdit={{ serialize: paramRowsToText, parse: paramTextToRows, placeholder: PARAMS_BULK_PLACEHOLDER }}
      />
    </div>
  );
};

export default WsParamsTab;
