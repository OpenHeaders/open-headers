/**
 * AuthRuleFields — credentials answered to an HTTP/proxy auth challenge.
 *
 * Both fields are template-resolvable so the real secret lives in the vault
 * (`{{vault.*}}`) rather than plaintext on the rule — the same
 * {@link TemplateInput} surface the header Authorization value uses. The
 * rule is debug-tier (CDP-only): it only takes effect on a tab in Debug-mode
 * scope, surfaced by the dormant badge/notice elsewhere.
 */

import { Form, Typography } from 'antd';
import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { EntityField, useActionPaths } from '@openheaders/ui/shared/awareness';
import ScalarConflictChip from '@openheaders/ui/shared/conflicts/ScalarConflictChip';
import { getDocId } from '../docs/doc-ids';
import SectionInfo from '../shared/SectionInfo';
import { DetectedValueInput } from '../value-editors';

const { Text } = Typography;

const AuthRuleFields: React.FC = () => {
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
            kicker: t('workbench.editors.rule.fields.auth.kicker'),
            title: t('workbench.editors.rule.fields.actionsTitle'),
            summary: t('workbench.editors.rule.fields.auth.infoSummary'),
            description: t('workbench.editors.rule.fields.auth.infoDescription'),
          }}
          docId={getDocId('auth', 'action')}
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
        {t('workbench.editors.rule.fields.auth.introBefore')} <Text code>{'{{vault.STAGING_PW}}'}</Text>{' '}
        {t('workbench.editors.rule.fields.auth.introAfter')}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {t('workbench.editors.rule.fields.auth.username')}
        </Text>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <EntityField path={paths.authUsername}>
          <Form.Item name="authUsername" style={{ marginBottom: 0, flex: 1, minWidth: 0 }}>
            <DetectedValueInput
              placeholder={t('workbench.editors.rule.fields.auth.usernamePlaceholder')}
              wrap
              maxRows={4}
              resizable
              allowClear
            />
          </Form.Item>
        </EntityField>
        <ScalarConflictChip formName="authUsername" schemaPath={paths.authUsername} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {t('workbench.editors.rule.fields.auth.password')}
        </Text>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <EntityField path={paths.authPassword}>
          <Form.Item name="authPassword" style={{ marginBottom: 0, flex: 1, minWidth: 0 }}>
            <DetectedValueInput
              placeholder={t('workbench.editors.rule.fields.auth.passwordPlaceholder')}
              wrap
              maxRows={4}
              resizable
              allowClear
            />
          </Form.Item>
        </EntityField>
        <ScalarConflictChip formName="authPassword" schemaPath={paths.authPassword} />
      </div>
    </div>
  );
};

export default AuthRuleFields;
