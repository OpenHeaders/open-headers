/**
 * An inherited auth config as its REAL form, inert: the Auth type row
 * (disabled, icon + label), the type's fields, and optionally the
 * Apply-to-host scope — dashed and dimmed so the fields read as the
 * parent's, editable only there. The request's Inherit state and a
 * folder's inherited pool entry render the same anatomy the editable
 * pane has, so nothing has to be learned twice.
 */

import type { ConcreteAuthConfig } from '@openheaders/core/types';
import { Divider, Input, Select } from 'antd';
import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { AuthConfigFields, OAuth2RailControls } from './auth-config-form';
import { AUTH_FIELD_DEFAULT_MAX_WIDTH, AuthFormNote, AuthLabeledRow } from './auth-layout';
import { authTypeSelectOptions } from './auth-type-menu';
import { authTypeInfo } from './AuthRowInfo';

const noop = () => undefined;

const InheritedAuthForm: React.FC<{
  auth: ConcreteAuthConfig;
  /** Present = the Apply-to-host row renders (a pool entry's scope). */
  appliesTo?: string | null;
  testId?: string;
}> = ({ auth, appliesTo, testId }) => {
  const t = useT();
  return (
    <div inert className="oh-auth-readonly" data-testid={testId}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <AuthLabeledRow label={t('workbench.editors.request.auth.typeLabel')} info={authTypeInfo(t, auth)}>
          <Select
            size="small"
            value={auth.type}
            options={authTypeSelectOptions(t)}
            disabled
            style={{ width: '100%', maxWidth: AUTH_FIELD_DEFAULT_MAX_WIDTH }}
          />
        </AuthLabeledRow>
        {auth.type === 'none' && <AuthFormNote>{t('workbench.editors.request.auth.noneNote')}</AuthFormNote>}
        {auth.type === 'oauth2' && <OAuth2RailControls auth={auth} onChange={noop} layout="rows" />}
        <AuthConfigFields auth={auth} onChange={noop} />
        {appliesTo !== undefined && (
          <>
            <Divider style={{ margin: '4px 0' }} />
            <AuthLabeledRow label={t('workbench.editors.requestContainer.auth.appliesTo')}>
              <Input
                size="small"
                value={appliesTo ?? ''}
                placeholder={t('workbench.editors.requestContainer.auth.appliesToPlaceholder')}
                disabled
                style={{ maxWidth: AUTH_FIELD_DEFAULT_MAX_WIDTH, fontFamily: 'monospace', fontSize: 12 }}
                data-testid="oh-auth-entry-applies-to"
              />
            </AuthLabeledRow>
          </>
        )}
      </div>
    </div>
  );
};

export default InheritedAuthForm;
