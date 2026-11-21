import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Palette,
  Layout,
  ShieldCheck,
  Bookmark,
  History,
  RotateCcw,
  Download,
  Upload,
  Plus,
  Trash2,
  ExternalLink,
  Sliders,
  MousePointerClick,
  Keyboard,
  Sun,
  Moon,
  Code2,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import {
  ACCENT_SWATCHES,
  BROWSER_SKINS,
  BrowserBookmarksBarMode,
  BrowserCustomizationConfig,
  BrowserDensity,
  BrowserFontFamily,
  BrowserHistoryEntry,
  BrowserRadius,
  BrowserTabPosition,
  BrowserTabStyle,
  DEFAULT_BROWSER_CUSTOMIZATION,
  FiresEtpLevel,
  FiresStartupPage,
  FiresToolbarButtonsConfig,
  FiresUserAgentMode,
  WALLPAPER_PRESETS,
} from '../types/browserCustomization';
import { FiresLogo } from './FiresLogo';

export type CustomizationSection =
  | 'appearance'
  | 'layout'
  | 'interactions'
  | 'widgets'
  | 'engine'
  | 'bookmarks'
  | 'history'
  | 'shortcuts';

export interface ClosedTabSummary {
  id: string;
  title: string;
  url: string;
  closedAt: string;
}

interface BrowserCustomizationDrawerProps {
  isOpen: boolean;
  initialSection?: CustomizationSection;
  config: BrowserCustomizationConfig;
  history: BrowserHistoryEntry[];
  closedTabs?: ClosedTabSummary[];
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
  onChange: (patch: Partial<BrowserCustomizationConfig>) => void;
  onReset: () => void;
  onAddBookmark: (title: string, url: string) => void;
  onRemoveBookmark: (id: string) => void;
  onNavigateUrl: (url: string) => void;
  onRestoreClosedTab?: (id: string) => void;
  onClearHistory: () => void;
  onOpenAboutFires: () => void;
  onOpenSourceCode?: () => void;
  onClose: () => void;
}

