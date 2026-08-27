/**
 * SystemProxyPane — right-pane renderer for the Proxy · Outbound child
 * category (desktop only): the standard pane header over
 * `SystemProxySection`, the outbound plane's settings surface
 * (the request-engine proxy design P3). Split from the trust pane
 * so each proxy plane reads as its own page — outbound egress here,
 * capture-proxy trust under Proxy · HTTPS Trust.
 */

import { theme } from 'antd';
import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { PaneHeader } from './pane-chrome';
import type { CategoryPaneProps } from '../types';
import SystemProxySection from './system-proxy-section';

const SystemProxyPane: React.FC<CategoryPaneProps> = ({ category }) => {
  const { token } = theme.useToken();
  const t = useT();

  return (
    <div style={{ padding: '14px 18px 20px' }}>
      <PaneHeader category={category} />
      <SystemProxySection />
    </div>
  );
};

export default SystemProxyPane;
