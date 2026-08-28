/**
 * SpecTab — the HTTP request's spec binding surface. An HTTP request
 * carries no spec link of its own yet (a collection generated from an
 * OpenAPI document links at the collection level), so the tab states
 * that fact; the surface is the same slot the WebSocket / gRPC / MQTT
 * editors bind their specs in.
 */

import { useT } from '@openheaders/ui/context/LocaleContext';
import { Typography } from 'antd';
import type React from 'react';

const { Text } = Typography;

const SpecTab: React.FC = () => {
  const t = useT();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 560 }} data-testid="request-spec-tab">
      <div>
        <Text type="secondary" style={{ display: 'block', fontSize: 11, marginBottom: 4 }}>
          {t('workbench.editors.request.spec.selectLabel')}
        </Text>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {t('workbench.editors.request.spec.none')}
        </Text>
      </div>
    </div>
  );
};

export default SpecTab;