export const BrowserCustomizationDrawer: React.FC<BrowserCustomizationDrawerProps> = ({
  isOpen,
  initialSection = 'appearance',
  config,
  history,
  closedTabs = [],
  theme = 'light',
  onToggleTheme,
  onChange,
  onReset,
  onAddBookmark,
  onRemoveBookmark,
  onNavigateUrl,
  onRestoreClosedTab,
  onClearHistory,
  onOpenAboutFires,
  onOpenSourceCode,
  onClose,
}) => {
  const [section, setSection] = useState<CustomizationSection>(initialSection);
  const [bmTitle, setBmTitle] = useState('');
  const [bmUrl, setBmUrl] = useState('');
  const [historyQuery, setHistoryQuery] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const wallpaperFileRef = useRef<HTMLInputElement | null>(null);
  const importFileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSection(initialSection);
      setImportError(null);
      setImportSuccess(null);
    }
  }, [isOpen, initialSection]);

  if (!isOpen) return null;

  const updateToolbarButton = (key: keyof FiresToolbarButtonsConfig, checked: boolean) => {
    onChange({
      toolbarButtons: {
        ...config.toolbarButtons,
        [key]: checked,
      },
    });
  };

  const handleWallpaperUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 5_000_000) {
      setImportError('Изображение слишком велико (лимит 5 МБ).');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImportError(null);
        setImportSuccess('Фоновое изображение установлено.');
        onChange({
          wallpaperType: 'custom',
          wallpaperUrl: reader.result,
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(config, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fires-settings-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setImportError(null);
    setImportSuccess('Настройки и закладки сохранены в JSON.');
  };

  const parseImportText = (text: string, fileName: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      setImportError('Выбранный файл пуст.');
      setImportSuccess(null);
      return;
    }

    // 1. Standard browser Netscape HTML bookmarks import
    if (
      fileName.toLowerCase().endsWith('.html') ||
      fileName.toLowerCase().endsWith('.htm') ||
      /<a\s+[^>]*href=/i.test(trimmed)
    ) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(trimmed, 'text/html');
      const anchors = Array.from(doc.querySelectorAll('a[href]'));
      const importedBookmarks = anchors
        .map((a, idx) => {
          const href = a.getAttribute('href')?.trim() || '';
          const title = a.textContent?.trim() || href;
          if (!/^https?:\/\//i.test(href)) return null;
          return {
            id: `bm-imp-${Date.now()}-${idx}`,
            title: title.slice(0, 60),
            url: href,
            pinnedHome: true,
          };
        })
        .filter((x): x is NonNullable<typeof x> => Boolean(x));

      if (importedBookmarks.length === 0) {
        setImportError('В HTML-файле не найдено корректных ссылок закладок (http/https).');
        setImportSuccess(null);
        return;
      }

      const existingUrls = new Set(config.bookmarks.map((b) => b.url.toLowerCase()));
      const merged = [
        ...config.bookmarks,
        ...importedBookmarks.filter((b) => !existingUrls.has(b.url.toLowerCase())),
      ];
      onChange({ bookmarks: merged });
      setImportError(null);
      setImportSuccess(`Импортировано закладок из HTML: ${importedBookmarks.length}.`);
      return;
    }

    // 2. JSON configuration / workspace bookmarks import
    try {
      const parsed = JSON.parse(trimmed) as Partial<BrowserCustomizationConfig> & {
        bookmarks?: Array<{ id?: string; title?: string; url?: string; pinnedHome?: boolean }>;
      };
      if (!parsed || typeof parsed !== 'object') {
        setImportError('Некорректный формат файла настроек.');
        setImportSuccess(null);
        return;
      }

      // Support importing plain array of bookmarks or Firas backup JSON too
      if (Array.isArray(parsed)) {
        const cleanBookmarks = parsed
          .filter((b) => b && typeof b === 'object' && typeof (b as { url?: unknown }).url === 'string')
          .map((b, i) => ({
            id: (b as { id?: string }).id || `bm-imp-${Date.now()}-${i}`,
            title: String((b as { title?: string }).title || 'Закладка').slice(0, 60),
            url: String((b as { url: string }).url),
            pinnedHome: true,
          }));
        if (cleanBookmarks.length === 0) {
          setImportError('В JSON-массиве не найдено закладок.');
          return;
        }
        onChange({ bookmarks: [...config.bookmarks, ...cleanBookmarks] });
        setImportError(null);
        setImportSuccess(`Импортировано закладок: ${cleanBookmarks.length}.`);
        return;
      }

      const nextBookmarks = Array.isArray(parsed.bookmarks)
        ? parsed.bookmarks
            .filter((b) => b && typeof b.url === 'string')
            .map((b, i) => ({
              id: b.id || `bm-${Date.now()}-${i}`,
              title: String(b.title || b.url || 'Сайт').slice(0, 60),
              url: String(b.url),
              pinnedHome: b.pinnedHome ?? true,
            }))
        : config.bookmarks;

      onChange({
        ...DEFAULT_BROWSER_CUSTOMIZATION,
        ...parsed,
        toolbarButtons: {
          ...DEFAULT_BROWSER_CUSTOMIZATION.toolbarButtons,
          ...(parsed.toolbarButtons || {}),
        },
        bookmarks: nextBookmarks,
      });
      setImportError(null);
      setImportSuccess(`Файл «${fileName}» успешно импортирован.`);
    } catch {
      setImportError('Не удалось разобрать файл. Поддерживаются JSON-настройки Fires и HTML-закладки.');
      setImportSuccess(null);
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    e.target.value = '';
    if (!selected) return;
    const reader = new FileReader();
    reader.onload = () => {
      parseImportText(String(reader.result || ''), selected.name);
    };
    reader.onerror = () => {
      setImportError('Ошибка чтения файла с диска.');
      setImportSuccess(null);
    };
    reader.readAsText(selected, 'utf-8');
  };

  const filteredHistory = history.filter((item) => {
    const q = historyQuery.trim().toLowerCase();
    if (!q) return true;
    return item.title.toLowerCase().includes(q) || item.url.toLowerCase().includes(q);
  });

  const navTabs: Array<{ id: CustomizationSection; label: string; icon: React.ReactNode }> = [
    { id: 'appearance', label: 'Темы и фон', icon: <Palette className="w-3.5 h-3.5" /> },
    { id: 'layout', label: 'Панель и вкладки', icon: <Layout className="w-3.5 h-3.5" /> },
    { id: 'interactions', label: 'Поведение', icon: <MousePointerClick className="w-3.5 h-3.5" /> },
    { id: 'widgets', label: 'Домашняя', icon: <Sliders className="w-3.5 h-3.5" /> },
    { id: 'engine', label: 'Ядро и приватность', icon: <ShieldCheck className="w-3.5 h-3.5" /> },
    { id: 'bookmarks', label: 'Закладки', icon: <Bookmark className="w-3.5 h-3.5" /> },
    { id: 'history', label: 'История', icon: <History className="w-3.5 h-3.5" /> },
    { id: 'shortcuts', label: 'Клавиши', icon: <Keyboard className="w-3.5 h-3.5" /> },
  ];

  const toolItems: Array<{ key: keyof FiresToolbarButtonsConfig; label: string }> = [
    { key: 'downloads', label: 'Единый загрузчик (GitHub + Play)' },
    { key: 'privateTab', label: 'Приватное окно' },
    { key: 'splitView', label: 'Разделение экрана (Split View)' },
    { key: 'findInPage', label: 'Поиск по странице (Ctrl+F)' },
    { key: 'screenshot', label: 'Снимок экрана' },
    { key: 'devtools', label: 'Инструменты разработчика (F12)' },
    { key: 'containers', label: 'Контейнеры вкладок' },
    { key: 'zoom', label: 'Масштаб страницы' },
    { key: 'aiChat', label: 'Нейрочат и Studio AI' },
    { key: 'cloud', label: 'Облако 1 ТБ' },
    { key: 'messenger', label: 'Мессенджер' },
    { key: 'home', label: 'Кнопка «Домой»' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/45 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-label="Настройка и кастомизация Fires"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl h-full bg-white dark:bg-zinc-950 border-l border-zinc-200 dark:border-zinc-800 flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {config.showLogo && <FiresLogo size={28} className="shrink-0" />}
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                Настройка и оформление Fires
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                Панель инструментов, темы, вкладки, CSS-стили, импорт файлов и ядро FiresCore
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {onToggleTheme && (
              <button
                type="button"
                onClick={onToggleTheme}
                title={theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus:outline-none"
              >
                {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                <span>{theme === 'dark' ? 'Светлая' : 'Тёмная'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Закрыть настройки"
              className="p-2 rounded-lg text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus:outline-none"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Section Tabs */}
        <div className="px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-1 overflow-x-auto bg-zinc-50 dark:bg-zinc-900/60 shrink-0">
          {navTabs.map((tab) => {
            const active = section === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSection(tab.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 focus:outline-none ${
                  active
                    ? 'bg-black dark:bg-zinc-100 text-white dark:text-black'
                    : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200/60 dark:hover:bg-zinc-800'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {importError && (
            <div className="px-3.5 py-2.5 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 text-xs text-red-700 dark:text-red-300 flex items-center justify-between gap-2">
              <span>{importError}</span>
              <button
                type="button"
                onClick={() => setImportError(null)}
                className="p-0.5 hover:opacity-70"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {importSuccess && (
            <div className="px-3.5 py-2.5 rounded-lg border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/40 text-xs text-emerald-700 dark:text-emerald-300 flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>{importSuccess}</span>
              </span>
              <button
                type="button"
                onClick={() => setImportSuccess(null)}
                className="p-0.5 hover:opacity-70"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {section === 'appearance' && (
            <div className="space-y-6">
              {/* Show/Hide Logo & Mode */}
              <div className="space-y-2.5">
                <label className="flex items-center justify-between gap-3 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/40 cursor-pointer text-xs">
                  <div>
                    <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                      Показывать логотип Fires
                    </div>
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      Можно полностью убрать логотип из верхней панели и со стартовой страницы
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.showLogo}
                    onChange={(e) => onChange({ showLogo: e.target.checked })}
                    className="w-4 h-4 accent-black dark:accent-zinc-100 shrink-0"
                  />
                </label>
              </div>

              {/* Skins / Colorways */}
              <div className="space-y-2.5">
                <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  Цветовые темы (Colorways)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {BROWSER_SKINS.map((skin) => {
                    const selected = config.skin === skin.id;
                    return (
                      <button
                        key={skin.id}
                        type="button"
                        onClick={() =>
                          onChange({
                            skin: skin.id,
                            accentColor: skin.accent,
                          })
                        }
                        className={`p-3 rounded-xl border text-left transition-colors focus:outline-none ${
                          selected
                            ? 'border-black dark:border-zinc-100 bg-zinc-50 dark:bg-zinc-900'
                            : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                            {skin.label}
                          </span>
                          <span
                            className="w-3.5 h-3.5 rounded-full shrink-0 border border-black/15"
                            style={{ backgroundColor: skin.accent }}
                          />
                        </div>
                        <div className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                          {skin.description}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Accent Color */}
              <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    Акцентный цвет (базовый — #000000)
                  </span>
                  <span className="font-mono text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
                    {config.accentColor}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {ACCENT_SWATCHES.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => onChange({ accentColor: hex })}
                      aria-label={`Выбрать цвет ${hex}`}
                      className={`w-7 h-7 rounded-lg border transition-transform focus:outline-none ${
                        config.accentColor.toLowerCase() === hex.toLowerCase()
                          ? 'ring-2 ring-black dark:ring-zinc-100 ring-offset-2 dark:ring-offset-zinc-950 scale-105'
                          : 'border-zinc-200 dark:border-zinc-700'
                      }`}
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                  <label className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-700 dark:text-zinc-200 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900">
                    <input
                      type="color"
                      value={config.accentColor}
                      onChange={(e) => onChange({ accentColor: e.target.value })}
                      className="w-4 h-4 bg-transparent border-0 p-0 cursor-pointer"
                    />
                    <span>Свой цвет</span>
                  </label>
                </div>
              </div>

              {/* Start Page Wallpaper */}
              <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
                <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  Фон новой вкладки
                </div>
                <div className="grid grid-cols-3 gap-1.5 p-1 rounded-lg bg-zinc-100 dark:bg-zinc-900">
                  {(
                    [
                      { id: 'none', label: 'Чистый' },
                      { id: 'gradient', label: 'Градиенты' },
                      { id: 'custom', label: 'Своё фото' },
                    ] as const
                  ).map((wt) => (
                    <button
                      key={wt.id}
                      type="button"
                      onClick={() => onChange({ wallpaperType: wt.id })}
                      className={`py-1.5 text-xs font-medium rounded-md transition-colors focus:outline-none ${
                        config.wallpaperType === wt.id
                          ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs'
                          : 'text-zinc-600 dark:text-zinc-400'
                      }`}
                    >
                      {wt.label}
                    </button>
                  ))}
                </div>

                {config.wallpaperType === 'gradient' && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {WALLPAPER_PRESETS.map((preset) => {
                      const active = config.wallpaperPreset === preset.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => onChange({ wallpaperPreset: preset.id })}
                          className={`p-2 rounded-xl border text-left transition-colors focus:outline-none ${
                            active
                              ? 'border-black dark:border-zinc-100'
                              : 'border-zinc-200 dark:border-zinc-800'
                          }`}
                        >
                          <div
                            className="h-10 rounded-lg border border-zinc-200/70 dark:border-zinc-700/70 mb-1.5"
                            style={{ background: preset.lightBg }}
                          />
                          <div className="text-[11px] font-medium text-zinc-800 dark:text-zinc-200 truncate">
                            {preset.label}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {config.wallpaperType === 'custom' && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="url"
                        value={config.wallpaperUrl.startsWith('data:') ? '' : config.wallpaperUrl}
                        onChange={(e) => onChange({ wallpaperUrl: e.target.value })}
                        placeholder="Прямая ссылка на фото (https://...)"
                        className="flex-1 min-w-[200px] px-3 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none"
                      />
                      <input
                        ref={wallpaperFileRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleWallpaperUpload}
                      />
                      <button
                        type="button"
                        onClick={() => wallpaperFileRef.current?.click()}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 whitespace-nowrap focus:outline-none"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Импорт фото</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <label className="space-y-1">
                        <div className="flex justify-between text-zinc-600 dark:text-zinc-300">
                          <span>Размытие</span>
                          <span className="font-mono tabular-nums">{config.wallpaperBlur} px</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={16}
                          step={1}
                          value={config.wallpaperBlur}
                          onChange={(e) => onChange({ wallpaperBlur: Number(e.target.value) })}
                          className="w-full accent-black dark:accent-zinc-100"
                        />
                      </label>
                      <label className="space-y-1">
                        <div className="flex justify-between text-zinc-600 dark:text-zinc-300">
                          <span>Затемнение</span>
                          <span className="font-mono tabular-nums">{config.wallpaperDim}%</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={70}
                          step={5}
                          value={config.wallpaperDim}
                          onChange={(e) => onChange({ wallpaperDim: Number(e.target.value) })}
                          className="w-full accent-black dark:accent-zinc-100"
                        />
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {section === 'layout' && (
            <div className="space-y-6">
              {/* Compact Unified Overflow Menu Toggle */}
              <div className="space-y-2.5">
                <label className="flex items-center justify-between gap-3 p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 cursor-pointer text-xs">
                  <div>
                    <div className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Объединять кнопки панели в одно меню «Ещё»</span>
                    </div>
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                      Минималистичный вид панели как в современных браузерах — отключайте, если хотите видеть все кнопки сразу
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.compactToolbarMenu}
                    onChange={(e) => onChange({ compactToolbarMenu: e.target.checked })}
                    className="w-4 h-4 accent-black dark:accent-zinc-100 shrink-0"
                  />
                </label>

                <label className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 cursor-pointer text-xs">
                  <div>
                    <div className="font-medium text-zinc-900 dark:text-zinc-100">
                      Гибкий интервал по краям адресной строки (Flexible Space)
                    </div>
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      Центрирует омнибокс с воздухом по бокам
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.flexibleSpaces}
                    onChange={(e) => onChange({ flexibleSpaces: e.target.checked })}
                    className="w-4 h-4 accent-black dark:accent-zinc-100 shrink-0"
                  />
                </label>
              </div>

              {/* Tab Bar Position & Style */}
              <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-4">
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    Расположение строки вкладок
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        { id: 'top', label: 'Сверху (отдельная строка)' },
                        { id: 'left', label: 'Вертикально слева' },
                        { id: 'bottom', label: 'Снизу' },
                      ] as Array<{ id: BrowserTabPosition; label: string }>
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => onChange({ tabPosition: opt.id })}
                        className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors focus:outline-none ${
                          config.tabPosition === opt.id
                            ? 'border-black bg-black text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-black'
                            : 'border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    Стиль вкладок
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        { id: 'floating', label: 'Плавающие (Proton)' },
                        { id: 'attached', label: 'Слитные (Chrome)' },
                        { id: 'minimal', label: 'Плоский минимал' },
                      ] as Array<{ id: BrowserTabStyle; label: string }>
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => onChange({ tabStyle: opt.id })}
                        className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors focus:outline-none ${
                          config.tabStyle === opt.id
                            ? 'border-black bg-black text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-black'
                            : 'border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    Панель закладок
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        { id: 'always', label: 'Показывать всегда' },
                        { id: 'newtab', label: 'Только на новой вкладке' },
                        { id: 'never', label: 'Не показывать' },
                      ] as Array<{ id: BrowserBookmarksBarMode; label: string }>
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() =>
                          onChange({
                            bookmarksBarMode: opt.id,
                            showBookmarksBar: opt.id !== 'never',
                          })
                        }
                        className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors focus:outline-none ${
                          config.bookmarksBarMode === opt.id
                            ? 'border-black bg-black text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-black'
                            : 'border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Density & Corner Radius */}
              <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    Плотность интерфейса (Density)
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        { id: 'compact', label: 'Компакт' },
                        { id: 'normal', label: 'Обычная' },
                        { id: 'comfortable', label: 'Touch' },
                      ] as Array<{ id: BrowserDensity; label: string }>
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => onChange({ density: opt.id })}
                        className={`py-2 text-xs font-medium rounded-lg border transition-colors focus:outline-none ${
                          config.density === opt.id
                            ? 'border-black bg-black text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-black'
                            : 'border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    Скругление элементов
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(
                      [
                        { id: 'sharp', label: '0px' },
                        { id: 'standard', label: '8px' },
                        { id: 'soft', label: '14px' },
                        { id: 'rounded', label: '20px' },
                      ] as Array<{ id: BrowserRadius; label: string }>
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => onChange({ cornerRadius: opt.id })}
                        className={`py-2 text-xs font-mono font-medium rounded-lg border transition-colors focus:outline-none ${
                          config.cornerRadius === opt.id
                            ? 'border-black bg-black text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-black'
                            : 'border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Typography & Scale */}
              <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    Шрифт браузера
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        { id: 'sans', label: 'Sans' },
                        { id: 'serif', label: 'Serif' },
                        { id: 'mono', label: 'Mono' },
                      ] as Array<{ id: BrowserFontFamily; label: string }>
                    ).map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => onChange({ fontFamily: f.id })}
                        className={`py-1.5 text-xs font-medium rounded-lg border transition-colors focus:outline-none ${
                          config.fontFamily === f.id
                            ? 'border-black bg-black text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-black'
                            : 'border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    Масштаб интерфейса
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[90, 100, 110, 120].map((sc) => (
                      <button
                        key={sc}
                        type="button"
                        onClick={() => onChange({ fontScale: sc })}
                        className={`py-1.5 text-xs font-mono tabular-nums font-medium rounded-lg border transition-colors focus:outline-none ${
                          config.fontScale === sc
                            ? 'border-black bg-black text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-black'
                            : 'border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300'
                        }`}
                      >
                        {sc}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Customize Toolbar Items */}
              <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-2.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                    Настройка кнопок панели (Customize Toolbar)
                  </span>
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    {config.compactToolbarMenu ? 'В меню «Ещё»' : 'На панели'}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {toolItems.map((item) => (
                    <label
                      key={item.key}
                      className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 cursor-pointer text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                    >
                      <span className="truncate">{item.label}</span>
                      <input
                        type="checkbox"
                        checked={Boolean(config.toolbarButtons[item.key])}
                        onChange={(e) => updateToolbarButton(item.key, e.target.checked)}
                        className="w-4 h-4 accent-black dark:accent-zinc-100 shrink-0"
                      />
                    </label>
                  ))}
                </div>
              </div>

              {/* userChrome Custom CSS */}
              <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                    Пользовательский CSS интерфейса (userChrome.css)
                  </span>
                  {config.customCss && (
                    <button
                      type="button"
                      onClick={() => onChange({ customCss: '' })}
                      className="text-[11px] text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                    >
                      Очистить CSS
                    </button>
                  )}
                </div>
                <textarea
                  rows={3}
                  value={config.customCss}
                  onChange={(e) => onChange({ customCss: e.target.value })}
                  placeholder=".fires-omnibox { border-radius: 999px; }"
                  className="w-full px-3 py-2 font-mono text-[11px] rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none"
                />
              </div>
            </div>
          )}

          {section === 'interactions' && (
            <div className="space-y-5 text-xs">
              <div className="space-y-2">
                <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                  Запуск и восстановление сессии
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: 'home', label: 'Стартовая Fires' },
                      { id: 'restore', label: 'Восстановить вкладки' },
                      { id: 'blank', label: 'Пустая страница' },
                    ] as Array<{ id: FiresStartupPage; label: string }>
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onChange({ startupPage: opt.id })}
                      className={`px-3 py-2 font-medium rounded-lg border transition-colors focus:outline-none ${
                        config.startupPage === opt.id
                          ? 'border-black bg-black text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-black'
                          : 'border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 space-y-2.5">
                <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                  Поведение и навигация
                </div>
                {(
                  [
                    {
                      key: 'openLinksInNewTab',
                      label: 'Открывать результаты поиска и внешние ссылки в новой вкладке',
                    },
                    {
                      key: 'autofocusAddressBar',
                      label: 'Автоматически фокусировать ввод при открытии новой вкладки',
                    },
                    {
                      key: 'smoothScroll',
                      label: 'Плавная прокрутка страниц (Smooth Scroll)',
                    },
                    {
                      key: 'caretBrowsing',
                      label: 'Режим текстового курсора на странице (Caret Browsing)',
                    },
                    {
                      key: 'muteAllByDefault',
                      label: 'Отключать автовоспроизведение звука на всех сайтах',
                    },
                    {
                      key: 'hoverTabPreview',
                      label: 'Показывать подсказку с адресом и статистикой при наведении на вкладку',
                    },
                    {
                      key: 'clearHistoryOnExit',
                      label: 'Удалять журнал посещений при закрытии сессии браузера',
                    },
                    {
                      key: 'askBeforeSave',
                      label: 'Всегда спрашивать перед сохранением файла из загрузчика',
                    },
                  ] as Array<{ key: keyof BrowserCustomizationConfig; label: string }>
                ).map((item) => (
                  <label
                    key={item.key}
                    className="flex items-center justify-between gap-3 py-1.5 cursor-pointer text-zinc-700 dark:text-zinc-200"
                  >
                    <span>{item.label}</span>
                    <input
                      type="checkbox"
                      checked={Boolean(config[item.key])}
                      onChange={(e) => onChange({ [item.key]: e.target.checked })}
                      className="w-4 h-4 accent-black dark:accent-zinc-100 shrink-0"
                    />
                  </label>
                ))}
              </div>
            </div>
          )}

          {section === 'widgets' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <label className="space-y-1">
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                    Заголовок домашней страницы
                  </span>
                  <input
                    type="text"
                    value={config.customTitle}
                    onChange={(e) => onChange({ customTitle: e.target.value })}
                    placeholder="Fires"
                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none"
                  />
                </label>
                <label className="space-y-1">
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                    Подзаголовок (необязательно)
                  </span>
                  <input
                    type="text"
                    value={config.customSubtitle}
                    onChange={(e) => onChange({ customSubtitle: e.target.value })}
                    placeholder="Минимализм и скорость"
                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none"
                  />
                </label>
              </div>

              <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 space-y-2.5 text-xs">
                <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                  Элементы новой вкладки
                </div>
                {(
                  [
                    { key: 'showLogo', label: 'Показывать логотип Fires' },
                    { key: 'showClockWidget', label: 'Минималистичные часы и дата' },
                    { key: 'showHomeBookmarks', label: 'Быстрые сайты (Ярлыки)' },
                    { key: 'showAiSwitcher', label: 'Выбор нейросетей (Claude, Codeium, Studio AI...)' },
                    { key: 'showEngineSelector', label: 'Переключатель поисковых систем' },
                    { key: 'showExamples', label: 'Подсказки поисковых запросов' },
                    { key: 'showNews', label: 'Лента «Новости дня» внизу' },
                  ] as Array<{ key: keyof BrowserCustomizationConfig; label: string }>
                ).map((item) => (
                  <label
                    key={item.key}
                    className="flex items-center justify-between gap-3 py-1.5 cursor-pointer text-zinc-700 dark:text-zinc-200"
                  >
                    <span>{item.label}</span>
                    <input
                      type="checkbox"
                      checked={Boolean(config[item.key])}
                      onChange={(e) => onChange({ [item.key]: e.target.checked })}
                      className="w-4 h-4 accent-black dark:accent-zinc-100"
                    />
                  </label>
                ))}
              </div>
            </div>
          )}

          {section === 'engine' && (
            <div className="space-y-5">
              <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    Ядро FiresCore (Fires Engine 132.0)
                  </div>
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Изоляция контейнеров, защита от трекеров и быстрый веб-рендеринг с открытым кодом (MIT)
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onOpenAboutFires();
                    onClose();
                  }}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 whitespace-nowrap shrink-0 focus:outline-none"
                >
                  about:fires
                </button>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  Защита от отслеживания (Fires Shield ETP)
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: 'standard', label: 'Стандартная' },
                      { id: 'strict', label: 'Строгая' },
                      { id: 'off', label: 'Отключена' },
                    ] as Array<{ id: FiresEtpLevel; label: string }>
                  ).map((lvl) => (
                    <button
                      key={lvl.id}
                      type="button"
                      onClick={() => onChange({ etpLevel: lvl.id })}
                      className={`py-2 px-3 text-xs font-medium rounded-lg border transition-colors focus:outline-none ${
                        config.etpLevel === lvl.id
                          ? 'border-black bg-black text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-black'
                          : 'border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300'
                      }`}
                    >
                      {lvl.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 space-y-2.5 text-xs">
                {(
                  [
                    {
                      key: 'httpsOnly',
                      title: 'Режим «Только HTTPS» (HTTPS-Only)',
                      desc: 'Автоматически переводит HTTP-адреса в защищённый HTTPS',
                    },
                    {
                      key: 'doNotTrack',
                      title: 'Отправлять сигнал Do Not Track (DNT / GPC)',
                      desc: 'Запрос сайтам не передавать и не продавать данные визита',
                    },
                    {
                      key: 'isolateContainers',
                      title: 'Изоляция данных по контейнерам вкладок',
                      desc: 'Отдельные сессии для Личного, Работы, Банков и Покупок',
                    },
                    {
                      key: 'disableJavaScript',
                      title: 'Отключить JavaScript на прокси-страницах',
                      desc: 'Ускоряет загрузку и блокирует сторонние скрипты на сайтах',
                    },
                    {
                      key: 'blockImages',
                      title: 'Текстовый режим (скрывать изображения)',
                      desc: 'Экономия трафика и мгновенная отрисовка страниц',
                    },
                  ] as const
                ).map((t) => (
                  <label
                    key={t.key}
                    className="flex items-center justify-between gap-3 py-1 cursor-pointer text-zinc-700 dark:text-zinc-200"
                  >
                    <div>
                      <div className="font-medium">{t.title}</div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400">{t.desc}</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={Boolean(config[t.key])}
                      onChange={(e) => onChange({ [t.key]: e.target.checked })}
                      className="w-4 h-4 accent-black dark:accent-zinc-100 shrink-0"
                    />
                  </label>
                ))}
              </div>

              <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 space-y-3 text-xs">
                <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                  Профиль ядра и режим чтения
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { id: 'fires-desktop', label: 'Fires Desktop 132' },
                      { id: 'fires-mobile', label: 'Fires Android Mobile' },
                    ] as Array<{ id: FiresUserAgentMode; label: string }>
                  ).map((ua) => (
                    <button
                      key={ua.id}
                      type="button"
                      onClick={() => onChange({ uaMode: ua.id })}
                      className={`py-2 px-3 text-xs font-medium rounded-lg border transition-colors focus:outline-none ${
                        config.uaMode === ua.id
                          ? 'border-black bg-black text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-black'
                          : 'border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300'
                      }`}
                    >
                      {ua.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <label className="space-y-1">
                    <span className="text-zinc-600 dark:text-zinc-300">Шрифт чтения</span>
                    <select
                      value={config.readerFont}
                      onChange={(e) =>
                        onChange({ readerFont: e.target.value as BrowserFontFamily })
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none"
                    >
                      <option value="sans">Sans-serif</option>
                      <option value="serif">Книжный Serif</option>
                      <option value="mono">Моноширинный</option>
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="text-zinc-600 dark:text-zinc-300">
                      Размер ({config.readerSize} px)
                    </span>
                    <input
                      type="range"
                      min={14}
                      max={20}
                      step={1}
                      value={config.readerSize}
                      onChange={(e) => onChange({ readerSize: Number(e.target.value) })}
                      className="w-full accent-black dark:accent-zinc-100 mt-1"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          {section === 'bookmarks' && (
            <div className="space-y-4">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!bmTitle.trim() || !bmUrl.trim()) return;
                  onAddBookmark(bmTitle.trim(), bmUrl.trim());
                  setBmTitle('');
                  setBmUrl('');
                }}
                className="space-y-2"
              >
                <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  Добавить сайт в закладки
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    required
                    value={bmTitle}
                    onChange={(e) => setBmTitle(e.target.value)}
                    placeholder="Название (напр. GitHub)"
                    className="px-3 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none"
                  />
                  <input
                    type="text"
                    required
                    value={bmUrl}
                    onChange={(e) => setBmUrl(e.target.value)}
                    placeholder="Адрес (https://...)"
                    className="px-3 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg bg-black dark:bg-zinc-100 text-white dark:text-black focus:outline-none"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Добавить закладку</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => importFileRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:outline-none"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Импорт HTML / JSON закладок</span>
                  </button>
                </div>
              </form>

              <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 space-y-2">
                <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  Сохранённые закладки ({config.bookmarks.length})
                </div>
                {config.bookmarks.length === 0 ? (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Закладок пока нет. Нажмите на звёздочку в адресной строке или импортируйте файл.
                  </p>
                ) : (
                  <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {config.bookmarks.map((bm) => (
                      <li
                        key={bm.id}
                        className="py-2.5 flex items-center justify-between gap-2 text-xs"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            onNavigateUrl(bm.url);
                            onClose();
                          }}
                          className="min-w-0 flex-1 text-left hover:underline focus:outline-none"
                        >
                          <div className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                            {bm.title}
                          </div>
                          <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                            {bm.url}
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemoveBookmark(bm.id)}
                          aria-label={`Удалить ${bm.title}`}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 shrink-0 focus:outline-none"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {section === 'history' && (
            <div className="space-y-5">
              {closedTabs.length > 0 && onRestoreClosedTab && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    Недавно закрытые вкладки (Ctrl+Shift+T)
                  </div>
                  <div className="space-y-1">
                    {closedTabs.slice(0, 5).map((ct) => (
                      <div
                        key={ct.id}
                        className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex items-center justify-between gap-2 text-xs"
                      >
                        <span className="truncate text-zinc-800 dark:text-zinc-200">
                          {ct.title}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            onRestoreClosedTab(ct.id);
                            onClose();
                          }}
                          className="px-2.5 py-1 rounded bg-black dark:bg-zinc-100 text-white dark:text-black text-[11px] font-medium shrink-0"
                        >
                          Восстановить
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <input
                    type="text"
                    value={historyQuery}
                    onChange={(e) => setHistoryQuery(e.target.value)}
                    placeholder="Поиск по истории..."
                    className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none"
                  />
                  {history.length > 0 && (
                    <button
                      type="button"
                      onClick={onClearHistory}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 shrink-0 focus:outline-none"
                    >
                      Очистить
                    </button>
                  )}
                </div>

                {filteredHistory.length === 0 ? (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 py-4">
                    Журнал посещений пуст. Открытые сайты и поисковые запросы появятся здесь автоматически.
                  </p>
                ) : (
                  <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {filteredHistory.map((item) => (
                      <li key={item.id} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => {
                            onNavigateUrl(item.url);
                            onClose();
                          }}
                          className="min-w-0 flex-1 text-left group focus:outline-none"
                        >
                          <div className="font-medium text-zinc-900 dark:text-zinc-100 truncate group-hover:underline">
                            {item.title}
                          </div>
                          <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate flex items-center gap-1.5">
                            <span className="font-mono tabular-nums">
                              {new Date(item.visitedAt).toLocaleTimeString('ru-RU', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                            <span>·</span>
                            <span className="truncate">{item.url}</span>
                          </div>
                        </button>
                        <ExternalLink className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {section === 'shortcuts' && (
            <div className="space-y-3 text-xs">
              <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                Горячие клавиши браузера Fires
              </div>
              <div className="divide-y divide-zinc-200 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-xl">
                {[
                  { keys: 'Ctrl + T', action: 'Открыть новую вкладку' },
                  { keys: 'Ctrl + W', action: 'Закрыть активную вкладку' },
                  { keys: 'Ctrl + Shift + T', action: 'Восстановить последнюю закрытую вкладку' },
                  { keys: 'Ctrl + Shift + P', action: 'Открыть приватную вкладку (без записи истории)' },
                  { keys: 'Ctrl + F', action: 'Открыть поиск по странице' },
                  { keys: 'Ctrl + J', action: 'Открыть Единый загрузчик (GitHub + Google Play)' },
                  { keys: 'Ctrl + L', action: 'Выделить адресную строку' },
                  { keys: 'Ctrl + D', action: 'Добавить/убрать текущий сайт в закладках' },
                  { keys: 'F12', action: 'Открыть консоль разработчика (Fires DevTools)' },
                ].map((row) => (
                  <div
                    key={row.keys}
                    className="px-4 py-2.5 flex items-center justify-between gap-4"
                  >
                    <span className="text-zinc-700 dark:text-zinc-200">{row.action}</span>
                    <kbd className="px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 font-mono text-[11px] text-zinc-900 dark:text-zinc-100 shrink-0">
                      {row.keys}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions: Export / Import / Open Source / Reset */}
        <div className="px-5 py-3.5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExportJson}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:outline-none"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Экспорт</span>
            </button>
            <input
              ref={importFileRef}
              type="file"
              accept=".json,.html,.htm,application/json,text/html,text/plain"
              className="hidden"
              onChange={handleImportFile}
            />
            <button
              type="button"
              onClick={() => importFileRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:outline-none"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Импорт файла</span>
            </button>

            {onOpenSourceCode && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSourceCode();
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:outline-none"
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>Исходный код (MIT)</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:outline-none"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Сбросить</span>
          </button>
        </div>
      </div>
    </div>
  );
};
