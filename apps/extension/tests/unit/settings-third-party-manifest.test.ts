import { loadThirdPartySoftware } from '@openheaders/ui/workbench/settings/components/third-party-software-row';
import { describe, expect, it } from 'vitest';

describe('third-party software manifest', () => {
  it('parses and lists packages for every host', async () => {
    const entries = await loadThirdPartySoftware();
    expect(entries.length).toBeGreaterThan(100);
    for (const host of ['desktop', 'extension', 'web'] as const) {
      expect(entries.some((entry) => entry.hosts.includes(host))).toBe(true);
    }
  });

  it('is deduplicated and sorted by name', async () => {
    const entries = await loadThirdPartySoftware();
    const keys = entries.map((entry) => `${entry.name}@${entry.version}`);
    expect(new Set(keys).size).toBe(keys.length);
    const names = entries.map((entry) => entry.name);
    expect([...names].sort((a, b) => a.localeCompare(b))).toEqual(names);
  });
});
