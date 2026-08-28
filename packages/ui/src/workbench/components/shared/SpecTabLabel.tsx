/**
 * SpecTabLabel — the request editors' shared "Spec" tab label. A spec
 * binding is metadata about a request (where it comes from), not a
 * section of it, so the tab sits LAST on every editor behind a
 * vertical divider. antd tab items carry no class of their own; the
 * divider keys on this label's class from `spec-tab.css`.
 */

import { useT } from '@openheaders/ui/context/LocaleContext';
import type React from 'react';
import './spec-tab.css';

const SpecTabLabel: React.FC = () => {
  const t = useT();
  return <span className="oh-spec-tab">{t('workbench.editors.spec.tab')}</span>;
};

export default SpecTabLabel;
