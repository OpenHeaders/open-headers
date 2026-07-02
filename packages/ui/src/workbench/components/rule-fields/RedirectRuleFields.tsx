/**
 * RedirectRuleFields — redirect target configuration.
 */

import { InfoCircleOutlined } from '@ant-design/icons';
import { Form, Radio, Tooltip, Typography } from 'antd';
import type React from 'react';
import { EntityField, useActionPaths } from '@openheaders/ui/shared/awareness';
import { useInspectorNav } from '../../hooks/useInspectorNav';
import { getDocId } from '../docs/doc-ids';
import { TemplateInput } from '../template-input';
import ScalarConflictChip from '@openheaders/ui/shared/conflicts/ScalarConflictChip';

const { Text } = Typography;

const RedirectRuleFields: React.FC = () => {
  const { openDocs } = useInspectorNav();
  const paths = useActionPaths();

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <Text strong style={{ fontSize: 13 }}>
          Actions
        </Text>
        <InfoCircleOutlined
          style={{ fontSize: 12, color: 'var(--ant-color-text-tertiary)', cursor: 'pointer' }}
          onClick={() => openDocs(getDocId('redirect', 'action'))}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          Redirects to
        </Text>
        <InfoCircleOutlined
          style={{ fontSize: 11, color: 'var(--ant-color-text-quaternary)', cursor: 'pointer' }}
          onClick={() => openDocs(getDocId('redirect-regex', 'action'))}
        />
      </div>

      <div style={{ marginBottom: 10 }}>
        <Radio.Group value="url" size="small">
          <Radio.Button value="url">Another URL</Radio.Button>
          <Tooltip title="Available in desktop app">
            <Radio.Button value="local" disabled>
              Local file
            </Radio.Button>
          </Tooltip>
        </Radio.Group>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <EntityField path={paths.redirectTo}>
          <Form.Item name="redirectTo" style={{ marginBottom: 0, flex: 1, minWidth: 0 }}>
            <TemplateInput
              placeholder="e.g. https://openheaders.io/redirected — use \1, \2 with URL Regex conditions"
              wrap
              maxRows={4}
              resizable
              allowClear
            />
          </Form.Item>
        </EntityField>
        <ScalarConflictChip formName="redirectTo" schemaPath={paths.redirectTo} />
      </div>
    </div>
  );
};

export default RedirectRuleFields;
