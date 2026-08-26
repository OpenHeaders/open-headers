/**
 * MqttAuthTab — the session credential on the shared `auth-layout`
 * anatomy: none, or Basic (the CONNECT packet's User Name and Password
 * pair — both MQTT versions carry them; `{{refs}}` resolve at Connect
 * and saved examples never capture the credential — the rail note
 * names all of it).
 */

import type { MqttAuth } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Select } from 'antd';
import type React from 'react';
import {
  AUTH_FIELD_DEFAULT_MAX_WIDTH,
  AuthEmptyState,
  AuthForm,
  AuthLabeledRow,
  AuthRailNote,
  AuthSecretField,
  AuthTabShell,
  AuthTypeLabel,
} from '../request-editor/auth-layout';
import { TemplateInput } from '../template-input';

interface MqttAuthTabProps {
  auth: MqttAuth;
  onChange: (auth: MqttAuth) => void;
}

const MqttAuthTab: React.FC<MqttAuthTabProps> = ({ auth, onChange }) => {
  const t = useT();
  return (
    <AuthTabShell
      rail={
        <>
          <AuthTypeLabel>{t('workbench.editors.request.auth.typeLabel')}</AuthTypeLabel>
          <Select
            size="middle"
            data-testid="mqtt-auth-type"
            value={auth.type}
            options={[
              { value: 'none', label: t('workbench.editors.request.auth.type.none') },
              { value: 'basic', label: t('workbench.editors.request.auth.type.basic') },
            ]}
            onChange={(type: 'none' | 'basic') =>
              onChange(
                type === 'basic'
                  ? {
                      type: 'basic',
                      username: auth.type === 'basic' ? auth.username : '',
                      password: auth.type === 'basic' ? auth.password : '',
                    }
                  : { type: 'none' },
              )
            }
            style={{ width: '100%' }}
          />
          {auth.type === 'none' && <AuthRailNote>{t('workbench.editors.request.auth.noneNote')}</AuthRailNote>}
          {auth.type === 'basic' && <AuthRailNote>{t('workbench.editors.mqtt.auth.help')}</AuthRailNote>}
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
      {auth.type === 'basic' && (
        <AuthForm>
          <AuthLabeledRow label={t('workbench.editors.request.auth.username')}>
            <TemplateInput
              size="small"
              value={auth.username}
              onChange={(next) => onChange({ type: 'basic', username: next, password: auth.password })}
              placeholder={t('workbench.editors.request.auth.usernamePlaceholder')}
              style={{ maxWidth: AUTH_FIELD_DEFAULT_MAX_WIDTH }}
              data-testid="mqtt-auth-username"
            />
          </AuthLabeledRow>
          <AuthLabeledRow label={t('workbench.editors.request.auth.password')}>
            <AuthSecretField
              value={auth.password}
              onChange={(next) => onChange({ type: 'basic', username: auth.username, password: next })}
              placeholder={t('workbench.editors.request.auth.passwordPlaceholder')}
              data-testid="mqtt-auth-password"
            />
          </AuthLabeledRow>
        </AuthForm>
      )}
    </AuthTabShell>
  );
};

export default MqttAuthTab;
