import { useT } from '@openheaders/ui/context/LocaleContext';
import { createPanelHeaderWiring, PanelHeader } from '@openheaders/ui/shared/dock-layout';
import { useMemo } from 'react';
import { fireTier } from '../data/fire-evidence';
import type { InspectorRowWithFires } from '../data/inspector-row-projection';
import { type InspectorFire, isAppliedFire } from '../data/types';

interface RuleExecutionsProps {
  rows: readonly InspectorRowWithFires[];
  danglingFires: readonly InspectorFire[];
  onRequestClick: (requestId: string) => void;
  onHide: () => void;
}

function RuleActivityHeader({ onHide }: { onHide: () => void }) {
  const t = useT();
  const wiring = useMemo(() => createPanelHeaderWiring({ onHide }), [onHide]);
  return <PanelHeader wiring={wiring} title={<strong>{t('panel.toolWindows.ruleActivity')}</strong>} />;
}

interface RuleGroup {
  ruleUid: string;
  totalHits: number;
  /** Hits where the rule verifiably applied — engine-confirmed,
   *  reporter-confirmed, or wire-corroborated. */
  appliedHits: number;
  /** Hits where the captured headers disprove a claimed modification. */
  contradictedHits: number;
  attachedHits: Array<{ requestId: string; url: string; t: number }>;
  danglingHits: Array<{ url: string; t: number }>;
}

export function RuleExecutions({ rows, danglingFires, onRequestClick, onHide }: RuleExecutionsProps) {
  const t = useT();
  const groups = useMemo<RuleGroup[]>(() => {
    const byRule: Map<string, RuleGroup> = new Map();
    for (const r of rows) {
      for (const f of r.fires) {
        let g = byRule.get(f.ruleUid);
        if (!g) {
          g = { ruleUid: f.ruleUid, totalHits: 0, appliedHits: 0, contradictedHits: 0, attachedHits: [], danglingHits: [] };
          byRule.set(f.ruleUid, g);
        }
        g.totalHits++;
        const tier = fireTier(r.lifecycle, f);
        if (tier === 'applied') g.appliedHits++;
        else if (tier === 'contradicted') g.contradictedHits++;
        if (g.attachedHits.length < 10) {
          g.attachedHits.push({ requestId: r.lifecycle.requestId, url: r.lifecycle.url, t: f.t });
        }
      }
    }
    for (const d of danglingFires) {
      let g = byRule.get(d.ruleUid);
      if (!g) {
        g = { ruleUid: d.ruleUid, totalHits: 0, appliedHits: 0, contradictedHits: 0, attachedHits: [], danglingHits: [] };
        byRule.set(d.ruleUid, g);
      }
      g.totalHits++;
      // No lifecycle to corroborate against — the engine/reporter tiers
      // are the only evidence a dangling fire can carry.
      if (isAppliedFire(d)) g.appliedHits++;
      if (g.danglingHits.length < 10) {
        // Dangling fires don't carry a `url` field on the new InspectorFire
        // shape — fall back to the pattern when present so the panel still
        // surfaces a useful identifier.
        g.danglingHits.push({ url: d.pattern || '(off-HAR)', t: d.t });
      }
    }
    return Array.from(byRule.values()).sort((a, b) => b.totalHits - a.totalHits);
  }, [rows, danglingFires]);

  if (groups.length === 0) {
    return (
      <div className="dt-panel">
        <RuleActivityHeader onHide={onHide} />
        <div className="dt-empty">{t('panel.ruleActivity.empty')}</div>
      </div>
    );
  }

  return (
    <div className="dt-panel">
      <RuleActivityHeader onHide={onHide} />
      <div className="dt-executions">
        <div className="dt-executions-hint" style={{ marginBottom: 6 }}>
          <strong>{t('panel.ruleActivity.hint.applied')}</strong> {t('panel.ruleActivity.hint.appliedDesc')}{' '}
          <strong>{t('panel.ruleActivity.hint.contradicted')}</strong>{' '}
          {t('panel.ruleActivity.hint.contradictedDesc')}{' '}
          <strong>{t('panel.ruleActivity.hint.inferred')}</strong> {t('panel.ruleActivity.hint.inferredDesc')}{' '}
          <strong>{t('panel.ruleActivity.hint.offHar')}</strong> {t('panel.ruleActivity.hint.offHarDesc')}
        </div>
        {groups.map((group) => (
          <details key={group.ruleUid} className="dt-exec-group" open>
            <summary>
              <code>{group.ruleUid}</code>
              <span className="dt-exec-badge dt-exec-badge--auth">
                {t('panel.ruleActivity.hits', { count: group.totalHits })}
              </span>
              {group.appliedHits > 0 && (
                <span className="dt-exec-badge dt-exec-badge--auth">
                  {t('panel.ruleActivity.applied', { count: group.appliedHits })}
                </span>
              )}
              {group.contradictedHits > 0 && (
                <span className="dt-exec-badge dt-exec-badge--contradicted">
                  {t('panel.ruleActivity.contradicted', { count: group.contradictedHits })}
                </span>
              )}
              {group.danglingHits.length > 0 && (
                <span className="dt-exec-badge dt-exec-badge--dangling">
                  {t('panel.ruleActivity.offHar', { count: group.danglingHits.length })}
                </span>
              )}
            </summary>
            {group.attachedHits.map((h, i) => (
              <button
                key={`att-${i}-${h.requestId}`}
                type="button"
                className="dt-exec-url"
                onClick={() => onRequestClick(h.requestId)}
              >
                {h.url}
              </button>
            ))}
            {group.danglingHits.map((h, i) => (
              <div
                key={`dng-${i}-${h.url}`}
                className="dt-exec-url dt-exec-url--muted"
                title={t('panel.ruleActivity.offHarTitle')}
              >
                {h.url} (off-HAR)
              </div>
            ))}
          </details>
        ))}
      </div>
    </div>
  );
}

export function RuleExecutionsHint() {
  const t = useT();
  return <span className="dt-col-muted">{t('panel.ruleActivity.toolbarHint')}</span>;
}
