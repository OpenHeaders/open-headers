/**
 * WsTargetRow — the editor header's title slot: the flavor tag
 * (identity chrome, fixed at creation), the ws/wss scheme lock, and
 * the URL.
 */

import { LockOutlined, UnlockOutlined } from '@ant-design/icons';
import type { WebSocketRequest } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Button, Input, Tag, Tooltip, theme } from 'antd';
import type React from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { toggleScheme } from './compose';
import type { WebSocketDraft } from './draft';

interface WsTargetRowProps {
  draft: WebSocketDraft;
  setDraft: Dispatch<SetStateAction<WebSocketDraft>>;
  flavor: WebSocketRequest['flavor'];
}

const WsTargetRow: React.FC<WsTargetRowProps> = ({ draft, setDraft, flavor }) => {
  const t = useT();
  const { token } = theme.useToken();
  const secure = !draft.url.startsWith('ws://');
  const schemeLabel = secure ? t('workbench.editors.websocket.scheme.wss') : t('workbench.editors.websocket.scheme.ws');
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
      <Tag style={{ marginInlineEnd: 0, flexShrink: 0, fontSize: 10 }}>
        {flavor === 'socketio'
          ? t('workbench.editors.websocket.flavor.socketio')
          : t('workbench.editors.websocket.flavor.raw')}
      </Tag>
      <Tooltip title={schemeLabel}>
        <Button
          icon={
            secure ? (
              <LockOutlined style={{ color: token.colorSuccess }} />
            ) : (
              <UnlockOutlined style={{ color: token.colorWarning }} />
            )
          }
          onClick={() => setDraft((d) => ({ ...d, url: toggleScheme(d.url) }))}
          aria-label={schemeLabel}
          data-testid="websocket-scheme-lock"
        />
      </Tooltip>
      <Input
        style={{ flex: 1, minWidth: 0, fontFamily: "'SF Mono', monospace", fontSize: 12 }}
        placeholder={t('workbench.editors.websocket.urlPlaceholder')}
        value={draft.url}
        onChange={(e) => setDraft((d) => ({ ...d, url: e.target.value }))}
        data-testid="websocket-url-input"
      />
    </div>
  );
};

export default WsTargetRow;
