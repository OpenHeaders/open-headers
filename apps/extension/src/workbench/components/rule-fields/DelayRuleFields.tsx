/**
 * DelayRuleFields — delay rule configuration.
 */

import { InfoCircleOutlined } from '@ant-design/icons';
import { Alert, Form, InputNumber, Typography } from 'antd';
import type React from 'react';
import { EntityField, RULE_FIELD } from '@/shared/awareness';
import { useInspectorNav } from '../../hooks/useInspectorNav';
import { getDocId } from '../InspectorDocs';
import ScalarConflictChip from './ScalarConflictChip';
import type { ConflictBridge } from './use-rule-conflicts';

const { Text } = Typography;

interface DelayRuleFieldsProps {
  conflicts?: ConflictBridge;
}

const DelayRuleFields: React.FC<DelayRuleFieldsProps> = ({ conflicts }) => {
  const { openDocs } = useInspectorNav();

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <Text strong style={{ fontSize: 13 }}>
          Actions
        </Text>
        <InfoCircleOutlined
          style={{ fontSize: 12, color: 'var(--ant-color-text-tertiary)', cursor: 'pointer' }}
          onClick={() => openDocs(getDocId('delay', 'action'))}
        />
      </div>
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 12, fontSize: 12 }}
        message="Document and iframe navigations are delayed up to 30,000ms via a local waiting page. JS-initiated XHR/Fetch is capped at 5,000ms to avoid HTTP connection pool starvation. Sub-resources (CSS, JS, images) are not delayed."
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
          Delay
        </Text>
        <EntityField path={RULE_FIELD.delayMs}>
          <Form.Item name="delayMs" style={{ marginBottom: 0 }}>
            {/* min={1}: a 0ms delay makes the rule a no-op (the compiler skips
                `delayMs === 0`), so the rule would save but never fire. Forcing
                >=1 keeps "saved" and "effective" aligned. */}
            <InputNumber min={1} max={30000} step={100} addonAfter="ms" style={{ width: 160 }} placeholder="1000" />
          </Form.Item>
        </EntityField>
        <ScalarConflictChip formName="delayMs" schemaPath={RULE_FIELD.delayMs} conflicts={conflicts} />
        <Text type="secondary" style={{ fontSize: 11 }}>
          Max 30,000 ms
        </Text>
      </div>
    </div>
  );
};

export default DelayRuleFields;
