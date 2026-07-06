import type React from 'react';
import { ArrowDefs, STROKE, STROKE_GREEN, TEXT, TEXT_DIM } from '../_shared';
import { type DiagramScope, scopeBg, scopeColor } from './_scope-palette';

// ─── Per-scope reference diagrams ──────────────────────────────────
//
// One diagram per scope, all rendered from the same template so the
// five stay geometrically identical: a definition chip in the scope's
// colors, a green box of recommended references, a "don't" list with
// the reason each entry is a trap, and a dashed footer naming the
// better alternative. Mirrors the per-condition reference diagrams on
// the Conditions page.

interface GoodRow {
  text: string;
  note: string;
}

interface BadRow {
  text: string;
  reason: string;
}

interface ScopeRefSpec {
  scope: DiagramScope;
  title: string;
  chipLabel: string;
  chipSub: string;
  arrowCaption: string;
  goods: GoodRow[];
  goodFootnote?: string;
  badsLabel: string;
  bads: BadRow[];
  footer: [string, string];
  aria: string;
}

/** Approximate glyph advances at the chip's font sizes — size the
 *  chip to its content without measuring the DOM. */
const CHIP_LABEL_CHAR_W = 6.6;
const CHIP_SUB_CHAR_W = 4.2;

const ScopeRefDiagram: React.FC<{ spec: ScopeRefSpec }> = ({ spec }) => {
  const accent = scopeColor(spec.scope);
  const matchFail = 'var(--ant-color-error)';

  const chipTextW = Math.max(spec.chipLabel.length * CHIP_LABEL_CHAR_W, spec.chipSub.length * CHIP_SUB_CHAR_W);
  const chipW = Math.min(288, Math.max(150, Math.round(chipTextW) + 28));
  const chipX = 160 - chipW / 2;
  const chipY = 22;
  const chipH = 34;

  const arrowTop = chipY + chipH + 4;
  const arrowBottom = arrowTop + 16;

  const boxTop = arrowBottom + 8;
  const boxH = 40 + (spec.goods.length - 1) * 26 + (spec.goodFootnote ? 18 : 0);
  const boxBottom = boxTop + boxH;

  const sepY = boxBottom + 14;
  const badsLabelY = sepY + 16;
  const badTop = badsLabelY + 20;
  const lastReasonY = badTop + (spec.bads.length - 1) * 36 + 12;

  const footerTop = lastReasonY + 14;
  const height = footerTop + 38 + 8;
  const markerId = `var-ref-${spec.scope}`;

  return (
    <svg viewBox={`0 0 320 ${height}`} width="100%" style={{ maxWidth: 360 }} role="img" aria-label={spec.aria}>
      <ArrowDefs id={markerId} />

      <text x={160} y={14} textAnchor="middle" fontSize={10} fontWeight={600} fill={TEXT}>
        {spec.title}
      </text>

      {/* Definition chip in the scope's colors */}
      <rect x={chipX} y={chipY} width={chipW} height={chipH} rx={4} fill={scopeBg(spec.scope)} stroke={accent} />
      <text
        x={160}
        y={chipY + 15}
        textAnchor="middle"
        fontFamily="monospace"
        fontSize={10.5}
        fontWeight={700}
        fill={TEXT}
      >
        {spec.chipLabel}
      </text>
      <text x={160} y={chipY + 28} textAnchor="middle" fontSize={7.5} fill={TEXT_DIM}>
        {spec.chipSub}
      </text>

      <line x1={160} y1={arrowTop} x2={160} y2={arrowBottom} stroke={accent} strokeWidth={1.5} markerEnd={`url(#${markerId})`} />
      <text x={168} y={arrowTop + 12} fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        {spec.arrowCaption}
      </text>

      {/* Recommended references */}
      <rect x={20} y={boxTop} width={280} height={boxH} rx={4} fill="var(--ant-color-fill-quaternary)" stroke={STROKE_GREEN} />
      {spec.goods.map((row, i) => {
        const y = boxTop + 20 + i * 26;
        return (
          <g key={row.text}>
            <text x={34} y={y} fontSize={11} fontWeight={700} fill={STROKE_GREEN}>
              ✓
            </text>
            <text x={50} y={y} fontFamily="monospace" fontSize={10} fill={TEXT}>
              {row.text}
            </text>
            <text x={50} y={y + 11} fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
              {row.note}
            </text>
          </g>
        );
      })}
      {spec.goodFootnote && (
        <>
          <line x1={28} y1={boxBottom - 18} x2={292} y2={boxBottom - 18} stroke={STROKE_GREEN} strokeDasharray="2 2" />
          <text x={160} y={boxBottom - 6} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
            {spec.goodFootnote}
          </text>
        </>
      )}

      <line x1={20} y1={sepY} x2={300} y2={sepY} stroke={STROKE} strokeDasharray="2 3" />

      {/* Anti-patterns */}
      <text x={20} y={badsLabelY} fontSize={9} fontWeight={600} fill={TEXT_DIM}>
        {spec.badsLabel}
      </text>
      {spec.bads.map((row, i) => {
        const y = badTop + i * 36;
        return (
          <g key={row.text}>
            <text x={32} y={y} fontSize={11} fontWeight={700} fill={matchFail}>
              ✗
            </text>
            <text x={48} y={y} fontFamily="monospace" fontSize={10} fill={TEXT_DIM}>
              {row.text}
            </text>
            <text x={48} y={y + 12} fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
              {row.reason}
            </text>
          </g>
        );
      })}

      {/* Better-alternative hint */}
      <rect
        x={14}
        y={footerTop}
        width={292}
        height={38}
        rx={4}
        fill="var(--ant-color-fill-quaternary)"
        stroke={STROKE}
        strokeDasharray="2 3"
      />
      <text x={160} y={footerTop + 16} textAnchor="middle" fontSize={9} fill={TEXT}>
        {spec.footer[0]}
      </text>
      <text x={160} y={footerTop + 30} textAnchor="middle" fontSize={9} fill={TEXT}>
        {spec.footer[1]}
      </text>
    </svg>
  );
};

