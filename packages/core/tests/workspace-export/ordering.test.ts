/**
 * Sanity checks for the canonical field order constants — keeps the
 * envelope's serialization stable across clients.
 */

import { describe, expect, it } from 'vitest';
import {
  WORKSPACE_EXPORT_ENTITIES_FIELD_ORDER,
  WORKSPACE_EXPORT_FIELD_ORDER,
  WORKSPACE_EXPORT_META_FIELD_ORDER,
  WORKSPACE_EXPORT_SECRETS_FIELD_ORDER,
  WORKSPACE_EXPORT_SOURCE_FIELD_ORDER,
} from '../../src/workspace-export/index';

describe('WORKSPACE_EXPORT_FIELD_ORDER', () => {
  it('lists metadata fields before payload', () => {
    const idxOf = (k: string) => WORKSPACE_EXPORT_FIELD_ORDER.indexOf(k as never);
    expect(idxOf('kind')).toBe(0);
    expect(idxOf('schemaVersion')).toBe(1);
    expect(idxOf('exportFormatVersion')).toBe(2);
    expect(idxOf('entities')).toBeGreaterThan(idxOf('workspace'));
    expect(idxOf('meta')).toBeGreaterThan(idxOf('entities'));
  });

  it('does not duplicate any field', () => {
    const arr = [...WORKSPACE_EXPORT_FIELD_ORDER];
    expect(new Set(arr).size).toBe(arr.length);
  });
});

describe('WORKSPACE_EXPORT_ENTITIES_FIELD_ORDER', () => {
  it('lists collections + folders before rules + requests (dependency-friendly)', () => {
    const idxOf = (k: string) => WORKSPACE_EXPORT_ENTITIES_FIELD_ORDER.indexOf(k as never);
    expect(idxOf('collections')).toBeLessThan(idxOf('rules'));
    expect(idxOf('folders')).toBeLessThan(idxOf('rules'));
    expect(idxOf('environments')).toBeLessThan(idxOf('liveVariables'));
    expect(idxOf('liveWorkflows')).toBeLessThan(idxOf('liveVariables'));
  });
});

describe('source / meta / secrets sub-orderings exist + are non-empty', () => {
  it('source has app/appVersion/platform first', () => {
    expect(WORKSPACE_EXPORT_SOURCE_FIELD_ORDER[0]).toBe('app');
  });
  it('meta orders redactions then counts', () => {
    expect(WORKSPACE_EXPORT_META_FIELD_ORDER).toEqual(['redactions', 'counts']);
  });
  it('secrets orders encryption then ciphertext', () => {
    expect(WORKSPACE_EXPORT_SECRETS_FIELD_ORDER).toEqual(['encryption', 'ciphertext']);
  });
});
