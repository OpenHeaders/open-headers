/**
 * Bottom-dock tool window listing every Open Headers rule that fired
 * on the currently-selected request.
 *
 * Complements the inline per-header badges in the Headers tab:
 *   - Headers tab shows *what changed* about each individual header.
 *   - This panel shows *which rules* fired, each with its type, target
 *     headers, and match evidence. A rule may fire without changing
 *     any visible header (block / delay / pure-match rules), in which
 *     case it only shows up here.
 */

import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import type { Rule } from '@openheaders/core/types';
import { createPanelHeaderWiring, PanelHeader } from '@openheaders/ui/shared/dock-layout';
import { useMemo } from 'react';
import {
  type FireDotTier,
  type FireEvidence,
  deriveFireEvidence,
  fireTier,
  hasCapturedOverride,
} from '../data/fire-evidence';
import type { InspectorRowWithFires } from '../data/inspector-row-projection';
import type { InspectorFire } from '../data/types';
import type { RulesByUid } from '../data/rule-create/use-rules-lookup';
import { useRulePopover } from './RulePopoverHost';

interface MatchedRulesPanelProps {
  row: InspectorRowWithFires | null;
  rulesByUid: RulesByUid;
  onClose: () => void;
}

function formatRuleType(rule: Rule): string {
  return formatRuleTypeFromSnapshot(rule.type);
}

function formatRuleTypeFromSnapshot(type: Rule['type']): string {
  switch (type) {
    case 'header':
      return 'Header';
    case 'redirect':
      return 'Redirect';
    case 'block':
      return 'Block';
    case 'response':
      return 'Response';
    case 'request-body':
      return 'Request Body';
    case 'delay':
      return 'Delay';
    case 'inject':
      return 'Inject';
    case 'ws':
      return 'WebSocket';
    case 'sse':
      return 'SSE';
    default:
      return type;
  }
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
  const type = rule
    ? formatRuleType(rule)
    : fire.ruleSnapshot
      ? formatRuleTypeFromSnapshot(fire.ruleSnapshot.type)
      : '—';
  const actions = describeHeaderActions(fire, rule);
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
        <span className={`dt-exec-badge ${BADGE_CLASS[tier]}`} title={evidenceTitle(fire, evidence, lifecycle)}>
          {evidenceLabel(fire, evidence, lifecycle)}
        </span>
        <span className="dt-matched-rule-type">{type}</span>
        <span className="dt-matched-rule-name">{label}</span>
        {!rule && <span className="dt-col-muted"> · rule deleted</span>}
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

export function MatchedRulesPanel({ row, rulesByUid, onClose }: MatchedRulesPanelProps) {
  const wiring = useMemo(() => createPanelHeaderWiring({ onHide: onClose }), [onClose]);
  return (
    <div className="dt-panel dt-matched-rules-panel">
      <PanelHeader
        wiring={wiring}
        title={
          <>
            <strong>Matched Rules</strong>
            {row && <span className="dt-panel-title-sub">· {row.lifecycle.method}</span>}
          </>
        }
      />
      <div className="dt-matched-rules-panel-body">
        {!row && (
          <div className="dt-empty" style={{ fontSize: 11, padding: 12 }}>
            Select a request to see matched rules.
          </div>
        )}
        {row && row.fires.length === 0 && (
          <div className="dt-empty" style={{ fontSize: 11, padding: 12 }}>
            No rules matched this request.
          </div>
        )}
        {row?.fires.map((f, i) => (
          <FireRow key={`${f.ruleUid}-${i}`} fire={f} rule={rulesByUid.get(f.ruleUid)} lifecycle={row.lifecycle} />
        ))}
      </div>
    </div>
  );
}
