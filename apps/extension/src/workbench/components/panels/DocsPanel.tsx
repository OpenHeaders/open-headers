/**
 * DocsPanel — one of the two right-side panels in the workspace shell.
 *
 * Uses the shared `PanelHeader` for its title + hide button so the
 * header stays visually consistent with every other tool-window panel.
 * Hosts the existing InspectorDocs renderer for the actual content.
 */

import { BookOutlined } from '@ant-design/icons';
import type React from 'react';
import { PanelHeader } from '@/shared/dock-layout';
import InspectorDocs from '../InspectorDocs';

interface DocsPanelProps {
  onClose: () => void;
}

const DocsPanel: React.FC<DocsPanelProps> = ({ onClose }) => (
  <div
    className="rules-right-panel rules-right-panel--docs"
    style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
  >
    <PanelHeader
      title={
        <>
          <BookOutlined />
          <strong>Docs</strong>
        </>
      }
      onHide={onClose}
    />
    <div style={{ flex: 1, overflow: 'hidden' }}>
      <InspectorDocs />
    </div>
  </div>
);

export default DocsPanel;