// ─── The five specs ────────────────────────────────────────────────

const VAULT_SPEC: ScopeRefSpec = {
  scope: 'vault',
  title: 'Vault — secrets that never leave this device',
  chipLabel: 'api_key = ••••••••••',
  chipSub: 'Vault · kind: string',
  arrowCaption: 'resolved locally',
  goods: [
    { text: 'Authorization: {{vault.api_key}}', note: 'synced rule — each teammate’s own key fills in' },
    { text: '{{vault.mfa}} → 214908', note: 'TOTP entry — resolves the current code, never the seed' },
  ],
  goodFootnote: 'vault entries stay out of sync, exports, and git',
  badsLabel: "Don't:",
  bads: [
    { text: 'Bearer sk-live-9f3d… in a rule', reason: 'pasted plaintext syncs to the whole workspace' },
    { text: 'api_key as a workspace variable', reason: 'synced too — the vault is the only local scope' },
  ],
  footer: [
    'Vault outranks every scope — a bare {{api_key}}',
    'always picks the vault value when one exists.',
  ],
  aria: 'Vault: reference secrets from synced entities via vault templates; never paste raw keys into rules or workspace variables',
};

const ENVIRONMENT_SPEC: ScopeRefSpec = {
  scope: 'environment',
  title: 'Environment — one name, a value per stage',
  chipLabel: 'api_host = stg.openheaders.io',
  chipSub: 'Environments · staging (active)',
  arrowCaption: 'active environment wins',
  goods: [
    { text: '{{api_host}} → stg.openheaders.io', note: 'while staging is active' },
    { text: 'production → openheaders.io', note: 'switch environments — same rules, zero edits' },
  ],
  goodFootnote: 'a miss falls back to the default environment first',
  badsLabel: "Don't:",
  bads: [
    { text: 'sk-live key typed into production', reason: 'environments sync — secrets belong in the Vault' },
    { text: 'a staging copy of every rule', reason: 'don’t duplicate rules per stage — switch the environment' },
  ],
  footer: [
    'Same value in every stage? Use Workspace.',
    'Per-user secret? Vault outranks every environment.',
  ],
  aria: 'Environment: one variable name resolves to a different value per stage; switch environments instead of duplicating rules, and keep secrets in the vault',
};

