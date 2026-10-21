/**
 * The bundle's redaction: the host's roots become their placeholders
 * (longest first, a workspace inside the home before the home), the
 * home directory under the three operating systems' conventions
 * becomes `<home>` even unnamed, what follows a collapsing placeholder
 * becomes `…`, URL credentials and e-mail addresses go; the URLs and
 * origins the person worked with, the product's own identifiers and
 * anything merely shaped like a removal stay.
 */

import { describe, expect, it } from 'vitest';
import {
  DIAGNOSTICS_CREDENTIAL_QUERY_KEYS,
  type DiagnosticsRoot,
  redactDiagnosticsText,
  workspaceDiagnosticsRoots,
} from '../../src/diagnostics/redact';

const ROOTS: DiagnosticsRoot[] = [
  { path: '/Users/jane.doe', placeholder: '<home>', collapse: true },
  { path: '/Users/jane.doe/dev/open-headers', placeholder: '<app>' },
  { path: '/Users/jane.doe/Library/Application Support/OpenHeaders-Dev', placeholder: '<userData>' },
  { path: '/Users/jane.doe/Library/Application Support/OpenHeaders-Dev/logs', placeholder: '<logs>' },
  ...workspaceDiagnosticsRoots(['/Users/jane.doe/dev/test3']),
];

