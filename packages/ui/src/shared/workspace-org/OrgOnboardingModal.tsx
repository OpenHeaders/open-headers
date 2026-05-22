/**
 * OrgOnboardingModal — the two-personal-Orgs onboarding (U3.6,
 * UNIFIED_ORACLE_MODEL.md §6.2).
 *
 * Surfaces the first time a user holds more than one Org — i.e. they've
 * joined a daemon and now see both the synthetic local-org ("stuff on
 * this machine") and a real Org ("stuff on my account"). Users don't
 * natively carry the "this machine vs. my account" mental model, so the
 * modal names the distinction once and asks where new workspaces should
 * land by default.
 *
 * Mounting is gated by `shouldShowOrgOnboarding` upstream; this
 * component only renders the surface. Acknowledging stamps
 * `OH.orgBindingPrefs.onboardingAcknowledgedAt` so it never re-surfaces.
 */

import type { OrgDescriptor } from '@openheaders/core/identity';
import { Modal, Radio, Space, Typography } from 'antd';
import type React from 'react';
import { useEffect, useState } from 'react';
import { OrgIcon } from './OrgIcon';
import { orgScopeVisual } from './org-scope-vocabulary';

const { Text, Paragraph } = Typography;

export interface OrgOnboardingModalProps {
  open: boolean;
  /** Every Org the user belongs to — at least two when this modal shows. */
  catalogue: OrgDescriptor[];
  /** The home-org id — the recommended default for new workspaces. */
  homeOrgId: string;
  /** Persist the acknowledgement + chosen default Org for new workspaces. */
  onAcknowledge: (defaultNewWorkspaceOrgId: string) => void | Promise<void>;
}

export const OrgOnboardingModal: React.FC<OrgOnboardingModalProps> = ({
  open,
  catalogue,
  homeOrgId,
  onAcknowledge,
}) => {
  const [defaultOrgId, setDefaultOrgId] = useState<string>(homeOrgId);
  const [saving, setSaving] = useState(false);

  // Identity hydrates asynchronously, so `homeOrgId` is empty on the
  // first render and resolves later. Re-seed the radio default to the
  // home-org each time the modal opens so the recommended option is
  // pre-selected rather than stuck on the pre-hydration empty value.
  useEffect(() => {
    if (open) setDefaultOrgId(homeOrgId);
  }, [open, homeOrgId]);

  const handleOk = async (): Promise<void> => {
    setSaving(true);
    try {
      await onAcknowledge(defaultOrgId);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Where your workspaces live"
      closable={false}
      maskClosable={false}
      keyboard={false}
      okText="Got it"
      cancelButtonProps={{ style: { display: 'none' } }}
      confirmLoading={saving}
      onOk={handleOk}
    >
      <Paragraph type="secondary" style={{ fontSize: 13 }}>
        You're now signed in, so your workspaces can live in more than one place. Each workspace
        is bound to one of these:
      </Paragraph>

      <Space direction="vertical" size={10} style={{ width: '100%', marginBottom: 12 }}>
        {catalogue.map((descriptor) => {
          const visual = orgScopeVisual(descriptor.scopeKind);
          const title = descriptor.scopeKind === 'team' ? descriptor.name : visual.pickerLabel;
          return (
            <div key={descriptor.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <OrgIcon descriptor={descriptor} size={15} style={{ marginTop: 2 }} />
              <div>
                <Text strong style={{ fontSize: 13 }}>
                  {title}
                </Text>
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {visual.description}
                  </Text>
                </div>
              </div>
            </div>
          );
        })}
      </Space>

      <Paragraph style={{ fontSize: 13, marginBottom: 6 }}>
        Where should <Text strong>new</Text> workspaces go by default?
      </Paragraph>
      <Radio.Group
        value={defaultOrgId}
        onChange={(e) => setDefaultOrgId(e.target.value)}
        style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
      >
        {catalogue.map((descriptor) => {
          const visual = orgScopeVisual(descriptor.scopeKind);
          const title = descriptor.scopeKind === 'team' ? descriptor.name : visual.pickerLabel;
          return (
            <Radio key={descriptor.id} value={descriptor.id}>
              {title}
              {descriptor.id === homeOrgId && (
                <Text type="secondary" style={{ fontSize: 11, marginLeft: 6 }}>
                  recommended
                </Text>
              )}
            </Radio>
          );
        })}
      </Radio.Group>
    </Modal>
  );
};
