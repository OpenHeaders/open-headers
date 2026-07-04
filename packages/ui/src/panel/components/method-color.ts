/**
 * HTTP-method badge colors — shared by every surface that renders the
 * compact method chip (inspector tab pills, tab search rows, the
 * Matched Rules panel's request tag) so a method reads the same color
 * everywhere.
 */

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
