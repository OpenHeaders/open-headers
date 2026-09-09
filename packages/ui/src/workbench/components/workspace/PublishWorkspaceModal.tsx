/**
 * PublishWorkspaceModal — "Copy to <place>" as presentation over the
 * Duplicate-into RPC (the publish-target picker design; the Backup and
 * Sync UX plan §5.5). Targets are joined Orgs read as places — the
 * switcher's headers: "<label> · server", "This computer · desktop
 * app" — with a state beside the place only when it warns (off,
 * disconnected, re-pair needed), the switcher's silence otherwise.
 * Exactly one target keeps the one-click shape (no picker, the OK
 * button names the place); two or more get a Select. Unhealthy targets
 * list disabled. Secrets are excluded unless opted in, and the source
 * workspace always stays — a copy, never a move.
 */

import type { ExtensionWorkspace } from '@openheaders/core/types';
import { orgStateText, type PublishTarget } from '@openheaders/ui/shared/backend';
import { Checkbox, Form, Input, Modal, Select, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';

const { Text } = Typography;

export interface PublishFormValues {
  name: string;
  targetOrgId: string;
  includeSecrets: boolean;
}

interface PublishWorkspaceModalProps {
  source: ExtensionWorkspace | null;
  /** Joined-Org targets, already excluding the source's own Org. */
  targets: PublishTarget[];
  onCancel: () => void;
  onSubmit: (values: PublishFormValues) => Promise<boolean>;
}

const PublishWorkspaceModal: React.FC<PublishWorkspaceModalProps> = ({ source, targets, onCancel, onSubmit }) => {
  const t = useT();
  const [form] = Form.useForm<PublishFormValues>();

  const single = targets.length === 1 ? targets[0] : null;
  const firstHealthy = targets.find((t) => t.healthy) ?? null;

  const handleOk = useCallback(async () => {
    try {
      const values = await form.validateFields();
      const ok = await onSubmit(values);
      if (ok) {
        form.resetFields();
        onCancel();
      }
    } catch {
      // validation error — keep modal open
    }
  }, [form, onSubmit, onCancel]);

  return (
    <Modal
      open={source !== null}
      title={
        source
          ? t('workbench.workspace.publishTitle', { name: source.name })
          : t('workbench.workspace.publishTitleFallback')
      }
      okText={
        single ? t('workbench.workspace.publishToOk', { place: single.place }) : t('workbench.workspace.publishOk')
      }
      okButtonProps={{ disabled: firstHealthy === null }}
      onCancel={() => {
        form.resetFields();
        onCancel();
      }}
      onOk={handleOk}
      destroyOnHidden
    >
      {source && (
        <Form
          form={form}
          layout="vertical"
          preserve={false}
          initialValues={{
            name: source.name,
            targetOrgId: single ? single.orgId : firstHealthy?.orgId,
            includeSecrets: false,
          }}
          onFinish={handleOk}
        >
          <Text type="secondary" style={{ display: 'block', fontSize: 12, marginBottom: 12 }}>
            {t('workbench.workspace.publishIntro')}
          </Text>

          <Form.Item
            name="name"
            label={t('workbench.workspace.nameLabel')}
            rules={[
              { required: true, message: t('workbench.workspace.nameRequired') },
              { max: 60, message: t('workbench.workspace.nameTooLong') },
            ]}
          >
            <Input autoFocus />
          </Form.Item>

          {single ? (
            <>
              <Form.Item name="targetOrgId" hidden>
                <Input />
              </Form.Item>
              <div style={{ marginBottom: 16 }}>
                <Text strong style={{ fontSize: 13 }}>
                  {single.place}
                </Text>
                <TargetState annotation={single.annotation} />
              </div>
            </>
          ) : (
            <Form.Item
              name="targetOrgId"
              label={t('workbench.workspace.toOrg')}
              rules={[{ required: true, message: t('workbench.workspace.pickTargetOrg') }]}
            >
              <Select
                options={targets.map((target) => ({
                  value: target.orgId,
                  disabled: !target.healthy,
                  label: (
                    <span>
                      {target.place}
                      <TargetState annotation={target.annotation} />
                    </span>
                  ),
                }))}
              />
            </Form.Item>
          )}

          <Form.Item name="includeSecrets" valuePropName="checked" style={{ marginBottom: 4 }}>
            <Checkbox>{t('workbench.workspace.includeSecrets')}</Checkbox>
          </Form.Item>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {t('workbench.workspace.includeSecretsHint')}
          </Text>
        </Form>
      )}
    </Modal>
  );
};

/** The warning state beside a place — nothing for a healthy or connecting wire. */
const TargetState: React.FC<{ annotation: PublishTarget['annotation'] }> = ({ annotation }) => {
  const { token } = theme.useToken();
  const t = useT();
  const state = orgStateText(t, annotation);
  if (!state) return null;
  return (
    <>
      {' '}
      <Text style={{ fontSize: 12, color: token.colorWarningText }}>{state}</Text>
    </>
  );
};

export default PublishWorkspaceModal;
