/**
 * log-search — the text field asked of the WHOLE history, the view's
 * half: what the search sends the host and whose rows the log lists
 * once the host has answered.
 *
 * The view sifts the window it holds at once. The host is asked only
 * past a FULL window — a window under its limit is the whole history
 * its scope reaches, so the sift is already exact — and its answer
 * takes the list only when it reaches past the window: a commit the
 * window does not hold, or matches past the page. An answer wholly
 * inside the window changes nothing; the sift lists it, with its graph.
 * Pure.
 */

import type { BridgeRpcRequest, WorkspaceTreeLogEntryWire } from '@openheaders/core/bridge';
import { type GitLogScope, searchScopeWire } from './log-scope';
import type { GitLogWireFilters } from './toolbar/log-filters';

export type LogSearchRequest = BridgeRpcRequest<'oh.workspaceTree.searchLog'>;

export interface LogSearchAsk {
  workspaceId: string;
  /** The surface that asks (the log tab) — at the host its newer search ends its older one. */
  key: string;
  text: string;
  regex: boolean;
  matchCase: boolean;
  /** The refs the log walks. */
  scope: GitLogScope;
  /** The log's own wire filters; the walk's order is not a search's. */
  filters: GitLogWireFilters;
  /** Graph Options' riders — the view's sifts over a window, the host's over a history. */
  noMerges: boolean;
  firstParent: boolean;
  /** The page: as many commits as the window holds. */
  limit: number;
}

export function logSearchRequest(ask: LogSearchAsk): LogSearchRequest {
  const { author, authors, authorMe, since, until, paths } = ask.filters;
  return {
    workspaceId: ask.workspaceId,
    text: ask.text,
    key: ask.key,
    limit: ask.limit,
    ...(ask.regex ? { regex: true } : {}),
    ...(ask.matchCase ? { matchCase: true } : {}),
    ...searchScopeWire(ask.scope),
    ...(author !== undefined ? { author } : {}),
    ...(authors !== undefined ? { authors } : {}),
    ...(authorMe === true ? { authorMe: true } : {}),
    ...(since !== undefined ? { since } : {}),
    ...(until !== undefined ? { until } : {}),
    ...(paths !== undefined ? { paths } : {}),
    ...(ask.noMerges ? { noMerges: true } : {}),
    ...(ask.firstParent ? { firstParent: true } : {}),
  };
}

/** What the host said of the whole history. */
export type LogSearchAnswer =
  | { kind: 'page'; entries: WorkspaceTreeLogEntryWire[]; more: boolean }
  /** Its deadline came before the history ended: nothing is known past the window. */
  | { kind: 'timeout' };

export type LogSearchFace =
  /** The window's own sift: the host has nothing past it, or has said nothing. */
  | { kind: 'window' }
  /** The host's page — commits past the window, in the host's order, with no graph between them. */
  | { kind: 'page'; entries: WorkspaceTreeLogEntryWire[]; more: boolean }
  /** The window's own sift, and the search past it did not finish. */
  | { kind: 'timeout' };

export function logSearchFace(window: readonly { sha: string }[], answer: LogSearchAnswer | null): LogSearchFace {
  if (answer === null) return { kind: 'window' };
  if (answer.kind === 'timeout') return answer;
  if (!answer.more) {
    const held = new Set(window.map((entry) => entry.sha));
    if (answer.entries.every((entry) => held.has(entry.sha))) return { kind: 'window' };
  }
  return answer;
}
