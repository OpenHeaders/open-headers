/**
 * MqttAuthTab — the session credential on the shared `auth-layout`
 * anatomy: Inherit (the ancestor pool's default or a named entry,
 * resolved at Connect under the MQTT mask — Basic only), none, or an
 * own Basic pair (the CONNECT packet's User Name and Password — both
 * MQTT versions carry them; `{{refs}}` resolve at Connect and saved
 * examples never capture the credential — the rail note names all of
 * it). An inherited type outside the mask is named on the empty state
 * in warning tone — Connect fails with the same sentence.
 */

import type { MqttAuth } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Select, Typography } from 'antd';
import type React from 'react';
import { type InheritedAuthAttribution, useSessionInheritDetail } from '../request-editor/AuthorizationTab';
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

const { Text } = Typography;

interface MqttAuthTabProps {
  auth: MqttAuth;
  /** What Inherit resolves to and from which level; absent = unknown
   *  (a scratch draft, or a tree still hydrating). */
  inheritedFrom?: InheritedAuthAttribution;
  onChange: (auth: MqttAuth) => void;
}

const MqttAuthTab: React.FC<MqttAuthTabProps> = ({ auth, inheritedFrom, onChange }) => {
  const t = useT();
  const inherit = useSessionInheritDetail('mqtt', 'workbench.editors.mqtt.auth.inheritUnsupported', inheritedFrom);
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
              { value: 'inherit', label: t('workbench.editors.request.auth.type.inherit') },
              { value: 'none', label: t('workbench.editors.request.auth.type.none') },
              { value: 'basic', label: t('workbench.editors.request.auth.type.basic') },
            ]}
            onChange={(type: 'inherit' | 'none' | 'basic') =>
              onChange(
                type === 'basic'
                  ? {
                      type: 'basic',
                      username: auth.type === 'basic' ? auth.username : '',
                      password: auth.type === 'basic' ? auth.password : '',
                    }
                  : { type },
              )
            }
            style={{ width: '100%' }}
          />
          {auth.type === 'inherit' && <AuthRailNote>{t('workbench.editors.request.auth.inheritNote')}</AuthRailNote>}
          {auth.type === 'none' && <AuthRailNote>{t('workbench.editors.request.auth.noneNote')}</AuthRailNote>}
          {auth.type === 'basic' && <AuthRailNote>{t('workbench.editors.mqtt.auth.help')}</AuthRailNote>}
        </>
      }
    >
      {auth.type === 'inherit' && (
        <AuthEmptyState
          title={t('workbench.editors.request.auth.type.inherit')}
          note={inherit.unsupported ? <Text type="warning">{inherit.detail}</Text> : inherit.detail}
          testId="mqtt-auth-inherit-state"
        />
      )}
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
