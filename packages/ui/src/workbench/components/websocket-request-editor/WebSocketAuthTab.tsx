/**
 * WebSocketAuthTab — the request's auth block on the shared
 * `auth-layout` anatomy: Inherit (the ancestor pool's default or a
 * named entry, resolved at Connect under the WebSocket mask — bearer ·
 * basic · api-key in header), none, or an own Bearer token. Where the
 * credential rides depends on the flavor — a handshake header for raw
 * (node hosts only), the CONNECT auth payload plus that header for
 * Socket.IO — so the rail note is per flavor. An inherited type
 * outside the mask is named on the empty state in warning tone —
 * Connect fails with the same sentence.
 */

import type { WebSocketAuth } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Select, Typography } from 'antd';
import type React from 'react';
import { type InheritedAuthAttribution, useSessionInheritDetail } from '../request-editor/AuthorizationTab';
import {
  AuthEmptyState,
  AuthForm,
  AuthLabeledRow,
  AuthRailNote,
  AuthSecretField,
  AuthTabShell,
  AuthTypeLabel,
} from '../request-editor/auth-layout';

const { Text } = Typography;

interface WebSocketAuthTabProps {
  auth: WebSocketAuth;
  socketioFlavor: boolean;
  /** What Inherit resolves to and from which level; absent = unknown
   *  (a scratch draft, or a tree still hydrating). */
  inheritedFrom?: InheritedAuthAttribution;
  onChange: (auth: WebSocketAuth) => void;
}

const WebSocketAuthTab: React.FC<WebSocketAuthTabProps> = ({ auth, socketioFlavor, inheritedFrom, onChange }) => {
  const t = useT();
  const inherit = useSessionInheritDetail(
    'websocket',
    'workbench.editors.websocket.auth.inheritUnsupported',
    inheritedFrom,
  );
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
              { value: 'inherit', label: t('workbench.editors.request.auth.type.inherit') },
              { value: 'none', label: t('workbench.editors.request.auth.type.none') },
              { value: 'bearer', label: t('workbench.editors.request.auth.type.bearer') },
            ]}
            onChange={(type: 'inherit' | 'none' | 'bearer') =>
              onChange(
                type === 'bearer' ? { type: 'bearer', token: auth.type === 'bearer' ? auth.token : '' } : { type },
              )
            }
            style={{ width: '100%' }}
          />
          {auth.type === 'inherit' && <AuthRailNote>{t('workbench.editors.request.auth.inheritNote')}</AuthRailNote>}
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
      {auth.type === 'inherit' && (
        <AuthEmptyState
          title={t('workbench.editors.request.auth.type.inherit')}
          note={inherit.unsupported ? <Text type="warning">{inherit.detail}</Text> : inherit.detail}
          testId="ws-auth-inherit-state"
        />
      )}
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
