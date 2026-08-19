/**
 * Spec outline Add affordances — insertion planning's pure core.
 *
 * Pins the S6 contract: appends land after a section's last child with
 * the sibling's indentation (`- ` markers included), absent sections
 * are created (nested `components:` wrappers too), inserted names mint
 * uniqueness suffixes, operations take the first free verb, and every
 * applied plan yields a document that still parses — the round-trip
 * invariant the whole feature stands on.
 */

import { buildSpecOutline } from '@openheaders/ui/workbench/components/specs/spec-outline';
import {
  planSpecInsertion,
  type SpecInsertTarget,
} from '@openheaders/ui/workbench/components/specs/spec-outline-insert';
import { OPENAPI_31_SCAFFOLD } from '@openheaders/ui/workbench/components/specs/spec-scaffold';
import { validateSpecSource } from '@openheaders/ui/workbench/components/specs/spec-validation';
import { describe, expect, it } from 'vitest';

const SAMPLE = `openapi: '3.1.0'
info:
  title: Openheaders API
  version: '1.0.0'
servers:
  - url: https://api.openheaders.com
paths:
  /users:
    get:
      summary: List users
      responses:
        '200':
          description: OK
components:
  schemas:
    User:
      type: object
`;

function apply(content: string, target: SpecInsertTarget): string {
  const plan = planSpecInsertion(content, target);
  expect(plan).not.toBeNull();
  if (plan === null) return content;
  return content.slice(0, plan.offset) + plan.text + content.slice(plan.offset);
}

