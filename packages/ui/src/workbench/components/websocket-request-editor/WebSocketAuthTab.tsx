/**
 * WebSocketAuthTab — the request's auth block on the shared
 * `auth-layout` anatomy: Inherit (the ancestor pool's default or a
 * named entry, resolved at Connect under the WebSocket mask — bearer ·
 * basic · api-key in header), none, or an own Bearer token. Where the
 * credential rides depends on the flavor — a handshake header for raw
 * (node hosts only), the CONNECT auth payload plus that header for
 * Socket.IO — so the rail note is per flavor. With ancestry the select
 * leads with the Inherited group (entries outside the mask greyed with
 * the refusal); an inherited type outside the mask is named on the
 * empty state in warning tone — Connect fails with the same sentence.
 */

import type { WebSocketAuth } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Select } from 'antd';
import type React from 'react';
import { useMemo } from 'react';
import type { RequestAncestry } from '../request-container/ancestry';
import {
  buildInheritedGroup,
  type InheritedAuthAttribution,
  InheritedAuthEmptyState,
  inheritSelectValue,
  parseInheritSelectValue,
  useSessionInheritDetail,
} from '../request-editor/inherited-auth';
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
  /** What Inherit resolves to and from which level; absent = unknown
   *  (a scratch draft, or a tree still hydrating). */
  inheritedFrom?: InheritedAuthAttribution;
  /** The ancestor chain behind the select's Inherited group; absent =
   *  the flat select. */
  ancestry?: RequestAncestry | null;
  /** The session URL — host-scoped entries resolve against it for the
   *  Default option's label. */
  url?: string;
  /** Opens the supplying container's Authorization section. */
  onOpenContainerAuth?: (kind: 'collection' | 'folder', uid: string, name: string) => void;
  onChange: (auth: WebSocketAuth) => void;
}

const WebSocketAuthTab: React.FC<WebSocketAuthTabProps> = ({
  auth,
  socketioFlavor,
  inheritedFrom,
  ancestry,
  url = '',
  onOpenContainerAuth,
  onChange,
}) => {
  const t = useT();
  const inherit = useSessionInheritDetail(
    'websocket',
    'workbench.editors.websocket.auth.inheritUnsupported',
    inheritedFrom,
  );
  const options = useMemo(() => {
    const own = [
      { value: 'none', label: t('workbench.editors.request.auth.type.none') },
      { value: 'bearer', label: t('workbench.editors.request.auth.type.bearer') },
    ];
    if (ancestry === undefined) {
      return [{ value: 'inherit', label: t('workbench.editors.request.auth.type.inherit') }, ...own];
    }
    return [
      buildInheritedGroup({
        t,
        kind: 'websocket',
        ancestry,
        url,
        unsupportedKey: 'workbench.editors.websocket.auth.inheritUnsupported',
        ...(auth.type === 'inherit' && auth.authUid !== undefined ? { currentAuthUid: auth.authUid } : {}),
      }),
      ...own,
    ];
  }, [t, ancestry, url, auth]);
  const handleSelect = (value: string) => {
    const pick = parseInheritSelectValue(value);
    if (pick !== null) {
      onChange({ type: 'inherit', ...(pick.authUid !== undefined ? { authUid: pick.authUid } : {}) });
      return;
    }
    onChange(
      value === 'bearer' ? { type: 'bearer', token: auth.type === 'bearer' ? auth.token : '' } : { type: 'none' },
    );
  };
  return (
    <AuthTabShell
      rail={
        <>
          <AuthTypeLabel>{t('workbench.editors.request.auth.typeLabel')}</AuthTypeLabel>
          <Select
            size="middle"
            data-testid="ws-auth-type"
            value={inheritSelectValue(auth)}
            options={options}
            onChange={handleSelect}
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
        <InheritedAuthEmptyState
          title={t('workbench.editors.request.auth.type.inherit')}
          detail={inherit.detail}
          unsupported={inherit.unsupported}
          inheritedFrom={inheritedFrom}
          onOpenContainerAuth={onOpenContainerAuth}
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
