export type BrowserSkinId =
  | 'classic'
  | 'cobalt'
  | 'twilight'
  | 'amber'
  | 'emerald'
  | 'obsidian';

export type BrowserTabPosition = 'top' | 'left' | 'bottom';
export type BrowserTabStyle = 'floating' | 'attached' | 'minimal';
export type BrowserBookmarksBarMode = 'always' | 'newtab' | 'never';
export type BrowserDensity = 'compact' | 'normal' | 'comfortable';
export type BrowserRadius = 'sharp' | 'standard' | 'soft' | 'rounded';
export type BrowserFontFamily = 'sans' | 'serif' | 'mono';
export type BrowserWallpaperType = 'none' | 'gradient' | 'custom';
export type FiresEtpLevel = 'standard' | 'strict' | 'off';
export type FiresUserAgentMode = 'fires-desktop' | 'fires-mobile';
export type FiresContainerId = 'default' | 'personal' | 'work' | 'banking' | 'shopping';
export type FiresStartupPage = 'home' | 'restore' | 'blank';

export interface FiresToolbarButtonsConfig {
  home: boolean;
  bookmarks: boolean;
  downloads: boolean;
  privateTab: boolean;
  splitView: boolean;
  screenshot: boolean;
  findInPage: boolean;
  devtools: boolean;
  containers: boolean;
  zoom: boolean;
  aiChat: boolean;
  cloud: boolean;
  messenger: boolean;
}

export interface BrowserBookmarkItem {
  id: string;
  title: string;
  url: string;
  pinnedHome?: boolean;
}

export interface BrowserHistoryEntry {
  id: string;
  title: string;
  url: string;
  kind: 'search' | 'page';
  visitedAt: string;
}

export interface BrowserCustomizationConfig {
  // Visual & Theme
  skin: BrowserSkinId;
  accentColor: string;
  showLogo: boolean;
  wallpaperType: BrowserWallpaperType;
  wallpaperPreset: string;
  wallpaperUrl: string;
  wallpaperBlur: number; // 0..16 px
  wallpaperDim: number; // 0..70 %
  // Layout, Toolbar & Fires-Style Customization
  tabPosition: BrowserTabPosition;
  tabStyle: BrowserTabStyle;
  bookmarksBarMode: BrowserBookmarksBarMode;
  compactToolbarMenu: boolean;
  flexibleSpaces: boolean;
  density: BrowserDensity;
  cornerRadius: BrowserRadius;
  fontFamily: BrowserFontFamily;
  fontScale: number; // 90 | 100 | 110 | 120
  toolbarButtons: FiresToolbarButtonsConfig;
  customCss: string;
  // Interactions & Behavior
  startupPage: FiresStartupPage;
  openLinksInNewTab: boolean;
  autofocusAddressBar: boolean;
  smoothScroll: boolean;
  caretBrowsing: boolean;
  muteAllByDefault: boolean;
  warnOnCloseMultipleTabs: boolean;
  hoverTabPreview: boolean;
  // Home & Widgets
  customTitle: string;
  customSubtitle: string;
  showGreeting: boolean;
  showClockWidget: boolean;
  showAiSwitcher: boolean;
  showEngineSelector: boolean;
  showExamples: boolean;
  showQuickLaunch: boolean;
  showNews: boolean;
  showBookmarksBar: boolean;
  showHomeBookmarks: boolean;
  // Fires Core Engine & Privacy
  etpLevel: FiresEtpLevel;
  httpsOnly: boolean;
  doNotTrack: boolean;
  blockImages: boolean;
  disableJavaScript: boolean;
  isolateContainers: boolean;
  clearHistoryOnExit: boolean;
  uaMode: FiresUserAgentMode;
  defaultZoom: number; // 75..150
  readerFont: BrowserFontFamily;
  readerSize: number; // 14..20
  readerWidth: 'narrow' | 'normal' | 'wide';
  // Unified Downloader Control
  downloadSpeedLimitKbps: number; // 0 = unlimited, 256, 1024, 5120
  maxConcurrentDownloads: number; // 1..5
  askBeforeSave: boolean;
  // Bookmarks list
  bookmarks: BrowserBookmarkItem[];
}

