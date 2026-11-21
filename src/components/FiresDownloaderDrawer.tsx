import React, { useState } from 'react';
import {
  X,
  Download,
  Pause,
  Play,
  Trash2,
  RotateCw,
  FolderDown,
  Github,
  Smartphone,
  Link2,
  Search,
  ShieldCheck,
  HardDrive,
  ExternalLink,
  Gauge,
} from 'lucide-react';
import { FiresLogo } from './FiresLogo';

export type DownloadSourceType = 'github' | 'google-play' | 'direct';
export type DownloadPriority = 'high' | 'normal' | 'low';
export type DownloadStatus =
  | 'queued'
  | 'downloading'
  | 'paused'
  | 'completed'
  | 'error'
  | 'cancelled';

export interface FiresDownloadItem {
  id: string;
  name: string;
  url: string;
  source: DownloadSourceType;
  packageOrRepo?: string;
  status: DownloadStatus;
  priority: DownloadPriority;
  receivedBytes: number;
  totalBytes: number;
  speedBps: number;
  mimeType: string;
  error?: string;
  createdAt: string;
  verifiedSafe: boolean;
  blob?: Blob;
}

interface GitHubRepoResult {
  fullName: string;
  description: string;
  stars: number;
  language: string;
  htmlUrl: string;
  branch: string;
  zipUrl?: string;
}

interface GitHubAsset {
  id: string;
  name: string;
  size: number;
  downloadUrl: string;
  kind: string;
}

interface GooglePlayAppInfo {
  packageId: string;
  title: string;
  description?: string;
  icon?: string;
  playUrl: string;
  directApkUrl?: string | null;
  apkVersionCode?: number | null;
}

interface FiresDownloaderDrawerProps {
  isOpen: boolean;
  downloads: FiresDownloadItem[];
  speedLimitKbps: number;
  maxConcurrent: number;
  canSaveToCloud: boolean;
  onChangeSpeedLimit: (kbps: number) => void;
  onChangeMaxConcurrent: (n: number) => void;
  onStartDownload: (opts: {
    name: string;
    url: string;
    source: DownloadSourceType;
    packageOrRepo?: string;
    priority?: DownloadPriority;
    syntheticJsonPayload?: string;
  }) => void;
  onPauseDownload: (id: string) => void;
  onResumeDownload: (id: string) => void;
  onCancelDownload: (id: string) => void;
  onRemoveDownload: (id: string) => void;
  onSetPriority: (id: string, priority: DownloadPriority) => void;
  onSaveFileToDisk: (item: FiresDownloadItem) => void;
  onSaveToCloud: (item: FiresDownloadItem) => Promise<void>;
  onPauseAll: () => void;
  onClearCompleted: () => void;
  onOpenUrlInTab: (url: string) => void;
  onClose: () => void;
}

export function formatBytesRu(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 Б';
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} ГБ`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${bytes} Б`;
}

