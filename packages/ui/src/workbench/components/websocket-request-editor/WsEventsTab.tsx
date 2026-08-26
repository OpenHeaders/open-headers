/**
 * WsEventsTab — the Socket.IO events grid: a display filter over
 * incoming EVENT frames (the capture stays verbatim — the capture
 * law); with no named rows the timeline shows everything. Event name
 * rides the key track, Listen is the value cell's switch; a fresh row
 * listens by default.
 */

import type { WebSocketEventRow } from '@openheaders/core/types';
import { generateUid } from '@openheaders/core/utils';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Switch, Typography } from 'antd';
import type React from 'react';
import { EditableGridTable } from '../request-editor/EditableGridTable';
import type { EditableRowAdapter } from '../request-editor/editable-grid-types';

const { Text } = Typography;

/** Events-tab row adapter — `enabled` has no row meaning (the column
 *  is hidden). */
const EVENT_ROW_ADAPTER: EditableRowAdapter<WebSocketEventRow> = {
  getId: (r) => r.uid,
  getEnabled: () => true,
  setEnabled: (r) => r,
  getKey: (r) => r.name,
  setKey: (r, v) => ({ ...r, name: v }),
  getDescription: (r) => r.description ?? '',
  setDescription: (r, v) => ({ ...r, description: v }),
  makeEmpty: () => ({ uid: generateUid(), name: '' }),
  isEmpty: (r) => !r.name && !r.description,
};

interface WsEventsTabProps {
  rows: WebSocketEventRow[];
  onChange: (rows: WebSocketEventRow[]) => void;
}

const WsEventsTab: React.FC<WsEventsTabProps> = ({ rows, onChange }) => {
  const t = useT();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-testid="ws-events-table">
      <Text type="secondary" style={{ fontSize: 11 }}>
        {t('workbench.editors.websocket.events.hint')}
      </Text>
      <EditableGridTable<WebSocketEventRow>
        rows={rows}
        onChange={onChange}
        adapter={EVENT_ROW_ADAPTER}
        keyPlaceholder={t('workbench.editors.websocket.events.namePlaceholder')}
        headerLabels={{
          key: t('workbench.editors.websocket.events.namePlaceholder'),
          value: t('workbench.editors.websocket.events.listenLabel'),
        }}
        hideEnabled
        columnWidths={{ value: '90px' }}
        renderValueCell={(row, update, ctx) =>
          ctx.isPlaceholder ? (
            <span />
          ) : (
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
              <Switch
                size="small"
                checked={row.listen !== false}
                onChange={(listen) => update({ ...row, listen })}
                aria-label={t('workbench.editors.websocket.events.listenLabel')}
                data-testid="ws-event-listen"
              />
            </span>
          )
        }
      />
    </div>
  );
};

export default WsEventsTab;
