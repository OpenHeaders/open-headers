import { AuditOutlined } from '@ant-design/icons';
import { useMemo } from 'react';
import { PanelHeader } from '@/shared/dock-layout';
import { type DanglingFire, type InspectorRequest, isAppliedFire } from '../data/types';

interface RuleExecutionsProps {
  entries: readonly InspectorRequest[];
  danglingFires: readonly DanglingFire[];
  onRequestClick: (id: string) => void;
  onHide?: () => void;
}

function RuleActivityHeader({ onHide }: { onHide?: () => void }) {
  return (
    <PanelHeader
      title={
        <>
          <AuditOutlined />
          <strong>Rule Activity</strong>
        </>
      }
      onHide={onHide}
    />
  );
}

interface RuleGroup {
  ruleUid: string;
  totalHits: number;
  /** Hits where the rule is known to have actually run — authoritative
   *  (Chrome confirmed DNR) or `evidence: 'confirmed'` (in-page reporter
   *  confirmed the scriptable action). */
  appliedHits: number;
  attachedHits: Array<{ entryId: string; url: string; t: number }>;
  danglingHits: Array<{ url: string; t: number }>;
}

export function RuleExecutions({ entries, danglingFires, onRequestClick, onHide }: RuleExecutionsProps) {
  const groups = useMemo<RuleGroup[]>(() => {
    const byRule: Map<string, RuleGroup> = new Map();
    for (const e of entries) {
      for (const f of e.fires) {
        let g = byRule.get(f.ruleUid);
        if (!g) {
          g = { ruleUid: f.ruleUid, totalHits: 0, appliedHits: 0, attachedHits: [], danglingHits: [] };
          byRule.set(f.ruleUid, g);
        }
        g.totalHits++;
        if (isAppliedFire(f)) g.appliedHits++;
        if (g.attachedHits.length < 10) {
          g.attachedHits.push({ entryId: e.id, url: e.url, t: f.t });
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
        g.danglingHits.push({ url: d.url, t: d.t });
      }
    }
    return Array.from(byRule.values()).sort((a, b) => b.totalHits - a.totalHits);
  }, [entries, danglingFires]);

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
          <strong>Applied</strong> fires are confirmed to have run — either Chrome&apos;s declarativeNetRequest feedback
          confirmed the DNR rule executed, or the in-page reporter confirmed a scriptable action ran.{' '}
          <strong>Inferred</strong> fires match your rule patterns against observed requests but couldn&apos;t be
          confirmed. <strong>Off-HAR</strong> fires are rule matches on requests DevTools didn&apos;t capture.
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
                key={`att-${i}-${h.entryId}`}
                type="button"
                className="dt-exec-url"
                onClick={() => onRequestClick(h.entryId)}
              >
                {h.url}
              </button>
            ))}
            {group.danglingHits.map((h, i) => (
              <div
                key={`dng-${i}-${h.url}`}
                className="dt-exec-url dt-exec-url--muted"
                title="Off-HAR — DevTools didn't capture this request"
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
