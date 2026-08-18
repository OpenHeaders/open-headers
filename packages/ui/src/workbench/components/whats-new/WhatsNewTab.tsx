/**
 * WhatsNewTab — the bundled release-notes page (the updates plan).
 *
 * Content comes from the host's `getWhatsNew` capability: notes are
 * baked into the build from the canonical changelog entry and never
 * fetched — the current version's page works fully offline. Below it,
 * `WhatsNewHistory` adds earlier releases from the changelog feed when
 * the host registers the `whatsNewHistory` capability (enhancement
 * only; without it, or offline, the section simply isn't there). The
 * running version headlines the page from the build-info seam.
 * Auto-opening is `useWhatsNewAutoOpen`'s job; this component only
 * renders.
 */

import { getCapability } from '@openheaders/core/capabilities';
import { Typography, theme } from 'antd';
import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { getBuildInfo } from '../../../shared/build-info';
import { MarkdownView } from '../../../shared/markdown/MarkdownView';
import WhatsNewHistory from './WhatsNewHistory';

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
        <WhatsNewHistory />
      </div>
    </div>
  );
};

export default WhatsNewTab;
