/**
 * The script sandbox document — the realm a browser page mounts in a
 * hidden `sandbox="allow-scripts"` iframe as `srcdoc` (the Execution
 * Place plan, Phase W). ONE self-contained document: the realm's
 * script inline, the policy as a meta tag, nothing referenced — so the
 * realm needs no network, no served page, no precache, and an offline
 * tab runs its scripts as an online one does. The opaque origin is the
 * iframe attribute's (a meta tag cannot carry the `sandbox` directive,
 * and there is no URL to reach the document by, so nothing else could
 * ever navigate to it top-level); the meta policy is the belt inside:
 * no fetch, no frame, no form, `'unsafe-eval'` for the user scripts
 * the realm compiles.
 *
 * The web build bundles the realm entry and hands the document to the
 * tab as a virtual module; the extension keeps its manifest-declared
 * sandbox page (its manifest's sandbox CSP is that page's own). Both
 * shapes ride the same iframe transport.
 */

export const SCRIPT_SANDBOX_DOCUMENT_CSP =
  "default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; base-uri 'none'; form-action 'none'";

/** The document around one inline realm script. */
export function scriptSandboxDocument(inlineScript: string): string {
  // An inline script must never contain the closing tag; the realm's
  // source carries none, but the escape costs nothing.
  const inline = inlineScript.replace(/<\/script/gi, '<\\/script');
  return [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="UTF-8">',
    `<meta http-equiv="Content-Security-Policy" content="${SCRIPT_SANDBOX_DOCUMENT_CSP}">`,
    '<title>Open Headers — script sandbox</title>',
    '</head>',
    '<body>',
    `<script>${inline}</script>`,
    '</body>',
    '</html>',
    '',
  ].join('\n');
}