const COLLECTION_SPEC: ScopeRefSpec = {
  scope: 'collection',
  title: 'Collection — scoped to one API',
  chipLabel: 'base_url = pay.openheaders.io',
  chipSub: 'Payments API · Variables',
  arrowCaption: 'resolves inside Payments API',
  goods: [
    { text: 'GET {{base_url}}/v2/charges', note: 'request in the Payments API collection' },
    { text: 'redirect → {{base_url}}/sandbox', note: 'rule in the Payments API collection' },
  ],
  badsLabel: "Doesn't resolve:",
  bads: [
    { text: '{{base_url}} in Billing API', reason: 'different collection — define it there instead' },
    { text: '{{base_url}} in an uncollected rule', reason: 'no collection → the reference walks past this scope' },
  ],
  footer: [
    'Needed by every collection? Move it to Workspace.',
    'A same-named environment variable outranks it.',
  ],
  aria: 'Collection: variables resolve only for rules and requests inside their collection; move workspace-wide values to workspace scope',
};

const WORKSPACE_SPEC: ScopeRefSpec = {
  scope: 'workspace',
  title: 'Workspace — the shared base layer',
  chipLabel: 'team_id = acme-42',
  chipSub: 'Workspace Variables',
  arrowCaption: 'resolves everywhere',
  goods: [
    { text: 'X-Team: {{team_id}}', note: 'header rule — any collection, any environment' },
    { text: 'api.openheaders.io/{{team_id}}/usage', note: 'request URL' },
    { text: '{{workspace.team_id}}', note: 'pinned — even when a higher scope shadows the name' },
  ],
  badsLabel: "Don't:",
  bads: [
    { text: 'api_key = sk-live-9f3d…', reason: 'synced to everyone — keep secrets in the Vault' },
    { text: 'api_host = stg.openheaders.io', reason: 'changes per stage — define it in each Environment' },
  ],
  footer: [
    'Secret? Use Vault. Different per stage? Use Environment.',
    'Workspace is for values that are true everywhere.',
  ],
  aria: 'Workspace: workspace variables resolve everywhere and rank lowest; keep secrets in the vault and per-stage values in environments',
};

const LIVE_SPEC: ScopeRefSpec = {
  scope: 'live',
  title: 'Live — produced by a workflow run',
  chipLabel: '{{live.token}}',
  chipSub: 'Live Variables · OAuth login workflow',
  arrowCaption: 'published by the last run',
  goods: [
    { text: 'Authorization: Bearer {{live.token}}', note: 'header rule that never goes stale' },
    { text: '{{live.token}} in requests & workflows', note: 'always the latest published value' },
  ],
  badsLabel: "Don't:",
  bads: [
    { text: '{{token}} — bare', reason: 'live never joins the bare walk — write {{live.token}}' },
    { text: 'a pasted token in an env variable', reason: 'expires silently — back it with a workflow instead' },
  ],
  footer: [
    'Edited the workflow? The value shows stale —',
    'only the next successful run re-publishes it.',
  ],
  aria: 'Live: reference workflow-published values with the live prefix; a bare reference never resolves live, and hand-pasted tokens go stale',
};

export const VariablesVaultRefDiagram: React.FC = () => <ScopeRefDiagram spec={VAULT_SPEC} />;
export const VariablesEnvironmentRefDiagram: React.FC = () => <ScopeRefDiagram spec={ENVIRONMENT_SPEC} />;
export const VariablesCollectionRefDiagram: React.FC = () => <ScopeRefDiagram spec={COLLECTION_SPEC} />;
export const VariablesWorkspaceRefDiagram: React.FC = () => <ScopeRefDiagram spec={WORKSPACE_SPEC} />;
export const VariablesLiveRefDiagram: React.FC = () => <ScopeRefDiagram spec={LIVE_SPEC} />;
