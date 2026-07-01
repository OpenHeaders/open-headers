/**
 * SnapshotBlock — the read-only "what happened on this request" block
 * at the top of the rule hover popover.
 *
 * Renders the frozen `RuleSnapshot` capture (Original / Now rows), a
 * Future row previewing what the live rule would do on the next
 * matching request, and the rule's sibling mods on the same request.
 * All data is derived by the parent (`RuleHoverPopover`) and passed in
 * as props — this module owns presentation only.
 */

import type { HeaderModification, Rule, RuleSnapshotHeaderMod } from '@openheaders/core/types';
import { theme } from 'antd';
import type { GlobalToken } from 'antd/es/theme/interface';
import type { HeaderAttribution, RuleAttributionContext } from '../data/header-attribution';
import type { RuleApplicability } from '../data/rule-applicability';
import { ResolvedHeaderValue } from './ResolvedHeaderValue';
import {
  computeFutureKind,
  type FutureKind,
  isSnapshotResolutionReliable,
  snapshotAppliedValue,
} from './rule-hover-format';

interface FutureValueProps {
  kind: FutureKind;
  collectionId: string | undefined;
  token: GlobalToken;
  valueStyle: React.CSSProperties;
}

/**
 * Renders the right-hand side of the Future row. Each `FutureKind`
 * variant maps to a distinct affordance:
 *
 *   - resolved              — the live rule's resolved value
 *   - removed               — rule's op flipped to `remove`
 *   - mod-gone              — rule still exists but the mod was deleted
 *   - rule-deleted          — rule no longer in the registry
 *   - rule-disabled         — rule's enabled flag is off
 *   - conditions-mismatch   — rule's conditions no longer match this URL
 *   - name/value-template-unresolved — DNR builder will reject (TOTP etc.)
 */
function FutureValue({ kind, collectionId, token, valueStyle }: FutureValueProps) {
  const muted: React.CSSProperties = {
    ...valueStyle,
    fontStyle: 'italic',
    color: token.colorTextTertiary,
  };
  const struck: React.CSSProperties = { ...muted, textDecoration: 'line-through' };
  switch (kind.kind) {
    case 'resolved':
      return (
        <span style={valueStyle}>
          <ResolvedHeaderValue value={kind.value} collectionId={collectionId} />
        </span>
      );
    case 'removed':
      return <span style={struck}>removed</span>;
    case 'rule-deleted':
      return <span style={muted}>rule was deleted — won't fire</span>;
    case 'rule-disabled':
      return <span style={muted}>rule is disabled — won't fire</span>;
    case 'mod-gone':
      return <span style={muted}>this modification was removed from the rule</span>;
    case 'conditions-mismatch':
      return <span style={muted}>rule's conditions no longer match this URL</span>;
    case 'name-template-unresolved':
      return (
        <span style={muted} title={`Template: ${kind.template}`}>
          header name template can't be resolved — rule won't fire
        </span>
      );
    case 'value-template-unresolved':
      return (
        <span style={muted} title={`Template: ${kind.template}`}>
          value template can't be resolved — rule won't fire
        </span>
      );
    case 'separator-template-unresolved':
      return (
        <span style={muted} title={`Template: ${kind.template}`}>
          mergeSeparator template can't be resolved — rule won't fire
        </span>
      );
    default:
      return null;
  }
}

interface SnapshotBlockProps {
  attribution: HeaderAttribution;
  ctx: RuleAttributionContext;
  /** Live rule from the renderer mirror — passed in so SnapshotBlock
   *  shows the freshest "future" view without reaching into a stale
   *  attribution-cached field. */
  liveRule: Rule | null;
  /** Live mod (or null if removed) — derived once in the parent via
   *  `findCurrentMod(liveRule, ctx)`. */
  currentMod: HeaderModification | null;
  /** Whether the live rule diverges from the snapshot — derived once
   *  in the parent via `isAttributionEdited(liveRule, ctx)`. */
  ruleEdited: boolean;
  collectionId: string | undefined;
  /** Live resolution of the current rule's value template. Only
   *  rendered when it differs from the snapshot's `valueResolved`. */
  currentResolvedValue: string | null;
  /** Live resolution of the current rule's headerName template.
   *  Used to surface name drift (var referenced by name resolves
   *  differently now). */
  currentResolvedName: string | null;
  /** Live-rule firing verdict — drives the Future row's content. */
  applicability: RuleApplicability | null;
}

/**
 * Read-only "what happened on this request" block.
 *
 * Layout:
 *   - Original (server, or "(absent — added by rule)")
 *   - Applied for this request — the snapshot's resolved value, plus
 *     a small monospaced template hint when the template differs from
 *     the resolved value (i.e. the user wrote `{{vars}}`).
 *
 * Clearly labeled as a snapshot so users understand the editor below
 * does NOT retroactively change this — it's a frozen capture.
 */
