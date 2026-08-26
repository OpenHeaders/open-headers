/**
 * GrpcAuthTab — the request's auth block on the shared `auth-layout`
 * anatomy: none, or a Bearer token sent as the `authorization`
 * metadata pair at invoke (templates resolve then; the rail note names
 * the exclusions).
 */

import type { GrpcAuth } from '@openheaders/core/types';
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

interface GrpcAuthTabProps {
  auth: GrpcAuth;
  onChange: (auth: GrpcAuth) => void;
}

const GrpcAuthTab: React.FC<GrpcAuthTabProps> = ({ auth, onChange }) => {
  const t = useT();
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
          {auth.type === 'bearer' && <AuthRailNote>{t('workbench.editors.grpc.auth.help')}</AuthRailNote>}
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
              data-testid="grpc-auth-token"
            />
          </AuthLabeledRow>
        </AuthForm>
      )}
    </AuthTabShell>
  );
};

export default GrpcAuthTab;
