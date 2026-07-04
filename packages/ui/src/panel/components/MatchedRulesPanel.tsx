/**
 * "Request Rules" — bottom-dock tool window for the currently-selected
 * request, in two sections:
 *
 *   - Matched: every rule that fired on the capture, with its match
 *     evidence. Complements the inline per-header badges in the
 *     Headers tab — a rule may fire without changing any visible
 *     header (block / delay / pure-match rules), in which case it
 *     only shows up here.
 *   - Future matches: live rules that WOULD fire if the request were
 *     made again but aren't in the snapshot — instant feedback for a
 *     rule just created from the panel (see `future-matches.ts`).
 *
 * Rows in both sections hover-open the rule quick editor.
 */

import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import type { Rule } from '@openheaders/core/types';
import { createPanelHeaderWiring, PanelHeader } from '@openheaders/ui/shared/dock-layout';
import { buildRuleIcon } from '@openheaders/ui/workbench/components/shared/rule-icon';
import { useMemo } from 'react';
import {
  type FireDotTier,
  type FireEvidence,
  deriveFireEvidence,
  fireTier,
  hasCapturedOverride,
} from '../data/fire-evidence';
import { type FutureMatch, useFutureMatches } from '../data/future-matches';
import { isRuleEditedSinceSnapshot } from '../data/headers/header-attribution';
import { buildInspectorTab } from '../data/inspector-tab';
import type { InspectorRowWithFires } from '../data/inspector-row-projection';
import type { InspectorFire } from '../data/types';
import type { RulesByUid } from '../data/rule-create/use-rules-lookup';
import { methodColor } from './method-color';
import { useRulePopover } from './RulePopoverHost';

interface MatchedRulesPanelProps {
  row: InspectorRowWithFires | null;
  rulesByUid: RulesByUid;
  onClose: () => void;
}

/** Action lines from the LIVE rule — the fire-less variant used by the
 *  Future-matches rows and as the snapshot fallback below. */
function describeHeaderRuleActions(rule: Rule | undefined): string[] {
  if (!rule || rule.type !== 'header') return [];
  const lines: string[] = [];
  for (const h of rule.action.requestHeaders) {
    lines.push(`req ${h.operation} ${h.headerName}${h.value != null ? ` = ${h.value}` : ''}`);
  }
  for (const h of rule.action.responseHeaders) {
    lines.push(`res ${h.operation} ${h.headerName}${h.value != null ? ` = ${h.value}` : ''}`);
  }
  return lines;
}

function describeHeaderActions(fire: InspectorFire, rule: Rule | undefined): string[] {
  const snapshot = fire.ruleSnapshot;
  if (snapshot && snapshot.type === 'header' && snapshot.headerMods) {
    const lines: string[] = [];
    for (const h of snapshot.headerMods) {
      const tag = h.direction === 'request' ? 'req' : 'res';
      const value = h.valueResolved ?? h.valueTemplate;
      lines.push(`${tag} ${h.operation} ${h.headerName}${value !== undefined ? ` = ${value}` : ''}`);
    }
    return lines;
  }
  return describeHeaderRuleActions(rule);
}

interface FireRowProps {
  fire: InspectorFire;
  rule: Rule | undefined;
  lifecycle: RequestLifecycle;
}

function evidenceLabel(fire: InspectorFire, evidence: FireEvidence, lifecycle: RequestLifecycle): string {
  if (evidence.verdict === 'contradicted') return 'contradicted';
  if (fire.authoritative) return 'authoritative';
  // A captured two-sided override (served/original or sent/original) is the
  // body-rule's confirmation — the modifier ran and we recorded both sides —
  // even when the page-reported fire alone would read 'fallback'.
  if (hasCapturedOverride(lifecycle, fire.ruleUid)) return 'confirmed';
  switch (fire.evidence) {
    case 'confirmed':
      return 'confirmed';
    case 'matched-fallback':
      return 'fallback';
    case 'silent':
      return 'silent';
    default:
      return evidence.verdict === 'corroborated' ? 'corroborated' : 'inferred';
  }
}

