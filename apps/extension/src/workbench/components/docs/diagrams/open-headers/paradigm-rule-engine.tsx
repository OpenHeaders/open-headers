import type React from 'react';
import { FILL_BLUE, FILL_PURPLE, STROKE_BLUE, STROKE_PURPLE, TEXT, TEXT_DIM } from '../_shared';
import { OH_GREEN, OH_GREEN_TINT } from './_shared';

/**
 * Rule Engine deep-dive — unpacks the "Rule Engine · ENTERPRISE" row
 * of the paradigm-shift comparison. Two columns, one per execution
 * engine: DNR (native, Chrome's declarativeNetRequest) and Script
 * (extension-injected fetch/XHR monkey-patch). Each lists the rule
 * categories that compile to that engine. Below: a band naming the
 * shared condition language; under that, the variable scope chain.
 *
 * The argument the diagram makes: this isn't a header-only extension
 * with a single trick — it's a real engine with two execution paths,
 * a full condition language, and per-rule variable resolution.
 */
export const ParadigmRuleEngineDiagram: React.FC = () => {
  type Rule = { name: string; sub: string };

  const DNR_RULES: Rule[] = [
    { name: 'Headers', sub: 'Override · Append · Remove' },
    { name: 'Block', sub: 'cancel at network layer' },
    { name: 'Redirect', sub: 'static URL or regex' },
    { name: 'Query Params', sub: 'add · replace · remove · strip-all' },
  ];

  const SCRIPT_RULES: Rule[] = [
    { name: 'Headers (Merge)', sub: 'value concatenation' },
    { name: 'Inject', sub: 'JS or CSS, two timings' },
    { name: 'Delay', sub: 'navigation + fetch/XHR' },
    { name: 'Request Body', sub: 'static · dynamic · GraphQL filter' },
    { name: 'Response Body', sub: 'body + status + headers' },
  ];

  // Layout
  const W = 480;
  const OUTER_PAD = 10;
  const COL_GAP = 12;
  const COL_W = (W - OUTER_PAD * 2 - COL_GAP) / 2;
  const LEFT_X = OUTER_PAD;
  const RIGHT_X = LEFT_X + COL_W + COL_GAP;

  const TITLE_Y = 16;
  const SUBTITLE_Y = 30;
  const HEADER_BAND_Y = 44;
  const HEADER_BAND_H = 24;
  const RULE_LIST_Y = HEADER_BAND_Y + HEADER_BAND_H + 6;
  const RULE_H = 32;
  const RULE_GAP = 4;
  // Reserve enough vertical space for the taller column.
  const maxRules = Math.max(DNR_RULES.length, SCRIPT_RULES.length);
  const RULES_BLOCK_H = maxRules * (RULE_H + RULE_GAP) - RULE_GAP;
  const BAND_H = 36;
  const CONDITIONS_Y = RULE_LIST_Y + RULES_BLOCK_H + 40;
  const SCOPES_Y = CONDITIONS_Y + BAND_H + 14;
  const FOOTER_Y = SCOPES_Y + BAND_H + 22;
  const H = FOOTER_Y + 22;

  const renderRulePill = (rule: Rule, x: number, y: number, accent: 'dnr' | 'script') => {
    const fill = accent === 'dnr' ? FILL_BLUE : FILL_PURPLE;
    const stroke = accent === 'dnr' ? STROKE_BLUE : STROKE_PURPLE;
    return (
      <g>
        <rect x={x} y={y} width={COL_W} height={RULE_H} rx={4} fill={fill} stroke={stroke} strokeOpacity={0.6} />
        <text x={x + 10} y={y + RULE_H / 2 - 2} fontSize={11} fontWeight={700} fill={TEXT}>
          {rule.name}
        </text>
        <text x={x + 10} y={y + RULE_H / 2 + 11} fontSize={9} fill={TEXT_DIM} fontStyle="italic">
          {rule.sub}
        </text>
      </g>
    );
  };

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      style={{ maxWidth: 540 }}
      role="img"
      aria-label="Open Headers rule engine — two execution paths (DNR-native and script-based intercept), nine rule type categories grouped by engine, plus the shared condition language and variable scope chain that every rule reads from."
    >
      {/* Title with #1 stamp — matches ParadigmShift corner-stamp format */}
      <text x={LEFT_X} y={TITLE_Y} fontSize={13} fontWeight={700} fill={TEXT}>
        Rule Engine
      </text>
      <rect
        x={LEFT_X + 88}
        y={TITLE_Y - 14}
        width={24}
        height={18}
        rx={3}
        fill="var(--ant-color-bg-container)"
        stroke={STROKE_BLUE}
        strokeWidth={2}
      />
      <rect
        x={LEFT_X + 91}
        y={TITLE_Y - 11}
        width={18}
        height={12}
        rx={2}
        fill="none"
        stroke={STROKE_BLUE}
        strokeWidth={0.8}
        strokeDasharray="2 2"
      />
      <text
        x={LEFT_X + 100}
        y={TITLE_Y - 2}
        textAnchor="middle"
        fontSize={8}
        fontWeight={900}
        fill={TEXT}
        letterSpacing={0.8}
      >
        #1
      </text>
      <text x={LEFT_X} y={SUBTITLE_Y} fontSize={10} fontStyle="italic" fill={TEXT_DIM}>
        MV3 native · two engines · nine rule categories
      </text>

      {/* Engine column headers */}
      <rect
        x={LEFT_X}
        y={HEADER_BAND_Y}
        width={COL_W}
        height={HEADER_BAND_H}
        rx={5}
        fill={FILL_BLUE}
        stroke={STROKE_BLUE}
        strokeWidth={1.5}
      />
      <text
        x={LEFT_X + COL_W / 2}
        y={HEADER_BAND_Y + 16}
        textAnchor="middle"
        fontSize={11}
        fontWeight={700}
        fill={TEXT}
      >
        DNR · native
      </text>

      <rect
        x={RIGHT_X}
        y={HEADER_BAND_Y}
        width={COL_W}
        height={HEADER_BAND_H}
        rx={5}
        fill={FILL_PURPLE}
        stroke={STROKE_PURPLE}
        strokeWidth={1.5}
      />
      <text
        x={RIGHT_X + COL_W / 2}
        y={HEADER_BAND_Y + 16}
        textAnchor="middle"
        fontSize={11}
        fontWeight={700}
        fill={TEXT}
      >
        Script · intercept
      </text>

      {/* Rule pills per engine */}
      {DNR_RULES.map((rule, i) => (
        <g key={`dnr-${rule.name}`}>{renderRulePill(rule, LEFT_X, RULE_LIST_Y + i * (RULE_H + RULE_GAP), 'dnr')}</g>
      ))}
      {SCRIPT_RULES.map((rule, i) => (
        <g key={`script-${rule.name}`}>
          {renderRulePill(rule, RIGHT_X, RULE_LIST_Y + i * (RULE_H + RULE_GAP), 'script')}
        </g>
      ))}

      {/* Reach captions — each anchored to its OWN column's last pill.
       *  DNR caption sits close (its column ends sooner); Script caption
       *  gets extra breathing room so it doesn't crowd Response Body. */}
      <text
        x={LEFT_X + COL_W / 2}
        y={RULE_LIST_Y + DNR_RULES.length * (RULE_H + RULE_GAP) - RULE_GAP + 14}
        textAnchor="middle"
        fontSize={9}
        fontStyle="italic"
        fill={TEXT_DIM}
      >
        catches every browser-issued request
      </text>
      <text
        x={RIGHT_X + COL_W / 2}
        y={RULE_LIST_Y + SCRIPT_RULES.length * (RULE_H + RULE_GAP) - RULE_GAP + 22}
        textAnchor="middle"
        fontSize={9}
        fontStyle="italic"
        fill={TEXT_DIM}
      >
        catches JS-initiated fetch / XHR
      </text>

      {/* Shared conditions band */}
      <rect
        x={LEFT_X}
        y={CONDITIONS_Y}
        width={W - OUTER_PAD * 2}
        height={BAND_H}
        rx={5}
        fill="var(--ant-color-fill-quaternary)"
        stroke="var(--ant-color-border)"
      />
      <text x={LEFT_X + 12} y={CONDITIONS_Y + 14} fontSize={9} fontWeight={700} fill={TEXT_DIM} letterSpacing={0.5}>
        ONE CONDITION LANGUAGE
      </text>
      <text x={LEFT_X + 12} y={CONDITIONS_Y + 28} fontSize={10} fill={TEXT}>
        Request Domains · URL Pattern · URL Regex · Methods · Resource · Initiator · Headers · Domain Type
      </text>

      {/* Variable scopes band */}
      <rect
        x={LEFT_X}
        y={SCOPES_Y}
        width={W - OUTER_PAD * 2}
        height={BAND_H}
        rx={5}
        fill={OH_GREEN_TINT}
        stroke={OH_GREEN}
        strokeOpacity={0.6}
      />
      <text x={LEFT_X + 12} y={SCOPES_Y + 14} fontSize={9} fontWeight={700} fill={OH_GREEN} letterSpacing={0.5}>
        FIVE VARIABLE SCOPES
      </text>
      <text x={LEFT_X + 12} y={SCOPES_Y + 28} fontSize={10} fill={TEXT}>
        <tspan fontFamily="monospace">{'{{vault.X}}'}</tspan> · <tspan fontFamily="monospace">{'{{env.X}}'}</tspan> ·{' '}
        <tspan fontFamily="monospace">{'{{collection.X}}'}</tspan> ·{' '}
        <tspan fontFamily="monospace">{'{{workspace.X}}'}</tspan> · <tspan fontFamily="monospace">{'{{file.X}}'}</tspan>
      </text>

      <text x={W / 2} y={FOOTER_Y} textAnchor="middle" fontSize={10} fontWeight={700} fill={STROKE_BLUE}>
        One engine. Two execution paths. Full condition + variable language. Inside the extension.
      </text>
    </svg>
  );
};