export const FIRES_CONTAINERS: Array<{
  id: FiresContainerId;
  label: string;
  color: string;
}> = [
  { id: 'default', label: 'Обычная вкладка', color: 'transparent' },
  { id: 'personal', label: 'Личное', color: '#2563eb' },
  { id: 'work', label: 'Работа', color: '#059669' },
  { id: 'banking', label: 'Банки', color: '#d97706' },
  { id: 'shopping', label: 'Покупки', color: '#e11d48' },
];

export const BROWSER_SKINS: Array<{
  id: BrowserSkinId;
  label: string;
  accent: string;
  description: string;
}> = [
  {
    id: 'classic',
    label: 'Fires Чёрный',
    accent: '#000000',
    description: 'Минималистичный чистый чёрный контраст',
  },
  {
    id: 'obsidian',
    label: 'Графит Про',
    accent: '#27272a',
    description: 'Матовый угольный оттенок рабочей панели',
  },
  {
    id: 'cobalt',
    label: 'Синий океан',
    accent: '#0060df',
    description: 'Чистый технологичный синий акцент',
  },
  {
    id: 'amber',
    label: 'Fires Пламя',
    accent: '#ea580c',
    description: 'Тёплый огненный акцент Fires',
  },
  {
    id: 'twilight',
    label: 'Мягкие сумерки',
    accent: '#7c3aed',
    description: 'Вечерняя цветовая схема',
  },
  {
    id: 'emerald',
    label: 'Хвойный сланец',
    accent: '#059669',
    description: 'Спокойный сбалансированный зелёный',
  },
];

export const ACCENT_SWATCHES: string[] = [
  '#000000',
  '#27272a',
  '#0060df',
  '#ea580c',
  '#7c3aed',
  '#059669',
  '#e11d48',
  '#b45309',
];

export const WALLPAPER_PRESETS: Array<{
  id: string;
  label: string;
  lightBg: string;
  darkBg: string;
}> = [
  {
    id: 'obsidian-clean',
    label: 'Чистый минимал',
    lightBg:
      'radial-gradient(circle at 20% 20%, rgba(0, 0, 0, 0.03), transparent 45%), linear-gradient(180deg, #fafafa 0%, #f4f4f5 100%)',
    darkBg:
      'radial-gradient(circle at 20% 20%, rgba(255, 255, 255, 0.04), transparent 45%), linear-gradient(180deg, #09090b 0%, #111115 100%)',
  },
  {
    id: 'ember-sunset',
    label: 'Огненный рассвет',
    lightBg:
      'radial-gradient(circle at 80% 15%, rgba(249, 115, 22, 0.14), transparent 45%), radial-gradient(circle at 15% 75%, rgba(220, 38, 38, 0.08), transparent 50%), linear-gradient(135deg, #fff7ed 0%, #f8fafc 100%)',
    darkBg:
      'radial-gradient(circle at 80% 15%, rgba(234, 88, 12, 0.2), transparent 45%), radial-gradient(circle at 15% 75%, rgba(220, 38, 38, 0.14), transparent 50%), linear-gradient(135deg, #050507 0%, #170c08 100%)',
  },
  {
    id: 'nordic-mist',
    label: 'Скандинавский туман',
    lightBg:
      'radial-gradient(circle at 50% 0%, rgba(14, 165, 233, 0.11), transparent 55%), linear-gradient(180deg, #f1f5f9 0%, #e2e8f0 100%)',
    darkBg:
      'radial-gradient(circle at 50% 0%, rgba(14, 165, 233, 0.13), transparent 55%), linear-gradient(180deg, #09090b 0%, #0b1322 100%)',
  },
  {
    id: 'emerald-calm',
    label: 'Спокойный лес',
    lightBg:
      'radial-gradient(circle at 25% 25%, rgba(16, 185, 129, 0.12), transparent 50%), linear-gradient(160deg, #f8fafc 0%, #ecfdf5 100%)',
    darkBg:
      'radial-gradient(circle at 25% 25%, rgba(16, 185, 129, 0.16), transparent 50%), linear-gradient(160deg, #09090b 0%, #071917 100%)',
  },
  {
    id: 'technical-grid',
    label: 'Инженерная сетка',
    lightBg:
      'linear-gradient(to right, rgba(15, 23, 42, 0.035) 1px, transparent 1px), linear-gradient(to bottom, rgba(15, 23, 42, 0.035) 1px, transparent 1px), #fafafa',
    darkBg:
      'linear-gradient(to right, rgba(248, 250, 252, 0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(248, 250, 252, 0.04) 1px, transparent 1px), #09090b',
  },
];

