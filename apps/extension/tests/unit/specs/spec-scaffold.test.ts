/**
 * Blank "New Specification" scaffold — the sidebar create seed.
 *
 * Pins the Phase B contract: the seed validates against `SpecSchema`
 * once identity is minted, the single file IS the root (`rootFileUid`
 * matches, `index.yaml`, OpenAPI 3.1), and the template fully parses
 * through `parseOpenApi` out of the box (the vendor scaffold shows
 * 0 errors / 0 warnings on creation — ours must too).
 */

import { parseOpenApi } from '@openheaders/core/import';
import { SpecSchema } from '@openheaders/core/schemas';
import {
  createBlankSpecSeed,
  OPENAPI_31_SCAFFOLD,
  SPEC_ROOT_FILE_NAME,
} from '@openheaders/ui/workbench/components/specs/spec-scaffold';
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

describe('createBlankSpecSeed', () => {
  it('seeds a single root index.yaml carrying the OpenAPI 3.1 template', () => {
    const seed = createBlankSpecSeed('My Spec');
    expect(seed.name).toBe('My Spec');
    expect(seed.format).toBe('openapi-3.1');
    expect(seed.files).toHaveLength(1);
    expect(seed.files[0].uid).toBe(seed.rootFileUid);
    expect(seed.files[0].fileName).toBe(SPEC_ROOT_FILE_NAME);
    expect(seed.files[0].content).toBe(OPENAPI_31_SCAFFOLD);
  });

  it('mints a fresh root-file uid per seed', () => {
    expect(createBlankSpecSeed('A').rootFileUid).not.toBe(createBlankSpecSeed('B').rootFileUid);
  });

  it('validates against SpecSchema once identity is minted', () => {
    const seed = createBlankSpecSeed('My Spec');
    const spec = { ...seed, schemaVersion: 5, uid: 'spec0001', path: 'specs/my-spec-spec0001' };
    expect(() => v.parse(SpecSchema, spec)).not.toThrow();
  });

  it('template fully parses through parseOpenApi', () => {
    const result = parseOpenApi(OPENAPI_31_SCAFFOLD);
    expect(result.collectionName).toBe('Sample API');
    expect(result.requests).toHaveLength(1);
    expect(result.requests[0].request.url).toContain('/spacecrafts/{{spacecraftId}}');
  });
});
