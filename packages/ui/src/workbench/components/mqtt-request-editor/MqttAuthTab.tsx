/**
 * MqttAuthTab — the session credential: none, or Basic (the CONNECT
 * packet's User Name and Password pair — both MQTT versions carry
 * them; `{{refs}}` resolve at Connect and saved examples never capture
 * the credential — the help copy names all of it).
 */

import type { MqttAuth } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Input, Select, Typography } from 'antd';
import type React from 'react';

const { Text } = Typography;

interface MqttAuthTabProps {
  auth: MqttAuth;
  onChange: (auth: MqttAuth) => void;
}

const MqttAuthTab: React.FC<MqttAuthTabProps> = ({ auth, onChange }) => {
  const t = useT();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 560 }}>
      <div>
        <Text type="secondary" style={{ display: 'block', fontSize: 11, marginBottom: 4 }}>
          {t('workbench.editors.mqtt.auth.typeLabel')}
        </Text>
        <Select
          style={{ width: 220 }}
          value={auth.type}
          options={[
            { value: 'none', label: t('workbench.editors.mqtt.auth.typeNone') },
            { value: 'basic', label: t('workbench.editors.mqtt.auth.typeBasic') },
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
          data-testid="mqtt-auth-type"
        />
      </div>
      {auth.type === 'basic' && (
        <>
          <div>
            <Text type="secondary" style={{ display: 'block', fontSize: 11, marginBottom: 4 }}>
              {t('workbench.editors.mqtt.auth.usernameLabel')}
            </Text>
            <Input
              style={{ fontFamily: "'SF Mono', monospace", fontSize: 12 }}
              placeholder={t('workbench.editors.mqtt.auth.usernamePlaceholder')}
              value={auth.username}
              onChange={(e) => onChange({ type: 'basic', username: e.target.value, password: auth.password })}
              data-testid="mqtt-auth-username"
            />
          </div>
          <div>
            <Text type="secondary" style={{ display: 'block', fontSize: 11, marginBottom: 4 }}>
              {t('workbench.editors.mqtt.auth.passwordLabel')}
            </Text>
            <Input.Password
              style={{ fontFamily: "'SF Mono', monospace", fontSize: 12 }}
              placeholder={t('workbench.editors.mqtt.auth.passwordPlaceholder')}
              value={auth.password}
              onChange={(e) => onChange({ type: 'basic', username: auth.username, password: e.target.value })}
              data-testid="mqtt-auth-password"
            />
            <Text type="secondary" style={{ display: 'block', fontSize: 11, marginTop: 6 }}>
              {t('workbench.editors.mqtt.auth.help')}
            </Text>
          </div>
        </>
      )}
    </div>
  );
};

export default MqttAuthTab;
