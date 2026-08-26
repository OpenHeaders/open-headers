/**
 * WebSocketAuthTab — the request's auth block on the shared
 * `auth-layout` anatomy: none, or a Bearer token. Where it rides
 * depends on the flavor — a handshake header for raw (node hosts
 * only), the CONNECT auth payload plus that header for Socket.IO —
 * so the rail note is per flavor.
 */

import type { WebSocketAuth } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Select } from 'antd';
import type React from 'react';
import {
  AuthEmptyState,
  AuthForm,
  AuthLabeledRow,
  AuthRailNote,
  AuthSecretField,
  AuthTabShell,
  AuthTypeLabel,
} from '../request-editor/auth-layout';

interface WebSocketAuthTabProps {
  auth: WebSocketAuth;
  socketioFlavor: boolean;
  onChange: (auth: WebSocketAuth) => void;
}

const WebSocketAuthTab: React.FC<WebSocketAuthTabProps> = ({ auth, socketioFlavor, onChange }) => {
  const t = useT();
  return (
    <AuthTabShell
      rail={
        <>
          <AuthTypeLabel>{t('workbench.editors.request.auth.typeLabel')}</AuthTypeLabel>
          <Select
            size="middle"
            data-testid="ws-auth-type"
            value={auth.type}
            options={[
              { value: 'none', label: t('workbench.editors.request.auth.type.none') },
              { value: 'bearer', label: t('workbench.editors.request.auth.type.bearer') },
            ]}
            onChange={(type: 'none' | 'bearer') =>
              onChange(
                type === 'bearer'
                  ? { type: 'bearer', token: auth.type === 'bearer' ? auth.token : '' }
                  : { type: 'none' },
              )
            }
            style={{ width: '100%' }}
          />
          {auth.type === 'none' && <AuthRailNote>{t('workbench.editors.request.auth.noneNote')}</AuthRailNote>}
          {auth.type === 'bearer' && (
            <AuthRailNote>
              {socketioFlavor
                ? t('workbench.editors.websocket.auth.helpSocketio')
                : t('workbench.editors.websocket.auth.helpRaw')}
            </AuthRailNote>
          )}
        </>
      }
    >
      {auth.type === 'none' && (
        <AuthEmptyState
          glyph="—"
          title={t('workbench.editors.request.auth.type.none')}
          note={t('workbench.editors.request.auth.noneNote')}
        />
      )}
      {auth.type === 'bearer' && (
        <AuthForm>
          <AuthLabeledRow label={t('workbench.editors.request.auth.token')}>
            <AuthSecretField
              value={auth.token}
              onChange={(next) => onChange({ type: 'bearer', token: next })}
              placeholder={t('workbench.editors.request.auth.tokenPlaceholder')}
              data-testid="ws-auth-token"
            />
          </AuthLabeledRow>
        </AuthForm>
      )}
    </AuthTabShell>
  );
};

export default WebSocketAuthTab;
