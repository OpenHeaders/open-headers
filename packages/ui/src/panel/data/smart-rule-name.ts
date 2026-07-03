/**
 * Heuristic rule names for the quick-create popovers. "New Redirect
 * Rule (7)" tells the user nothing when they review the sidebar later —
 * so the initial name is derived from what the rule actually does and
 * where (rule kind + captured URL, plus the header/operation or
 * response mode when known). The popover title is editable; this is
 * only the pre-fill. Deduped against existing rule names via the shared
 * `uniqueName` scheme; falls back to the old static bases when the URL
 * doesn't parse.
 */

import { uniqueName } from '@openheaders/ui/shared/naming';

export type SmartNameKind =
  | 'redirect'
  | 'replace-host'
  | 'replace-url-part'
  | 'delay'
  | 'block'
  | 'header'
  | 'response'
  | 'request-body'
  | 'query-param';

export interface SmartNameInput {
  kind: SmartNameKind;
  /** Captured request URL the rule scaffolds from. */
  url: string;
  /** Header create mode — the seeded header row, when one exists. */
  headerName?: string;
  headerOperation?: 'override' | 'add' | 'remove' | 'merge';
  /** Response create mode — mock (synthetic) vs network (modify). */
  responseSource?: 'mock' | 'network';
}

const FALLBACK_BASE: Record<SmartNameKind, string> = {
  redirect: 'New Redirect Rule',
  'replace-host': 'New Redirect Rule',
  'replace-url-part': 'New Redirect Rule',
  delay: 'New Delay Rule',
  block: 'New Block Rule',
  header: 'New Header Rule',
  response: 'New API Response Rule',
  'request-body': 'New API Request Body Rule',
  'query-param': 'New Query Param Rule',
};

const HEADER_OP_VERB: Record<NonNullable<SmartNameInput['headerOperation']>, string> = {
  override: 'Set',
  add: 'Add',
  remove: 'Remove',
  merge: 'Merge',
};

/** Longest path fragment a name carries — names must stay scannable in
 *  the sidebar, and the url-filter condition holds the full URL anyway. */
const MAX_PATH_CHARS = 24;

function urlParts(url: string): { host: string; path: string } | null {
  try {
    const u = new URL(url);
    if (!u.host) return null;
    const rawPath = u.pathname === '/' ? '' : u.pathname;
    const path = rawPath.length > MAX_PATH_CHARS ? `${rawPath.slice(0, MAX_PATH_CHARS - 1)}…` : rawPath;
    return { host: u.host, path };
  } catch {
    return null;
  }
}

function baseName(input: SmartNameInput): string {
  const parts = urlParts(input.url);
  if (!parts) return FALLBACK_BASE[input.kind];
  const hostPath = `${parts.host}${parts.path}`;
  switch (input.kind) {
    case 'redirect':
      return `Redirect ${hostPath}`;
    case 'replace-host':
      return `Replace host · ${parts.host}`;
    case 'replace-url-part':
      return `Replace URL ${hostPath}`;
    case 'delay':
      return `Delay ${hostPath}`;
    case 'block':
      return `Block ${hostPath}`;
    case 'header': {
      const headerName = input.headerName?.trim();
      // "+ Add Header" opens with an empty seed — nothing to derive from.
      if (!headerName) return FALLBACK_BASE.header;
      return `${HEADER_OP_VERB[input.headerOperation ?? 'override']} ${headerName} · ${parts.host}`;
    }
    case 'response':
      return `${input.responseSource === 'network' ? 'Modify' : 'Mock'} response · ${hostPath}`;
    case 'request-body':
      return `Request body · ${hostPath}`;
    case 'query-param':
      return `Query params · ${hostPath}`;
  }
}

export function generateSmartRuleName(input: SmartNameInput, rules: ReadonlyArray<{ name: string }>): string {
  return uniqueName(baseName(input), new Set(rules.map((r) => r.name)));
}