export function SnapshotBlock({
  attribution,
  ctx,
  liveRule,
  currentMod,
  ruleEdited,
  collectionId,
  currentResolvedValue,
  currentResolvedName,
  applicability,
}: SnapshotBlockProps) {
  const { token } = theme.useToken();
  const mod = ctx.snapshotMod;
  // Long token-style values (Bearer JWTs, base64 blobs, cookies) used
  // to render at full height inside the snapshot block — for a 3 KB
  // JWT that meant the popover was 800 px tall and pushed the editable
  // form below the fold. Cap the visible area at ~4 lines with inner
  // vertical scroll. `display: inline-block` is required for max-height
  // / overflow to take on a span; `flex: 1; minWidth: 0` lets the value
  // shrink to the row's available width inside the flex parent and
  // wrap rather than overflow horizontally.
  const valueStyle: React.CSSProperties = {
    fontFamily: token.fontFamilyCode,
    fontSize: 12,
    wordBreak: 'break-all',
    whiteSpace: 'pre-wrap',
    lineHeight: 1.45,
    display: 'inline-block',
    flex: 1,
    minWidth: 0,
    // Same cap as the editable value field below — see panel.css :root.
    maxHeight: 'var(--oh-multiline-cap, 96px)',
    overflowY: 'auto',
    overflowX: 'hidden',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: token.colorTextTertiary,
    flexShrink: 0,
    minWidth: 64,
    paddingTop: 1,
  };
  const rowStyle: React.CSSProperties = {
    display: 'flex',
    // `flex-start` (was: baseline) — baseline misaligns when the value
    // is a multi-line scrollable block.
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 2,
  };
  const blockStyle: React.CSSProperties = {
    background: token.colorFillQuaternary,
    border: `1px solid ${token.colorBorderSecondary}`,
    borderRadius: token.borderRadius,
    padding: '6px 10px',
    marginBottom: 8,
  };

  const opLabel = (() => {
    switch (mod.operation) {
      case 'override':
        return attribution.kind === 'added' ? 'inject' : 'override';
      case 'add':
        return 'append';
      case 'merge':
        return 'merge';
      case 'remove':
        return 'remove';
    }
  })();

  // `originalValue` is absent on a corroborated mod over a post-rewrite
  // capture (the pre-rule value was never recorded) — normalize to null.
  const originalValue =
    attribution.kind === 'modified' || attribution.kind === 'removed' ? (attribution.originalValue ?? null) : null;
  const cancelledInjection =
    attribution.kind === 'removed' && attribution.source === 'injection' ? attribution.injectingRule : undefined;
  const appliedValue = snapshotAppliedValue(mod);

  // Now / Future framing:
  //   - "Now"    — what this request actually got (the snapshot).
  //   - "Future" — what the live rule would produce for the next request.
  //
  // Future content is driven by the parent-computed `applicability`
  // verdict — anything other than `will-fire` short-circuits the
  // resolved-value preview with a specific reason (rule disabled,
  // conditions mismatch, unresolvable template). For `will-fire`,
  // we surface the value- or op-drift cases.
  const futureKind = computeFutureKind(applicability, liveRule, currentMod, mod, currentResolvedValue);
  const showFutureRow = futureKind.kind !== 'none';

  // Hide the `Original` row when it would be identical to `Now`. Common
  // case: request-direction overrides where Chrome's HAR captured the
  // post-rule value as the "server" value, so `originalValue` ===
  // `appliedValue`. The row would carry no information.
  const showOriginalRow = originalValue !== null && (mod.operation === 'remove' || originalValue !== appliedValue);

  // Name drift: same reliability gate as value drift — if the
  // snapshot's resolved name still contains `{{`, resolution failed at
  // fire time (TOTP in name, broken ref) and we have no honest
  // baseline to compare against. Skip the drift signal in that case.
  const nameDrifted =
    !ruleEdited &&
    !mod.headerName.includes('{{') &&
    currentResolvedName != null &&
    currentResolvedName !== mod.headerName;

  // Mutated-headline byline: one short line summarizing op + direction +
  // header name. When the user wrote a `{{var}}` in the name, also
  // show the template alongside the resolved name so the user sees
  // both representations.
  const headline = (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 11,
        color: token.colorTextSecondary,
        marginBottom: 4,
        flexWrap: 'wrap',
      }}
    >
      <span style={{ fontWeight: 600 }}>{opLabel}</span>
      <span style={{ opacity: 0.6 }}>·</span>
      <span>{mod.direction}</span>
      <span style={{ opacity: 0.6 }}>·</span>
      <span style={{ fontFamily: token.fontFamilyCode }}>{mod.headerName}</span>
      {mod.headerNameTemplate && (
        <span
          style={{ fontFamily: token.fontFamilyCode, opacity: 0.6 }}
          title="Template before variable resolution at fire time"
        >
          ({mod.headerNameTemplate})
        </span>
      )}
      {nameDrifted && currentResolvedName != null && (
        <>
          <span style={{ opacity: 0.6 }}>→</span>
          <span
            style={{ fontFamily: token.fontFamilyCode, color: token.colorWarning }}
            title="Same template — a referenced variable now resolves to a different header name"
          >
            {currentResolvedName}
          </span>
        </>
      )}
      {cancelledInjection && (
        <>
          <span style={{ opacity: 0.6 }}>·</span>
          <span style={{ fontStyle: 'italic' }}>cancels "{cancelledInjection.ruleName}"</span>
        </>
      )}
    </div>
  );

  return (
    <div style={blockStyle}>
      {headline}

      {/* Original: server's pre-rule value or the value of the rule
       *  whose injection was cancelled. Hidden when it would equal
       *  Now — typical for request-direction overrides where Chrome's
       *  HAR has already captured the post-rule value as the
       *  "server" baseline. */}
      {showOriginalRow && (
        <div style={rowStyle}>
          <span style={labelStyle}>Original</span>
          <span style={valueStyle}>{originalValue}</span>
        </div>
      )}

      {/* Now: what this request actually got. */}
      <div style={rowStyle}>
        <span style={labelStyle}>Now</span>
        {mod.operation === 'remove' ? (
          <span
            style={{
              ...valueStyle,
              fontStyle: 'italic',
              color: token.colorTextTertiary,
              textDecoration: 'line-through',
            }}
          >
            removed
          </span>
        ) : appliedValue ? (
          <span style={valueStyle}>
            <ResolvedHeaderValue value={appliedValue} collectionId={collectionId} />
          </span>
        ) : (
          <span style={{ ...valueStyle, fontStyle: 'italic', color: token.colorTextTertiary }}>(empty)</span>
        )}
      </div>

      {/* Future: what the next request would get. Driven by the
       *  applicability verdict so we surface specific reasons (rule
       *  disabled, conditions mismatch, unresolvable template) rather
       *  than cheerfully previewing a value that wouldn't actually fire. */}
      {showFutureRow && (
        <div style={rowStyle} title="What the next matching request would get">
          <span style={{ ...labelStyle, color: token.colorWarning }}>Future</span>
          <FutureValue kind={futureKind} collectionId={collectionId} token={token} valueStyle={valueStyle} />
        </div>
      )}

      {/* Optional: TOTP / unreliable-resolution disclosure. */}
      {!isSnapshotResolutionReliable(mod) && (
        <div
          style={{
            marginTop: 2,
            fontSize: 10,
            fontStyle: 'italic',
            color: token.colorTextTertiary,
            lineHeight: 1.3,
          }}
        >
          TOTP / deferred refs are resolved at request time and not captured here.
        </div>
      )}

      {/* Sibling mods: other actions on the same rule that fired on
       *  this same request. Surfaced compactly so the user knows the
       *  rule has a wider footprint than this single row. Each entry
       *  is read-only here — to edit, the user hovers that header's
       *  row in the inspector list. */}
      {ctx.siblingMods.length > 0 && (
        <div
          style={{
            marginTop: 8,
            paddingTop: 6,
            borderTop: `1px dashed ${token.colorBorderSecondary}`,
          }}
        >
          <div
            style={{
              fontSize: 10,
              textTransform: 'uppercase',
              letterSpacing: 0.4,
              color: token.colorTextTertiary,
              marginBottom: 4,
            }}
          >
            Also by this rule on this request
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {ctx.siblingMods.map((s, i) => (
              <SiblingModRow key={`${s.direction}|${s.headerName}|${s.operation}|${i}`} mod={s} token={token} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SiblingModRow({ mod, token }: { mod: RuleSnapshotHeaderMod; token: GlobalToken }) {
  const opGlyph = (() => {
    switch (mod.operation) {
      case 'override':
        return '↻';
      case 'add':
        return '+';
      case 'merge':
        return '⊕';
      case 'remove':
        return '−';
    }
  })();
  const value = mod.operation === 'remove' ? null : (mod.valueResolved ?? mod.valueTemplate ?? '');
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 6,
        fontFamily: token.fontFamilyCode,
        fontSize: 11,
        color: token.colorTextSecondary,
        lineHeight: 1.4,
      }}
      title={`${mod.direction} ${mod.operation} ${mod.headerName}${value !== null ? ` = ${value}` : ''}`}
    >
      <span style={{ color: token.colorTextTertiary, width: 12, textAlign: 'center', flexShrink: 0 }}>{opGlyph}</span>
      <span style={{ color: token.colorTextTertiary, fontSize: 10, flexShrink: 0 }}>
        {mod.direction === 'request' ? 'req' : 'res'}
      </span>
      <span style={{ flexShrink: 0 }}>{mod.headerName}</span>
      {value !== null && (
        <>
          <span style={{ color: token.colorTextTertiary }}>:</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
        </>
      )}
    </div>
  );
}
