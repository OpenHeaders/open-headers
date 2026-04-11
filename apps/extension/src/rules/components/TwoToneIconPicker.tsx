/**
 * TwoToneIconPicker — grid picker for Ant Design TwoTone icons.
 *
 * Renders a dropdown with a grid of all available TwoTone icons.
 * Selected icon is stored as a string key (e.g. "ThunderboltTwoTone").
 */

import {
  AccountBookTwoTone,
  AlertTwoTone,
  ApiTwoTone,
  AppstoreTwoTone,
  AudioTwoTone,
  BankTwoTone,
  BellTwoTone,
  BookTwoTone,
  BoxPlotTwoTone,
  BugTwoTone,
  BuildTwoTone,
  BulbTwoTone,
  CalculatorTwoTone,
  CalendarTwoTone,
  CameraTwoTone,
  CarTwoTone,
  CarryOutTwoTone,
  CheckCircleTwoTone,
  CheckSquareTwoTone,
  ClockCircleTwoTone,
  CloseCircleTwoTone,
  CloseSquareTwoTone,
  CloudTwoTone,
  CodeTwoTone,
  CompassTwoTone,
  ContactsTwoTone,
  ContainerTwoTone,
  ControlTwoTone,
  CopyTwoTone,
  CreditCardTwoTone,
  CrownTwoTone,
  CustomerServiceTwoTone,
  DashboardTwoTone,
  DatabaseTwoTone,
  DeleteTwoTone,
  DiffTwoTone,
  DislikeTwoTone,
  DollarTwoTone,
  DownCircleTwoTone,
  DownSquareTwoTone,
  EditTwoTone,
  EnvironmentTwoTone,
  ExclamationCircleTwoTone,
  ExperimentTwoTone,
  EyeInvisibleTwoTone,
  EyeTwoTone,
  FileAddTwoTone,
  FileExcelTwoTone,
  FileExclamationTwoTone,
  FileImageTwoTone,
  FileMarkdownTwoTone,
  FilePdfTwoTone,
  FilePptTwoTone,
  FileTextTwoTone,
  FileTwoTone,
  FileUnknownTwoTone,
  FileWordTwoTone,
  FileZipTwoTone,
  FilterTwoTone,
  FireTwoTone,
  FlagTwoTone,
  FolderAddTwoTone,
  FolderOpenTwoTone,
  FolderTwoTone,
  FrownTwoTone,
  FunnelPlotTwoTone,
  FundTwoTone,
  GiftTwoTone,
  GoldTwoTone,
  HddTwoTone,
  HeartTwoTone,
  HighlightTwoTone,
  HomeTwoTone,
  HourglassTwoTone,
  Html5TwoTone,
  IdcardTwoTone,
  InfoCircleTwoTone,
  InsuranceTwoTone,
  InteractionTwoTone,
  LayoutTwoTone,
  LeftCircleTwoTone,
  LeftSquareTwoTone,
  LikeTwoTone,
  LockTwoTone,
  MailTwoTone,
  MedicineBoxTwoTone,
  MehTwoTone,
  MessageTwoTone,
  MinusCircleTwoTone,
  MinusSquareTwoTone,
  MobileTwoTone,
  MoneyCollectTwoTone,
  NotificationTwoTone,
  PauseCircleTwoTone,
  PhoneTwoTone,
  PictureTwoTone,
  PieChartTwoTone,
  PlayCircleTwoTone,
  PlaySquareTwoTone,
  PlusCircleTwoTone,
  PlusSquareTwoTone,
  PrinterTwoTone,
  ProfileTwoTone,
  ProjectTwoTone,
  PropertySafetyTwoTone,
  PushpinTwoTone,
  QuestionCircleTwoTone,
  ReconciliationTwoTone,
  RedEnvelopeTwoTone,
  RestTwoTone,
  RightCircleTwoTone,
  RightSquareTwoTone,
  RocketTwoTone,
  SafetyCertificateTwoTone,
  SaveTwoTone,
  ScheduleTwoTone,
  SecurityScanTwoTone,
  SettingTwoTone,
  ShopTwoTone,
  ShoppingTwoTone,
  SkinTwoTone,
  SlidersTwoTone,
  SmileTwoTone,
  SnippetsTwoTone,
  SoundTwoTone,
  StarTwoTone,
  StopTwoTone,
  SwitcherTwoTone,
  TabletTwoTone,
  TagTwoTone,
  TagsTwoTone,
  ThunderboltTwoTone,
  ToolTwoTone,
  TrophyTwoTone,
  UnlockTwoTone,
  UpCircleTwoTone,
  UpSquareTwoTone,
  UsbTwoTone,
  VideoCameraTwoTone,
  WalletTwoTone,
  WarningTwoTone,
} from '@ant-design/icons';
import { Popover, Tooltip, theme } from 'antd';
import type React from 'react';
import { createElement, useMemo, useState } from 'react';

