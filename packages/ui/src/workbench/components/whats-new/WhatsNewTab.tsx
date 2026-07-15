/**
 * WhatsNewTab — the bundled release-notes page (`docs/UPDATES_PLAN.md`).
 *
 * Content comes from the host's `getWhatsNew` capability: notes are
 * baked into the build (the desktop bundles `whats-new.md` at build
 * time) and never fetched, so opening this tab causes no outbound
 * request. The running version headlines the page from the build-info
 * seam. Auto-opening is `useWhatsNewAutoOpen`'s job; this component
 * only renders.
 */

import { getCapability } from '@openheaders/core/capabilities';
import { Typography, theme } from 'antd';
import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { getBuildInfo } from '../../../shared/build-info';
import { MarkdownView } from '../../../shared/markdown/MarkdownView';

const { Title, Text } = Typography;

const WhatsNewTab: React.FC = () => {
  const { token } = theme.useToken();
  const t = useT();
  const notes = getCapability('getWhatsNew')?.() ?? null;
  const { version } = getBuildInfo();

  return (
    <div style={{ height: '100%', overflow: 'auto', overscrollBehavior: 'none', background: token.colorBgContainer }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px 48px' }}>
        <Title level={3} style={{ marginBottom: 4 }}>
          {t('workbench.whatsNew.title', { version })}
        </Title>
        {notes !== null ? (
          <MarkdownView>{notes}</MarkdownView>
        ) : (
          <Text type="secondary">{t('workbench.whatsNew.noNotes')}</Text>
        )}
      </div>
    </div>
  );
};

export default WhatsNewTab;
