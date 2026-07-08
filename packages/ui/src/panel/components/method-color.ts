/**
 * HTTP-method badge colors — shared by every surface that renders the
 * compact method chip (inspector tab pills, tab search rows, the
 * Matched Rules panel's request tag) so a method reads the same color
 * everywhere.
 */

import type { InspectorTab } from '../data/inspector-tab';

const METHOD_COLORS: Record<string, string> = {
  GET: '#61affe',
  POST: '#49cc90',
  PUT: '#fca130',
  PATCH: '#50e3c2',
  DELETE: '#f93e3e',
  HEAD: '#9012fe',
  OPTIONS: '#0d5aa7',
};

export function methodColor(method: string): string {
  return METHOD_COLORS[method.toUpperCase()] ?? '#999';
}

/** The compact chip a tab pill leads with — HTTP method for request
 *  tabs, a document-kind tag for everything else. */
export function tabBadge(tab: InspectorTab): { text: string; color: string } {
  if (tab.kind === 'idb-record') return { text: 'IDB', color: '#b180d7' };
  if (tab.kind === 'dom-storage-entry') return { text: tab.area === 'session' ? 'SS' : 'LS', color: '#4ec9b0' };
  if (tab.kind === 'cookie') return { text: 'CK', color: '#d7ba7d' };
  return { text: tab.method, color: methodColor(tab.method) };
}
