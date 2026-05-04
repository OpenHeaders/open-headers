/**
 * DocsPanel — one of the two right-side panels in the workspace shell.
 *
 * Uses the shared `PanelHeader` for its title + hide button so the
 * header stays visually consistent with every other tool-window panel.
 * Hosts the existing InspectorDocs renderer for the actual content.
 */

import { useMemo } from 'react';
import type React from 'react';
import { createPanelHeaderWiring, PanelHeader } from '@/shared/dock-layout';
import InspectorDocs from '../InspectorDocs';

interface DocsPanelProps {
  onClose: () => void;
}

const DocsPanel: React.FC<DocsPanelProps> = ({ onClose }) => {
  const wiring = useMemo(() => createPanelHeaderWiring({ onHide: onClose }), [onClose]);
  return (
    <div
      className="rules-right-panel rules-right-panel--docs"
      style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
    >
      <PanelHeader wiring={wiring} title={<strong>Docs</strong>} />
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <InspectorDocs />
      </div>
    </div>
  );
};

export default DocsPanel;