/** Wire values observed for the first disproven claim — the badge's receipt. */
function contradictionDetail(evidence: FireEvidence): string {
  const hit = evidence.mods.find((m) => m.verdict === 'contradicted');
  if (!hit) return '';
  if (hit.reason === 'present-despite-remove') {
    return ` ${hit.mod.headerName} is still present (${(hit.observed ?? []).join(', ')}).`;
  }
  if (hit.reason === 'absent-from-wire') {
    return ` ${hit.mod.headerName} is missing from the captured headers.`;
  }
  return ` ${hit.mod.headerName} carries "${(hit.observed ?? []).join(', ')}" instead of the claimed value.`;
}

function evidenceTitle(fire: InspectorFire, evidence: FireEvidence, lifecycle: RequestLifecycle): string {
  if (evidence.verdict === 'contradicted') {
    return `Contradicted — the captured headers disprove a modification this rule claimed.${contradictionDetail(evidence)}`;
  }
  if (fire.authoritative) {
    return 'Authoritative — the rule engine confirmed this DNR rule executed on the request.';
  }
  if (hasCapturedOverride(lifecycle, fire.ruleUid)) {
    return 'Confirmed — the rule modified the body in page context and both sides (served vs. original) were captured for this request.';
  }
  switch (fire.evidence) {
    case 'confirmed':
      return 'Confirmed by the in-page reporter — the scriptable action ran inside the page.';
    case 'matched-fallback':
      return 'Inferred from URL matching — a scriptable confirmation was expected but did not arrive.';
    case 'silent':
      return 'Pattern matched but the request was served from cache / a service worker — no DNR or scriptable action ran.';
    default:
      return evidence.verdict === 'corroborated'
        ? 'Corroborated — the claimed modification is visible in the captured headers.'
        : 'Inferred from URL matching — the rule would match this request based on its conditions.';
  }
}

const BADGE_CLASS: Record<FireDotTier, string> = {
  applied: 'dt-exec-badge--auth',
  contradicted: 'dt-exec-badge--contradicted',
  inferred: 'dt-exec-badge--inferred',
};

