import { createPanelHeaderWiring, PanelHeader } from '@openheaders/ui/shared/dock-layout';
import { useMemo } from 'react';
import type { InspectorRowWithFires } from '../data/inspector-row-projection';
import { type InspectorFire, isAppliedFire } from '../data/types';

interface RuleExecutionsProps {
  rows: readonly InspectorRowWithFires[];
  danglingFires: readonly InspectorFire[];
  onRequestClick: (requestId: string) => void;
  onHide: () => void;
}

function RuleActivityHeader({ onHide }: { onHide: () => void }) {
  const wiring = useMemo(() => createPanelHeaderWiring({ onHide }), [onHide]);
  return <PanelHeader wiring={wiring} title={<strong>Rule Activity</strong>} />;
}

interface RuleGroup {
  ruleUid: string;
  totalHits: number;
  /** Hits where the rule is known to have actually run — authoritative
   *  or `evidence: 'confirmed'`. */
  appliedHits: number;
  attachedHits: Array<{ requestId: string; url: string; t: number }>;
  danglingHits: Array<{ url: string; t: number }>;
}

export function RuleExecutions({ rows, danglingFires, onRequestClick, onHide }: RuleExecutionsProps) {
  const groups = useMemo<RuleGroup[]>(() => {
    const byRule: Map<string, RuleGroup> = new Map();
    for (const r of rows) {
      for (const f of r.fires) {
        let g = byRule.get(f.ruleUid);
        if (!g) {
          g = { ruleUid: f.ruleUid, totalHits: 0, appliedHits: 0, attachedHits: [], danglingHits: [] };
          byRule.set(f.ruleUid, g);
        }
        g.totalHits++;
        if (isAppliedFire(f)) g.appliedHits++;
        if (g.attachedHits.length < 10) {
          g.attachedHits.push({ requestId: r.lifecycle.requestId, url: r.lifecycle.url, t: f.t });
        }
      }
    }
    for (const d of danglingFires) {
      let g = byRule.get(d.ruleUid);
      if (!g) {
        g = { ruleUid: d.ruleUid, totalHits: 0, appliedHits: 0, attachedHits: [], danglingHits: [] };
        byRule.set(d.ruleUid, g);
      }
      g.totalHits++;
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
        <div className="dt-empty">No rule activity on this tab yet.</div>
      </div>
    );
  }

  return (
    <div className="dt-panel">
      <RuleActivityHeader onHide={onHide} />
      <div className="dt-executions">
        <div className="dt-executions-hint" style={{ marginBottom: 6 }}>
          <strong>Applied</strong> fires are confirmed to have run — either the rule engine reported the DNR rule
          executed, or the in-page reporter confirmed a scriptable action ran.{' '}
          <strong>Inferred</strong> fires match your rule patterns against observed requests but couldn&apos;t be
          confirmed. <strong>Off-HAR</strong> fires are rule matches on requests the panel didn&apos;t capture.
        </div>
        {groups.map((group) => (
          <details key={group.ruleUid} className="dt-exec-group" open>
            <summary>
              <code>{group.ruleUid}</code>
              <span className="dt-exec-badge dt-exec-badge--auth">
                {group.totalHits} hit{group.totalHits === 1 ? '' : 's'}
              </span>
              {group.appliedHits > 0 && (
                <span className="dt-exec-badge dt-exec-badge--auth">{group.appliedHits} applied</span>
              )}
              {group.danglingHits.length > 0 && (
                <span className="dt-exec-badge dt-exec-badge--dangling">{group.danglingHits.length} off-HAR</span>
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
                title="Off-HAR — the panel didn't capture a HAR shell for this fire"
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
  return <span className="dt-col-muted">Rule activity grouped by rule.</span>;
}
