/**
 * BC-MWPT-15 — every registered setting picks a valid scope sub-marker.
 *
 * The TypeScript discriminated union (`SettingScope`) already forbids
 * `scope: 'workspace'` at compile time; this test backstops the type-
 * level guarantee with a runtime walk so a stray `as SettingScope` cast
 * or unsafe registration path still trips the suite.
 *
 * See `MULTI_WORKSPACE_PER_WINDOW_OR_TAB_DESIGN.md` § 5.3 + § 11.2 BC-MWPT-15.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { allDefs } from '@openheaders/ui/workbench/settings/registry';
import type { SettingScope } from '@openheaders/ui/workbench/settings/storage/adapter';
import { describe, expect, it } from 'vitest';
import '@openheaders/ui/workbench/settings/schema';

const VALID_SCOPES: readonly SettingScope[] = ['user', 'workspace-taste', 'workspace-behavioral'];

describe('settings scope marker (BC-MWPT-15)', () => {
  it('every registered setting carries a valid scope', () => {
    const defs = allDefs();
    expect(defs.length).toBeGreaterThan(0);
    const offenders = defs.filter((def) => !VALID_SCOPES.includes(def.scope));
    expect(offenders.map((d) => `${d.key}=${d.scope}`)).toEqual([]);
  });

  it('no schema source file uses a deprecated bare workspace or collection scope', () => {
    const schemaDir = join(
      __dirname,
      '..',
      '..',
      '..',
      '..',
      'packages',
      'ui',
      'src',
      'workbench',
      'settings',
      'schema',
    );
    const files = readdirSync(schemaDir).filter((f) => f.endsWith('.ts'));
    expect(files.length).toBeGreaterThan(0);
    const hits: string[] = [];
    for (const file of files) {
      const text = readFileSync(join(schemaDir, file), 'utf8');
      // Catch the literal pre-split scope tokens. The discriminated
      // union catches these at compile time too — this is the structural
      // backstop for `as SettingScope` cast escapes.
      if (/scope:\s*'workspace'/.test(text) || /scope:\s*'collection'/.test(text)) {
        hits.push(file);
      }
    }
    expect(hits).toEqual([]);
  });
});
