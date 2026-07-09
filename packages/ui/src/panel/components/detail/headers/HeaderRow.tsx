import { CheckOutlined, CopyOutlined } from '@ant-design/icons';
import { InfoTrigger } from '@openheaders/ui/shared/info-popover';
import { getHeaderInfoContentForRow } from '@openheaders/ui/shared/info-popover/data/http-headers';
import { useElementOverflow } from '@openheaders/ui/shared/hooks/dom/useElementOverflow';
import { useVariableResolver } from '@openheaders/ui/shared/hooks/variables/useVariableResolver';
import type { HeaderModification, HeaderOperation, Rule } from '@openheaders/core/types';
import { useMemo, useState } from 'react';
import {
  type AnnotatedHeader,
  findCurrentMod,
  isAttributionEdited,
} from '../../../data/headers/header-attribution';
import {
  HEADER_CATEGORY_LABEL,
  type HeaderCategory,
} from '@openheaders/ui/shared/info-popover/data/http-headers/header-category';
import type { HeaderRowMeta } from '../../../data/headers/header-filter';
import { formatHeaderName, type HeaderNameCase } from '../../../data/headers/header-name-case';
import { computeRuleApplicability, type RuleApplicability } from '../../../data/rule-create/rule-applicability';
import type { RulesByUid } from '../../../data/rule-create/use-rules-lookup';
import { introspectWithAuthScheme } from '../../../data/auth-scheme';
import { introspectionHasDepth } from '../../../data/value-introspect';
import { ResolvedHeaderValue } from '../../ResolvedHeaderValue';
import { useRulePopover } from '../../RulePopoverHost';
import { ValueExpander } from '../ValueExpander';
import { ValueChips } from './value-chips';
import type { SectionLabel } from './types';

interface AttributedHeaderRowProps {
  row: AnnotatedHeader;
  meta: HeaderRowMeta;
  index: number;
  sectionLabel: SectionLabel;
  searchSection?: string;
  searchLineNumber?: number;
  searchHighlight?: string;
  ruleCollectionId?: string;
  requestUrl: string;
  rulesByUid: RulesByUid;
  nameCase: HeaderNameCase;
  showChips: boolean;
  /** Override button on a server row — opens the in-panel create
   *  popover anchored to the button. */
  onOverride: (name: string, value: string, anchorEl: HTMLElement) => void;
}

function isHighlightedHeader(
  index: number,
  section: string,
  searchSection: string | undefined,
  searchLineNumber: number | undefined,
  highlight: string | undefined,
  headerText: string,
): boolean {
  if (!highlight || !searchSection || searchLineNumber == null) return false;
  if (searchSection !== section) return false;
  if (index + 1 !== searchLineNumber) return false;
  return headerText.toLowerCase().includes(highlight.toLowerCase());
}

/**
 * `(i)` glyph prefixed to a header name. Hidden by default — revealed
 * on row hover via CSS. Click anchors an `<InfoPopover>` with the
 * header's documentation.
 *
 * Always renders — even unknown headers get an honest fallback popover
 * (name + direction + the category the row was bucketed into) so the
 * user gets *something* useful for every row, not just curated ones.
 */
function HeaderInfoTrigger({
  name,
  direction,
  category,
}: {
  name: string;
  direction: 'request' | 'response';
  category: HeaderCategory;
}) {
  const content = getHeaderInfoContentForRow(name, direction, HEADER_CATEGORY_LABEL[category]);
  return <InfoTrigger content={content} className="dt-header-info-trigger" />;
}

type SinceFireKind = 'deleted' | 'disabled' | 'rule' | 'value';

const SINCE_FIRE_CHIP: Record<SinceFireKind, { label: string; title: string }> = {
  deleted: {
    label: '· rule deleted since',
    title: 'Rule has been deleted since this request — it will not apply to future requests',
  },
  disabled: {
    label: '· rule disabled since',
    title: 'Rule has been disabled since this request — it will not apply to future requests',
  },
  rule: {
    label: '· rule edited since',
    title: 'Rule has been edited since this request — current rule applies only to future requests',
  },
  value: {
    label: '· variable changed since',
    title: 'A variable referenced by this rule resolves to a different value now — applies only to future requests',
  },
};

function EditedSinceFireChip({ kind }: { kind: SinceFireKind }) {
  const { label, title } = SINCE_FIRE_CHIP[kind];
  return (
    <span title={title} style={{ marginLeft: 8, fontSize: 10, fontStyle: 'italic', opacity: 0.7, userSelect: 'none' }}>
      {label}
    </span>
  );
}

