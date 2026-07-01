import type { RequestRecord, SilentMatchRecord } from '@openheaders/core/types';
import type { RuleVerdict } from '@openheaders/ui/shared/verdict';

export interface MatchedRequestRow extends RequestRecord {
  key: string;
  /** True when the matched URL is the current tab URL (main-frame). */
  isTabUrl: boolean;
}

export interface ActiveRule {
  id: string;
  name: string;
  ruleType: string;
  summary: string;
  actionLabel?: string;
  actionOperation?: string;
  actionTooltip?: string;
  actionDirection?: string;
  actionValue?: string;
  actionItems?: string[];
  isEnabled?: boolean;
  domains?: string[];
  path?: string;
  /**
   * Verdict rendered by the verdict engine for this rule on the
   * current tab. See `@openheaders/ui/shared/verdict` for the canonical taxonomy and
   * rank / label / tooltip metadata.
   */
  verdict?: RuleVerdict;
  /** Short human-readable reason text supplied by the engine. */
  verdictReason?: string;
  /**
   * Cached / SW-shortcut subresource URLs that match the rule's
   * pattern but didn't fire webRequest. Merged into the per-rule
   * sub-table as synthetic records with `evidence: 'silent'`.
   */
  silentRecords?: SilentMatchRecord[];
}

export interface CurrentTabInfo {
  id: number;
  url: string;
  domain: string;
  title: string;
}

export interface TableRecord extends ActiveRule {
  key: string | number;
  statusRank: number;
  /**
   * Primary sort key — lower = stronger signal. Clusters the table
   * into visual sections (firing → silent → page → related → idle)
   * regardless of the secondary sort mode. See `VERDICT_RANK` in
   * `@openheaders/ui/shared/verdict` for the canonical ordering.
   */
  verdictRank: number;
  /** Total fire events for this rule on the current page (from counters). */
  fireCount: number;
  /** Unique-URL records for this rule, newest first. */
  records: RequestRecord[];
  /** Highest evidence tier present across `records`, or 'none' if empty. */
  dominantEvidence: RequestRecord['evidence'] | 'none';
  /**
   * First shadower seen across this rule's records, or undefined if none are
   * shadowed. Only rendered when the experimental shadow-detection setting
   * is enabled; always computed so tooltips can reference it when flagged on.
   */
  dominantShadow?: { uid: string; name: string };
  /** Number of shadowed records (out of `records.length`). */
  shadowedCount: number;
}
