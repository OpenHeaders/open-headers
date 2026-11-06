/**
 * The settings page the shell last showed, kept for the session. The
 * modal destroys its shell on close so every open applies its deep
 * link cleanly; without a memory an untargeted reopen (the gear menu,
 * the keymap) would land on the first leaf, where the reference
 * reopens on the page the person left. A deep link always wins: the
 * setting's own category first (the row must be in the mounted pane),
 * then an explicit category, then the memory. Session-scoped on
 * purpose — a fresh start lands on the first leaf.
 */

let lastCategoryId: string | null = null;

export interface SettingsOpenTarget {
  settingKey?: string;
  categoryId?: string;
}

export function rememberSettingsCategory(categoryId: string): void {
  lastCategoryId = categoryId;
}

export function recallSettingsCategory(): string | null {
  return lastCategoryId;
}

/** The category a shell opens on: the key's own category, the explicit id, else the remembered page. */
export function initialSettingsCategory(
  target: SettingsOpenTarget,
  categoryOf: (settingKey: string) => string | undefined,
): string | null {
  if (target.settingKey) {
    const own = categoryOf(target.settingKey);
    if (own) return own;
  }
  return target.categoryId ?? lastCategoryId;
}

export function __resetLastSettingsCategoryForTests(): void {
  lastCategoryId = null;
}
