/**
 * Phase 0 verification — byte-exact round-trip for every fixture in
 * `tests/fixtures/format/v1/`.
 *
 * parse(fixture) → serialize(mergePatch(parsed, identity)) should
 * produce the original bytes. This exercises preserve-unknown
 * (invariant #4) and canonical ordering (invariant #6) on a single
 * read/write hop. Any new entity codec must add a fixture + a case
 * here before it's considered landed.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  parseCollection,
  parseFolder,
  parseRule,
  parseTemplate,
  parseWorkspace,
  serializeCollection,
  serializeFolder,
  serializeRule,
  serializeTemplate,
  serializeWorkspace,
} from '../../src/codec/yaml';
import { mergePatch } from '../../src/schemas/document';

const FIXTURE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../fixtures/format/v1');

function loadFixture(name: string): string {
  return readFileSync(join(FIXTURE_DIR, name), 'utf8');
}

describe('yaml codec — round-trip parity', () => {
  it('workspace.yaml', () => {
    const raw = loadFixture('workspace.yaml');
    const parsed = parseWorkspace(raw);
    expect(parsed.value.uid).toBe('a1b2c3d4');
    const write = mergePatch(parsed, () => {});
    expect(serializeWorkspace(write)).toBe(raw);
  });

  it('_collection.yaml', () => {
    const raw = loadFixture('_collection.yaml');
    const parsed = parseCollection(raw, { path: 'requests/auth-c0ll1111' });
    expect(parsed.value.uid).toBe('c0ll1111');
    expect(parsed.value.path).toBe('requests/auth-c0ll1111');
    const write = mergePatch(parsed, () => {});
    expect(serializeCollection(write)).toBe(raw);
  });

  it('_folder.yaml', () => {
    const raw = loadFixture('_folder.yaml');
    const parsed = parseFolder(raw, { path: 'requests/auth-c0ll1111/tokens-f0ld3r12' });
    expect(parsed.value.uid).toBe('f0ld3r12');
    const write = mergePatch(parsed, () => {});
    expect(serializeFolder(write)).toBe(raw);
  });

  const ruleFixtures = readdirSync(FIXTURE_DIR).filter((f) => f.startsWith('rule-') && f.endsWith('.yaml'));

  for (const fixture of ruleFixtures) {
    it(fixture, () => {
      const raw = loadFixture(fixture);
      const parsed = parseRule(raw, { path: `rules/demo-rule000${ruleFixtures.indexOf(fixture)}` });
      const write = mergePatch(parsed, () => {});
      expect(serializeRule(write)).toBe(raw);
    });
  }

  it('template.yaml', () => {
    const raw = loadFixture('template.yaml');
    const parsed = parseTemplate(raw, { path: 'templates/bearer-tmpl0001' });
    expect(parsed.value.uid).toBe('tmpl0001');
    const write = mergePatch(parsed, () => {});
    expect(serializeTemplate(write)).toBe(raw);
  });
});
