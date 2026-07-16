/**
 * Spec outline derivation — the structure pane's pure core.
 *
 * Pins the Phase D contract: the vendor groups derive from the parsed
 * AST with character offsets pointing at each node's source position
 * (one `yaml.parseDocument` pass covers YAML and JSON — YAML 1.2 is a
 * superset of JSON), and a non-parsing buffer returns null so the pane
 * keeps the last good tree.
 */

import { buildSpecOutline } from '@openheaders/ui/workbench/components/specs/spec-outline';
import { OPENAPI_31_SCAFFOLD } from '@openheaders/ui/workbench/components/specs/spec-scaffold';
import { describe, expect, it } from 'vitest';

const SAMPLE_YAML = `openapi: '3.1.0'
info:
  title: Openheaders API
  version: '1.0.0'
servers:
  - url: https://api.openheaders.io
  - url: https://staging.openheaders.io
tags:
  - name: users
  - name: status
paths:
  /users:
    get:
      summary: List users
      responses:
        '200':
          description: OK
    post:
      responses:
        '201':
          description: Created
  /status:
    get:
      responses:
        '200':
          description: OK
components:
  schemas:
    User:
      type: object
  securitySchemes:
    ApiKey:
      type: apiKey
      in: header
      name: X-Api-Key
security:
  - ApiKey: []
`;

describe('buildSpecOutline', () => {
  it('derives the vendor groups from a YAML document', () => {
    const outline = buildSpecOutline(SAMPLE_YAML);
    expect(outline).not.toBeNull();
    if (outline === null) return;

    expect(outline.servers.children.map((s) => s.label)).toEqual([
      'https://api.openheaders.io',
      'https://staging.openheaders.io',
    ]);
    expect(outline.tags.children.map((tag) => tag.label)).toEqual(['users', 'status']);
    expect(outline.paths.children.map((p) => p.label)).toEqual(['/users', '/status']);
    expect(outline.components.children.map((sub) => sub.label)).toEqual(['schemas', 'securitySchemes']);
    expect(outline.components.children[0].children.map((s) => s.label)).toEqual(['User']);
    expect(outline.components.children[1].children.map((s) => s.label)).toEqual(['ApiKey']);
    expect(outline.security.children.map((s) => s.label)).toEqual(['ApiKey']);
  });

  it('nests operations under their path with method and summary', () => {
    const outline = buildSpecOutline(SAMPLE_YAML);
    const users = outline?.paths.children.find((p) => p.label === '/users');
    expect(users?.children.map((op) => op.method)).toEqual(['GET', 'POST']);
    expect(users?.children[0].label).toBe('List users');
    // No summary → the method itself is the label.
    expect(users?.children[1].label).toBe('POST');
  });

  it('carries source offsets that point at each node', () => {
    const outline = buildSpecOutline(SAMPLE_YAML);
    expect(outline?.paths.offset).toBe(SAMPLE_YAML.indexOf('paths:'));
    expect(outline?.paths.children[0].offset).toBe(SAMPLE_YAML.indexOf('/users:'));
    const users = outline?.paths.children[0];
    expect(users?.children[1].offset).toBe(SAMPLE_YAML.indexOf('post:'));
    expect(outline?.servers.children[1].offset).toBe(SAMPLE_YAML.indexOf('url: https://staging'));
    expect(outline?.components.children[0].children[0].offset).toBe(SAMPLE_YAML.indexOf('User:'));
  });

  it('carries section end offsets bounding each node for the editor highlight', () => {
    const outline = buildSpecOutline(SAMPLE_YAML);
    expect(outline).not.toBeNull();
    if (outline === null) return;

    // The /users path section spans its operations but not its sibling.
    const users = outline.paths.children[0];
    expect(users.offset).not.toBeNull();
    expect(users.end).toBeDefined();
    if (users.offset === null || users.end === undefined) return;
    const usersSlice = SAMPLE_YAML.slice(users.offset, users.end);
    expect(usersSlice.startsWith('/users:')).toBe(true);
    expect(usersSlice).toContain("'201'");
    expect(usersSlice).not.toContain('/status:');

    // The paths group span covers every path.
    expect(outline.paths.end).toBeDefined();
    if (outline.paths.offset === null || outline.paths.end === undefined) return;
    const pathsSlice = SAMPLE_YAML.slice(outline.paths.offset, outline.paths.end);
    expect(pathsSlice).toContain('/users:');
    expect(pathsSlice).toContain('/status:');
    expect(pathsSlice).not.toContain('components:');

    // A server row spans only its own entry.
    const server = outline.servers.children[0];
    if (server.offset === null || server.end === undefined) return;
    expect(SAMPLE_YAML.slice(server.offset, server.end)).toContain('api.openheaders.io');
    expect(SAMPLE_YAML.slice(server.offset, server.end)).not.toContain('staging');

    // Absent sections carry no end.
    const empty = buildSpecOutline("openapi: '3.1.0'\ninfo:\n  title: Empty\n  version: '1.0.0'\n");
    expect(empty?.servers.end).toBeUndefined();
  });

  it('derives the same structure from a JSON document', () => {
    const outline = buildSpecOutline(
      JSON.stringify(
        {
          openapi: '3.1.0',
          info: { title: 'Test API', version: '1.0.0' },
          servers: [{ url: 'https://api.openheaders.io' }],
          paths: { '/status': { get: { responses: { '200': { description: 'OK' } } } } },
        },
        null,
        2,
      ),
    );
    expect(outline).not.toBeNull();
    expect(outline?.servers.children.map((s) => s.label)).toEqual(['https://api.openheaders.io']);
    expect(outline?.paths.children.map((p) => p.label)).toEqual(['/status']);
    expect(outline?.paths.children[0].children.map((op) => op.method)).toEqual(['GET']);
    expect(outline?.tags.children).toEqual([]);
  });

  it('groups are present but empty when their sections are absent', () => {
    const outline = buildSpecOutline("openapi: '3.1.0'\ninfo:\n  title: Empty\n  version: '1.0.0'\n");
    expect(outline).not.toBeNull();
    expect(outline?.servers.children).toEqual([]);
    expect(outline?.servers.offset).toBeNull();
    expect(outline?.paths.children).toEqual([]);
    expect(outline?.components.children.map((sub) => sub.children)).toEqual([[], []]);
    expect(outline?.security.children).toEqual([]);
  });

  it('returns null when the buffer does not parse to a mapping', () => {
    expect(buildSpecOutline('foo: [unclosed')).toBeNull();
    expect(buildSpecOutline('- just\n- a\n- list\n')).toBeNull();
    expect(buildSpecOutline('')).toBeNull();
  });

  it('outlines the blank scaffold', () => {
    const outline = buildSpecOutline(OPENAPI_31_SCAFFOLD);
    expect(outline).not.toBeNull();
    expect(outline?.paths.children.map((p) => p.label)).toEqual(['/spacecrafts/{spacecraftId}']);
    expect(outline?.paths.children[0].children.map((op) => op.method)).toEqual(['GET']);
    expect(outline?.components.children[0].children.map((s) => s.label)).toEqual([
      'SpacecraftId',
      'Spacecraft',
      'Error',
    ]);
    expect(outline?.components.children[1].children.map((s) => s.label)).toEqual(['ApiKey']);
    expect(outline?.security.children.map((s) => s.label)).toEqual(['ApiKey']);
  });
});
