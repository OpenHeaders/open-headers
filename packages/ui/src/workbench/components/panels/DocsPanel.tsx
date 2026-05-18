/**
 * Workbench DocsPanel — thin wrapper that passes the workbench's own
 * `DOC_GROUPS` registry to the shared `DocsPanel` component.
 *
 * The shared implementation lives at
 * `@openheaders/ui/shared/docs/DocsPanel` and is registry-agnostic;
 * each surface (workbench, devtools panel) supplies its own groups.
 */

import type React from 'react';
import SharedDocsPanel from '@openheaders/ui/shared/docs/DocsPanel';
import { DEFAULT_SECTION_ID, DOC_GROUPS } from '../docs/registry';

interface DocsPanelProps {
  onClose: () => void;
}

const DocsPanel: React.FC<DocsPanelProps> = ({ onClose }) => (
  <SharedDocsPanel groups={DOC_GROUPS} defaultSectionId={DEFAULT_SECTION_ID} onClose={onClose} />
);

export default DocsPanel;