export const FiresDownloaderDrawer: React.FC<FiresDownloaderDrawerProps> = ({
  isOpen,
  downloads,
  speedLimitKbps,
  maxConcurrent,
  canSaveToCloud,
  onChangeSpeedLimit,
  onChangeMaxConcurrent,
  onStartDownload,
  onPauseDownload,
  onResumeDownload,
  onCancelDownload,
  onRemoveDownload,
  onSetPriority,
  onSaveFileToDisk,
  onSaveToCloud,
  onPauseAll,
  onClearCompleted,
  onOpenUrlInTab,
  onClose,
}) => {
  const [sourceTab, setSourceTab] = useState<'queue' | 'github' | 'google-play' | 'direct'>('github');

  // GitHub state
  const [ghInput, setGhInput] = useState('');
  const [ghLoading, setGhLoading] = useState(false);
  const [ghError, setGhError] = useState<string | null>(null);
  const [ghRepo, setGhRepo] = useState<GitHubRepoResult | null>(null);
  const [ghAssets, setGhAssets] = useState<GitHubAsset[]>([]);
  const [ghSearchRepos, setGhSearchRepos] = useState<GitHubRepoResult[]>([]);

  // Google Play state
  const [gpInput, setGpInput] = useState('');
  const [gpLoading, setGpLoading] = useState(false);
  const [gpError, setGpError] = useState<string | null>(null);
  const [gpApp, setGpApp] = useState<GooglePlayAppInfo | null>(null);
  const [gpSearchApps, setGpSearchApps] = useState<GooglePlayAppInfo[]>([]);

  // Direct link state
  const [directUrl, setDirectUrl] = useState('');
  const [directName, setDirectName] = useState('');
  const [directPriority, setDirectPriority] = useState<DownloadPriority>('normal');
  const [cloudBusyId, setCloudBusyId] = useState<string | null>(null);

  if (!isOpen) return null;

  const inspectGitHub = async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setGhLoading(true);
    setGhError(null);
    setGhRepo(null);
    setGhAssets([]);
    setGhSearchRepos([]);
    try {
      const resp = await fetch(`/api/downloader/github?q=${encodeURIComponent(trimmed)}`);
      const json = (await resp.json()) as {
        mode?: 'repo' | 'search';
        repo?: GitHubRepoResult;
        assets?: GitHubAsset[];
        repos?: GitHubRepoResult[];
        error?: string;
      };
      if (!resp.ok || json.error) {
        setGhError(json.error || 'Не удалось получить данные из GitHub.');
        return;
      }
      if (json.mode === 'repo' && json.repo) {
        setGhRepo(json.repo);
        setGhAssets(Array.isArray(json.assets) ? json.assets : []);
      } else {
        setGhSearchRepos(Array.isArray(json.repos) ? json.repos : []);
      }
    } catch {
      setGhError('Ошибка соединения с GitHub.');
    } finally {
      setGhLoading(false);
    }
  };

  const inspectGooglePlay = async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setGpLoading(true);
    setGpError(null);
    setGpApp(null);
    setGpSearchApps([]);
    try {
      const resp = await fetch(`/api/downloader/google-play?q=${encodeURIComponent(trimmed)}`);
      const json = (await resp.json()) as {
        mode?: 'package' | 'search';
        app?: GooglePlayAppInfo;
        apps?: GooglePlayAppInfo[];
        error?: string;
      };
      if (!resp.ok || json.error) {
        setGpError(json.error || 'Не удалось получить данные из Google Play.');
        return;
      }
      if (json.mode === 'package' && json.app) {
        setGpApp(json.app);
      } else {
        setGpSearchApps(Array.isArray(json.apps) ? json.apps : []);
      }
    } catch {
      setGpError('Ошибка соединения с Google Play.');
    } finally {
      setGpLoading(false);
    }
  };

  const activeCount = downloads.filter(
    (d) => d.status === 'downloading' || d.status === 'queued'
  ).length;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-label="Единый загрузчик Fires (GitHub и Google Play)"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <FiresLogo size={28} className="shrink-0" />
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 truncate">
                Единый загрузчик Fires · GitHub & Google Play
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                Полный контроль потоков, скорости, пауз, приоритета и загрузки из GitHub / Google Play
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть загрузчик"
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0 focus:outline-none"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Global Control Toolbar (Bandwidth Limit + Max Concurrent + Pause All) */}
        <div className="px-5 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
              <Gauge className="w-3.5 h-3.5 text-slate-500" />
              <span>Лимит скорости:</span>
              <select
                value={speedLimitKbps}
                onChange={(e) => onChangeSpeedLimit(Number(e.target.value))}
                className="px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono focus:outline-none"
              >
                <option value={0}>Без лимита</option>
                <option value={5120}>5 МБ/с</option>
                <option value={1024}>1 МБ/с</option>
                <option value={256}>256 КБ/с</option>
              </select>
            </label>

            <label className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
              <span>Потоки:</span>
              <select
                value={maxConcurrent}
                onChange={(e) => onChangeMaxConcurrent(Number(e.target.value))}
                className="px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono focus:outline-none"
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex items-center gap-1.5">
            {activeCount > 0 && (
              <button
                type="button"
                onClick={onPauseAll}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none"
              >
                <Pause className="w-3 h-3" />
                <span>Пауза всем</span>
              </button>
            )}
            {downloads.some(
              (d) =>
                d.status === 'completed' ||
                d.status === 'cancelled' ||
                d.status === 'error'
            ) && (
              <button
                type="button"
                onClick={onClearCompleted}
                className="px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none"
              >
                Очистить
              </button>
            )}
          </div>
        </div>

        {/* Source Switcher Tabs */}
        <div className="px-5 py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center gap-1 overflow-x-auto shrink-0">
          {(
            [
              { id: 'github', label: 'GitHub', icon: <Github className="w-3.5 h-3.5" /> },
              { id: 'google-play', label: 'Google Play', icon: <Smartphone className="w-3.5 h-3.5" /> },
              { id: 'direct', label: 'Прямая ссылка', icon: <Link2 className="w-3.5 h-3.5" /> },
              {
                id: 'queue',
                label: `Диспетчер (${downloads.length})`,
                icon: <FolderDown className="w-3.5 h-3.5" />,
              },
            ] as const
          ).map((t) => {
            const active = sourceTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setSourceTab(t.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 focus:outline-none ${
                  active
                    ? 'bg-black text-white dark:bg-slate-100 dark:text-slate-900'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {t.icon}
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* GITHUB SOURCE */}
          {sourceTab === 'github' && (
            <div className="space-y-4">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  inspectGitHub(ghInput);
                }}
                className="flex items-center gap-2"
              >
                <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950">
                  <Github className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    value={ghInput}
                    onChange={(e) => setGhInput(e.target.value)}
                    placeholder="Ссылка GitHub, owner/repo или название проекта..."
                    className="w-full bg-transparent text-xs text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={ghLoading || !ghInput.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-black dark:bg-slate-100 text-white dark:text-slate-900 disabled:opacity-40 whitespace-nowrap focus:outline-none"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>{ghLoading ? 'Поиск...' : 'Найти'}</span>
                </button>
              </form>

              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="text-slate-400">Быстро:</span>
                {['telegramdesktop/tdesktop', 'neovim/neovim', 'termux/termux-app'].map((sample) => (
                  <button
                    key={sample}
                    type="button"
                    onClick={() => {
                      setGhInput(sample);
                      inspectGitHub(sample);
                    }}
                    className="px-2 py-1 rounded border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    {sample}
                  </button>
                ))}
              </div>

              {ghError && (
                <div className="p-3 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 text-xs text-red-700 dark:text-red-300">
                  {ghError}
                </div>
              )}

              {ghRepo && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                        {ghRepo.fullName}
                      </div>
                      {ghRepo.description && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {ghRepo.description}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onOpenUrlInTab(ghRepo.htmlUrl);
                        onClose();
                      }}
                      className="text-xs text-slate-600 dark:text-slate-300 hover:underline inline-flex items-center gap-1 shrink-0"
                    >
                      <span>Открыть</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                    {ghAssets.map((asset) => (
                      <div
                        key={asset.id}
                        className="px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
                            {asset.name}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {asset.kind}
                            {asset.size > 0 && ` · ${formatBytesRu(asset.size)}`}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            onStartDownload({
                              name: asset.name,
                              url: asset.downloadUrl,
                              source: 'github',
                              packageOrRepo: ghRepo.fullName,
                              priority: 'high',
                            });
                            setSourceTab('queue');
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-black dark:bg-slate-100 text-white dark:text-slate-900 shrink-0 focus:outline-none"
                        >
                          <Download className="w-3 h-3" />
                          <span>Скачать</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {ghSearchRepos.length > 0 && (
                <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl">
                  {ghSearchRepos.map((r) => (
                    <div
                      key={r.fullName}
                      className="p-3.5 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {r.fullName}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                          {r.description || 'Репозиторий GitHub'}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setGhInput(r.fullName);
                            inspectGitHub(r.fullName);
                          }}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          Релизы
                        </button>
                        {r.zipUrl && (
                          <button
                            type="button"
                            onClick={() => {
                              onStartDownload({
                                name: `${r.fullName.replace('/', '-')}.zip`,
                                url: r.zipUrl!,
                                source: 'github',
                                packageOrRepo: r.fullName,
                              });
                              setSourceTab('queue');
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-black dark:bg-slate-100 text-white dark:text-slate-900"
                          >
                            <Download className="w-3 h-3" />
                            <span>ZIP</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* GOOGLE PLAY SOURCE */}
          {sourceTab === 'google-play' && (
            <div className="space-y-4">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  inspectGooglePlay(gpInput);
                }}
                className="flex items-center gap-2"
              >
                <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950">
                  <Smartphone className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    value={gpInput}
                    onChange={(e) => setGpInput(e.target.value)}
                    placeholder="Ссылка Google Play, package ID (org.telegram.messenger) или поиск..."
                    className="w-full bg-transparent text-xs text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={gpLoading || !gpInput.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-black dark:bg-slate-100 text-white dark:text-slate-900 disabled:opacity-40 whitespace-nowrap focus:outline-none"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>{gpLoading ? 'Поиск...' : 'Найти'}</span>
                </button>
              </form>

              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="text-slate-400">Популярное:</span>
                {[
                  { label: 'Telegram', q: 'org.telegram.messenger' },
                  { label: 'Termux', q: 'com.termux' },
                  { label: 'VLC', q: 'org.videolan.vlc' },
                  { label: 'WhatsApp', q: 'com.whatsapp' },
                ].map((sample) => (
                  <button
                    key={sample.q}
                    type="button"
                    onClick={() => {
                      setGpInput(sample.q);
                      inspectGooglePlay(sample.q);
                    }}
                    className="px-2 py-1 rounded border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    {sample.label}
                  </button>
                ))}
              </div>

              {gpError && (
                <div className="p-3 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 text-xs text-red-700 dark:text-red-300">
                  {gpError}
                </div>
              )}

              {gpApp && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    {gpApp.icon ? (
                      <img
                        src={gpApp.icon}
                        alt={gpApp.title}
                        className="w-12 h-12 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-black text-white flex items-center justify-center shrink-0">
                        <Smartphone className="w-5 h-5" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {gpApp.title}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                        {gpApp.packageId}
                      </div>
                      {gpApp.description && (
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 line-clamp-2">
                          {gpApp.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {gpApp.directApkUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          onStartDownload({
                            name: `${gpApp.packageId}.apk`,
                            url: gpApp.directApkUrl!,
                            source: 'google-play',
                            packageOrRepo: gpApp.packageId,
                            priority: 'high',
                          });
                          setSourceTab('queue');
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg bg-black dark:bg-slate-100 text-white dark:text-slate-900 focus:outline-none"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Скачать APK</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        onStartDownload({
                          name: `${gpApp.packageId}.fires-play.json`,
                          url: gpApp.playUrl,
                          source: 'google-play',
                          packageOrRepo: gpApp.packageId,
                          syntheticJsonPayload: JSON.stringify(
                            {
                              packageId: gpApp.packageId,
                              title: gpApp.title,
                              description: gpApp.description,
                              playStoreUrl: gpApp.playUrl,
                              directApkUrl: gpApp.directApkUrl,
                              downloadedVia: 'Fires Unified Downloader',
                              savedAt: new Date().toISOString(),
                            },
                            null,
                            2
                          ),
                        });
                        setSourceTab('queue');
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Скачать карточку пакета Google Play</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onOpenUrlInTab(gpApp.playUrl);
                        onClose();
                      }}
                      className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <span>Страница в Google Play</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}

              {gpSearchApps.length > 0 && (
                <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl">
                  {gpSearchApps.map((app) => (
                    <div
                      key={app.packageId}
                      className="p-3 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-mono font-medium text-slate-900 dark:text-slate-100 truncate">
                          {app.packageId}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setGpInput(app.packageId);
                          inspectGooglePlay(app.packageId);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-black dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-medium shrink-0"
                      >
                        Открыть
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* DIRECT LINK SOURCE */}
          {sourceTab === 'direct' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!directUrl.trim()) return;
                const cleanUrl = /^https?:\/\//i.test(directUrl.trim())
                  ? directUrl.trim()
                  : `https://${directUrl.trim()}`;
                const guessedName =
                  directName.trim() ||
                  cleanUrl.split('/').filter(Boolean).pop()?.split('?')[0] ||
                  'download-file.bin';
                onStartDownload({
                  name: guessedName,
                  url: cleanUrl,
                  source: 'direct',
                  priority: directPriority,
                });
                setDirectUrl('');
                setDirectName('');
                setSourceTab('queue');
              }}
              className="space-y-3"
            >
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  Прямая ссылка на файл, архив или установщик
                </label>
                <input
                  type="text"
                  required
                  value={directUrl}
                  onChange={(e) => setDirectUrl(e.target.value)}
                  placeholder="https://example.com/archive.zip"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="space-y-1 text-xs">
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    Имя файла (необязательно)
                  </span>
                  <input
                    type="text"
                    value={directName}
                    onChange={(e) => setDirectName(e.target.value)}
                    placeholder="my-package.zip"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </label>
                <label className="space-y-1 text-xs">
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    Приоритет загрузки
                  </span>
                  <select
                    value={directPriority}
                    onChange={(e) => setDirectPriority(e.target.value as DownloadPriority)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none"
                  >
                    <option value="high">Высокий</option>
                    <option value="normal">Обычный</option>
                    <option value="low">Низкий</option>
                  </select>
                </label>
              </div>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-black dark:bg-slate-100 text-white dark:text-slate-900 focus:outline-none"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Начать контролируемую загрузку</span>
              </button>
            </form>
          )}

          {/* DOWNLOAD QUEUE MANAGER */}
          <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                Очередь и контроль загрузок ({downloads.length})
              </div>
              <span className="text-[11px] text-slate-400">
                Проверка безопасности Fires Shield активна
              </span>
            </div>

            {downloads.length === 0 ? (
              <div className="p-6 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500 dark:text-slate-400">
                Список загрузок пуст. Найдите релиз на GitHub, приложение в Google Play или вставьте прямую ссылку выше.
              </div>
            ) : (
              <div className="space-y-2.5">
                {downloads.map((item) => {
                  const pct =
                    item.totalBytes > 0
                      ? Math.min(100, Math.round((item.receivedBytes / item.totalBytes) * 100))
                      : item.status === 'completed'
                      ? 100
                      : 0;

                  return (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            {item.source === 'github' ? (
                              <Github className="w-3.5 h-3.5 text-slate-700 dark:text-slate-300 shrink-0" />
                            ) : item.source === 'google-play' ? (
                              <Smartphone className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            ) : (
                              <Link2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            )}
                            <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                              {item.name}
                            </span>
                            {item.verifiedSafe && (
                              <span
                                title="Проверено Fires Shield"
                                className="inline-flex items-center gap-0.5 text-[10px] text-emerald-600 dark:text-emerald-400 shrink-0"
                              >
                                <ShieldCheck className="w-3 h-3" />
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-0.5 flex flex-wrap items-center gap-2">
                            <span>
                              {item.status === 'downloading'
                                ? 'Загрузка'
                                : item.status === 'paused'
                                ? 'На паузе'
                                : item.status === 'queued'
                                ? 'В очереди'
                                : item.status === 'completed'
                                ? 'Готово'
                                : item.status === 'cancelled'
                                ? 'Отменено'
                                : 'Ошибка'}
                            </span>
                            <span>·</span>
                            <span>
                              {formatBytesRu(item.receivedBytes)}
                              {item.totalBytes > 0 ? ` / ${formatBytesRu(item.totalBytes)}` : ''}
                            </span>
                            {item.status === 'downloading' && item.speedBps > 0 && (
                              <>
                                <span>·</span>
                                <span>{formatBytesRu(item.speedBps)}/с</span>
                              </>
                            )}
                          </div>
                          {item.error && (
                            <div className="text-[11px] text-red-600 dark:text-red-400 mt-1">
                              {item.error}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <select
                            aria-label={`Приоритет ${item.name}`}
                            value={item.priority}
                            onChange={(e) =>
                              onSetPriority(item.id, e.target.value as DownloadPriority)
                            }
                            className="px-1.5 py-1 text-[11px] rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-200 focus:outline-none"
                          >
                            <option value="high">Высок.</option>
                            <option value="normal">Обыч.</option>
                            <option value="low">Низк.</option>
                          </select>

                          {item.status === 'downloading' && (
                            <button
                              type="button"
                              onClick={() => onPauseDownload(item.id)}
                              title="Пауза"
                              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                              <Pause className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {(item.status === 'paused' ||
                            item.status === 'error' ||
                            item.status === 'cancelled') && (
                            <button
                              type="button"
                              onClick={() => onResumeDownload(item.id)}
                              title="Продолжить / Повторить"
                              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                              {item.status === 'paused' ? (
                                <Play className="w-3.5 h-3.5" />
                              ) : (
                                <RotateCw className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}

                          {item.status === 'completed' && item.blob && (
                            <>
                              <button
                                type="button"
                                onClick={() => onSaveFileToDisk(item)}
                                title="Сохранить файл на устройство"
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-lg bg-black dark:bg-slate-100 text-white dark:text-slate-900"
                              >
                                <Download className="w-3 h-3" />
                                <span>На диск</span>
                              </button>
                              {canSaveToCloud && item.blob.size <= 9 * 1024 * 1024 && (
                                <button
                                  type="button"
                                  disabled={cloudBusyId === item.id}
                                  onClick={async () => {
                                    setCloudBusyId(item.id);
                                    try {
                                      await onSaveToCloud(item);
                                    } finally {
                                      setCloudBusyId(null);
                                    }
                                  }}
                                  title="Сохранить в Облако 1 ТБ"
                                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
                                >
                                  <HardDrive className="w-3 h-3" />
                                  <span>{cloudBusyId === item.id ? '...' : 'Облако'}</span>
                                </button>
                              )}
                            </>
                          )}

                          {(item.status === 'downloading' || item.status === 'queued') && (
                            <button
                              type="button"
                              onClick={() => onCancelDownload(item.id)}
                              title="Отменить"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {item.status !== 'downloading' && (
                            <button
                              type="button"
                              onClick={() => onRemoveDownload(item.id)}
                              title="Удалить из списка"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {(item.status === 'downloading' ||
                        item.status === 'paused' ||
                        item.status === 'completed') && (
                        <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              item.status === 'completed'
                                ? 'bg-emerald-600 dark:bg-emerald-500'
                                : item.status === 'paused'
                                ? 'bg-amber-500'
                                : 'bg-black dark:bg-slate-100'
                            }`}
                            style={{
                              width:
                                item.status === 'completed'
                                  ? '100%'
                                  : item.totalBytes > 0
                                  ? `${pct}%`
                                  : '45%',
                            }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
