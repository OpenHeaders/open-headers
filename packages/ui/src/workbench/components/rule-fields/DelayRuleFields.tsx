/**
 * DelayRuleFields — delay rule configuration.
 */

import { Alert, Form, InputNumber, Typography } from 'antd';
import type React from 'react';
import { EntityField, useActionPaths } from '@openheaders/ui/shared/awareness';
import { getDocId } from '../docs/doc-ids';
import SectionInfo from '../shared/SectionInfo';
import ScalarConflictChip from '@openheaders/ui/shared/conflicts/ScalarConflictChip';

const { Text } = Typography;

const DelayRuleFields: React.FC = () => {
  const paths = useActionPaths();

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <Text strong style={{ fontSize: 13 }}>
          Actions
        </Text>
        <SectionInfo
          content={{
            kicker: 'Delay Rule',
            title: 'Actions',
            summary: 'Holds matching requests for the configured time before letting them continue.',
          }}
          docId={getDocId('delay', 'action')}
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
        <EntityField path={paths.delayMs}>
          <Form.Item name="delayMs" style={{ marginBottom: 0 }}>
            {/* min={1}: a 0ms delay makes the rule a no-op (the compiler skips
                `delayMs === 0`), so the rule would save but never fire. Forcing
                >=1 keeps "saved" and "effective" aligned. */}
            <InputNumber min={1} max={30000} step={100} addonAfter="ms" style={{ width: 160 }} placeholder="1000" />
          </Form.Item>
        </EntityField>
        <ScalarConflictChip formName="delayMs" schemaPath={paths.delayMs} />
        <Text type="secondary" style={{ fontSize: 11 }}>
          Max 30,000 ms
        </Text>
      </div>
    </div>
  );
};

export default DelayRuleFields;
