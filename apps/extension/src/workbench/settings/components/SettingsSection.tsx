/**
 * SettingsSection — one category rendered as a scroll-anchored block.
 *
 * The shell stacks every non-empty section vertically so users can
 * scroll through categories without page-switching. Each section gets
 * a `data-category-id` anchor so the scroll-spy observer can detect
 * which category is currently in view.
 */

import { theme } from 'antd';
import { forwardRef } from 'react';
import SettingRow from '../fields/SettingRow';
import type { CategoryDef, SettingDef } from '../types';

interface SettingsSectionProps {
  category: CategoryDef;
  defs: readonly SettingDef[];
}

const SettingsSection = forwardRef<HTMLElement, SettingsSectionProps>(({ category, defs }, ref) => {
  const { token } = theme.useToken();

  return (
    <section
      ref={ref}
      data-category-id={category.id}
      aria-labelledby={`settings-heading-${category.id}`}
      style={{ padding: '24px 32px 32px', scrollMarginTop: 16 }}
    >
      <header style={{ marginBottom: 12 }}>
        <h2
          id={`settings-heading-${category.id}`}
          style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 600,
            color: token.colorText,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <span style={{ fontSize: 18, opacity: 0.85 }}>{category.icon}</span>
          {category.label}
        </h2>
        {category.description && (
          <p
            style={{
              margin: '4px 0 0',
              fontSize: 12,
              color: token.colorTextSecondary,
            }}
          >
            {category.description}
          </p>
        )}
      </header>
      <div>
        {defs.map((def) => (
          <SettingRow key={def.key} def={def} />
        ))}
      </div>
    </section>
  );
});

SettingsSection.displayName = 'SettingsSection';

export default SettingsSection;
