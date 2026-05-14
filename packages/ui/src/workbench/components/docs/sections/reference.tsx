import { Card, theme } from 'antd';
import type React from 'react';
import { SHORTCUTS, useShortcutLabel } from '../../../hooks/useWorkspaceShortcuts';
import { KeyboardRegionsDiagram, ResourceTypesAnatomyDiagram } from '../diagrams';
import { DiagramFrame, DocParagraph, SurfaceContext } from '../shared';
import { ResourceTypeTable } from './concepts';

// ── Reference: Resource Types ────────────────────────────────────

export const ResourceTypesSection: React.FC = () => (
  <>
    <SurfaceContext surfaces={['popup', 'side-panel', 'workbench', 'devtools']} />
    <DocParagraph>
      Reference for Chrome's <code>ResourceType</code> values surfaced by request tracking and the Resource Types
      condition. Each label maps to a single underlying type — there's no overlap between rows.
    </DocParagraph>
    <DiagramFrame caption="What kind of request lands in which ResourceType — at a glance.">
      <ResourceTypesAnatomyDiagram />
    </DiagramFrame>
    <ResourceTypeTable />
  </>
);

// ── Reference: Keyboard Shortcuts ────────────────────────────────

const ShortcutRow: React.FC<{ id: string; label: string; codeBg: string }> = ({ id, label, codeBg }) => {
  const chord = useShortcutLabel(id);
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 12 }}>{label}</span>
      <code
        style={{
          fontSize: 11,
          padding: '1px 6px',
          background: codeBg,
          borderRadius: 3,
          whiteSpace: 'nowrap',
        }}
      >
        {chord}
      </code>
    </div>
  );
};

export const KeyboardShortcutsSection: React.FC = () => {
  const { token } = theme.useToken();
  return (
    <>
      <SurfaceContext surfaces={['workbench']} />
      <DocParagraph>
        Press <code>?</code> anytime to jump here. Shortcuts use{' '}
        <strong>{/Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘ Cmd' : 'Ctrl'}</strong> as the modifier key.
      </DocParagraph>
      <DiagramFrame caption="Four chords park your focus in one of four shell regions.">
        <KeyboardRegionsDiagram />
      </DiagramFrame>
      {(['panels', 'tabs', 'navigation', 'actions'] as const).map((category) => {
        const items = SHORTCUTS.filter((s) => s.category === category);
        if (items.length === 0) return null;
        return (
          <Card
            key={category}
            size="small"
            style={{ marginBottom: 8 }}
            title={category.charAt(0).toUpperCase() + category.slice(1)}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {items.map((s) => (
                <ShortcutRow key={s.id} id={s.id} label={s.label} codeBg={token.colorFillQuaternary} />
              ))}
            </div>
          </Card>
        );
      })}
    </>
  );
};
