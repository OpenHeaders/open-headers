/**
 * GrpcAuthTab — the request's auth block on the shared `auth-layout`
 * anatomy: Inherit (the ancestor pool's default or a named entry,
 * resolved at invoke under the gRPC mask — bearer · basic · api-key
 * in header), none, or an own Bearer token sent as the
 * `authorization` metadata pair (templates resolve then; the rail
 * note names the exclusions). An inherited type outside the mask is
 * named on the empty state in warning tone — the invoke fails with
 * the same sentence.
 */

import type { GrpcAuth } from '@openheaders/core/types';
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

interface GrpcAuthTabProps {
  auth: GrpcAuth;
  /** What Inherit resolves to and from which level; absent = unknown
   *  (a scratch draft, or a tree still hydrating). */
  inheritedFrom?: InheritedAuthAttribution;
  onChange: (auth: GrpcAuth) => void;
}

const GrpcAuthTab: React.FC<GrpcAuthTabProps> = ({ auth, inheritedFrom, onChange }) => {
  const t = useT();
  const inherit = useSessionInheritDetail('grpc', 'workbench.editors.grpc.auth.inheritUnsupported', inheritedFrom);
  return (
    <AuthTabShell
      rail={
        <>
          <AuthTypeLabel>{t('workbench.editors.request.auth.typeLabel')}</AuthTypeLabel>
          <Select
            size="middle"
            data-testid="grpc-auth-type"
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
          {auth.type === 'bearer' && <AuthRailNote>{t('workbench.editors.grpc.auth.help')}</AuthRailNote>}
        </>
      }
    >
      {auth.type === 'inherit' && (
        <AuthEmptyState
          title={t('workbench.editors.request.auth.type.inherit')}
          note={inherit.unsupported ? <Text type="warning">{inherit.detail}</Text> : inherit.detail}
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
