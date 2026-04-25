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

import { ThunderboltOutlined } from '@ant-design/icons';
import type { V5 } from '@openheaders/core/types';
import { PanelHeader } from '@/shared/dock-layout';
import { type InspectorFire, type InspectorRequest, isAppliedFire } from '../data/types';
import type { RulesByUid } from '../data/use-rules-lookup';

interface MatchedRulesPanelProps {
  request: InspectorRequest | null;
  rulesByUid: RulesByUid;
  onClose: () => void;
}

function formatRuleType(rule: V5.Rule): string {
  switch (rule.type) {
    case 'header':
      return 'Header';
    case 'redirect':
      return 'Redirect';
    case 'block':
      return 'Block';
    case 'mock':
      return 'Mock';
    case 'body':
      return 'Body';
    case 'delay':
      return 'Delay';
    case 'inject':
      return 'Inject';
    default:
      return rule.type;
  }
}

function describeHeaderActions(rule: V5.Rule): string[] {
  if (rule.type !== 'header') return [];
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
  rule: V5.Rule | undefined;
}

/** Power-user evidence label — distinguishes the *source* of the
 *  applied/inferred verdict for diagnostic readers. */
function evidenceLabel(fire: InspectorFire): string {
  if (fire.authoritative) return 'authoritative';
  switch (fire.evidence) {
    case 'confirmed':
      return 'confirmed';
    case 'matched-fallback':
      return 'fallback';
    case 'silent':
      return 'silent';
    default:
      return 'inferred';
  }
}

function evidenceTitle(fire: InspectorFire): string {
  if (fire.authoritative) {
    return "Confirmed by Chrome's onRuleMatchedDebug — this DNR rule actually executed on the request.";
  }
  switch (fire.evidence) {
    case 'confirmed':
      return 'Confirmed by the in-page reporter — the scriptable action ran inside the page.';
    case 'matched-fallback':
      return 'Inferred from URL matching — a scriptable confirmation was expected but did not arrive.';
    case 'silent':
      return 'Pattern matched but the request was served from cache / a service worker — no DNR or scriptable action ran.';
    default:
      return 'Inferred from URL matching — the rule would match this request based on its conditions.';
  }
}

function FireRow({ fire, rule }: FireRowProps) {
  const label = rule?.name ?? fire.ruleUid;
  const type = rule ? formatRuleType(rule) : '—';
  const actions = rule ? describeHeaderActions(rule) : [];
  const applied = isAppliedFire(fire);
  return (
    <div className="dt-matched-rule">
      <div className="dt-matched-rule-head">
        <span
          className={`dt-exec-badge ${applied ? 'dt-exec-badge--auth' : 'dt-exec-badge--inferred'}`}
          title={evidenceTitle(fire)}
        >
          {evidenceLabel(fire)}
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

export function MatchedRulesPanel({ request, rulesByUid, onClose }: MatchedRulesPanelProps) {
  return (
    <div className="dt-panel dt-matched-rules-panel">
      <PanelHeader
        title={
          <>
            <ThunderboltOutlined />
            <strong>Matched Rules</strong>
            {request && <span className="dt-panel-title-sub">· {request.method}</span>}
          </>
        }
        onHide={onClose}
      />
      <div className="dt-matched-rules-panel-body">
        {!request && (
          <div className="dt-empty" style={{ fontSize: 11, padding: 12 }}>
            Select a request to see matched rules.
          </div>
        )}
        {request && request.fires.length === 0 && (
          <div className="dt-empty" style={{ fontSize: 11, padding: 12 }}>
            No rules matched this request.
          </div>
        )}
        {request?.fires.map((f, i) => (
          <FireRow key={`${f.ruleUid}-${i}`} fire={f} rule={rulesByUid.get(f.ruleUid)} />
        ))}
      </div>
    </div>
  );
}
