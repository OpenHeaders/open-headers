/**
 * WhatsNewModal — the bundled release notes in a modal, for surfaces
 * without a tab strip (devtools panel, popup, sidepanel). Same content
 * seam as WhatsNewTab: the host's `getWhatsNew` capability, baked into
 * the build and never fetched, headlined by the running version from
 * build-info. Openers gate on the capability, so an empty-notes build
 * never surfaces the affordance.
 */

import { getCapability } from '@openheaders/core/capabilities';
import { Modal, Typography } from 'antd';
import type React from 'react';
import { useT } from '../../../context/LocaleContext';
import { getBuildInfo } from '../../../shared/build-info';
import { MarkdownView } from '../../../shared/markdown/MarkdownView';

const { Text } = Typography;

const WhatsNewModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const t = useT();
  const notes = getCapability('getWhatsNew')?.() ?? null;
  const { version } = getBuildInfo();

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      title={t('workbench.whatsNew.title', { version })}
      width={720}
      centered
      styles={{ body: { maxHeight: '70vh', overflowY: 'auto', overscrollBehavior: 'contain' } }}
    >
      {notes !== null ? <MarkdownView>{notes}</MarkdownView> : <Text type="secondary">{t('workbench.whatsNew.noNotes')}</Text>}
    </Modal>
  );
};

export default WhatsNewModal;
