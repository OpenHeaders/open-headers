/**
 * Inline helper code embedded (via template interpolation) in every dynamic
 * string-template injection script. These run in the page MAIN world as part
 * of the generated source — they are JS source strings, not real functions,
 * so they live as string constants here.
 */

export const TEST_BRIDGE_CODE = [
  'function __ohFire(ruleUid, url, kind) {',
  '  try {',
  // Route through the one dispatcher oh-setup installed (binding on an in-scope
  // tab, else postMessage). oh-setup always runs before any wrapper on this
  // document, so __ohOrig.fire is present; if it somehow is not, drop the fire
  // rather than re-deciding the channel here.
  '    var o = window.__ohOrig;',
  '    if (o && o.fire) o.fire(ruleUid, url, kind);',
  '  } catch (e) {}',
  '}',
].join('\n');

export const URL_MATCHER_CODE = [
  'function __ohMatchesUrl(url, regexSources) {',
  // Resolve relative URLs against the page base — the patterns are
  // absolute, matching what the network layer sees. Absolute URLs are
  // idempotent under this resolution.
  '  var abs = url;',
  '  try { abs = new URL(url, document.baseURI).href; } catch (e) {}',
  '  for (var i = 0; i < regexSources.length; i++) {',
  '    try { if (new RegExp(regexSources[i], "i").test(abs)) return true; } catch (e) {}',
  '  }',
  '  return false;',
  '}',
].join('\n');

// GraphQL operation filter — parses the request body as JSON and tests
// the configured field (commonly `operationName`, or `query` for substring
// match) against the user's value. Returns true (pass-through) when no
// filter is configured. Returns false when a filter is configured and the
// body is missing, unparseable, or the field does not match — those are
// the cases where the rule should NOT fire.
export const GRAPHQL_MATCHER_CODE = [
  'function __ohMatchesGraphQL(bodyStr, filter) {',
  '  if (!filter || !filter.key) return true;',
  '  if (typeof bodyStr !== "string" || bodyStr.length === 0) return false;',
  '  try {',
  '    var parsed = JSON.parse(bodyStr);',
  '    if (parsed == null || typeof parsed !== "object") return false;',
  '    var v = parsed[filter.key];',
  '    if (typeof v !== "string") return false;',
  '    return filter.operator === "Contains" ? v.indexOf(filter.value) !== -1 : v === filter.value;',
  '  } catch (e) { return false; }',
  '}',
].join('\n');
