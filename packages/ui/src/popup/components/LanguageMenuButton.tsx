/**
 * LanguageMenuButton — footer language switcher for popup/sidepanel.
 *
 * Mirrors the Settings "Language" picker (Follow system + every real
 * locale by its native name) minus the synthetic pseudo locale, which
 * stays a Settings-only QA affordance. Writes `general.language`
 * directly, so the catalog swaps in place and every other surface
 * follows through the settings store's cross-context sync. The icon
 * always depicts the resolved locale, so with "Follow system" active
 * it shows what the user is actually reading. Opens on hover like the
 * workbench status-bar switcher — the menu itself is the affordance,
 * so there's no tooltip to race it.
 */

import { useLocale } from '@openheaders/ui/context/LocaleContext';
import { LanguageIcon } from '@openheaders/ui/shared/icons';
import { useSetting } from '@openheaders/ui/workbench/settings/hooks';
import type { Language } from '@openheaders/ui/workbench/settings/schema/general';
import { getLocaleDef, getTranslator, LOCALES } from '@openheaders/i18n';
import { Button, Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import type React from 'react';
import { useMemo } from 'react';

const LanguageMenuButton: React.FC = () => {
  const { locale, t } = useLocale();
  const [language, setLanguage] = useSetting('general.language');

  const items = useMemo<MenuProps['items']>(
    () => [
      { key: 'auto', label: t('workbench.settings.def.general.language.option.auto.label') },
      // Native names are each language's self-designation — never translated.
      ...LOCALES.filter((l) => !l.synthetic).map((l) => ({ key: l.code, label: l.nativeName })),
    ],
    [t],
  );

  const menu = useMemo<MenuProps>(
    () => ({
      items,
      selectable: true,
      selectedKeys: [language],
      onClick: ({ key }) => setLanguage(key as Language),
    }),
    [items, language, setLanguage],
  );

  // The active locale's word for "Language" plus the English constant,
  // "Langue / Language" — collapsed to the English alone when they match.
  const english = getTranslator('en')('workbench.settings.def.general.language.label');
  const translated = t('workbench.settings.def.general.language.label');
  const label = translated === english ? english : `${translated} / ${english}`;

  return (
    <Dropdown menu={menu} trigger={['hover']} placement="topRight" classNames={{ root: 'language-menu' }}>
      <Button
        type="text"
        size="small"
        className="footer-language-button"
        aria-label={label}
        icon={<LanguageIcon locale={locale} style={{ fontSize: 20 }} />}
      >
        {/* Native name mirrors the workbench status bar; collapses to the
            bare icon on narrow sidepanels (sm tier). */}
        <span className="oh-language-label" style={{ fontSize: 12 }}>
          {getLocaleDef(locale)?.nativeName}
        </span>
      </Button>
    </Dropdown>
  );
};

export default LanguageMenuButton;