// ── Icon registry ─────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ComponentType<{ twoToneColor?: string; style?: React.CSSProperties }>> = {
  ThunderboltTwoTone,
  FireTwoTone,
  RocketTwoTone,
  StarTwoTone,
  HeartTwoTone,
  BulbTwoTone,
  CrownTwoTone,
  TrophyTwoTone,
  FlagTwoTone,
  BookTwoTone,
  CodeTwoTone,
  ApiTwoTone,
  BugTwoTone,
  BuildTwoTone,
  ToolTwoTone,
  SettingTwoTone,
  ExperimentTwoTone,
  DatabaseTwoTone,
  CloudTwoTone,
  LockTwoTone,
  UnlockTwoTone,
  SafetyCertificateTwoTone,
  SecurityScanTwoTone,
  EyeTwoTone,
  EyeInvisibleTwoTone,
  FilterTwoTone,
  FunnelPlotTwoTone,
  TagTwoTone,
  TagsTwoTone,
  PushpinTwoTone,
  FileTextTwoTone,
  FileTwoTone,
  FileAddTwoTone,
  FileExclamationTwoTone,
  FileZipTwoTone,
  FileImageTwoTone,
  FileMarkdownTwoTone,
  FilePdfTwoTone,
  FileExcelTwoTone,
  FilePptTwoTone,
  FileWordTwoTone,
  FileUnknownTwoTone,
  FolderTwoTone,
  FolderOpenTwoTone,
  FolderAddTwoTone,
  SnippetsTwoTone,
  DiffTwoTone,
  EditTwoTone,
  HighlightTwoTone,
  CopyTwoTone,
  DeleteTwoTone,
  SaveTwoTone,
  ContainerTwoTone,
  AppstoreTwoTone,
  LayoutTwoTone,
  DashboardTwoTone,
  ControlTwoTone,
  SlidersTwoTone,
  ProfileTwoTone,
  ProjectTwoTone,
  ScheduleTwoTone,
  CarryOutTwoTone,
  CalendarTwoTone,
  ClockCircleTwoTone,
  HourglassTwoTone,
  AlertTwoTone,
  WarningTwoTone,
  ExclamationCircleTwoTone,
  InfoCircleTwoTone,
  QuestionCircleTwoTone,
  CheckCircleTwoTone,
  CheckSquareTwoTone,
  CloseCircleTwoTone,
  CloseSquareTwoTone,
  StopTwoTone,
  PlusCircleTwoTone,
  PlusSquareTwoTone,
  MinusCircleTwoTone,
  MinusSquareTwoTone,
  PauseCircleTwoTone,
  PlayCircleTwoTone,
  UpCircleTwoTone,
  DownCircleTwoTone,
  LeftCircleTwoTone,
  RightCircleTwoTone,
  UpSquareTwoTone,
  DownSquareTwoTone,
  LeftSquareTwoTone,
  RightSquareTwoTone,
  PlaySquareTwoTone,
  BellTwoTone,
  NotificationTwoTone,
  MessageTwoTone,
  MailTwoTone,
  PhoneTwoTone,
  MobileTwoTone,
  SoundTwoTone,
  AudioTwoTone,
  VideoCameraTwoTone,
  CameraTwoTone,
  PictureTwoTone,
  SmileTwoTone,
  FrownTwoTone,
  MehTwoTone,
  LikeTwoTone,
  DislikeTwoTone,
  HomeTwoTone,
  BankTwoTone,
  ShopTwoTone,
  ShoppingTwoTone,
  GiftTwoTone,
  WalletTwoTone,
  MoneyCollectTwoTone,
  DollarTwoTone,
  CreditCardTwoTone,
  GoldTwoTone,
  RedEnvelopeTwoTone,
  AccountBookTwoTone,
  InsuranceTwoTone,
  PropertySafetyTwoTone,
  InteractionTwoTone,
  ReconciliationTwoTone,
  RestTwoTone,
  PrinterTwoTone,
  HddTwoTone,
  UsbTwoTone,
  SkinTwoTone,
  CarTwoTone,
  CompassTwoTone,
  EnvironmentTwoTone,
  IdcardTwoTone,
  ContactsTwoTone,
  CustomerServiceTwoTone,
  MedicineBoxTwoTone,
  CalculatorTwoTone,
  TabletTwoTone,
  SwitcherTwoTone,
  PieChartTwoTone,
  BoxPlotTwoTone,
  FundTwoTone,
  Html5TwoTone,
};

