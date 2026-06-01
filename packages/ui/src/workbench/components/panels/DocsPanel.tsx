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
import type { InfoPopoverContent } from '@openheaders/ui/shared/info-popover';
import { DEFAULT_SECTION_ID, DOC_GROUPS } from '../docs/registry';

interface DocsPanelProps {
  /** Title-bar `(i)` popover copy. */
  info: InfoPopoverContent;
  onClose: () => void;
}

const DocsPanel: React.FC<DocsPanelProps> = ({ info, onClose }) => (
  <SharedDocsPanel groups={DOC_GROUPS} defaultSectionId={DEFAULT_SECTION_ID} info={info} onClose={onClose} />
);

export default DocsPanel;
