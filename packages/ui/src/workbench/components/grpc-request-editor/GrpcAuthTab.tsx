/**
 * GrpcAuthTab — the request's auth block on the shared `auth-layout`
 * anatomy: Inherit (the ancestor pool's default or a named entry,
 * resolved at invoke under the gRPC mask — bearer · basic · api-key
 * in header), none, or an own Bearer token sent as the
 * `authorization` metadata pair (templates resolve then; the rail
 * note names the exclusions). With ancestry the select leads with the
 * Inherited group (entries outside the mask greyed with the refusal);
 * an inherited type outside the mask is named on the Inherit pane in
 * warning tone — the invoke fails with the same sentence.
 */

import type { GrpcAuth } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Select } from 'antd';
import type React from 'react';
import { useMemo } from 'react';
import type { RequestAncestry } from '../request-container/ancestry';
import type { ConcreteAuthType } from '../request-editor/auth-config-form';
import {
  buildInheritedGroup,
  type InheritedAuthAttribution,
  InheritedAuthPane,
  type InheritSelectItem,
  AuthTypeRailHeader,
  inheritSelectValue,
  parseInheritSelectValue,
  plainInheritOption,
  useSessionInheritRefusal,
} from '../request-editor/inherited-auth';
import { AUTH_TYPE_SELECT_POPUP,
  sectionedOwnAuthTypeItems,
} from '../request-editor/auth-type-menu';
import {
  AuthEmptyState,
  AuthForm,
  AuthLabeledRow,
  AuthRailNote,
  AuthSecretField,
  AuthTabShell,
} from '../request-editor/auth-layout';

/** The kind's own types, in offer order. */
const OWN_TYPES: readonly ConcreteAuthType[] = ['none', 'bearer'];

interface GrpcAuthTabProps {
  auth: GrpcAuth;
  /** What Inherit resolves to and from which level; absent = unknown
   *  (a scratch draft, or a tree still hydrating). */
  inheritedFrom?: InheritedAuthAttribution;
  /** The ancestor chain behind the select's Inherited group; absent =
   *  the flat select. */
  ancestry?: RequestAncestry | null;
  /** The call target — host-scoped entries resolve against it for the
   *  Default option's label. */
  url?: string;
  /** Opens the supplying container's Authorization section. */
  onOpenContainerAuth?: (kind: 'collection' | 'folder', uid: string, name: string) => void;
  onChange: (auth: GrpcAuth) => void;
}

const GrpcAuthTab: React.FC<GrpcAuthTabProps> = ({
  auth,
  inheritedFrom,
  ancestry,
  url = '',
  onOpenContainerAuth,
  onChange,
}) => {
  const t = useT();
  const refusal = useSessionInheritRefusal(
    'grpc',
    'workbench.editors.grpc.auth.inheritUnsupported',
    inheritedFrom,
  );
  const options = useMemo<InheritSelectItem[]>(() => {
    if (ancestry === undefined) return [plainInheritOption(t), ...sectionedOwnAuthTypeItems(t, OWN_TYPES, null)];
    return [
      buildInheritedGroup({
        t,
        kind: 'grpc',
        ancestry,
        url,
        unsupportedKey: 'workbench.editors.grpc.auth.inheritUnsupported',
        ...(auth.type === 'inherit' && auth.authUid !== undefined ? { currentAuthUid: auth.authUid } : {}),
      }),
      ...sectionedOwnAuthTypeItems(t, OWN_TYPES, t('workbench.editors.request.auth.groupOwn')),
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
          <AuthTypeRailHeader label={t('workbench.editors.request.auth.typeLabel')} auth={auth} onChange={onChange} />
          <Select
            size="middle"
            data-testid="grpc-auth-type"
            {...AUTH_TYPE_SELECT_POPUP}
            value={inheritSelectValue(auth)}
            options={options}
            onChange={handleSelect}
            style={{ width: '100%' }}
          />
          {auth.type === 'inherit' && <AuthRailNote>{t('workbench.editors.request.auth.inheritNote')}</AuthRailNote>}
          {auth.type === 'none' && <AuthRailNote>{t('workbench.editors.request.auth.noneNote')}</AuthRailNote>}
          {auth.type === 'bearer' && <AuthRailNote>{t('workbench.editors.grpc.auth.help')}</AuthRailNote>}
        </>
      }
    >
      {auth.type === 'inherit' && (
        <InheritedAuthPane
          inheritedFrom={inheritedFrom}
          refusal={refusal}
          onOpenContainerAuth={onOpenContainerAuth}
          testId="grpc-auth-inherit-state"
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
              data-testid="grpc-auth-token"
            />
          </AuthLabeledRow>
        </AuthForm>
      )}
    </AuthTabShell>
  );
};

export default GrpcAuthTab;
