/**
 * GrpcAuthTab — the request's auth block: none, or a Bearer token sent
 * as the `authorization` metadata pair at invoke (templates resolve
 * then; the help copy names the exclusions).
 */

import type { GrpcAuth } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Input, Select, Typography } from 'antd';
import type React from 'react';

const { Text } = Typography;

interface GrpcAuthTabProps {
  auth: GrpcAuth;
  onChange: (auth: GrpcAuth) => void;
}

const GrpcAuthTab: React.FC<GrpcAuthTabProps> = ({ auth, onChange }) => {
  const t = useT();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 560 }}>
      <div>
        <Text type="secondary" style={{ display: 'block', fontSize: 11, marginBottom: 4 }}>
          {t('workbench.editors.grpc.auth.typeLabel')}
        </Text>
        <Select
          style={{ width: 220 }}
          value={auth.type}
          options={[
            { value: 'none', label: t('workbench.editors.grpc.auth.typeNone') },
            { value: 'bearer', label: t('workbench.editors.grpc.auth.typeBearer') },
          ]}
          onChange={(type: 'none' | 'bearer') =>
            onChange(type === 'bearer' ? { type: 'bearer', token: auth.type === 'bearer' ? auth.token : '' } : { type: 'none' })
          }
          data-testid="grpc-auth-type"
        />
      </div>
      {auth.type === 'bearer' && (
        <div>
          <Text type="secondary" style={{ display: 'block', fontSize: 11, marginBottom: 4 }}>
            {t('workbench.editors.grpc.auth.tokenLabel')}
          </Text>
          <Input
            style={{ fontFamily: "'SF Mono', monospace", fontSize: 12 }}
            placeholder={t('workbench.editors.grpc.auth.tokenPlaceholder')}
            value={auth.token}
            onChange={(e) => onChange({ type: 'bearer', token: e.target.value })}
            data-testid="grpc-auth-token"
          />
          <Text type="secondary" style={{ display: 'block', fontSize: 11, marginTop: 6 }}>
            {t('workbench.editors.grpc.auth.help')}
          </Text>
        </div>
      )}
    </div>
  );
};

export default GrpcAuthTab;
