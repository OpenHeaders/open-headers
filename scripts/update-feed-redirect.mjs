/**
 * Keeps the feed zone's Redirect Rule in step with the retention
 * plan: a `dl/<tag>/` download outside the kept tags answers with a
 * 302 to the same asset on the GitHub release page, which keeps every
 * byte for good. The rule lives in the zone's dynamic-redirect phase,
 * found by its description; the other rules in that phase are never
 * touched. An unchanged rule is left alone, so a release that keeps
 * the same tags makes no write.
 *
 * Runs before the plan's deletes, so no link ever lands on a 404
 * between the two. Needs a zone-scoped token (Zone → Dynamic
 * Redirect → Edit) and the zone id in the environment.
 *
 * Usage: node scripts/update-feed-redirect.mjs --plan <plan.json> [--dry-run]
 *   env: CF_ZONE_ID, CF_API_TOKEN, CF_API_BASE (tests only)
 */

import { readFileSync } from 'node:fs';

const PHASE = 'http_request_dynamic_redirect';
const DESCRIPTION = 'feed: dl/ downloads outside retention go to the GitHub release page';

function fail(message) {
  console.error(`update-feed-redirect: ${message}`);
  process.exit(1);
}

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const planIndex = args.indexOf('--plan');
const planFile = planIndex === -1 ? undefined : args[planIndex + 1];
if (!planFile) fail('usage: update-feed-redirect.mjs --plan <plan.json> [--dry-run]');

const zoneId = process.env.CF_ZONE_ID;
const token = process.env.CF_API_TOKEN;
if (!zoneId || !token) fail('CF_ZONE_ID and CF_API_TOKEN must be set');
const apiBase = process.env.CF_API_BASE ?? 'https://api.cloudflare.com/client/v4';

let redirect;
try {
  redirect = JSON.parse(readFileSync(planFile, 'utf8')).redirect;
} catch (error) {
  fail(`cannot read ${planFile}: ${error.message}`);
}
if (!redirect?.expression || !redirect.targetExpression) fail(`${planFile} carries no redirect`);

const rule = {
  description: DESCRIPTION,
  expression: redirect.expression,
  action: 'redirect',
  action_parameters: {
    from_value: {
      status_code: redirect.statusCode ?? 302,
      target_url: { expression: redirect.targetExpression },
      preserve_query_string: false,
    },
  },
  enabled: true,
};

async function api(method, route, body) {
  const response = await fetch(`${apiBase}${route}`, {
    method,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let payload;
  try {
    payload = await response.json();
  } catch {
    fail(`${method} ${route}: HTTP ${response.status} with a non-JSON body`);
  }
  if (response.status === 404 && method === 'GET') return undefined;
  if (!response.ok || payload.success === false) {
    const errors = (payload.errors ?? []).map((error) => `${error.code}: ${error.message}`).join('; ');
    fail(`${method} ${route}: HTTP ${response.status}${errors ? ` — ${errors}` : ''}`);
  }
  return payload.result;
}

function sameRule(existing) {
  const params = existing.action_parameters?.from_value ?? {};
  return (
    existing.expression === rule.expression &&
    existing.action === 'redirect' &&
    existing.enabled !== false &&
    params.status_code === rule.action_parameters.from_value.status_code &&
    params.target_url?.expression === rule.action_parameters.from_value.target_url.expression &&
    (params.preserve_query_string ?? false) === false
  );
}

const entrypoint = await api('GET', `/zones/${zoneId}/rulesets/phases/${PHASE}/entrypoint`);
const existing = entrypoint?.rules?.find((candidate) => candidate.description === DESCRIPTION);

if (existing && sameRule(existing)) {
  console.log(`redirect rule unchanged (${existing.id})`);
} else if (dryRun) {
  console.log(`dry run: would ${existing ? `update rule ${existing.id}` : 'create the rule'}`);
  console.log(`  ${rule.expression}`);
  console.log(`  -> ${rule.action_parameters.from_value.target_url.expression}`);
} else if (!entrypoint) {
  const created = await api('POST', `/zones/${zoneId}/rulesets`, {
    name: 'default',
    kind: 'zone',
    phase: PHASE,
    rules: [rule],
  });
  console.log(`redirect rule created in new ruleset ${created.id}`);
} else if (existing) {
  await api('PATCH', `/zones/${zoneId}/rulesets/${entrypoint.id}/rules/${existing.id}`, rule);
  console.log(`redirect rule updated (${existing.id})`);
} else {
  const updated = await api('POST', `/zones/${zoneId}/rulesets/${entrypoint.id}/rules`, rule);
  const added = updated.rules?.find((candidate) => candidate.description === DESCRIPTION);
  console.log(`redirect rule created (${added?.id ?? 'id not reported'})`);
}