export const DEFAULT_BOOKMARKS: BrowserBookmarkItem[] = [
  { id: 'bm-wiki', title: 'Википедия', url: 'https://ru.wikipedia.org', pinnedHome: true },
  { id: 'bm-github', title: 'GitHub', url: 'https://github.com', pinnedHome: true },
  { id: 'bm-gplay', title: 'Google Play', url: 'https://play.google.com/store', pinnedHome: true },
  { id: 'bm-habr', title: 'Хабр', url: 'https://habr.com', pinnedHome: true },
];

export const DEFAULT_TOOLBAR_BUTTONS: FiresToolbarButtonsConfig = {
  home: true,
  bookmarks: true,
  downloads: true,
  privateTab: true,
  splitView: true,
  screenshot: true,
  findInPage: true,
  devtools: true,
  containers: true,
  zoom: true,
  aiChat: true,
  cloud: true,
  messenger: true,
};

export const DEFAULT_BROWSER_CUSTOMIZATION: BrowserCustomizationConfig = {
  skin: 'classic',
  accentColor: '#000000',
  showLogo: true,
  wallpaperType: 'none',
  wallpaperPreset: 'obsidian-clean',
  wallpaperUrl: '',
  wallpaperBlur: 0,
  wallpaperDim: 15,
  tabPosition: 'top',
  tabStyle: 'floating',
  bookmarksBarMode: 'newtab',
  compactToolbarMenu: true,
  flexibleSpaces: false,
  density: 'normal',
  cornerRadius: 'soft',
  fontFamily: 'sans',
  fontScale: 100,
  toolbarButtons: DEFAULT_TOOLBAR_BUTTONS,
  customCss: '',
  startupPage: 'home',
  openLinksInNewTab: false,
  autofocusAddressBar: true,
  smoothScroll: true,
  caretBrowsing: false,
  muteAllByDefault: false,
  warnOnCloseMultipleTabs: false,
  hoverTabPreview: true,
  customTitle: 'Fires',
  customSubtitle: '',
  showGreeting: true,
  showClockWidget: false,
  showAiSwitcher: true,
  showEngineSelector: true,
  showExamples: true,
  showQuickLaunch: false,
  showNews: true,
  showBookmarksBar: true,
  showHomeBookmarks: true,
  etpLevel: 'standard',
  httpsOnly: true,
  doNotTrack: true,
  blockImages: false,
  disableJavaScript: false,
  isolateContainers: true,
  clearHistoryOnExit: false,
  uaMode: 'fires-desktop',
  defaultZoom: 100,
  readerFont: 'sans',
  readerSize: 15,
  readerWidth: 'normal',
  downloadSpeedLimitKbps: 0,
  maxConcurrentDownloads: 3,
  askBeforeSave: false,
  bookmarks: DEFAULT_BOOKMARKS,
};

export const FIRES_CUSTOMIZATION_KEY = 'fires-browser-customization-v3';
export const FIRES_HISTORY_KEY = 'fires-browser-history-v1';
export const FIRES_DOWNLOADS_KEY = 'fires-browser-downloads-v1';

export function loadBrowserCustomization(): BrowserCustomizationConfig {
  try {
    const raw =
      localStorage.getItem(FIRES_CUSTOMIZATION_KEY) ||
      localStorage.getItem('fires-browser-customization-v2');
    if (!raw) return DEFAULT_BROWSER_CUSTOMIZATION;
    const parsed = JSON.parse(raw) as Partial<BrowserCustomizationConfig>;
    return {
      ...DEFAULT_BROWSER_CUSTOMIZATION,
      ...parsed,
      toolbarButtons: {
        ...DEFAULT_TOOLBAR_BUTTONS,
        ...(parsed.toolbarButtons || {}),
      },
      bookmarks: Array.isArray(parsed.bookmarks)
        ? parsed.bookmarks
        : DEFAULT_BROWSER_CUSTOMIZATION.bookmarks,
    };
  } catch {
    return DEFAULT_BROWSER_CUSTOMIZATION;
  }
}

export function loadBrowserHistory(): BrowserHistoryEntry[] {
  try {
    const raw = localStorage.getItem(FIRES_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as BrowserHistoryEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
