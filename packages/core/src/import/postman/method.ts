import type { HttpMethod } from '../../types/request';
import { type ImportReport, recordDrop } from '../report';

const VALID_METHODS: ReadonlySet<HttpMethod> = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);

export function coerceMethod(raw: string | undefined, jsonPath: string, report: ImportReport): HttpMethod {
  if (typeof raw !== 'string' || raw.length === 0) {
    recordDrop(report, {
      path: `${jsonPath}.request.method`,
      reason: 'Method missing — defaulting to GET.',
      tracking: 'PERMANENT: Postman shape validation',
    });
    return 'GET';
  }
  const upper = raw.toUpperCase();
  if ((VALID_METHODS as Set<string>).has(upper)) return upper as HttpMethod;
  recordDrop(report, {
    path: `${jsonPath}.request.method`,
    reason: `Unknown HTTP method "${raw}" — defaulting to GET.`,
    tracking: 'PERMANENT: method picklist',
  });
  return 'GET';
}
