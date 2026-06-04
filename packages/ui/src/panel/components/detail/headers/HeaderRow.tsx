import { CheckOutlined, CopyOutlined } from '@ant-design/icons';
import { InfoTrigger } from '@openheaders/ui/shared/info-popover';
import { getHeaderInfoContentForRow } from '@openheaders/ui/shared/info-popover/data/http-headers';
import { useVariableResolver } from '@openheaders/ui/shared/hooks/useVariableResolver';
import type { HeaderModification, HeaderOperation, Rule } from '@openheaders/core/types';
import { useMemo, useState } from 'react';
import {
  type AnnotatedHeader,
  findCurrentMod,
  isAttributionEdited,
} from '../../../data/header-attribution';
import { HEADER_CATEGORY_LABEL, type HeaderCategory } from '../../../data/header-category';
import type { HeaderRowMeta } from '../../../data/header-filter';
import { formatHeaderName, type HeaderNameCase } from '../../../data/header-name-case';
import { computeRuleApplicability, type RuleApplicability } from '../../../data/rule-applicability';
import type { RulesByUid } from '../../../data/use-rules-lookup';
import { ResolvedHeaderValue } from '../../ResolvedHeaderValue';
import { useRulePopover } from '../../RulePopoverHost';
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
  onNameClick: (name: string, value: string) => void;
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

function EditedSinceFireChip({ kind }: { kind: 'rule' | 'value' }) {
  const label = kind === 'rule' ? '· rule edited since' : '· variable changed since';
  const title =
    kind === 'rule'
      ? 'Rule has been edited since this request — current rule applies only to future requests'
      : 'A variable referenced by this rule resolves to a different value now — applies only to future requests';
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
  onNameClick,
}: AttributedHeaderRowProps) {
  const rulePopover = useRulePopover();
  const { name, value, attribution } = row;
  const displayName = formatHeaderName(name, nameCase);
  const kind = attribution.kind;

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
  const editedSinceFire = (ruleEdited ?? false) || valueDrifted || nameDrifted;

  const handleRowMouseOver = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ruleCtx) return;
    rulePopover.open({
      anchorEl: e.currentTarget,
      attribution,
      rule: ruleForHover,
      target: operationForHover ? { direction, headerName: name, operation: operationForHover } : undefined,
      currentResolvedValue,
      currentResolvedName,
      applicability,
    });
  };
  const handleRowMouseOut = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ruleCtx) return;
    rulePopover.scheduleClose(e.relatedTarget);
  };

  const showResolvedValue = kind === 'added' || kind === 'modified' || kind === 'system';

  const serverTitle = kind === 'server' ? 'Create a rule to override this header' : undefined;
  const systemTitle = kind === 'system' ? `Injected by ${attribution.label} (Open Headers system feature)` : undefined;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: hover-only popover trigger; primary affordance is the rule's full editor reachable via the popover.
    // biome-ignore lint/a11y/useKeyWithMouseEvents: hover-anchored popover; keyboard users use "Open in workspace" inside the popover.
    <div
      className={classes}
      style={{ fontFamily: 'monospace' }}
      onMouseOver={ruleCtx ? handleRowMouseOver : undefined}
      onMouseOut={ruleCtx ? handleRowMouseOut : undefined}
    >
      <HeaderInfoTrigger name={name} direction={meta.direction} category={meta.category} />
      {isProtected ? (
        <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{displayName}</span>
      ) : (
        <button
          type="button"
          className="dt-btn-link"
          style={{ fontFamily: 'monospace', fontWeight: 600 }}
          onClick={() => onNameClick(name, value)}
          title={serverTitle ?? systemTitle}
        >
          {displayName}
        </button>
      )}
      <span className="dt-kv-content">
        <span className="dt-kv-oh-value">
          : {showResolvedValue ? <ResolvedHeaderValue value={value} collectionId={ruleCollectionId} /> : value}
        </span>
        {showChips && <ValueChips name={name} value={value} />}
        {editedSinceFire && <EditedSinceFireChip kind={ruleEdited ? 'rule' : 'value'} />}
      </span>
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
        <button
          type="button"
          className="dt-btn dt-btn-primary dt-kv-action"
          disabled={isProtected}
          aria-disabled={isProtected || undefined}
          title={
            isProtected
              ? `${displayName} is a protected header — the browser's Declarative Net Request engine refuses to let extensions override it. Common protected names include host, content-length, connection, sec-fetch-*, sec-ch-ua-*.`
              : 'Create a rule to override this header'
          }
          onClick={(e) => {
            e.stopPropagation();
            if (isProtected) return;
            onNameClick(name, value);
          }}
        >
          Override
        </button>
      </span>
    </div>
  );
}
