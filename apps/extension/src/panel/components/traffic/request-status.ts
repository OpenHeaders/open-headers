import type { InspectorRequest } from '../../data/types';

export function isBlockedRequest(entry: InspectorRequest): boolean {
  if (entry.statusCode === 0) return true;
  const st = entry.statusText?.toLowerCase() ?? '';
  if (st.includes('blocked') || st.includes('net::err_blocked')) return true;
  const status = entry.harEntry?.response?.status;
  if (status === 0) return true;
  const statusLine = (entry.harEntry?.response?.statusText ?? '').toLowerCase();
  return statusLine.includes('blocked');
}
