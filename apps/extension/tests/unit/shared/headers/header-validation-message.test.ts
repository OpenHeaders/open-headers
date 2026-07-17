import {
  getHeaderOperationCapability,
  type HeaderNameValidation,
  type HeaderValueValidation,
  validateHeaderName,
  validateHeaderValue,
} from '@openheaders/core/utils';
import { DEFAULT_LOCALE, getTranslator } from '@openheaders/i18n';
import { headerValidationMessage, headerValidationWarning } from '@openheaders/ui/shared/headers';
import { describe, expect, it } from 'vitest';

const t = getTranslator(DEFAULT_LOCALE);

describe('headerValidationMessage', () => {
  it('mirrors core name-validation errors byte-for-byte across every code', () => {
    const cases: Array<[label: string, v: HeaderNameValidation]> = [
      ['name-empty', validateHeaderName('')],
      ['name-whitespace-only', validateHeaderName('   ')],
      ['name-too-long', validateHeaderName('a'.repeat(257))],
      ['name-protected request', validateHeaderName('Host')],
      ['name-protected response', validateHeaderName('Alt-Svc', true)],
      ['name-invalid-characters', validateHeaderName('X Api Key')],
    ];
    for (const [label, v] of cases) {
      expect(v.valid, label).toBe(false);
      expect(v.code, label).toBeDefined();
      expect(headerValidationMessage(t, v), label).toBe(v.message);
    }
  });

  it('mirrors core value-validation errors byte-for-byte across every code', () => {
    const cases: Array<[label: string, v: HeaderValueValidation]> = [
      ['value-empty', validateHeaderValue('')],
      ['value-whitespace-only', validateHeaderValue('   ')],
      ['value-too-long', validateHeaderValue('a'.repeat(8193))],
      ['value-null-bytes', validateHeaderValue('bearer\0token')],
      ['value-line-folding', validateHeaderValue('a\r\n b')],
      ['value-line-breaks', validateHeaderValue('a\r\nb')],
      ['value-control-characters', validateHeaderValue('a\x07b')],
      ['value-content-type-format', validateHeaderValue('???', 'Content-Type')],
    ];
    for (const [label, v] of cases) {
      expect(v.valid, label).toBe(false);
      expect(v.code, label).toBeDefined();
      expect(headerValidationMessage(t, v), label).toBe(v.message);
    }
  });

  it('mirrors the append-allowlist capability reason per direction', () => {
    for (const direction of ['request', 'response'] as const) {
      const capability = getHeaderOperationCapability(direction, 'add', 'X-OH-Stack');
      expect(capability.allowed, direction).toBe(false);
      expect(capability.code, direction).toBe('append-not-allowlisted');
      expect(headerValidationMessage(t, capability), direction).toBe(capability.reason);
    }
  });

  it('mirrors the capability name-validation pass-through', () => {
    const capability = getHeaderOperationCapability('request', 'add', 'Host');
    expect(capability.allowed).toBe(false);
    expect(capability.code).toBe('name-protected');
    expect(headerValidationMessage(t, capability)).toBe(capability.reason);
  });

  it('falls back to the raw message when no code is present', () => {
    expect(headerValidationMessage(t, { message: 'custom sentence' })).toBe('custom sentence');
    expect(headerValidationMessage(t, { reason: 'custom reason' })).toBe('custom reason');
    expect(headerValidationMessage(t, {})).toBe('');
  });
});

describe('headerValidationWarning', () => {
  it('mirrors core warnings byte-for-byte across every warning code', () => {
    const cases: Array<[label: string, v: HeaderNameValidation | HeaderValueValidation]> = [
      ['name-templated', validateHeaderName('{{prefix}}-Trace')],
      ['name-referrer-spelling', validateHeaderName('Referrer')],
      ['value-non-ascii', validateHeaderValue('café')],
    ];
    for (const [label, v] of cases) {
      expect(v.valid, label).toBe(true);
      expect(v.warningCode, label).toBeDefined();
      expect(headerValidationWarning(t, v), label).toBe(v.warning);
    }
  });

  it('falls back to the raw warning when no code is present', () => {
    expect(headerValidationWarning(t, { warning: 'custom warning' })).toBe('custom warning');
    expect(headerValidationWarning(t, {})).toBe('');
  });
});