function FireRow({ fire, rule, lifecycle }: FireRowProps) {
  const label = rule?.name ?? fire.ruleSnapshot?.name ?? fire.ruleUid;
  const ruleType = rule?.type ?? fire.ruleSnapshot?.type ?? null;
  const actions = describeHeaderActions(fire, rule);
  // Rule-state tag next to the evidence badge — the snapshot is what
  // fired; the live rule may have been deleted or edited since.
  const ruleState = !rule
    ? 'deleted'
    : fire.ruleSnapshot && isRuleEditedSinceSnapshot(rule, fire.ruleSnapshot)
      ? 'modified'
      : null;
  const evidence = deriveFireEvidence(lifecycle, fire);
  const tier = fireTier(lifecycle, fire);
  const rulePopover = useRulePopover();
  const handleMouseOver = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!rule) return;
    rulePopover.open({ anchorEl: e.currentTarget, rule });
  };
  const handleMouseOut = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!rule) return;
    rulePopover.scheduleClose(e.relatedTarget);
  };
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: hover-only popover trigger; primary affordance remains the rule's full editor.
    // biome-ignore lint/a11y/useKeyWithMouseEvents: hover-anchored popover; keyboard users use the existing list interactions in the panel.
    <div
      className="dt-matched-rule"
      onMouseOver={rule ? handleMouseOver : undefined}
      onMouseOut={rule ? handleMouseOut : undefined}
    >
      <div className="dt-matched-rule-head">
        {/* Same type code + direction arrow as the quick-editor popover's
            title, so the row and the popover it opens read as one surface.
            Deleted rules (snapshot-only) render the code in the inactive
            gray. */}
        {ruleType &&
          buildRuleIcon({
            ruleType,
            rule,
            isActive: rule?.enabled ?? false,
            compactArrow: true,
            size: 12,
          })}
        <span className="dt-matched-rule-name">{label}</span>
        <span className="dt-matched-rule-badges">
          {ruleState && (
            <span
              className={`dt-exec-badge dt-exec-badge--rule-${ruleState}`}
              title={
                ruleState === 'deleted'
                  ? 'This rule has been deleted since it fired. The row shows what it did at fire time.'
                  : 'This rule has been edited since it fired. The row shows what it did at fire time; hover to see the current rule.'
              }
            >
              rule {ruleState}
            </span>
          )}
          <span className={`dt-exec-badge ${BADGE_CLASS[tier]}`} title={evidenceTitle(fire, evidence, lifecycle)}>
            {evidenceLabel(fire, evidence, lifecycle)}
          </span>
        </span>
      </div>
      {fire.pattern && <div className="dt-matched-rule-pattern">Pattern: {fire.pattern}</div>}
      {actions.length > 0 && (
        <ul className="dt-matched-rule-actions">
          {actions.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Projection row — a live rule that would fire on the next identical
 *  request. Same row anatomy as a matched row (type code + name,
 *  pattern line, header action lines) so the two sections read as one
 *  list; the evidence slot says "would match" instead of a verdict
 *  (nothing happened yet). The same hover opens the quick editor. */
function FutureRow({ match }: { match: FutureMatch }) {
  const { rule, pattern } = match;
  const actions = describeHeaderRuleActions(rule);
  const rulePopover = useRulePopover();
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: hover-only popover trigger; primary affordance remains the rule's full editor.
    // biome-ignore lint/a11y/useKeyWithMouseEvents: hover-anchored popover; keyboard users use the existing list interactions in the panel.
    <div
      className="dt-matched-rule"
      onMouseOver={(e) => rulePopover.open({ anchorEl: e.currentTarget, rule })}
      onMouseOut={(e) => rulePopover.scheduleClose(e.relatedTarget)}
    >
      <div className="dt-matched-rule-head">
        {buildRuleIcon({ ruleType: rule.type, rule, isActive: rule.enabled ?? true, compactArrow: true, size: 12 })}
        <span className="dt-matched-rule-name">{rule.name}</span>
        <span className="dt-matched-rule-future">would match</span>
      </div>
      {pattern && <div className="dt-matched-rule-pattern">Pattern: {pattern}</div>}
      {actions.length > 0 && (
        <ul className="dt-matched-rule-actions">
          {actions.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function MatchedRulesPanel({ row, rulesByUid, onClose }: MatchedRulesPanelProps) {
  const wiring = useMemo(() => createPanelHeaderWiring({ onHide: onClose }), [onClose]);
  const futureMatches = useFutureMatches(row, rulesByUid);
  // Same identity derivation as the inspector tab pill (`#N host/path`),
  // so the panel names the request exactly like the tab it belongs to.
  const reqTab = useMemo(
    () => (row ? buildInspectorTab({ lifecycle: row.lifecycle, displayId: row.displayId }) : null),
    [row],
  );
  return (
    <div className="dt-panel dt-matched-rules-panel">
      <PanelHeader
        wiring={wiring}
        title={
          <>
            <strong>Request Rules</strong>
            {reqTab && (
              <span className="dt-matched-rules-req" title={reqTab.url}>
                <span className="dt-method-badge" style={{ color: methodColor(reqTab.method) }}>
                  {reqTab.method}
                </span>
                <span className="dt-editor-tab-label">{reqTab.label}</span>
                {reqTab.statusCode != null && (
                  <span className={`dt-editor-tab-status${reqTab.statusCode >= 400 ? ' error' : ''}`}>
                    {reqTab.statusCode}
                  </span>
                )}
              </span>
            )}
          </>
        }
      />
      <div className="dt-matched-rules-panel-body">
        {!row && (
          <div className="dt-empty" style={{ fontSize: 11, padding: 12 }}>
            Select a request to see its rules.
          </div>
        )}
        {row && (
          <>
            <details className="dt-section" open>
              <summary>Matched · {row.fires.length}</summary>
              {row.fires.length === 0 && (
                <div className="dt-empty" style={{ fontSize: 11, padding: 12 }}>
                  No rules matched this request.
                </div>
              )}
              {row.fires.map((f, i) => (
                <FireRow
                  key={`${f.ruleUid}-${i}`}
                  fire={f}
                  rule={rulesByUid.get(f.ruleUid)}
                  lifecycle={row.lifecycle}
                />
              ))}
            </details>
            <details className="dt-section" open>
              <summary>Future matches · {futureMatches.length}</summary>
              {futureMatches.length === 0 && (
                <div className="dt-empty" style={{ fontSize: 11, padding: 12 }}>
                  No other rules would match this request.
                </div>
              )}
              {futureMatches.map((m) => (
                <FutureRow key={m.rule.uid} match={m} />
              ))}
            </details>
          </>
        )}
      </div>
    </div>
  );
}
