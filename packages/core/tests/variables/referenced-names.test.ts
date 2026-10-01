import { describe, expect, it } from 'vitest';
import { collectTemplateStringsDeep, collectTemplateVariableNames } from '../../src/variables';

describe('collectTemplateVariableNames', () => {
  it('collects explicit vault refs and flat refs, never other namespaces', () => {
    const names = collectTemplateVariableNames([
      'Bearer {{vault.ApiToken}}',
      'https://api.openheaders.io/{{path}}?k={{env.Key}}&l={{live.Session}}',
      '{{ dynamic.uuid }} {{step.login.id}} {{collection.X}} {{file.F}}',
      '{{ vault.Spaced }}',
    ]);
    expect([...names].sort()).toEqual(['ApiToken', 'Spaced', 'path']);
  });

  it('ignores malformed references', () => {
    const names = collectTemplateVariableNames(['{{}}', '{{bogus.X}}', '{{env.}}', 'no templates']);
    expect(names.size).toBe(0);
  });
});

describe('collectTemplateStringsDeep', () => {
  it('walks nested objects and arrays for templated strings only', () => {
    const strings = collectTemplateStringsDeep({
      url: 'wss://ws.openheaders.io/{{path}}',
      headers: [{ key: 'Authorization', value: 'Bearer {{vault.Token}}', enabled: false }],
      plain: 'nothing here',
      count: 3,
      nested: { deeper: ['{{a}}', null, { x: '{{b}}' }] },
    });
    expect(strings).toEqual(['wss://ws.openheaders.io/{{path}}', 'Bearer {{vault.Token}}', '{{a}}', '{{b}}']);
  });
});
