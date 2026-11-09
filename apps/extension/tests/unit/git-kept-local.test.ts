/**
 * kept-local pins: a pull or merge that named no kept file raises no
 * line; a named one reads its paths, the first three and an ellipsis
 * past that.
 */

import type { Translate } from '@openheaders/ui/context/LocaleContext';
import { keptLocalNotice } from '@openheaders/ui/workbench/components/panels/git/kept-local';
import { describe, expect, it } from 'vitest';

const t: Translate = (key, args) => `${key}|${String(args?.files)}`;

describe('keptLocalNotice', () => {
  it('nothing kept raises nothing', () => {
    expect(keptLocalNotice(undefined, t)).toBeNull();
    expect(keptLocalNotice([], t)).toBeNull();
  });

  it('the kept paths are named in order', () => {
    expect(keptLocalNotice(['docs/README.md'], t)).toBe('workbench.gitLog.keptLocal|docs/README.md');
    expect(keptLocalNotice(['.gitignore', 'README.md', 'scripts/run.sh'], t)).toBe(
      'workbench.gitLog.keptLocal|.gitignore, README.md, scripts/run.sh',
    );
  });

  it('past three the line trails off', () => {
    expect(keptLocalNotice(['a.md', 'b.md', 'c.md', 'd.md', 'e.md'], t)).toBe(
      'workbench.gitLog.keptLocal|a.md, b.md, c.md, …',
    );
  });
});
