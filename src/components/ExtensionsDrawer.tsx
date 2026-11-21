import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Download,
  ExternalLink,
  HardDriveDownload,
  Monitor,
  Puzzle,
  RefreshCw,
  Search,
  Smartphone,
  Tablet,
  X,
} from 'lucide-react';
import {
  BrowserExtensionItem,
  EXTENSION_SOURCE_LABELS,
  ExtensionPlatform,
  ExtensionSourceStore,
} from '../types/extensions';

interface ExtensionStoreMeta {
  id: ExtensionSourceStore;
  label: string;
  description: string;
}

interface ExtensionsDrawerProps {
  isOpen: boolean;
  installedIds: string[];
  extensions: BrowserExtensionItem[];
  loading: boolean;
  onRefreshCatalog: () => void;
  onToggleInstall: (ext: BrowserExtensionItem) => void;
  onQueueDownload: (ext: BrowserExtensionItem) => void;
  onClose: () => void;
}

const PLATFORM_LABELS: Record<ExtensionPlatform, string> = {
  mobile: 'Телефоны',
  tablet: 'Планшеты',
  desktop: 'ПК',
};

export const ExtensionsDrawer: React.FC<ExtensionsDrawerProps> = ({
  isOpen,
  installedIds,
  extensions,
  loading,
  onRefreshCatalog,
  onToggleInstall,
  onQueueDownload,
  onClose,
}) => {
  const [search, setSearch] = useState('');
  const [platformFilter, setPlatformFilter] = useState<'all' | ExtensionPlatform>('all');
  const [storeFilter, setStoreFilter] = useState<'all' | ExtensionSourceStore>('all');
  const [storesMeta, setStoresMeta] = useState<ExtensionStoreMeta[]>([]);
  const [downloadedNotice, setDownloadedNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    fetch('/api/extensions/catalog')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { stores?: ExtensionStoreMeta[] } | null) => {
        if (!cancelled && data && Array.isArray(data.stores)) {
          setStoresMeta(data.stores);
        }
      })
      .catch(() => {
        // fallback labels already available
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return extensions.filter((ext) => {
      if (platformFilter !== 'all' && !ext.platforms.includes(platformFilter)) {
        return false;
      }
      if (storeFilter !== 'all' && ext.sourceStore !== storeFilter) {
        return false;
      }
      if (!q) return true;
      return (
        ext.name.toLowerCase().includes(q) ||
        ext.summary.toLowerCase().includes(q) ||
        ext.author.toLowerCase().includes(q) ||
        ext.sourceLabel.toLowerCase().includes(q)
      );
    });
  }, [extensions, platformFilter, search, storeFilter]);

  if (!isOpen) return null;

  const handleDirectDownload = (ext: BrowserExtensionItem) => {
    const a = document.createElement('a');
    a.href = `/api/extensions/download/${encodeURIComponent(ext.id)}`;
    a.download = ext.fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setDownloadedNotice(`Пакет ${ext.fileName} (${ext.sourceLabel}) скачивается.`);
  };

  return (
    <div
      role="dialog"
      aria-label="Расширения браузера Fires для телефонов и планшетов"
      className="fixed inset-0 z-50 flex justify-end bg-black/45 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl h-full bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 sm:px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-black dark:bg-white text-white dark:text-black flex items-center justify-center shrink-0">
              <Puzzle className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                Расширения Fires (Телефон и Планшет)
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                Установка в браузер или скачивание .xpi / .zip из проверенных каталогов
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onRefreshCatalog}
              aria-label="Обновить каталог расширений"
              className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus:outline-none"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Закрыть расширения"
              className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus:outline-none"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filters & Sources */}
        <div className="px-4 sm:px-5 py-3.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/60 space-y-3 shrink-0">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
            <Search className="w-4 h-4 text-zinc-400 shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Найти расширение (Википедия, GitHub, мобильный, темная тема...)"
              className="w-full bg-transparent text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none"
            />
          </div>

          {/* Platform selector */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-200/70 dark:bg-zinc-800 overflow-x-auto max-w-full">
              {(
                [
                  { id: 'all', label: 'Все устройства', icon: null },
                  { id: 'mobile', label: 'Телефоны', icon: Smartphone },
                  { id: 'tablet', label: 'Планшеты', icon: Tablet },
                  { id: 'desktop', label: 'ПК', icon: Monitor },
                ] as Array<{
                  id: 'all' | ExtensionPlatform;
                  label: string;
                  icon: React.ComponentType<{ className?: string }> | null;
                }>
              ).map((item) => {
                const active = platformFilter === item.id;
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setPlatformFilter(item.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[34px] text-xs font-medium rounded-lg whitespace-nowrap shrink-0 transition-colors focus:outline-none ${
                      active
                        ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-white shadow-xs'
                        : 'text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    {Icon && <Icon className="w-3.5 h-3.5" />}
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="text-xs text-zinc-500 dark:text-zinc-400 font-mono tabular-nums">
              Активно: {installedIds.length} / {extensions.length}
            </div>
          </div>

          {/* External & Internal Store Catalog Filter */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
            <button
              type="button"
              onClick={() => setStoreFilter('all')}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border whitespace-nowrap shrink-0 transition-colors focus:outline-none ${
                storeFilter === 'all'
                  ? 'border-black bg-black text-white dark:border-white dark:bg-white dark:text-black'
                  : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              Все источники
            </button>
            {(
              storesMeta.length > 0
                ? storesMeta
                : (Object.keys(EXTENSION_SOURCE_LABELS) as ExtensionSourceStore[]).map((id) => ({
                    id,
                    label: EXTENSION_SOURCE_LABELS[id],
                    description: '',
                  }))
            ).map((st) => {
              const active = storeFilter === st.id;
              return (
                <button
                  key={st.id}
                  type="button"
                  title={st.description || st.label}
                  onClick={() => setStoreFilter(st.id)}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border whitespace-nowrap shrink-0 transition-colors focus:outline-none ${
                    active
                      ? 'border-black bg-black text-white dark:border-white dark:bg-white dark:text-black'
                      : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  {st.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Notice banner */}
        {downloadedNotice && (
          <div className="px-4 sm:px-5 py-2.5 bg-emerald-50 dark:bg-emerald-950/40 border-b border-emerald-200 dark:border-emerald-900/60 flex items-center justify-between gap-2 text-xs text-emerald-900 dark:text-emerald-200 shrink-0">
            <span>{downloadedNotice}</span>
            <button
              type="button"
              onClick={() => setDownloadedNotice(null)}
              aria-label="Скрыть уведомление"
              className="p-1 hover:opacity-70 focus:outline-none"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Extensions List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          {loading && extensions.length === 0 ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-28 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 animate-pulse"
                />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                По выбранным фильтрам расширения не найдены
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setPlatformFilter('all');
                  setStoreFilter('all');
                }}
                className="px-3.5 py-2 text-xs font-medium rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:outline-none"
              >
                Сбросить фильтры
              </button>
            </div>
          ) : (
            filtered.map((ext) => {
              const isInstalled = installedIds.includes(ext.id);
              return (
                <article
                  key={ext.id}
                  className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/40 p-4 space-y-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                          {ext.name}
                        </h3>
                        {isInstalled && (
                          <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                            · Активно в Fires
                          </span>
                        )}
                      </div>

                      {/* Clean unboxed typographic metadata */}
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
                        <span>{ext.sourceLabel}</span>
                        <span aria-hidden="true">·</span>
                        <span>v{ext.version}</span>
                        <span aria-hidden="true">·</span>
                        <span>{ext.packageFormat.toUpperCase()}</span>
                        <span aria-hidden="true">·</span>
                        <span>{ext.sizeLabel}</span>
                        <span aria-hidden="true">·</span>
                        <span>{ext.platforms.map((p) => PLATFORM_LABELS[p]).join(', ')}</span>
                      </div>
                    </div>

                    <a
                      href={ext.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white underline-offset-2 hover:underline shrink-0"
                    >
                      <span>Каталог</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  <p className="text-xs sm:text-[13px] text-zinc-600 dark:text-zinc-300 leading-relaxed">
                    {ext.summary}
                  </p>

                  <div className="text-[11px] text-zinc-400 dark:text-zinc-500 font-mono truncate">
                    Автор: {ext.author} · Права: {ext.permissions.join(', ')}
                  </div>

                  {/* Actions */}
                  <div className="pt-1 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onToggleInstall(ext)}
                      className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[40px] text-xs font-medium rounded-xl transition-colors whitespace-nowrap focus:outline-none ${
                        isInstalled
                          ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                          : 'bg-black text-white dark:bg-white dark:text-black hover:opacity-90'
                      }`}
                    >
                      {isInstalled ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Включено в Fires</span>
                        </>
                      ) : (
                        <>
                          <Puzzle className="w-3.5 h-3.5" />
                          <span>Включить в Fires</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDirectDownload(ext)}
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[40px] text-xs font-medium rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors whitespace-nowrap focus:outline-none"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Скачать .{ext.packageFormat}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onQueueDownload(ext);
                        setDownloadedNotice(`«${ext.fileName}» добавлен в Загрузчик Fires.`);
                      }}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 min-h-[40px] text-xs font-medium rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors whitespace-nowrap focus:outline-none"
                    >
                      <HardDriveDownload className="w-3.5 h-3.5" />
                      <span>В Загрузчик Fires</span>
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
