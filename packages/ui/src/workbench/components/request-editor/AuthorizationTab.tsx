/**
 * AuthorizationTab — the HTTP request's auth block on the shared
 * `auth-layout` anatomy: left rail auth-type picker + contextual note,
 * right pane the type's form (`auth-config-form`).
 *
 * The wire-level `credentialsMode` (cookie-jar policy) lives under
 * the Settings tab now — this tab focuses purely on how the
 * Authorization header is assembled.
 */

import type { AuthConfig } from '@openheaders/core/types';
import { Select } from 'antd';
import type React from 'react';
import { useMemo } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import type { RequestAncestry } from '../request-container/ancestry';
import { AuthConfigFields, type ConcreteAuthType, OAuth2RailControls, seedAuthConfig } from './auth-config-form';
import { AuthEmptyState, AuthRailNote, AuthTabShell } from './auth-layout';
import { AUTH_TYPE_SELECT_POPUP,
  sectionedOwnAuthTypeItems,
} from './auth-type-menu';
import { authTypeInfo } from './AuthRowInfo';
import {
  buildInheritedGroup,
  type InheritedAuthAttribution,
  InheritedAuthPane,
  type InheritSelectItem,
  AuthTypeRailHeader,
  inheritSelectValue,
  parseInheritSelectValue,
  plainInheritOption,
} from './inherited-auth';

/** The HTTP request's own types, in offer order. */
const OWN_TYPES: readonly ConcreteAuthType[] = [
  'none',
  'basic',
  'bearer',
  'api-key',
  'oauth2',
  'aws-sigv4',
  'edgegrid',
  'asap',
  'digest',
  'oauth1',
  'hawk',
  'jwt',
];

interface AuthorizationTabProps {
  auth: AuthConfig;
  onChange: (auth: AuthConfig) => void;
  /** The Inherit empty state names what the request actually sends
   *  with. Absent = unknown (a scratch draft). */
  inheritedFrom?: InheritedAuthAttribution;
  /** The ancestor chain behind the select's Inherited group (default +
   *  every named pool entry). Absent = the flat select (a scratch
   *  draft). */
  ancestry?: RequestAncestry | null;
  /** The request's URL — host-scoped entries resolve against it for
   *  the Default option's label. */
  url?: string;
  /** Opens the supplying container's Authorization section — the
   *  Inherit empty state's "Edit in …" button. */
  onOpenContainerAuth?: (kind: 'collection' | 'folder', uid: string, name: string) => void;
}

const AuthorizationTab: React.FC<AuthorizationTabProps> = ({
  auth,
  onChange,
  inheritedFrom,
  ancestry,
  url = '',
  onOpenContainerAuth,
}) => {
  const t = useT();
  // With ancestry the transparent option grows into the Inherited
  // group — every ancestor entry — over the own types as a second
  // group; without it (a scratch draft) the flat list stands.
  const authOptions = useMemo<InheritSelectItem[]>(() => {
    if (ancestry === undefined) return [plainInheritOption(t), ...sectionedOwnAuthTypeItems(t, OWN_TYPES, null)];
    return [
      buildInheritedGroup({
        t,
        kind: 'http',
        ancestry: ancestry ?? null,
        url,
        ...(auth.type === 'inherit' && auth.authUid !== undefined ? { currentAuthUid: auth.authUid } : {}),
      }),
      ...sectionedOwnAuthTypeItems(t, OWN_TYPES, t('workbench.editors.request.auth.groupOwn')),
    ];
  }, [t, ancestry, url, auth]);

  // A pick from the Inherited group writes the pick (the default or a
  // named entry uid), carrying a suspended state along; a concrete
  // type seeds a fresh config.
  const handleSelect = (value: string) => {
    const pick = parseInheritSelectValue(value);
    if (pick !== null) {
      onChange({
        type: 'inherit',
        ...(pick.authUid !== undefined ? { authUid: pick.authUid } : {}),
        ...(auth.type === 'inherit' && auth.disabled === true ? { disabled: true } : {}),
      });
      return;
    }
    const own = OWN_TYPES.find((type) => type === value);
    if (own !== undefined) onChange(seedAuthConfig(own));
  };

  return (
    <AuthTabShell
      rail={
        <>
          <AuthTypeRailHeader
            label={t('workbench.editors.request.auth.typeLabel')}
            auth={auth}
            onChange={onChange}
            info={auth.type === 'inherit' ? undefined : authTypeInfo(t, auth)}
          />
          <Select
            size="middle"
            data-testid="oh-auth-type"
            {...AUTH_TYPE_SELECT_POPUP}
            value={inheritSelectValue(auth)}
            onChange={handleSelect}
            options={authOptions}
            style={{ width: '100%' }}
          />
          {auth.type === 'inherit' && <AuthRailNote>{t('workbench.editors.request.auth.inheritNote')}</AuthRailNote>}
          {auth.type === 'none' && <AuthRailNote>{t('workbench.editors.request.auth.noneNote')}</AuthRailNote>}
          {auth.type === 'oauth2' && <OAuth2RailControls auth={auth} onChange={onChange} layout="rail" />}
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

      {auth.type === 'inherit' && (
        <InheritedAuthPane
          inheritedFrom={inheritedFrom}
          onOpenContainerAuth={onOpenContainerAuth}
          testId="oh-auth-transparent-state"
        />
      )}

      {auth.type !== 'inherit' && auth.type !== 'none' && <AuthConfigFields auth={auth} onChange={onChange} />}
    </AuthTabShell>
  );
};

export default AuthorizationTab;