describe('planSpecInsertion', () => {
  it('appends a server after the last entry with the sibling prefix', () => {
    const plan = planSpecInsertion(SAMPLE, { kind: 'server' });
    expect(plan).not.toBeNull();
    if (plan === null) return;
    expect(plan.offset).toBe(SAMPLE.indexOf('paths:'));
    expect(plan.text).toBe("  - url: 'https://api.openheaders.com'\n    description: 'Server description'\n");
    const next = SAMPLE.slice(0, plan.offset) + plan.text + SAMPLE.slice(plan.offset);
    expect(buildSpecOutline(next)?.servers.children).toHaveLength(2);
    expect(next.slice(plan.selectionStart, plan.selectionEnd)).toBe('https://api.openheaders.com');
  });

  it('creates an absent section at the document tail', () => {
    const next = apply(SAMPLE, { kind: 'tag' });
    expect(next.endsWith("tags:\n  - name: 'new-tag'\n    description: 'Tag description'\n")).toBe(true);
    expect(buildSpecOutline(next)?.tags.children.map((tag) => tag.label)).toEqual(['new-tag']);
  });

  it('appends a path and mints a unique key on repeat', () => {
    const once = apply(SAMPLE, { kind: 'path' });
    expect(buildSpecOutline(once)?.paths.children.map((p) => p.label)).toEqual(['/users', '/new-path']);
    const twice = apply(once, { kind: 'path' });
    expect(buildSpecOutline(twice)?.paths.children.map((p) => p.label)).toEqual(['/users', '/new-path', '/new-path-2']);
    expect(validateSpecSource(twice, 'openapi-3.1').errors).toEqual([]);
  });

  it('adds an operation with the first free verb', () => {
    const next = apply(SAMPLE, { kind: 'operation', pathKey: '/users' });
    const users = buildSpecOutline(next)?.paths.children.find((p) => p.label === '/users');
    expect(users?.children.map((op) => op.method)).toEqual(['GET', 'POST']);
    expect(validateSpecSource(next, 'openapi-3.1').errors).toEqual([]);
  });

  it('returns null when every verb is taken or the path is unknown', () => {
    const allVerbs = `openapi: '3.1.0'
info:
  title: Full
  version: '1.0.0'
paths:
  /full:
    get: {}
    post: {}
    put: {}
    patch: {}
    delete: {}
    head: {}
    options: {}
`;
    expect(planSpecInsertion(allVerbs, { kind: 'operation', pathKey: '/full' })).toBeNull();
    expect(planSpecInsertion(SAMPLE, { kind: 'operation', pathKey: '/missing' })).toBeNull();
  });

  it('appends a schema into existing components.schemas with a unique name', () => {
    const once = apply(SAMPLE, { kind: 'schema' });
    expect(buildSpecOutline(once)?.components.children[0].children.map((s) => s.label)).toEqual(['User', 'NewSchema']);
    const twice = apply(once, { kind: 'schema' });
    expect(buildSpecOutline(twice)?.components.children[0].children.map((s) => s.label)).toEqual([
      'User',
      'NewSchema',
      'NewSchema2',
    ]);
  });

  it('creates the missing securitySchemes level inside existing components', () => {
    const next = apply(SAMPLE, { kind: 'securityScheme' });
    expect(buildSpecOutline(next)?.components.children[1].children.map((s) => s.label)).toEqual(['NewSecurityScheme']);
    expect(validateSpecSource(next, 'openapi-3.1').errors).toEqual([]);
  });

  it('creates the full nested wrapper when components is absent', () => {
    const bare = "openapi: '3.1.0'\ninfo:\n  title: Bare\n  version: '1.0.0'\npaths:\n  /a:\n    get: {}\n";
    const next = apply(bare, { kind: 'schema' });
    expect(next.endsWith('components:\n  schemas:\n    NewSchema:\n      type: object\n')).toBe(true);
    expect(buildSpecOutline(next)?.components.children[0].children.map((s) => s.label)).toEqual(['NewSchema']);
  });

  it('security requirement references the first declared scheme', () => {
    const withScheme = apply(OPENAPI_31_SCAFFOLD, { kind: 'securityRequirement' });
    const outline = buildSpecOutline(withScheme);
    expect(outline?.security.children.map((s) => s.label)).toEqual(['ApiKey', 'ApiKey']);
    const withoutScheme = apply(SAMPLE, { kind: 'securityRequirement' });
    expect(buildSpecOutline(withoutScheme)?.security.children.map((s) => s.label)).toEqual(['NewSecurityScheme']);
  });

  it('matches a 4-space indented document', () => {
    const wide = `openapi: '3.1.0'
info:
    title: Wide
    version: '1.0.0'
servers:
    - url: https://api.openheaders.com
`;
    const plan = planSpecInsertion(wide, { kind: 'server' });
    expect(plan?.text).toBe("    - url: 'https://api.openheaders.com'\n      description: 'Server description'\n");
  });

  it('inserts under an empty section key', () => {
    const empty = "openapi: '3.1.0'\ninfo:\n  title: Empty\n  version: '1.0.0'\npaths:\n";
    const next = apply(empty, { kind: 'path' });
    expect(buildSpecOutline(next)?.paths.children.map((p) => p.label)).toEqual(['/new-path']);
    expect(validateSpecSource(next, 'openapi-3.1').errors).toEqual([]);
  });

  it('returns null on non-parsing buffers and flow-empty sections', () => {
    expect(planSpecInsertion('foo: [unclosed', { kind: 'server' })).toBeNull();
    expect(planSpecInsertion('- a list\n', { kind: 'server' })).toBeNull();
    const flow = "openapi: '3.1.0'\nservers: []\n";
    expect(planSpecInsertion(flow, { kind: 'server' })).toBeNull();
  });

  it('every target applied to the scaffold keeps it valid', () => {
    const targets: SpecInsertTarget[] = [
      { kind: 'server' },
      { kind: 'tag' },
      { kind: 'path' },
      { kind: 'operation', pathKey: '/spacecrafts/{spacecraftId}' },
      { kind: 'schema' },
      { kind: 'securityScheme' },
      { kind: 'securityRequirement' },
    ];
    let doc = OPENAPI_31_SCAFFOLD;
    for (const target of targets) {
      doc = apply(doc, target);
      expect(validateSpecSource(doc, 'openapi-3.1').errors).toEqual([]);
    }
    const outline = buildSpecOutline(doc);
    expect(outline?.servers.children).toHaveLength(1);
    expect(outline?.tags.children).toHaveLength(1);
    expect(outline?.paths.children).toHaveLength(2);
    expect(outline?.components.children[1].children).toHaveLength(2);
  });
});
