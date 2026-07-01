import { FolderOpenOutlined } from '@ant-design/icons';
import type { CollectionTree, ExtensionRuleType, Template } from '@openheaders/core/types';
import type { FormInstance, MenuProps } from 'antd';
import { type Dispatch, type SetStateAction, useCallback, useMemo, useState } from 'react';
import type { RuleTemplate } from '../../../rule-templates';
import { SYSTEM_TEMPLATE_TREE_BY_TYPE, TEMPLATES_BY_TYPE } from '../../../rule-templates';
import { buildSystemMenuItems, buildUserMenuItems } from './template-menu';

interface UseRuleTemplatesArgs {
  selectedType: ExtensionRuleType | undefined;
  form: FormInstance;
  userTemplates: Template[];
  templateCollectionTrees: CollectionTree[];
  initialTemplateKey?: string;
  setDefaultHeaderTab: (reqLen: number, resLen: number) => void;
  setHeaderReqCount: Dispatch<SetStateAction<number>>;
  setHeaderResCount: Dispatch<SetStateAction<number>>;
}

export interface RuleTemplates {
  applyTemplate: (key: string) => void;
  systemMenuItems: NonNullable<MenuProps['items']>;
  userMenuItems: NonNullable<MenuProps['items']>;
  activeSystemTemplate: RuleTemplate | undefined;
  activeUserTemplate: Template | undefined;
  activeSource: 'blank' | 'system' | 'user';
  selectedDescription: string | null;
}

/**
 * Template-selector state for the rule editor: the current selection, the
 * `applyTemplate` action, the hierarchical System/User dropdown menus, and
 * the derived "which source is active" flags. System + User templates render
 * as `Collection/Root → Folder → Template leaf` dropdowns — system trees come
 * from `SYSTEM_TEMPLATE_TREE_BY_TYPE`, user trees from `templateCollectionTrees`
 * filtered by the current rule type.
 *
 * `applyTemplate` resets the form then pushes the header tab + badge counts in
 * from known data via the supplied setters, so the editor stays in sync
 * without waiting on a useWatch round-trip.
 */
export function useRuleTemplates({
  selectedType,
  form,
  userTemplates,
  templateCollectionTrees,
  initialTemplateKey,
  setDefaultHeaderTab,
  setHeaderReqCount,
  setHeaderResCount,
}: UseRuleTemplatesArgs): RuleTemplates {
  const [selectedTemplate, setSelectedTemplate] = useState<string>(initialTemplateKey ?? 'empty');

  const builtinTemplates = useMemo(() => TEMPLATES_BY_TYPE[selectedType ?? 'header'] ?? [], [selectedType]);
  const systemTemplateTree = useMemo(
    () => SYSTEM_TEMPLATE_TREE_BY_TYPE[selectedType ?? 'header'] ?? [],
    [selectedType],
  );
  const filteredUserTemplates = useMemo(
    () => userTemplates.filter((t) => t.ruleType === (selectedType ?? 'header')),
    [userTemplates, selectedType],
  );

  const applyTemplate = useCallback(
    (key: string) => {
      setSelectedTemplate(key);
      const type = selectedType ?? 'header';

      // Reset form first — clears all Form.List items to zero.
      // Then setFieldsValue only adds items (never needs to clear), so it works
      // correctly for empty arrays and properly notifies useWatch for badge counts.
      form.resetFields();

      // Set header tab + badge counts from known data (avoids useWatch timing issues)
      const updateHeaderState = (fv: Record<string, unknown>) => {
        const reqLen = Array.isArray(fv.requestHeaders) ? (fv.requestHeaders as unknown[]).length : 0;
        const resLen = Array.isArray(fv.responseHeaders) ? (fv.responseHeaders as unknown[]).length : 0;
        setHeaderReqCount(reqLen);
        setHeaderResCount(resLen);
        setDefaultHeaderTab(reqLen, resLen);
      };

      if (key === 'empty') {
        form.setFieldsValue({ ruleType: type, conditions: [] });
        updateHeaderState({});
        return;
      }

      const builtins = TEMPLATES_BY_TYPE[type] ?? [];
      const builtin = builtins.find((t) => t.key === key);
      if (builtin) {
        form.setFieldsValue({ ruleType: type, conditions: builtin.conditions, ...builtin.formValues });
        updateHeaderState(builtin.formValues);
      } else {
        // User templates (key is the uid)
        const userTpl = userTemplates.find((t) => t.uid === key);
        if (userTpl) {
          const values: Record<string, unknown> = { ruleType: type };
          if (userTpl.includes.conditions && userTpl.conditions) {
            values.conditions = userTpl.conditions;
          }
          if (userTpl.includes.formValues && userTpl.formValues) {
            Object.assign(values, userTpl.formValues);
          }
          form.setFieldsValue(values);
          updateHeaderState(userTpl.formValues ?? {});
        }
      }
    },
    [selectedType, form, userTemplates, setDefaultHeaderTab],
  );

  const systemMenuItems = useMemo(
    () => buildSystemMenuItems(systemTemplateTree, applyTemplate),
    [systemTemplateTree, applyTemplate],
  );

  const userMenuItems = useMemo(() => {
    const type = selectedType ?? 'header';
    const items: NonNullable<MenuProps['items']> = [];
    for (const col of templateCollectionTrees) {
      const childItems = buildUserMenuItems(col.tree, type, applyTemplate);
      if (childItems.length === 0) continue;
      items.push({
        key: `usr-col:${col.uid}`,
        label: col.name,
        icon: <FolderOpenOutlined />,
        children: childItems,
      });
    }
    return items;
  }, [templateCollectionTrees, selectedType, applyTemplate]);

  // Which source the current selection belongs to — drives active button state.
  const activeSystemTemplate = useMemo(
    () => (selectedTemplate === 'empty' ? undefined : builtinTemplates.find((t) => t.key === selectedTemplate)),
    [selectedTemplate, builtinTemplates],
  );
  const activeUserTemplate = useMemo(
    () => (selectedTemplate === 'empty' ? undefined : filteredUserTemplates.find((t) => t.uid === selectedTemplate)),
    [selectedTemplate, filteredUserTemplates],
  );
  const activeSource: 'blank' | 'system' | 'user' = activeSystemTemplate
    ? 'system'
    : activeUserTemplate
      ? 'user'
      : 'blank';

  const selectedDescription = useMemo(() => {
    if (activeSystemTemplate) return activeSystemTemplate.description.split('\n')[0];
    if (activeUserTemplate?.description) return activeUserTemplate.description.split('\n')[0];
    return null;
  }, [activeSystemTemplate, activeUserTemplate]);

  return {
    applyTemplate,
    systemMenuItems,
    userMenuItems,
    activeSystemTemplate,
    activeUserTemplate,
    activeSource,
    selectedDescription,
  };
}