describe('redactDiagnosticsText', () => {
  it('turns the host roots into their placeholders, the longest path first, and keeps what follows an app folder', () => {
    expect(redactDiagnosticsText('sweep /Users/jane.doe/dev/test3: 0 batches', ROOTS)).toBe(
      'sweep <workspace 1>: 0 batches',
    );
    expect(
      redactDiagnosticsText('helper not found at /Users/jane.doe/dev/open-headers/native/h3-helper/dist/x', ROOTS),
    ).toBe('helper not found at <app>/native/h3-helper/dist/x');
    expect(
      redactDiagnosticsText(
        'runtime installed (/Users/jane.doe/Library/Application Support/OpenHeaders-Dev/logs/main.log)',
        ROOTS,
      ),
    ).toBe('runtime installed (<logs>/main.log)');
    expect(
      redactDiagnosticsText('"/Users/jane.doe/Library/Application Support/OpenHeaders-Dev/data/oracle.db"', ROOTS),
    ).toBe('"<userData>/data/oracle.db"');
    expect(workspaceDiagnosticsRoots(['/a', '/b'])).toEqual([
      { path: '/a', placeholder: '<workspace 1>', collapse: true },
      { path: '/b', placeholder: '<workspace 2>', collapse: true },
    ]);
  });

  it('collapses whatever follows the home or a workspace; a frame keeps its file whatever folder it came from', () => {
    expect(redactDiagnosticsText('→ /Users/jane.doe/Library/Application Support/Google/Chrome/x.json', ROOTS)).toBe(
      '→ <home>/…',
    );
    expect(redactDiagnosticsText('saw /Users/jane.doe/x and then: y', ROOTS)).toBe('saw <home>/… and then: y');
    expect(redactDiagnosticsText('"terminal.startDirectory": "/Users/jane.doe/work/acme"', ROOTS)).toBe(
      '"terminal.startDirectory": "<home>/…"',
    );
    expect(redactDiagnosticsText('ignore entry .env for /Users/jane.doe/dev/test3/sub', ROOTS)).toBe(
      'ignore entry .env for <workspace 1>/…',
    );
    expect(
      redactDiagnosticsText(
        '    at VaultProvider (http://localhost:5173/@fs/Users/jane.doe/dev/open-headers/packages/ui/src/context/VaultContext.tsx:23:33)',
        ROOTS,
      ),
    ).toBe('    at VaultProvider (VaultContext.tsx:23:33)');
    expect(redactDiagnosticsText('/Users/jane.doe/dev/test30/x', ROOTS)).toBe('<home>/…');
  });

  it('replaces a home directory with no roots at all — POSIX, Windows plain and JSON-escaped, file URLs', () => {
    expect(redactDiagnosticsText('sweep /Users/jane.doe/dev/test3: 0 batches')).toBe('sweep <home>/…: 0 batches');
    expect(redactDiagnosticsText('/home/jdoe/.config/x')).toBe('<home>/…');
    expect(redactDiagnosticsText('at (/Users/jdoe/a.ts:1:2)')).toBe('at (a.ts:1:2)');
    expect(redactDiagnosticsText('C:\\Users\\jdoe\\AppData\\Local\\Programs\\x.exe')).toBe('<home>/…');
    expect(redactDiagnosticsText('"C:\\\\Users\\\\jdoe\\\\AppData"')).toBe('"<home>/…"');
    expect(redactDiagnosticsText('D:/Users/jdoe/x')).toBe('<home>/…');
    expect(redactDiagnosticsText('opened file:///Users/jdoe/x.js')).toBe('opened file:///<home>/…');
    expect(redactDiagnosticsText('served http://localhost:5173/@fs/Users/jdoe/dev/x.tsx')).toBe(
      'served http://localhost:5173/@fs/<home>/…',
    );
  });

  it('matches a Windows root in either separator form', () => {
    const roots: DiagnosticsRoot[] = [
      { path: 'C:\\Users\\jdoe\\AppData\\Local\\Programs\\OpenHeaders\\resources\\app.asar', placeholder: '<app>' },
    ];
    expect(
      redactDiagnosticsText(
        'C:\\Users\\jdoe\\AppData\\Local\\Programs\\OpenHeaders\\resources\\app.asar\\out\\x.js',
        roots,
      ),
    ).toBe('<app>\\out\\x.js');
    expect(
      redactDiagnosticsText(
        '"C:\\\\Users\\\\jdoe\\\\AppData\\\\Local\\\\Programs\\\\OpenHeaders\\\\resources\\\\app.asar\\\\out\\\\x.js"',
        roots,
      ),
    ).toBe('"<app>\\\\out\\\\x.js"');
  });

  it('cuts every stack frame location to its file and position, inside a line, before any folder rule', () => {
    const header =
      'ERROR [ErrorFunnel] boundary on workbench: InjectedFaultError: render fault injected into root     at FaultProbe (http://localhost:5173/@fs/Users/jane.doe/dev/open-headers/packages/ui/src/shared/fault-injection/FaultProbe.tsx:5:20)';
    expect(redactDiagnosticsText(header, ROOTS)).toBe(
      'ERROR [ErrorFunnel] boundary on workbench: InjectedFaultError: render fault injected into root     at FaultProbe (FaultProbe.tsx:5:20)',
    );
    expect(
      redactDiagnosticsText(
        '    at performWorkOnRoot (http://localhost:5173/@fs/Users/jane.doe/dev/open-headers/node_modules/.vite/deps/chunk-SDHHGFVO.js?v=79bd4831:11827:37) component stack:',
      ),
    ).toBe('    at performWorkOnRoot (chunk-SDHHGFVO.js:11827:37) component stack:');
    expect(redactDiagnosticsText('    at http://localhost:5173/@fs/Users/jdoe/x.tsx:2:3')).toBe('    at x.tsx:2:3');
    expect(redactDiagnosticsText('onSelect@https://openheaders.io/assets/index-abc.js:1:2')).toBe(
      'onSelect@index-abc.js:1:2',
    );
    expect(
      redactDiagnosticsText(
        '    at fn (file:///Applications/Open%20Headers.app/Contents/Resources/app.asar/out/renderer/assets/index-abc.js:1:2)',
      ),
    ).toBe('    at fn (index-abc.js:1:2)');
    expect(
      redactDiagnosticsText(
        '    at fn (C:\\Users\\jdoe\\AppData\\Local\\Programs\\OpenHeaders\\resources\\app.asar\\out\\index.js:1:2)',
      ),
    ).toBe('    at fn (index.js:1:2)');
    expect(redactDiagnosticsText('    at div (<anonymous>)')).toBe('    at div (<anonymous>)');
    expect(redactDiagnosticsText('listening on ws://127.0.0.1:8137')).toBe('listening on ws://127.0.0.1:8137');
    expect(redactDiagnosticsText('feed https://updates.openheaders.com/stable/latest-mac.yml')).toBe(
      'feed https://updates.openheaders.com/stable/latest-mac.yml',
    );
  });

  it('collapses temporary folders', () => {
    expect(redactDiagnosticsText('wrote /private/var/folders/x1/abc123/T/oh-import.json')).toBe('wrote <tmp>/…');
    expect(redactDiagnosticsText('wrote /var/folders/x1/abc123/T/oh-import.json')).toBe('wrote <tmp>/…');
    expect(redactDiagnosticsText('wrote /tmp/oh-import.json')).toBe('wrote <tmp>/…');
    expect(redactDiagnosticsText('https://openheaders.io/tmp/x')).toBe('https://openheaders.io/tmp/x');
  });

  it('leaves /Users/ and /home/ inside a URL path alone — an API resource, not a home', () => {
    expect(redactDiagnosticsText('Fetch failed for https://api.openheaders.io/Users/123')).toBe(
      'Fetch failed for https://api.openheaders.io/Users/123',
    );
    expect(redactDiagnosticsText('https://openheaders.io/home/page')).toBe('https://openheaders.io/home/page');
  });

  it('cuts URL userinfo and credential-named query values, keeps the rest of the URL', () => {
    expect(redactDiagnosticsText('https://jane:hunter2@api.openheaders.io/v1')).toBe(
      'https://<credentials>@api.openheaders.io/v1',
    );
    expect(redactDiagnosticsText('https://api.openheaders.io/v1?token=abc&page=2&X-Api-Key=k1#sig=s')).toBe(
      'https://api.openheaders.io/v1?token=<redacted>&page=2&X-Api-Key=<redacted>#sig=<redacted>',
    );
    expect(redactDiagnosticsText('?sortKey=name&countryCode=RO')).toBe('?sortKey=name&countryCode=RO');
    expect(DIAGNOSTICS_CREDENTIAL_QUERY_KEYS).toContain('password');
  });

  it('replaces e-mail addresses and nothing shaped like one', () => {
    expect(redactDiagnosticsText('author jane.doe@openheaders.io committed')).toBe('author <email> committed');
    expect(redactDiagnosticsText('import @openheaders/core; node_modules/@openheaders/ui')).toBe(
      'import @openheaders/core; node_modules/@openheaders/ui',
    );
    expect(redactDiagnosticsText('VaultProvider@https://openheaders.io/x.js:1:2')).toBe('VaultProvider@x.js:1:2');
    expect(redactDiagnosticsText('pre-handshake message oh.secretManager.resolveBatch')).toBe(
      'pre-handshake message oh.secretManager.resolveBatch',
    );
    expect(redactDiagnosticsText('peer connected (role=extension agent=@openheaders/extension@2026.8.4 ws=1)')).toBe(
      'peer connected (role=extension agent=@openheaders/extension@2026.8.4 ws=1)',
    );
    expect(redactDiagnosticsText('a@b.co.uk and mailto:x@api.openheaders.io')).toBe('<email> and mailto:<email>');
  });

  it('keeps loopback origins, ids and ordinary text byte for byte', () => {
    const text =
      'listening on ws://127.0.0.1:8137\nsession 74a32b2d89a778d90ced2b11274025d9\n"installId": "c925183f5ab1ee3433529b8ba27df0fe"\nHTTP/3 helper not found\n';
    expect(redactDiagnosticsText(text, ROOTS)).toBe(text);
  });
});
