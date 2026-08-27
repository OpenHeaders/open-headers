/**
 * SystemProxyPane — right-pane renderer for the Proxy · Outbound child
 * category (desktop only): the standard pane header over
 * `SystemProxySection`, the outbound plane's settings sections
 * (the request-engine proxy design P3). Split from the trust pane
 * so each proxy plane reads as its own page — outbound egress here,
 * capture-proxy trust under Proxy · HTTPS Trust.
 */

import type React from 'react';
import { Pane, PaneHeader } from './pane-chrome';
import type { CategoryPaneProps } from '../types';
import SystemProxySection from './system-proxy-section';

const SystemProxyPane: React.FC<CategoryPaneProps> = ({ category }) => (
  <Pane>
    <PaneHeader category={category} />
    <SystemProxySection />
  </Pane>
);

export default SystemProxyPane;