const ALL_ICON_KEYS = Object.keys(ICON_MAP);

/** Default icon per rule type */
const DEFAULT_ICON: Record<string, string> = {
  header: 'RightCircleTwoTone',
  block: 'StopTwoTone',
  redirect: 'RocketTwoTone',
  'query-param': 'TagTwoTone',
  inject: 'CodeTwoTone',
  delay: 'ClockCircleTwoTone',
  body: 'FileTextTwoTone',
  mock: 'ApiTwoTone',
};

export function getDefaultIconForType(ruleType: string): string {
  return DEFAULT_ICON[ruleType] ?? 'FileTextTwoTone';
}

/** Render a TwoTone icon by its key string. Returns null if not found. */
export function renderTwoToneIcon(
  iconKey: string,
  style?: React.CSSProperties,
  twoToneColor?: string,
): React.ReactNode {
  const Icon = ICON_MAP[iconKey];
  if (!Icon) return null;
  return createElement(Icon, { style, twoToneColor });
}

// ── Picker component ──────────────────────────────────────────────

interface TwoToneIconPickerProps {
  value?: string;
  onChange?: (iconKey: string) => void;
}

const TwoToneIconPicker: React.FC<TwoToneIconPickerProps> = ({ value, onChange }) => {
  const { token } = theme.useToken();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search) return ALL_ICON_KEYS;
    const q = search.toLowerCase();
    return ALL_ICON_KEYS.filter((k) => k.toLowerCase().includes(q));
  }, [search]);

  const grid = (
    <div style={{ width: 280 }}>
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search icons..."
        style={{
          width: '100%',
          padding: '4px 8px',
          fontSize: 12,
          border: `1px solid ${token.colorBorder}`,
          borderRadius: 4,
          marginBottom: 8,
          outline: 'none',
          background: token.colorBgContainer,
          color: token.colorText,
        }}
      />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(8, 1fr)',
          gap: 2,
          maxHeight: 200,
          overflowY: 'auto',
        }}
      >
        {filtered.map((key) => {
          const Icon = ICON_MAP[key];
          const isSelected = value === key;
          return (
            <Tooltip key={key} title={key.replace('TwoTone', '')} placement="top">
              <div
                role="button"
                tabIndex={0}
                onClick={() => {
                  onChange?.(key);
                  setOpen(false);
                  setSearch('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    onChange?.(key);
                    setOpen(false);
                    setSearch('');
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 32,
                  height: 32,
                  borderRadius: 4,
                  cursor: 'pointer',
                  background: isSelected ? token.colorPrimaryBg : 'transparent',
                  border: isSelected ? `1px solid ${token.colorPrimary}` : '1px solid transparent',
                }}
              >
                {createElement(Icon, { style: { fontSize: 16 } })}
              </div>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );

  const SelectedIcon = value ? ICON_MAP[value] : null;

  return (
    <Popover
      content={grid}
      trigger="click"
      open={open}
      onOpenChange={setOpen}
      placement="bottomLeft"
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') setOpen(true);
        }}
        style={{
          width: 32,
          height: 32,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 6,
          border: `1px solid ${token.colorBorder}`,
          cursor: 'pointer',
          background: token.colorBgContainer,
        }}
      >
        {SelectedIcon ? createElement(SelectedIcon, { style: { fontSize: 16 } }) : <FileTextTwoTone style={{ fontSize: 16 }} />}
      </div>
    </Popover>
  );
};

export default TwoToneIconPicker;
