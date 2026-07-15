import { hasCapability } from '@openheaders/core/capabilities';
import type { MessageKey } from '@openheaders/i18n';
import { Card, theme } from 'antd';
import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { getCurrentHost } from '@openheaders/ui/shared/host-vocabulary';
import { SHORTCUTS, useChordLabel, useShortcutLabel } from '../../../hooks/useWorkspaceShortcuts';
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

const ChordRow: React.FC<{ label: string; chord: string; codeBg: string }> = ({ label, chord, codeBg }) => (
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

const ShortcutRow: React.FC<{ id: string; label: string; codeBg: string }> = ({ id, label, codeBg }) => (
  <ChordRow label={label} chord={useShortcutLabel(id)} codeBg={codeBg} />
);

const CATEGORY_TITLE_KEYS: Record<(typeof SHORTCUTS)[number]['category'], MessageKey> = {
  panels: 'workbench.shortcuts.category.panels',
  tabs: 'workbench.shortcuts.category.tabs',
  navigation: 'workbench.shortcuts.category.navigation',
  actions: 'workbench.shortcuts.category.actions',
};

export const KeyboardShortcutsSection: React.FC = () => {
  const t = useT();
  const { token } = theme.useToken();
  const debugChord = useChordLabel('keyboard.toggleDebugMode');
  const debugAvailable = hasCapability('cdpInspection');
  return (
    <>
      <SurfaceContext surfaces={['workbench']} />
      <DocParagraph>
        {t('workbench.shortcuts.introPrefix')} <code>?</code> {t('workbench.shortcuts.introMiddle')}{' '}
        <strong>{/Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘ Cmd' : 'Ctrl'}</strong>{' '}
        {t('workbench.shortcuts.introSuffix')}
      </DocParagraph>
      <DiagramFrame caption={t('workbench.shortcuts.regionsCaption')}>
        <KeyboardRegionsDiagram />
      </DiagramFrame>
      {debugAvailable && (
        <Card size="small" style={{ marginBottom: 8 }} title={t('workbench.shortcuts.allSurfacesTitle')}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <ChordRow
              label={t('workbench.shortcuts.toggleDebugMode')}
              chord={debugChord}
              codeBg={token.colorFillQuaternary}
            />
          </div>
        </Card>
      )}
      {(['panels', 'tabs', 'navigation', 'actions'] as const).map((category) => {
        const items = SHORTCUTS.filter((s) => s.category === category);
        if (items.length === 0) return null;
        return (
          <Card key={category} size="small" style={{ marginBottom: 8 }} title={t(CATEGORY_TITLE_KEYS[category])}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {items.map((s) => (
                <ShortcutRow key={s.id} id={s.id} label={t(s.labelKey)} codeBg={token.colorFillQuaternary} />
              ))}
              {category === 'tabs' && getCurrentHost() === 'desktop' && (
                <ChordRow
                  label={t('workbench.shortcuts.goToTab')}
                  chord={/Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘1–⌘9' : 'Ctrl+1–9'}
                  codeBg={token.colorFillQuaternary}
                />
              )}
            </div>
          </Card>
        );
      })}
    </>
  );
};
