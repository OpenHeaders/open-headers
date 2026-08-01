/**
 * SystemProxyPane — right-pane renderer for the Proxy · Outbound child
 * category (desktop only): the standard pane header over
 * `SystemProxySection`, the outbound plane's settings surface
 * (docs/REQUEST_ENGINE_PROXY_DESIGN.md P3). Split from the trust pane
 * so each proxy plane reads as its own page — outbound egress here,
 * capture-proxy trust under Proxy · HTTPS Trust.
 */

import { theme } from 'antd';
import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { resolveLabel, resolveOptionalDescription } from '../localize';
import type { CategoryPaneProps } from '../types';
import SystemProxySection from './system-proxy-section';

const SystemProxyPane: React.FC<CategoryPaneProps> = ({ category }) => {
  const { token } = theme.useToken();
  const t = useT();
  const description = resolveOptionalDescription(category, t);

  return (
    <div style={{ padding: '14px 18px 20px' }}>
      <header style={{ marginBottom: 10 }}>
        <h2 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: token.colorText, letterSpacing: -0.1 }}>
          {resolveLabel(category, t)}
        </h2>
        {description && (
          <p style={{ margin: '1px 0 0', fontSize: 11.5, color: token.colorTextSecondary }}>{description}</p>
        )}
      </header>
      <SystemProxySection />
    </div>
  );
};

export default SystemProxyPane;
