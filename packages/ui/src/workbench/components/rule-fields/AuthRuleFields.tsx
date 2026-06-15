/**
 * AuthRuleFields — credentials answered to an HTTP/proxy auth challenge.
 *
 * Both fields are template-resolvable so the real secret lives in the vault
 * (`{{vault.*}}`) rather than plaintext on the rule — the same
 * {@link TemplateInput} surface the header Authorization value uses. The
 * rule is debug-tier (CDP-only): it only takes effect on a tab in Debug-mode
 * scope, surfaced by the dormant badge/notice elsewhere.
 */

import { InfoCircleOutlined } from '@ant-design/icons';
import { Form, Typography } from 'antd';
import type React from 'react';
import { EntityField, useActionPaths } from '@openheaders/ui/shared/awareness';
import ScalarConflictChip from '@openheaders/ui/shared/conflicts/ScalarConflictChip';
import { useInspectorNav } from '../../hooks/useInspectorNav';
import { getDocId } from '../docs/doc-ids';
import { TemplateInput } from '../template-input';

const { Text } = Typography;

const AuthRuleFields: React.FC = () => {
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
          onClick={() => openDocs(getDocId('auth', 'action'))}
        />
      </div>

      <div
        style={{
          fontSize: 12,
          color: 'var(--ant-color-text-secondary)',
          lineHeight: 1.5,
          marginBottom: 10,
        }}
      >
        Answers a server (401) or proxy (407) authentication challenge on matching requests. Reference a vault secret —
        e.g. <Text code>{'{{vault.STAGING_PW}}'}</Text> — so the credential isn't stored in the rule.
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          Username
        </Text>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <EntityField path={paths.authUsername}>
          <Form.Item name="authUsername" style={{ marginBottom: 0, flex: 1, minWidth: 0 }}>
            <TemplateInput placeholder="e.g. dev-user or {{env.PROXY_USER}}" />
          </Form.Item>
        </EntityField>
        <ScalarConflictChip formName="authUsername" schemaPath={paths.authUsername} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          Password
        </Text>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <EntityField path={paths.authPassword}>
          <Form.Item name="authPassword" style={{ marginBottom: 0, flex: 1, minWidth: 0 }}>
            <TemplateInput placeholder="e.g. {{vault.STAGING_PW}}" />
          </Form.Item>
        </EntityField>
        <ScalarConflictChip formName="authPassword" schemaPath={paths.authPassword} />
      </div>
    </div>
  );
};

export default AuthRuleFields;