export function AttributedHeaderRow({
  row,
  meta,
  index,
  sectionLabel,
  searchSection,
  searchLineNumber,
  searchHighlight,
  ruleCollectionId,
  requestUrl,
  rulesByUid,
  nameCase,
  showChips,
  onOverride,
}: AttributedHeaderRowProps) {
  const rulePopover = useRulePopover();
  const { name, value, attribution } = row;
  const displayName = formatHeaderName(name, nameCase);
  const kind = attribution.kind;

  // The value cell stays a single truncated line; the caret (or a click
  // anywhere on the row) reveals a standalone, freely-selectable readout
  // below the row — never the value span itself, so clicking into the
  // readout text to copy can't collapse it. The readout decodes JWT /
  // JSON / base64 values via the shared expander.
  const [expanded, setExpanded] = useState(false);
  const introspection = useMemo(() => introspectWithAuthScheme(value), [value]);
  // Overflow is measured on `value`, the raw source — the resolved display
  // text differs, but the ResizeObserver reads the live element regardless.
  // The span never wraps now, so the measure stays valid across toggles.
  const { ref: valueRef, overflowing } = useElementOverflow<HTMLSpanElement>({ dep: value });
  // Offer the caret / row toggle when the line is clipped OR the value
  // carries decodable depth worth surfacing even when it fits (a short
  // JWT / JSON / base64).
  const showExpander = overflowing || introspectionHasDepth(introspection);
  const toggle = (): void => {
    if (showExpander) setExpanded((v) => !v);
  };

  const [copied, setCopied] = useState(false);
  const handleCopy = (e: React.MouseEvent<HTMLButtonElement>): void => {
    e.stopPropagation();
    void navigator.clipboard?.writeText(value).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    });
  };

  const direction: 'request' | 'response' = sectionLabel === 'Response Headers' ? 'response' : 'request';
  const isProtected = meta.protectedHeader;

  const classes = [
    'dt-kv',
    isHighlightedHeader(index, sectionLabel, searchSection, searchLineNumber, searchHighlight, `${name}: ${value}`)
      ? 'dt-kv--highlighted'
      : '',
    kind === 'server' ? '' : `dt-kv--oh-${kind}`,
  ]
    .filter(Boolean)
    .join(' ');

  const ruleCtx = kind === 'added' || kind === 'modified' || kind === 'removed' ? attribution.ctx : null;
  const liveRule: Rule | null = ruleCtx ? (rulesByUid.get(ruleCtx.ruleUid) ?? null) : null;
  const currentMod: HeaderModification | null = ruleCtx ? findCurrentMod(liveRule, ruleCtx) : null;
  const ruleEdited = ruleCtx ? isAttributionEdited(liveRule, ruleCtx) : false;
  const ruleForHover: Rule | null = liveRule;
  const operationForHover: HeaderOperation | undefined =
    kind === 'added' || kind === 'modified' ? attribution.operation : kind === 'removed' ? 'remove' : undefined;

  const resolver = useVariableResolver();
  const currentResolvedValue = useMemo(() => {
    if (!currentMod) return null;
    if (currentMod.operation === 'remove') return null;
    const tpl = currentMod.value;
    if (typeof tpl !== 'string') return null;
    return resolver.resolveTemplate(tpl, ruleCollectionId ? { collectionId: ruleCollectionId } : undefined).result;
  }, [resolver, currentMod, ruleCollectionId]);
  const currentResolvedName = useMemo(() => {
    if (!currentMod) return null;
    return resolver.resolveTemplate(
      currentMod.headerName,
      ruleCollectionId ? { collectionId: ruleCollectionId } : undefined,
    ).result;
  }, [resolver, currentMod, ruleCollectionId]);
  const applicability = useMemo<RuleApplicability | null>(() => {
    if (!ruleCtx) return null;
    return computeRuleApplicability({
      liveRule,
      ctx: ruleCtx,
      url: requestUrl,
      resolver,
      collectionId: ruleCollectionId,
    });
  }, [liveRule, ruleCtx, requestUrl, resolver, ruleCollectionId]);
  const snapshotResolutionReliable =
    ruleCtx?.snapshotMod.valueTemplate === undefined ||
    !ruleCtx.snapshotMod.valueTemplate.includes('{{') ||
    ruleCtx.snapshotMod.valueTemplate !== ruleCtx.snapshotMod.valueResolved;
  const valueDrifted =
    !!ruleCtx &&
    !ruleEdited &&
    snapshotResolutionReliable &&
    currentResolvedValue != null &&
    ruleCtx.snapshotMod.valueResolved != null &&
    ruleCtx.snapshotMod.valueResolved !== currentResolvedValue;
  const snapshotNameReliable = !ruleCtx?.snapshotMod.headerName.includes('{{');
  const nameDrifted =
    !!ruleCtx &&
    !ruleEdited &&
    snapshotNameReliable &&
    currentResolvedName != null &&
    currentResolvedName !== ruleCtx.snapshotMod.headerName;
  const ruleDeleted = !!ruleCtx && !liveRule;
  const ruleDisabled = !!ruleCtx && liveRule?.enabled === false;
  const editedSinceFire = (ruleEdited ?? false) || ruleDisabled || valueDrifted || nameDrifted;

  // Edit opens the rule popover pinned — a click-opened editing session
  // stays open until outside-click / Escape / save, never closing on
  // mouse-leave the way a hover-opened popover would. Dismiss listeners
  // attach only while open, so the opening click can't self-close it.
  const openEditPopover = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    rulePopover.open(
      {
        anchorEl: e.currentTarget,
        attribution,
        rule: ruleForHover,
        target: operationForHover ? { direction, headerName: name, operation: operationForHover } : undefined,
        currentResolvedValue,
        currentResolvedName,
        applicability,
      },
      { pinned: true },
    );
  };

  const showResolvedValue = kind === 'added' || kind === 'modified' || kind === 'system';

  const systemTitle = kind === 'system' ? `Injected by ${attribution.label} (Open Headers system feature)` : undefined;

  // Override creates a rule against a server header. On rows that already
  // come from Open Headers — a user rule (added/modified/removed) or a
  // system feature — that's redundant or impossible, so Override is shown
  // disabled (Copy stays available). Protected server headers are disabled
  // too, with their own DNR explanation.
  const isOhRow = kind !== 'server';
  const overrideDisabled = isProtected || isOhRow;

  // Value tags describe the value, not the rule, so on attributed rows
  // (the tinted blue/grey/red pill) they render OUTSIDE the pill — keeping
  // the rule-colored background hugging just the header. Plain server rows
  // have no pill, so the tags stay inline after the value.
  const chips = showChips ? <ValueChips name={name} value={value} /> : null;
  const editedChip = editedSinceFire ? (
    <EditedSinceFireChip kind={ruleDeleted ? 'deleted' : ruleDisabled ? 'disabled' : ruleEdited ? 'rule' : 'value'} />
  ) : null;
  const overrideTitle = isProtected
    ? `${displayName} is a protected header — the browser's Declarative Net Request engine refuses to let extensions override it. Common protected names include host, content-length, connection, sec-fetch-*, sec-ch-ua-*.`
    : kind === 'system'
      ? `${displayName} is injected by ${attribution.label}, an Open Headers system feature — not overridable with a rule.`
      : isOhRow
        ? `${displayName} is already managed by one of your rules — edit the rule from its popover instead of overriding.`
        : 'Create a rule to override this header';

  return (
    <>
      {/* The full-width row hosts the hover target + right-aligned action
          overlay so they align to the panel edge even when the inner `.dt-kv`
          is a content-hugging attributed pill (blue/grey/red). */}
      <div className={`dt-kv-row${showExpander ? ' dt-kv-row--expandable' : ''}`} onClick={toggle}>
        <div className={classes} style={{ fontFamily: 'monospace' }}>
          <HeaderInfoTrigger name={name} direction={meta.direction} category={meta.category} />
          {/* Header name is plain text — rule creation lives on the Override
              button, so the name is no longer a clickable affordance. */}
          <span className="dt-kv-name" style={{ fontFamily: 'monospace', fontWeight: 600 }} title={systemTitle}>
            {displayName}
          </span>
          <span className="dt-kv-content">
            <span className="dt-kv-oh-sep">:</span>
            {showExpander && (
              <button
                type="button"
                className="dt-kv-value-caret"
                aria-label={expanded ? 'Collapse value' : 'Expand value'}
                aria-expanded={expanded}
                onClick={(e) => {
                  e.stopPropagation();
                  toggle();
                }}
              >
                {expanded ? '▾' : '▸'}
              </button>
            )}
            <span ref={valueRef} className="dt-kv-oh-value">
              {showResolvedValue ? <ResolvedHeaderValue value={value} collectionId={ruleCollectionId} /> : value}
            </span>
            {!isOhRow && chips}
            {!isOhRow && editedChip}
          </span>
        </div>
        {isOhRow && chips}
        {isOhRow && editedChip}
        <span className="dt-kv-row-actions">
          <button
            type="button"
            className="dt-btn dt-btn-primary dt-kv-action dt-kv-action--icon"
            title={copied ? 'Copied' : 'Copy value'}
            aria-label={copied ? 'Copied' : 'Copy value'}
            onClick={handleCopy}
          >
            {copied ? <CheckOutlined /> : <CopyOutlined />}
          </button>
          {ruleCtx && (
            <button
              type="button"
              className="dt-btn dt-btn--oh dt-kv-action"
              title="Edit the rule that set this header"
              onClick={openEditPopover}
            >
              Edit
            </button>
          )}
          <button
            type="button"
            className="dt-btn dt-btn--oh dt-kv-action"
            disabled={overrideDisabled}
            aria-disabled={overrideDisabled || undefined}
            title={overrideTitle}
            onClick={(e) => {
              e.stopPropagation();
              if (overrideDisabled) return;
              onOverride(name, value, e.currentTarget);
            }}
          >
            Override
          </button>
        </span>
      </div>
      {expanded && showExpander && (
        <div className="dt-kv-expand-row">
          <ValueExpander introspection={introspection} />
        </div>
      )}
    </>
  );
}
