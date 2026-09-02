/**
 * SessionAuthTab — the session kinds' request auth block (WebSocket /
 * gRPC / MQTT) on the shared `auth-layout` anatomy. Inherit (the
 * ancestor pool's default or a named entry, resolved at Connect /
 * Invoke under the kind's mask), none, or the request's OWN config of
 * any type the kind can carry — the mask (`authMaskFor`) is the own
 * offer, and the shared `AuthConfigFields` renders every type with the
 * kind's placement selects (a query placement is not offered off a
 * query leg, the WebSocket SigV4 offers the signed URL alone, the DPoP
 * binding parks). With ancestry the select leads with the Inherited
 * group (entries outside the mask greyed with the refusal); an
 * inherited type outside the mask is named on the Inherit pane in
 * warning tone, and a stored own config the kind refuses (reachable
 * through sync, never through the selects) is named above its form —
 * both the sentence the executor fails with.
 */

import {
  type AuthConfigByKind,
  type AuthProtocolKind,
  authFitsKind,
  authMaskFor,
  authRefusalOf,
} from '@openheaders/core/auth-inheritance';
import type { AuthConfig } from '@openheaders/core/types';
import type { MessageKey } from '@openheaders/i18n';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Select, Typography } from 'antd';
import type React from 'react';
import { useMemo } from 'react';
import type { RequestAncestry } from '../request-container/ancestry';
import { AuthConfigFields, type ConcreteAuthType, OAuth2RailControls, seedAuthConfig } from './auth-config-form';
import { AuthEmptyState, AuthRailNote, AuthTabShell } from './auth-layout';
import { AUTH_TYPE_SELECT_POPUP, sectionedOwnAuthTypeItems } from './auth-type-menu';
import {
  buildInheritedGroup,
  type InheritedAuthAttribution,
  InheritedAuthPane,
  type InheritSelectItem,
  AuthTypeRailHeader,
  inheritSelectValue,
  parseInheritSelectValue,
  plainInheritOption,
  refusalTypeLabel,
  useSessionInheritRefusal,
} from './inherited-auth';

const { Text } = Typography;

export type SessionAuthKind = Exclude<AuthProtocolKind, 'http'>;

export interface SessionAuthTabProps<K extends SessionAuthKind> {
  kind: K;
  auth: AuthConfigByKind[K];
  onChange: (auth: AuthConfigByKind[K]) => void;
  /** The test-id stem — `<stem>-auth-type` on the select, `<stem>-auth-inherit-state` on the Inherit pane. */
  testIdStem: string;
  /** The Inherit refusal sentence — `{type}` and `{source}`. */
  unsupportedKey: MessageKey;
  /** The own-config refusal sentence — `{type}`. */
  ownUnsupportedKey: MessageKey;
  /** The rail note under an own type; `null` = none. */
  ownNoteKey: (type: ConcreteAuthType) => MessageKey | null;
  /** What Inherit resolves to and from which level; absent = unknown
   *  (a scratch draft, or a tree still hydrating). */
  inheritedFrom?: InheritedAuthAttribution;
  /** The ancestor chain behind the select's Inherited group; absent =
   *  the flat select. */
  ancestry?: RequestAncestry | null;
  /** The dial target — host-scoped entries resolve against it for the
   *  Default option's label. */
  url?: string;
  /** Opens the supplying container's Authorization section. */
  onOpenContainerAuth?: (kind: 'collection' | 'folder', uid: string, name: string) => void;
}

export function SessionAuthTab<K extends SessionAuthKind>({
  kind,
  auth,
  onChange,
  testIdStem,
  unsupportedKey,
  ownUnsupportedKey,
  ownNoteKey,
  inheritedFrom,
  ancestry,
  url = '',
  onOpenContainerAuth,
}: SessionAuthTabProps<K>): React.ReactElement {
  const t = useT();
  const refusal = useSessionInheritRefusal(kind, unsupportedKey, inheritedFrom);
  // The kind's own offer IS its mask.
  const ownTypes = useMemo<ConcreteAuthType[]>(() => [...authMaskFor(kind)], [kind]);
  const options = useMemo<InheritSelectItem[]>(() => {
    if (ancestry === undefined) return [plainInheritOption(t), ...sectionedOwnAuthTypeItems(t, ownTypes, null)];
    return [
      buildInheritedGroup({
        t,
        kind,
        ancestry,
        url,
        unsupportedKey,
        ...(auth.type === 'inherit' && auth.authUid !== undefined ? { currentAuthUid: auth.authUid } : {}),
      }),
      ...sectionedOwnAuthTypeItems(t, ownTypes, t('workbench.editors.request.auth.groupOwn')),
    ];
  }, [t, kind, ancestry, url, auth, ownTypes, unsupportedKey]);
  // The one write: every next config — an Inherit pick, a fresh seed,
  // a form edit — passes the kind's predicate before it is stored.
  const emit = (next: AuthConfig): void => {
    if (authFitsKind(kind, next)) onChange(next);
  };
  const handleSelect = (value: string) => {
    const pick = parseInheritSelectValue(value);
    if (pick !== null) {
      emit({ type: 'inherit', ...(pick.authUid !== undefined ? { authUid: pick.authUid } : {}) });
      return;
    }
    const own = ownTypes.find((type) => type === value);
    if (own !== undefined) emit(seedAuthConfig(own, kind));
  };
  const ownRefusal = auth.type === 'inherit' || auth.type === 'none' ? null : authRefusalOf(kind, auth);
  const ownNote = auth.type === 'inherit' || auth.type === 'none' ? null : ownNoteKey(auth.type);
  return (
    <AuthTabShell
      rail={
        <>
          <AuthTypeRailHeader label={t('workbench.editors.request.auth.typeLabel')} auth={auth} onChange={emit} />
          <Select
            size="middle"
            data-testid={`${testIdStem}-auth-type`}
            {...AUTH_TYPE_SELECT_POPUP}
            value={inheritSelectValue(auth)}
            options={options}
            onChange={handleSelect}
            style={{ width: '100%' }}
          />
          {auth.type === 'inherit' && <AuthRailNote>{t('workbench.editors.request.auth.inheritNote')}</AuthRailNote>}
          {auth.type === 'none' && <AuthRailNote>{t('workbench.editors.request.auth.noneNote')}</AuthRailNote>}
          {ownNote !== null && <AuthRailNote>{t(ownNote)}</AuthRailNote>}
          {auth.type === 'oauth2' && <OAuth2RailControls auth={auth} onChange={emit} layout="rail" kind={kind} />}
        </>
      }
    >
      {auth.type === 'inherit' && (
        <InheritedAuthPane
          inheritedFrom={inheritedFrom}
          refusal={refusal}
          onOpenContainerAuth={onOpenContainerAuth}
          testId={`${testIdStem}-auth-inherit-state`}
        />
      )}
      {auth.type === 'none' && (
        <AuthEmptyState
          glyph="—"
          title={t('workbench.editors.request.auth.type.none')}
          note={t('workbench.editors.request.auth.noneNote')}
        />
      )}
      {auth.type !== 'inherit' && auth.type !== 'none' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {ownRefusal !== null && (
            <Text type="warning" style={{ fontSize: 12 }} data-testid="oh-auth-own-refusal">
              {t(ownUnsupportedKey, { type: refusalTypeLabel(t, ownRefusal) })}
            </Text>
          )}
          <AuthConfigFields auth={auth} onChange={emit} kind={kind} />
        </div>
      )}
    </AuthTabShell>
  );
}
