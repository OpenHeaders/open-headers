/**
 * DelayRuleFields — delay rule configuration.
 */

import { Alert, Form, InputNumber, Typography } from 'antd';
import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { EntityField, useActionPaths } from '@openheaders/ui/shared/awareness';
import { getDocId } from '../docs/doc-ids';
import SectionInfo from '../shared/SectionInfo';
import ScalarConflictChip from '@openheaders/ui/shared/conflicts/ScalarConflictChip';

const { Text } = Typography;

const DelayRuleFields: React.FC = () => {
  const t = useT();
  const paths = useActionPaths();

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <Text strong style={{ fontSize: 13 }}>
          {t('workbench.editors.rule.fields.actionsTitle')}
        </Text>
        <SectionInfo
          content={{
            kicker: t('workbench.editors.rule.fields.delay.kicker'),
            title: t('workbench.editors.rule.fields.actionsTitle'),
            summary: t('workbench.editors.rule.fields.delay.infoSummary'),
          }}
          docId={getDocId('delay', 'action')}
        />
      </div>
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 12, fontSize: 12 }}
        message={t('workbench.editors.rule.fields.delay.capsAlert')}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
          {t('workbench.editors.rule.fields.delay.label')}
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
          {t('workbench.editors.rule.fields.delay.maxNote')}
        </Text>
      </div>
    </div>
  );
};

export default DelayRuleFields;
