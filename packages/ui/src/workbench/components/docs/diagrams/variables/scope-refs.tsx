import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
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

const unitLen = (s: string): number =>
  Array.from(s).reduce((n, ch) => n + ((ch.codePointAt(0) ?? 0) > 0x2e7f ? 1.85 : 1), 0);

const ScopeRefDiagram: React.FC<{ spec: ScopeRefSpec }> = ({ spec }) => {
  const accent = scopeColor(spec.scope);
  const matchFail = 'var(--ant-color-error)';

  const chipTextW = Math.max(spec.chipLabel.length * CHIP_LABEL_CHAR_W, unitLen(spec.chipSub) * CHIP_SUB_CHAR_W);
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

export const VariablesVaultRefDiagram: React.FC = () => {
  const t = useT();
  return (
    <ScopeRefDiagram
      spec={{
        scope: 'vault',
        title: t('workbench.docs.diagrams.variables.refs.vault.title'),
        chipLabel: 'api_key = ••••••••••',
        chipSub: t('workbench.docs.diagrams.variables.refs.vault.chipSub'),
        arrowCaption: t('workbench.docs.diagrams.variables.refs.vault.arrowCaption'),
        goods: [
          {
            text: 'Authorization: {{vault.api_key}}',
            note: t('workbench.docs.diagrams.variables.refs.vault.good1Note'),
          },
          { text: '{{vault.mfa}} → 214908', note: t('workbench.docs.diagrams.variables.refs.vault.good2Note') },
        ],
        goodFootnote: t('workbench.docs.diagrams.variables.refs.vault.goodFootnote'),
        badsLabel: t('workbench.docs.diagrams.variables.refs.shared.dont'),
        bads: [
          {
            text: t('workbench.docs.diagrams.variables.refs.vault.bad1Text'),
            reason: t('workbench.docs.diagrams.variables.refs.vault.bad1Reason'),
          },
          {
            text: t('workbench.docs.diagrams.variables.refs.vault.bad2Text'),
            reason: t('workbench.docs.diagrams.variables.refs.vault.bad2Reason'),
          },
        ],
        footer: [
          t('workbench.docs.diagrams.variables.refs.vault.footer1'),
          t('workbench.docs.diagrams.variables.refs.vault.footer2'),
        ],
        aria: t('workbench.docs.diagrams.variables.refs.vault.aria'),
      }}
    />
  );
};

export const VariablesEnvironmentRefDiagram: React.FC = () => {
  const t = useT();
  return (
    <ScopeRefDiagram
      spec={{
        scope: 'environment',
        title: t('workbench.docs.diagrams.variables.refs.environment.title'),
        chipLabel: 'api_host = stg.openheaders.com',
        chipSub: t('workbench.docs.diagrams.variables.refs.environment.chipSub'),
        arrowCaption: t('workbench.docs.diagrams.variables.refs.environment.arrowCaption'),
        goods: [
          {
            text: '{{api_host}} → stg.openheaders.com',
            note: t('workbench.docs.diagrams.variables.refs.environment.good1Note'),
          },
          {
            text: 'production → openheaders.com',
            note: t('workbench.docs.diagrams.variables.refs.environment.good2Note'),
          },
        ],
        goodFootnote: t('workbench.docs.diagrams.variables.refs.environment.goodFootnote'),
        badsLabel: t('workbench.docs.diagrams.variables.refs.shared.dont'),
        bads: [
          {
            text: t('workbench.docs.diagrams.variables.refs.environment.bad1Text'),
            reason: t('workbench.docs.diagrams.variables.refs.environment.bad1Reason'),
          },
          {
            text: t('workbench.docs.diagrams.variables.refs.environment.bad2Text'),
            reason: t('workbench.docs.diagrams.variables.refs.environment.bad2Reason'),
          },
        ],
        footer: [
          t('workbench.docs.diagrams.variables.refs.environment.footer1'),
          t('workbench.docs.diagrams.variables.refs.environment.footer2'),
        ],
        aria: t('workbench.docs.diagrams.variables.refs.environment.aria'),
      }}
    />
  );
};

export const VariablesCollectionRefDiagram: React.FC = () => {
  const t = useT();
  return (
    <ScopeRefDiagram
      spec={{
        scope: 'collection',
        title: t('workbench.docs.diagrams.variables.refs.collection.title'),
        chipLabel: 'base_url = pay.openheaders.com',
        chipSub: t('workbench.docs.diagrams.variables.refs.collection.chipSub'),
        arrowCaption: t('workbench.docs.diagrams.variables.refs.collection.arrowCaption'),
        goods: [
          {
            text: 'GET {{base_url}}/v2/charges',
            note: t('workbench.docs.diagrams.variables.refs.collection.good1Note'),
          },
          {
            text: 'redirect → {{base_url}}/sandbox',
            note: t('workbench.docs.diagrams.variables.refs.collection.good2Note'),
          },
        ],
        badsLabel: t('workbench.docs.diagrams.variables.refs.collection.badsLabel'),
        bads: [
          {
            text: t('workbench.docs.diagrams.variables.refs.collection.bad1Text'),
            reason: t('workbench.docs.diagrams.variables.refs.collection.bad1Reason'),
          },
          {
            text: t('workbench.docs.diagrams.variables.refs.collection.bad2Text'),
            reason: t('workbench.docs.diagrams.variables.refs.collection.bad2Reason'),
          },
        ],
        footer: [
          t('workbench.docs.diagrams.variables.refs.collection.footer1'),
          t('workbench.docs.diagrams.variables.refs.collection.footer2'),
        ],
        aria: t('workbench.docs.diagrams.variables.refs.collection.aria'),
      }}
    />
  );
};

export const VariablesWorkspaceRefDiagram: React.FC = () => {
  const t = useT();
  return (
    <ScopeRefDiagram
      spec={{
        scope: 'workspace',
        title: t('workbench.docs.diagrams.variables.refs.workspace.title'),
        chipLabel: 'team_id = acme-42',
        chipSub: t('workbench.docs.diagrams.variables.refs.workspace.chipSub'),
        arrowCaption: t('workbench.docs.diagrams.variables.refs.workspace.arrowCaption'),
        goods: [
          { text: 'X-Team: {{team_id}}', note: t('workbench.docs.diagrams.variables.refs.workspace.good1Note') },
          {
            text: 'api.openheaders.com/{{team_id}}/usage',
            note: t('workbench.docs.diagrams.variables.refs.workspace.good2Note'),
          },
          { text: '{{workspace.team_id}}', note: t('workbench.docs.diagrams.variables.refs.workspace.good3Note') },
        ],
        badsLabel: t('workbench.docs.diagrams.variables.refs.shared.dont'),
        bads: [
          {
            text: 'api_key = sk-live-9f3d…',
            reason: t('workbench.docs.diagrams.variables.refs.workspace.bad1Reason'),
          },
          {
            text: 'api_host = stg.openheaders.com',
            reason: t('workbench.docs.diagrams.variables.refs.workspace.bad2Reason'),
          },
        ],
        footer: [
          t('workbench.docs.diagrams.variables.refs.workspace.footer1'),
          t('workbench.docs.diagrams.variables.refs.workspace.footer2'),
        ],
        aria: t('workbench.docs.diagrams.variables.refs.workspace.aria'),
      }}
    />
  );
};

export const VariablesLiveRefDiagram: React.FC = () => {
  const t = useT();
  return (
    <ScopeRefDiagram
      spec={{
        scope: 'live',
        title: t('workbench.docs.diagrams.variables.refs.live.title'),
        chipLabel: '{{live.token}}',
        chipSub: t('workbench.docs.diagrams.variables.refs.live.chipSub'),
        arrowCaption: t('workbench.docs.diagrams.variables.refs.live.arrowCaption'),
        goods: [
          {
            text: 'Authorization: Bearer {{live.token}}',
            note: t('workbench.docs.diagrams.variables.refs.live.good1Note'),
          },
          {
            text: t('workbench.docs.diagrams.variables.refs.live.good2Text'),
            note: t('workbench.docs.diagrams.variables.refs.live.good2Note'),
          },
        ],
        badsLabel: t('workbench.docs.diagrams.variables.refs.shared.dont'),
        bads: [
          {
            text: t('workbench.docs.diagrams.variables.refs.live.bad1Text'),
            reason: t('workbench.docs.diagrams.variables.refs.live.bad1Reason'),
          },
          {
            text: t('workbench.docs.diagrams.variables.refs.live.bad2Text'),
            reason: t('workbench.docs.diagrams.variables.refs.live.bad2Reason'),
          },
        ],
        footer: [
          t('workbench.docs.diagrams.variables.refs.live.footer1'),
          t('workbench.docs.diagrams.variables.refs.live.footer2'),
        ],
        aria: t('workbench.docs.diagrams.variables.refs.live.aria'),
      }}
    />
  );
};
