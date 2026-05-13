import type { InspectorHarEntry } from '@openheaders/core/types';

interface CookieRow {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: string;
  size: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: string;
}

function parseCookies(har: InspectorHarEntry): { request: CookieRow[]; response: CookieRow[] } {
  const request: CookieRow[] = (har.request?.cookies ?? []).map((c) => ({
    name: c.name,
    value: c.value,
    size: c.name.length + c.value.length,
  }));

  const response: CookieRow[] = [];
  for (const h of har.response?.headers ?? []) {
    if (h.name.toLowerCase() !== 'set-cookie') continue;
    const parsed = parseSetCookie(h.value);
    if (parsed) response.push(parsed);
  }

  return { request, response };
}

function parseSetCookie(header: string): CookieRow | null {
  const parts = header.split(';').map((s) => s.trim());
  const first = parts[0];
  if (!first) return null;

  const eqIdx = first.indexOf('=');
  const name = eqIdx >= 0 ? first.slice(0, eqIdx) : first;
  const value = eqIdx >= 0 ? first.slice(eqIdx + 1) : '';

  const row: CookieRow = { name, value, size: name.length + value.length };

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    const lower = part.toLowerCase();
    if (lower.startsWith('domain=')) row.domain = part.slice(7);
    else if (lower.startsWith('path=')) row.path = part.slice(5);
    else if (lower.startsWith('expires=')) row.expires = part.slice(8);
    else if (lower.startsWith('max-age=')) row.expires = `max-age ${part.slice(8)}`;
    else if (lower === 'httponly') row.httpOnly = true;
    else if (lower === 'secure') row.secure = true;
    else if (lower.startsWith('samesite=')) row.sameSite = part.slice(9);
  }

  return row;
}

function CookieTable({ cookies, label }: { cookies: CookieRow[]; label: string }) {
  if (cookies.length === 0) return null;

  return (
    <details className="dt-section" open>
      <summary>
        {label} ({cookies.length})
      </summary>
      <div className="dt-cookie-table-wrap">
        <table className="dt-cookie-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Value</th>
              <th>Domain</th>
              <th>Path</th>
              <th>Expires</th>
              <th className="dt-col-right">Size</th>
              <th>HttpOnly</th>
              <th>Secure</th>
              <th>SameSite</th>
            </tr>
          </thead>
          <tbody>
            {cookies.map((c, i) => (
              <tr key={`${c.name}-${i}`}>
                <td className="dt-cookie-name">{c.name}</td>
                <td className="dt-cookie-value" title={c.value}>
                  {c.value}
                </td>
                <td>{c.domain ?? ''}</td>
                <td>{c.path ?? ''}</td>
                <td className="dt-col-muted">{c.expires ?? 'Session'}</td>
                <td className="dt-col-right">{c.size}</td>
                <td>{c.httpOnly ? '\u2713' : ''}</td>
                <td>{c.secure ? '\u2713' : ''}</td>
                <td>{c.sameSite ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

interface CookiesViewProps {
  har: InspectorHarEntry;
}

export default function CookiesView({ har }: CookiesViewProps) {
  const { request, response } = parseCookies(har);

  if (request.length === 0 && response.length === 0) {
    return (
      <span className="dt-col-muted" style={{ padding: 12 }}>
        No cookies sent or received.
      </span>
    );
  }

  return (
    <div className="dt-cookies-view">
      <CookieTable cookies={request} label="Request Cookies" />
      <CookieTable cookies={response} label="Response Cookies" />
    </div>
  );
}
