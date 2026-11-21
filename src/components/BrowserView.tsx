import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  RotateCw,
  Home,
  Plus,
  X,
  Search,
  FilePlus,
  ExternalLink,
  Wifi,
  WifiOff,
  BookOpen,
  Monitor,
  Newspaper,
  Shield,
  ShieldCheck,
  Crown,
  MessageSquare,
  HardDrive,
  Send,
  Sparkles,
  User as UserIcon,
  Code2,
  Sliders,
  Star,
  Pin,
  PinOff,
  History,
  ZoomIn,
  ZoomOut,
  Lock,
  Layers,
  Clock,
  Download,
  EyeOff,
  Columns2,
  Camera,
  Volume2,
  VolumeX,
  Terminal,
  Undo2,
  ChevronUp,
  ChevronDown,
  Menu,
  Sun,
  Moon,
  ChevronRight,
  Puzzle,
  Smartphone,
} from 'lucide-react';
import {
  AiChatMessage,
  AiProviderId,
  BrowsedPageData,
  BrowserPublicConfig,
  CustomAiModel,
  DailyNewsResponse,
  isStaffRole,
  ROLE_LABEL_RU,
  SearchEngineId,
  SearchResultItem,
  UserProfile,
} from '../types/firas';
import {
  BrowserCustomizationConfig,
  BrowserHistoryEntry,
  DEFAULT_BROWSER_CUSTOMIZATION,
  FIRES_CONTAINERS,
  FIRES_CUSTOMIZATION_KEY,
  FIRES_DOWNLOADS_KEY,
  FIRES_HISTORY_KEY,
  FiresContainerId,
  loadBrowserCustomization,
  loadBrowserHistory,
  WALLPAPER_PRESETS,
} from '../types/browserCustomization';
import {
  BrowserExtensionItem,
  loadInstalledExtensions,
  saveInstalledExtensions,
} from '../types/extensions';
import {
  BrowserCustomizationDrawer,
  ClosedTabSummary,
  CustomizationSection,
} from './BrowserCustomizationDrawer';
import { ExtensionsDrawer } from './ExtensionsDrawer';
import {
  DownloadPriority,
  DownloadSourceType,
  FiresDownloaderDrawer,
  FiresDownloadItem,
} from './FiresDownloaderDrawer';
import { FiresLogo } from './FiresLogo';
import { OpenSourceModal } from './OpenSourceModal';
import { UserAvatar } from './UserAvatar';

interface BrowserViewProps {
  initialSearchQuery: string | null;
  onConsumeInitialSearch: () => void;
  onSavePageToNotes: (title: string, url: string, summary: string) => void;
  onOpenMenu: () => void;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
  currentUser: UserProfile | null;
  authToken: string | null;
  browserConfig: BrowserPublicConfig | null;
  customModels: CustomAiModel[];
  onOpenAuth: (mode?: 'login' | 'register', reason?: string) => void;
  onOpenAdminPanel: () => void;
  onOpenMessengerFull: () => void;
  onOpenCloud: () => void;
  onOpenAiChat: (provider?: AiProviderId) => void;
  messengerBadgeCount?: number;
  messengerOnlineCount?: number;
}

interface TabEntry {
  kind: 'home' | 'search' | 'page' | 'about';
  value: string;
  engine?: SearchEngineId;
}

type PageRenderMode = 'web' | 'reader';

interface BrowserTabState {
  id: string;
  title: string;
  pinned: boolean;
  isPrivate: boolean;
  muted: boolean;
  containerId: FiresContainerId;
  zoom: number;
  trackersBlocked: number;
  httpsUpgraded: boolean;
  engineLabel: string;
  history: TabEntry[];
  historyIndex: number;
  engine: SearchEngineId;
  aiProvider: AiProviderId;
  renderMode: PageRenderMode;
  reloadNonce: number;
  loading: boolean;
  aiLoading: boolean;
  aiAnswer: string | null;
  aiModel: string | null;
  aiRoutedTo: string | null;
  aiRouteReason: string | null;
  aiError: string | null;
  aiChatHistory: AiChatMessage[];
  aiChatSending: boolean;
  searchResults: SearchResultItem[];
  pageData: BrowsedPageData | null;
  error: string | null;
}

interface NetworkStatus {
  checking: boolean;
  online: boolean | null;
  latencyMs: number | null;
}

const SESSION_TABS_KEY = 'fires-session-tabs-v1';

const ENGINES: Array<{ id: SearchEngineId; label: string }> = [
  { id: 'firas', label: 'Fires Mix' },
  { id: 'google', label: 'Google' },
  { id: 'yandex', label: 'Яндекс' },
  { id: 'duckduckgo', label: 'DuckDuckGo' },
  { id: 'mailru', label: 'Mail.ru' },
];

const AI_PROVIDERS: Array<{ id: AiProviderId; label: string; officialUrl?: string }> = [
  { id: 'google_studio_ai', label: 'Google Studio AI', officialUrl: 'https://aistudio.google.com/' },
  { id: 'claude', label: 'Claude', officialUrl: 'https://claude.ai/' },
  { id: 'codex', label: 'Codex', officialUrl: 'https://chatgpt.com/codex' },
  { id: 'studio_collab', label: 'Studio + Claude + Codex' },
  { id: 'codeium', label: 'Codeium', officialUrl: 'https://codeium.com/' },
  { id: 'studio_ai', label: 'Studio AI' },
  { id: 'deepseek', label: 'DeepSeek', officialUrl: 'https://chat.deepseek.com/' },
  { id: 'deepseek_coder', label: 'DeepSeek Coder', officialUrl: 'https://chat.deepseek.com/' },
  { id: 'gemini', label: 'Gemini', officialUrl: 'https://gemini.google.com/' },
  { id: 'chatgpt', label: 'ChatGPT', officialUrl: 'https://chatgpt.com/' },
  { id: 'fire_assistant', label: 'Fires Assistant' },
];

const SEARCH_EXAMPLES: string[] = [
  'яблоко',
  'список Forbes',
  'курс доллара',
  'квантовый компьютер',
];

function getAccentColors(hex: string, isDark: boolean): { bg: string; fg: string } {
  const clean = /^#[0-9a-f]{6}$/i.test(hex) ? hex : '#000000';
  if ((clean.toLowerCase() === '#000000' || clean.toLowerCase() === '#0f172a') && isDark) {
    return { bg: '#f8fafc', fg: '#000000' };
  }
  const r = parseInt(clean.slice(1, 3), 16);
  const g = parseInt(clean.slice(3, 5), 16);
  const b = parseInt(clean.slice(5, 7), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return {
    bg: clean,
    fg: yiq >= 155 ? '#0f172a' : '#ffffff',
  };
}

const createHomeTab = (
  id: string,
  defaultZoom = 100,
  containerId: FiresContainerId = 'default',
  options?: { isPrivate?: boolean; muted?: boolean; blank?: boolean }
): BrowserTabState => ({
  id,
  title: options?.isPrivate ? 'Приватная вкладка' : 'Новая вкладка',
  pinned: false,
  isPrivate: Boolean(options?.isPrivate),
  muted: Boolean(options?.muted),
  containerId,
  zoom: defaultZoom,
  trackersBlocked: 0,
  httpsUpgraded: false,
  engineLabel: 'Fires Engine 132.0 (FiresCore)',
  history: [{ kind: options?.blank ? 'about' : 'home', value: options?.blank ? 'about:blank' : '' }],
  historyIndex: 0,
  engine: 'firas',
  aiProvider: 'claude',
  renderMode: 'web',
  reloadNonce: 0,
  loading: false,
  aiLoading: false,
  aiAnswer: null,
  aiModel: null,
  aiRoutedTo: null,
  aiRouteReason: null,
  aiError: null,
  aiChatHistory: [],
  aiChatSending: false,
  searchResults: [],
  pageData: null,
  error: null,
});

const looksLikeAbout = (input: string): boolean => {
  return /^about:(fires|config|settings|history|bookmarks|downloads|addons|extensions|source|blank)$/i.test(input.trim());
};

const looksLikeUrl = (input: string): boolean => {
  const trimmed = input.trim();
  if (!trimmed || trimmed.includes(' ')) return false;
  if (/^https?:\/\//i.test(trimmed)) return true;
  return /^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+(\/.*)?$/.test(trimmed);
};

const normalizeBookmarkUrl = (raw: string): string => {
  const t = raw.trim();
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
};

const getExternalEngineUrl = (engine: SearchEngineId, query: string): string => {
  const q = encodeURIComponent(query);
  switch (engine) {
    case 'yandex':
      return `https://ya.ru/search/?text=${q}`;
    case 'google':
      return `https://www.google.com/search?q=${q}`;
    case 'duckduckgo':
      return `https://duckduckgo.com/?q=${q}`;
    case 'mailru':
      return `https://go.mail.ru/search?q=${q}`;
    default:
      return `https://ya.ru/search/?text=${q}`;
  }
};

function loadSavedDownloadMetadata(): FiresDownloadItem[] {
  try {
    const raw = localStorage.getItem(FIRES_DOWNLOADS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as FiresDownloadItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => ({
      ...item,
      status:
        item.status === 'downloading' || item.status === 'queued'
          ? 'paused'
          : item.status,
      speedBps: 0,
    }));
  } catch {
    return [];
  }
}

export const BrowserView: React.FC<BrowserViewProps> = ({
  initialSearchQuery,
  onConsumeInitialSearch,
  onSavePageToNotes,
  onOpenMenu,
  theme,
  onToggleTheme,
  currentUser,
  authToken,
  browserConfig,
  customModels,
  onOpenAuth,
  onOpenAdminPanel,
  onOpenMessengerFull,
  onOpenCloud,
  onOpenAiChat,
  messengerBadgeCount = 0,
  messengerOnlineCount = 0,
}) => {
  const [customization, setCustomization] = useState<BrowserCustomizationConfig>(() =>
    loadBrowserCustomization()
  );
  const [browsingHistory, setBrowsingHistory] = useState<BrowserHistoryEntry[]>(() =>
    loadBrowserHistory()
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerSection, setDrawerSection] = useState<CustomizationSection>('appearance');
  const [downloaderOpen, setDownloaderOpen] = useState(false);
  const [extensionsOpen, setExtensionsOpen] = useState(false);
  const [extensionsCatalog, setExtensionsCatalog] = useState<BrowserExtensionItem[]>([]);
  const [extensionsLoading, setExtensionsLoading] = useState(false);
  const [installedExtIds, setInstalledExtIds] = useState<string[]>(() =>
    loadInstalledExtensions()
  );
  const [isCompactViewport, setIsCompactViewport] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 960px)').matches : false
  );
  const [unifiedMenuOpen, setUnifiedMenuOpen] = useState(false);
  const [openSourceOpen, setOpenSourceOpen] = useState(false);
  const unifiedMenuRef = useRef<HTMLDivElement | null>(null);
  const [downloads, setDownloads] = useState<FiresDownloadItem[]>(() =>
    loadSavedDownloadMetadata()
  );
  const downloadControllersRef = useRef<Map<string, AbortController>>(new Map());

  const [isDark, setIsDark] = useState<boolean>(() =>
    typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : false
  );
  const [clockNow, setClockNow] = useState<Date>(() => new Date());

  const [tabs, setTabs] = useState<BrowserTabState[]>(() => {
    const cfg = loadBrowserCustomization();
    if (cfg.startupPage === 'restore') {
      try {
        const savedRaw = localStorage.getItem(SESSION_TABS_KEY);
        if (savedRaw) {
          const parsed = JSON.parse(savedRaw) as Array<{
            id: string;
            title: string;
            pinned: boolean;
            containerId: FiresContainerId;
            entry: TabEntry;
          }>;
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed.map((item) => ({
              ...createHomeTab(item.id, cfg.defaultZoom, item.containerId),
              title: item.title || 'Новая вкладка',
              pinned: Boolean(item.pinned),
              history: [item.entry],
              historyIndex: 0,
            }));
          }
        }
      } catch {
        // fallback to single home tab
      }
    }
    return [
      createHomeTab('tab-1', cfg.defaultZoom, 'default', {
        blank: cfg.startupPage === 'blank',
        muted: cfg.muteAllByDefault,
      }),
    ];
  });
  const [activeTabId, setActiveTabId] = useState('tab-1');
  const [splitTabId, setSplitTabId] = useState<string | null>(null);
  const [closedTabs, setClosedTabs] = useState<BrowserTabState[]>([]);

  // Find in Page (Ctrl+F) & DevTools (F12)
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [devtoolsOpen, setDevtoolsOpen] = useState(false);
  const [devtoolsInput, setDevtoolsInput] = useState('navigator.userAgent');
  const [devtoolsLogs, setDevtoolsLogs] = useState<Array<{ id: string; text: string; kind: 'log' | 'result' | 'error' }>>([]);

  const [addressInput, setAddressInput] = useState('');
  const [homeQuery, setHomeQuery] = useState('');
  const [aiFollowUpInput, setAiFollowUpInput] = useState('');
  const [homeAiOpen, setHomeAiOpen] = useState(false);
  const [homeAiInput, setHomeAiInput] = useState('');
  const [network, setNetwork] = useState<NetworkStatus>({
    checking: true,
    online: null,
    latencyMs: null,
  });
  const [dailyNews, setDailyNews] = useState<DailyNewsResponse | null>(null);
  const [newsLoading, setNewsLoading] = useState(true);

  const addressInputRef = useRef<HTMLInputElement | null>(null);
  const homeInputRef = useRef<HTMLInputElement | null>(null);

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];
  const currentEntry = activeTab.history[activeTab.historyIndex] || {
    kind: 'home' as const,
    value: '',
  };

  // Track dark mode changes from root element or explicit theme prop
  useEffect(() => {
    const root = document.documentElement;
    const sync = () =>
      setIsDark(theme ? theme === 'dark' : root.classList.contains('dark'));
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, [theme]);

  // Close unified menu on outside click or Escape
  useEffect(() => {
    if (!unifiedMenuOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (unifiedMenuRef.current && !unifiedMenuRef.current.contains(e.target as Node)) {
        setUnifiedMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setUnifiedMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [unifiedMenuOpen]);

  // Track mobile/tablet viewport so Wikipedia/GitHub automatically disable rigid desktop columns
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(max-width: 960px)');
    const sync = () => setIsCompactViewport(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const fetchExtensionsCatalog = useCallback(async () => {
    setExtensionsLoading(true);
    try {
      const resp = await fetch('/api/extensions/catalog');
      if (resp.ok) {
        const data = (await resp.json()) as { extensions?: BrowserExtensionItem[] };
        if (Array.isArray(data.extensions)) {
          setExtensionsCatalog(data.extensions);
        }
      }
    } catch {
      // ignore transient errors
    } finally {
      setExtensionsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExtensionsCatalog();
  }, [fetchExtensionsCatalog]);

  useEffect(() => {
    saveInstalledExtensions(installedExtIds);
  }, [installedExtIds]);

  // Clock widget tick
  useEffect(() => {
    if (!customization.showClockWidget) return;
    setClockNow(new Date());
    const id = window.setInterval(() => setClockNow(new Date()), 15000);
    return () => window.clearInterval(id);
  }, [customization.showClockWidget]);

  // Persist customization & history & session tabs
  useEffect(() => {
    try {
      localStorage.setItem(FIRES_CUSTOMIZATION_KEY, JSON.stringify(customization));
    } catch {
      // ignore storage quota
    }
  }, [customization]);

  useEffect(() => {
    try {
      localStorage.setItem(FIRES_HISTORY_KEY, JSON.stringify(browsingHistory));
    } catch {
      // ignore storage quota
    }
  }, [browsingHistory]);

  useEffect(() => {
    try {
      const metadata = downloads.map(({ blob: _b, ...rest }) => rest).slice(0, 40);
      localStorage.setItem(FIRES_DOWNLOADS_KEY, JSON.stringify(metadata));
    } catch {
      // ignore
    }
  }, [downloads]);

  useEffect(() => {
    try {
      const publicTabs = tabs
        .filter((t) => !t.isPrivate)
        .map((t) => ({
          id: t.id,
          title: t.title,
          pinned: t.pinned,
          containerId: t.containerId,
          entry: t.history[t.historyIndex] || { kind: 'home', value: '' },
        }));
      localStorage.setItem(SESSION_TABS_KEY, JSON.stringify(publicTabs));
    } catch {
      // ignore
    }
  }, [tabs]);

  // Clear history on exit if enabled
  useEffect(() => {
    if (!customization.clearHistoryOnExit) return;
    const onUnload = () => {
      try {
        localStorage.removeItem(FIRES_HISTORY_KEY);
      } catch {
        // ignore
      }
    };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [customization.clearHistoryOnExit]);

  const updateCustomization = useCallback((patch: Partial<BrowserCustomizationConfig>) => {
    setCustomization((prev) => ({ ...prev, ...patch }));
  }, []);

  const resetCustomization = useCallback(() => {
    setCustomization(DEFAULT_BROWSER_CUSTOMIZATION);
  }, []);

  const openDrawerSection = useCallback((section: CustomizationSection) => {
    setDrawerSection(section);
    setDrawerOpen(true);
  }, []);

  const recordHistory = useCallback(
    (title: string, url: string, kind: 'search' | 'page', isPrivate?: boolean) => {
      if (isPrivate || !url.trim()) return;
      setBrowsingHistory((prev) => {
        const entry: BrowserHistoryEntry = {
          id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          title: title || url,
          url,
          kind,
          visitedAt: new Date().toISOString(),
        };
        const deduped = prev.filter((item) => item.url !== url || item.kind !== kind);
        return [entry, ...deduped].slice(0, 120);
      });
    },
    []
  );

  // Unified Downloader Controller (GitHub + Google Play + Controllable Stream)
  const executeControlledStreamDownload = useCallback(
    async (
      id: string,
      url: string,
      fileName: string,
      throttleKbps: number,
      syntheticJsonPayload?: string
    ) => {
      if (syntheticJsonPayload) {
        const blob = new Blob([syntheticJsonPayload], { type: 'application/json;charset=utf-8' });
        setDownloads((prev) =>
          prev.map((d) =>
            d.id === id
              ? {
                  ...d,
                  status: 'completed',
                  receivedBytes: blob.size,
                  totalBytes: blob.size,
                  speedBps: 0,
                  mimeType: 'application/json',
                  blob,
                }
              : d
          )
        );
        return;
      }

      const controller = new AbortController();
      downloadControllersRef.current.set(id, controller);
      setDownloads((prev) =>
        prev.map((d) =>
          d.id === id ? { ...d, status: 'downloading', error: undefined, speedBps: 0 } : d
        )
      );

      try {
        const streamUrl = url.startsWith('/')
          ? url
          : `/api/downloader/stream?url=${encodeURIComponent(
              url
            )}&throttleKbps=${throttleKbps}`;
        const resp = await fetch(streamUrl, { signal: controller.signal });
        if (!resp.ok) {
          let errMsg = `Ошибка загрузки (${resp.status})`;
          try {
            const j = (await resp.json()) as { error?: string };
            if (j.error) errMsg = j.error;
          } catch {
            // keep errMsg
          }
          setDownloads((prev) =>
            prev.map((d) =>
              d.id === id ? { ...d, status: 'error', error: errMsg, speedBps: 0 } : d
            )
          );
          return;
        }

        const totalBytes = Number(resp.headers.get('content-length') || 0) || 0;
        const mimeType = resp.headers.get('content-type') || 'application/octet-stream';

        if (!resp.body) {
          const blob = await resp.blob();
          setDownloads((prev) =>
            prev.map((d) =>
              d.id === id
                ? {
                    ...d,
                    status: 'completed',
                    receivedBytes: blob.size,
                    totalBytes: totalBytes || blob.size,
                    speedBps: 0,
                    mimeType,
                    blob,
                  }
                : d
            )
          );
          return;
        }

        const reader = resp.body.getReader();
        const chunks: BlobPart[] = [];
        let received = 0;
        let lastTick = Date.now();
        let bytesSinceTick = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value && value.byteLength > 0) {
            const copy = new Uint8Array(value);
            chunks.push(copy);
            received += copy.byteLength;
            bytesSinceTick += copy.byteLength;
            const now = Date.now();
            const dt = now - lastTick;
            if (dt >= 250) {
              const bps = Math.round((bytesSinceTick / dt) * 1000);
              lastTick = now;
              bytesSinceTick = 0;
              setDownloads((prev) =>
                prev.map((d) =>
                  d.id === id
                    ? { ...d, receivedBytes: received, totalBytes, speedBps: bps }
                    : d
                )
              );
            }
          }
        }

        const finalBlob = new Blob(chunks, { type: mimeType });
        setDownloads((prev) =>
          prev.map((d) =>
            d.id === id
              ? {
                  ...d,
                  name: fileName,
                  status: 'completed',
                  receivedBytes: finalBlob.size,
                  totalBytes: totalBytes || finalBlob.size,
                  speedBps: 0,
                  mimeType,
                  blob: finalBlob,
                }
              : d
          )
        );

        if (!customization.askBeforeSave) {
          const objUrl = URL.createObjectURL(finalBlob);
          const a = document.createElement('a');
          a.href = objUrl;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(objUrl);
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          setDownloads((prev) =>
            prev.map((d) =>
              d.id === id && d.status === 'downloading'
                ? { ...d, status: 'paused', speedBps: 0 }
                : d
            )
          );
        } else {
          setDownloads((prev) =>
            prev.map((d) =>
              d.id === id
                ? {
                    ...d,
                    status: 'error',
                    speedBps: 0,
                    error: 'Соединение прервано при скачивании.',
                  }
                : d
            )
          );
        }
      } finally {
        downloadControllersRef.current.delete(id);
      }
    },
    [customization.askBeforeSave]
  );

  const handleStartDownload = useCallback(
    (opts: {
      name: string;
      url: string;
      source: DownloadSourceType;
      packageOrRepo?: string;
      priority?: DownloadPriority;
      syntheticJsonPayload?: string;
    }) => {
      const id = `dl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const dangerousExt = /\.(bat|cmd|scr|vbs|pif)$/i.test(opts.name);
      const newItem: FiresDownloadItem = {
        id,
        name: opts.name,
        url: opts.url,
        source: opts.source,
        packageOrRepo: opts.packageOrRepo,
        status: 'downloading',
        priority: opts.priority || 'normal',
        receivedBytes: 0,
        totalBytes: 0,
        speedBps: 0,
        mimeType: 'application/octet-stream',
        createdAt: new Date().toISOString(),
        verifiedSafe: !dangerousExt,
      };
      setDownloads((prev) => [newItem, ...prev]);
      void executeControlledStreamDownload(
        id,
        opts.url,
        opts.name,
        customization.downloadSpeedLimitKbps,
        opts.syntheticJsonPayload
      );
    },
    [customization.downloadSpeedLimitKbps, executeControlledStreamDownload]
  );

  const handlePauseDownload = useCallback((id: string) => {
    const ctrl = downloadControllersRef.current.get(id);
    if (ctrl) ctrl.abort();
    setDownloads((prev) =>
      prev.map((d) => (d.id === id ? { ...d, status: 'paused', speedBps: 0 } : d))
    );
  }, []);

  const handleResumeDownload = useCallback(
    (id: string) => {
      const target = downloads.find((d) => d.id === id);
      if (!target) return;
      void executeControlledStreamDownload(
        id,
        target.url,
        target.name,
        customization.downloadSpeedLimitKbps
      );
    },
    [customization.downloadSpeedLimitKbps, downloads, executeControlledStreamDownload]
  );

  const handleCancelDownload = useCallback((id: string) => {
    const ctrl = downloadControllersRef.current.get(id);
    if (ctrl) ctrl.abort();
    setDownloads((prev) =>
      prev.map((d) => (d.id === id ? { ...d, status: 'cancelled', speedBps: 0 } : d))
    );
  }, []);

  const handlePauseAllDownloads = useCallback(() => {
    downloadControllersRef.current.forEach((ctrl) => ctrl.abort());
    setDownloads((prev) =>
      prev.map((d) =>
        d.status === 'downloading' || d.status === 'queued'
          ? { ...d, status: 'paused', speedBps: 0 }
          : d
      )
    );
  }, []);

  const handleSaveDownloadToDisk = useCallback((item: FiresDownloadItem) => {
    if (!item.blob) return;
    const objUrl = URL.createObjectURL(item.blob);
    const a = document.createElement('a');
    a.href = objUrl;
    a.download = item.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objUrl);
  }, []);

  const handleSaveDownloadToCloud = useCallback(
    async (item: FiresDownloadItem) => {
      if (!item.blob || !currentUser) return;
      const reader = new FileReader();
      const base64: string = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('read error'));
        reader.readAsDataURL(item.blob!);
      });
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) headers.Authorization = `Bearer ${authToken}`;
      await fetch('/api/cloud/upload', {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({
          name: item.name,
          folder: 'Документы',
          mimeType: item.mimeType,
          dataBase64: base64,
        }),
      });
    },
    [authToken, currentUser]
  );

  const checkNetwork = useCallback(async () => {
    setNetwork((prev) => ({ ...prev, checking: true }));
    try {
      const resp = await fetch('/api/network');
      if (!resp.ok) throw new Error('network error');
      const data = (await resp.json()) as { online: boolean; latencyMs: number };
      setNetwork({
        checking: false,
        online: data.online && navigator.onLine,
        latencyMs: data.latencyMs,
      });
    } catch {
      setNetwork({
        checking: false,
        online: false,
        latencyMs: null,
      });
    }
  }, []);

  const fetchNews = useCallback(async (forceRefresh = false) => {
    setNewsLoading(true);
    try {
      const resp = await fetch(forceRefresh ? '/api/news?refresh=1' : '/api/news');
      if (!resp.ok) throw new Error('news error');
      const data = (await resp.json()) as DailyNewsResponse;
      setDailyNews(data);
    } catch {
      // Keep previous news
    } finally {
      setNewsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkNetwork();
    fetchNews(false);
  }, [checkNetwork, fetchNews]);

  useEffect(() => {
    const checkDateRollover = () => {
      const todayKey = new Date().toISOString().slice(0, 10);
      if (dailyNews && dailyNews.dateKey !== todayKey) {
        fetchNews(true);
      }
    };
    const interval = window.setInterval(checkDateRollover, 5 * 60 * 1000);
    window.addEventListener('focus', checkDateRollover);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', checkDateRollover);
    };
  }, [dailyNews, fetchNews]);

  useEffect(() => {
    if (currentEntry.kind === 'home') {
      setAddressInput('');
    } else {
      setAddressInput(currentEntry.value);
    }
  }, [activeTab.id, activeTab.historyIndex, currentEntry.kind, currentEntry.value]);

  const updateTab = useCallback(
    (tabId: string, updater: (tab: BrowserTabState) => BrowserTabState) => {
      setTabs((prev) => prev.map((t) => (t.id === tabId ? updater(t) : t)));
    },
    []
  );

  const fetchAiForQuery = useCallback(
    (tabId: string, query: string, provider: AiProviderId) => {
      updateTab(tabId, (tab) => ({
        ...tab,
        aiProvider: provider,
        aiLoading: true,
        aiAnswer: null,
        aiError: null,
      }));

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (authToken) {
        headers.Authorization = `Bearer ${authToken}`;
      }

      fetch('/api/ai-answer', {
        method: 'POST',
        headers,
        body: JSON.stringify({ query, provider }),
      })
        .then(async (resp) => {
          const data = (await resp.json()) as {
            answer?: string;
            model?: string;
            routedTo?: string;
            routeReason?: string;
            error?: string;
          };
          if (!resp.ok || data.error) {
            updateTab(tabId, (tab) => ({
              ...tab,
              aiLoading: false,
              aiAnswer: null,
              aiRoutedTo: null,
              aiRouteReason: null,
              aiError: data.error || 'Не удалось получить ответ нейросети.',
            }));
            return;
          }
          const ansText = data.answer || '';
          updateTab(tabId, (tab) => ({
            ...tab,
            aiLoading: false,
            aiAnswer: ansText || null,
            aiModel: data.model || null,
            aiRoutedTo: data.routedTo || null,
            aiRouteReason: data.routeReason || null,
            aiError: null,
            aiChatHistory: ansText
              ? [
                  {
                    id: `ai-u-${Date.now()}`,
                    role: 'user',
                    text: query,
                    createdAt: new Date().toISOString(),
                  },
                  {
                    id: `ai-a-${Date.now()}`,
                    role: 'assistant',
                    text: ansText,
                    model: data.model,
                    routedTo: data.routedTo,
                    routeReason: data.routeReason,
                    createdAt: new Date().toISOString(),
                  },
                ]
              : [],
          }));
        })
        .catch(() => {
          updateTab(tabId, (tab) => ({
            ...tab,
            aiLoading: false,
            aiAnswer: null,
            aiError: 'Ошибка соединения с сервером нейросети.',
          }));
        });
    },
    [authToken, updateTab]
  );

  const sendUnlimitedAiChat = useCallback(
    async (tabId: string, promptText: string, providerOverride?: AiProviderId) => {
      const trimmed = promptText.trim();
      if (!trimmed) return;
      const targetTab = tabs.find((t) => t.id === tabId) || activeTab;
      const provider = providerOverride || targetTab.aiProvider;
      const userMsg: AiChatMessage = {
        id: `chat-u-${Date.now()}`,
        role: 'user',
        text: trimmed,
        createdAt: new Date().toISOString(),
      };
      const nextHistory = [...targetTab.aiChatHistory, userMsg];

      updateTab(tabId, (tab) => ({
        ...tab,
        aiProvider: provider,
        aiChatSending: true,
        aiError: null,
        aiChatHistory: [...tab.aiChatHistory, userMsg],
      }));

      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (authToken) headers.Authorization = `Bearer ${authToken}`;

        const resp = await fetch('/api/ai-chat', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            provider,
            messages: nextHistory.map((m) => ({ role: m.role, text: m.text })),
          }),
        });
        const data = (await resp.json()) as {
          answer?: string;
          model?: string;
          error?: string;
        };
        if (!resp.ok || data.error || !data.answer) {
          updateTab(tabId, (tab) => ({
            ...tab,
            aiChatSending: false,
            aiError: data.error || 'Не удалось получить ответ нейросети.',
          }));
          return;
        }
        const assistantMsg: AiChatMessage = {
          id: `chat-a-${Date.now()}`,
          role: 'assistant',
          text: data.answer,
          model: data.model,
          createdAt: new Date().toISOString(),
        };
        updateTab(tabId, (tab) => ({
          ...tab,
          aiChatSending: false,
          aiModel: data.model || tab.aiModel,
          aiChatHistory: [...tab.aiChatHistory, assistantMsg],
        }));
      } catch {
        updateTab(tabId, (tab) => ({
          ...tab,
          aiChatSending: false,
          aiError: 'Ошибка соединения с сервером нейросети.',
        }));
      }
    },
    [activeTab, authToken, tabs, updateTab]
  );

  const executeNavigation = useCallback(
    async (
      tabId: string,
      entry: TabEntry,
      pushToHistory: boolean,
      providerOverride?: AiProviderId
    ) => {
      const targetTab = tabs.find((t) => t.id === tabId) || activeTab;
      const aiProvider = providerOverride || targetTab.aiProvider;

      updateTab(tabId, (tab) => {
        const nextHistory = pushToHistory
          ? [...tab.history.slice(0, tab.historyIndex + 1), entry]
          : tab.history;
        const nextIndex = pushToHistory ? nextHistory.length - 1 : tab.historyIndex;
        return {
          ...tab,
          history: nextHistory,
          historyIndex: nextIndex,
          reloadNonce: tab.reloadNonce + 1,
          engine: entry.engine || tab.engine,
          aiProvider,
          trackersBlocked: entry.kind === 'page' ? 0 : tab.trackersBlocked,
          httpsUpgraded: false,
          loading: entry.kind !== 'home' && entry.kind !== 'about',
          aiLoading: entry.kind === 'search',
          aiAnswer: entry.kind === 'search' ? null : tab.aiAnswer,
          aiModel: entry.kind === 'search' ? null : tab.aiModel,
          aiError: null,
          aiChatHistory: entry.kind === 'search' ? [] : tab.aiChatHistory,
          error: null,
          title:
            entry.kind === 'home'
              ? tab.isPrivate
                ? 'Приватная вкладка'
                : 'Новая вкладка'
              : entry.kind === 'about'
              ? entry.value === 'about:blank'
                ? 'Пустая страница'
                : 'Ядро Fires · Конфигурация'
              : entry.kind === 'search'
              ? `${entry.value} — Поиск`
              : entry.value.replace(/^https?:\/\//, '').split('/')[0],
        };
      });

      if (entry.kind === 'home' || entry.kind === 'about') return;

      if (entry.kind === 'search') {
        const engine = entry.engine || 'firas';
        fetchAiForQuery(tabId, entry.value, aiProvider);

        try {
          const resp = await fetch(
            `/api/search?q=${encodeURIComponent(entry.value)}&engine=${encodeURIComponent(engine)}`
          );
          const json = (await resp.json()) as { results?: SearchResultItem[] };
          const searchTitle = `${entry.value} — ${
            ENGINES.find((e) => e.id === engine)?.label || 'Поиск'
          }`;
          updateTab(tabId, (tab) => ({
            ...tab,
            loading: false,
            searchResults: json.results || [],
            pageData: null,
            title: searchTitle,
          }));
          recordHistory(searchTitle, entry.value, 'search', targetTab.isPrivate);
        } catch {
          updateTab(tabId, (tab) => ({
            ...tab,
            loading: false,
            searchResults: [],
            error: 'Не удалось выполнить поиск. Проверьте подключение к интернету.',
          }));
        }
        return;
      }

      if (entry.kind === 'page') {
        const normalizedUrl = /^https?:\/\//i.test(entry.value)
          ? entry.value
          : `https://${entry.value}`;
        const finalFetchUrl =
          customization.httpsOnly && normalizedUrl.startsWith('http://')
            ? `https://${normalizedUrl.slice(7)}`
            : normalizedUrl;
        try {
          const resp = await fetch(
            `/api/browse?url=${encodeURIComponent(finalFetchUrl)}&httpsOnly=${
              customization.httpsOnly ? '1' : '0'
            }&ua=${encodeURIComponent(customization.uaMode)}`
          );
          const page = (await resp.json()) as BrowsedPageData;
          const resolvedTitle = page.title || page.domain || finalFetchUrl;
          updateTab(tabId, (tab) => ({
            ...tab,
            loading: false,
            pageData: page,
            error: page.error || null,
            title: resolvedTitle,
            httpsUpgraded:
              customization.httpsOnly && normalizedUrl.startsWith('http://'),
          }));
          recordHistory(
            resolvedTitle,
            page.finalUrl || finalFetchUrl,
            'page',
            targetTab.isPrivate
          );
        } catch {
          updateTab(tabId, (tab) => ({
            ...tab,
            loading: false,
            pageData: null,
            error: 'Не удалось загрузить страницу.',
          }));
        }
      }
    },
    [
      activeTab,
      customization.httpsOnly,
      customization.uaMode,
      fetchAiForQuery,
      recordHistory,
      tabs,
      updateTab,
    ]
  );

  // Listen to link clicks & Fires Engine metadata from proxied web iframe
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as
        | {
            type?: string;
            url?: string;
            title?: string;
            blockedCount?: number;
            httpsUpgraded?: boolean;
            engine?: string;
          }
        | undefined;
      if (!data || typeof data !== 'object') return;

      if (data.type === 'firas-proxy-navigate' && typeof data.url === 'string') {
        if (customization.openLinksInNewTab) {
          const id = `tab-${Date.now()}`;
          const nextTab = createHomeTab(id, customization.defaultZoom, activeTab.containerId, {
            isPrivate: activeTab.isPrivate,
            muted: customization.muteAllByDefault,
          });
          setTabs((prev) => [...prev, nextTab]);
          setActiveTabId(id);
          executeNavigation(id, { kind: 'page', value: data.url }, true);
        } else {
          executeNavigation(
            activeTab.id,
            { kind: 'page', value: data.url },
            true
          );
        }
      } else if (data.type === 'firas-proxy-loaded') {
        updateTab(activeTab.id, (tab) => ({
          ...tab,
          title:
            typeof data.title === 'string' && data.title.trim()
              ? data.title.trim()
              : tab.title,
          trackersBlocked:
            typeof data.blockedCount === 'number'
              ? data.blockedCount
              : tab.trackersBlocked,
          httpsUpgraded:
            typeof data.httpsUpgraded === 'boolean'
              ? data.httpsUpgraded
              : tab.httpsUpgraded,
          engineLabel:
            typeof data.engine === 'string' && data.engine
              ? data.engine
              : tab.engineLabel,
          loading: false,
        }));
      } else if (data.type === 'firas-proxy-reader') {
        updateTab(activeTab.id, (tab) => ({ ...tab, renderMode: 'reader' }));
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [
    activeTab.containerId,
    activeTab.id,
    activeTab.isPrivate,
    customization.defaultZoom,
    customization.muteAllByDefault,
    customization.openLinksInNewTab,
    executeNavigation,
    updateTab,
  ]);

  // Support external search / URL triggers
  useEffect(() => {
    if (!initialSearchQuery) return;
    const raw = initialSearchQuery;
    onConsumeInitialSearch();
    if (looksLikeAbout(raw)) {
      const lower = raw.trim().toLowerCase();
      if (lower === 'about:history') {
        openDrawerSection('history');
        return;
      }
      if (lower === 'about:bookmarks') {
        openDrawerSection('bookmarks');
        return;
      }
      if (lower === 'about:settings') {
        openDrawerSection('interactions');
        return;
      }
      if (lower === 'about:downloads') {
        setDownloaderOpen(true);
        return;
      }
      if (lower === 'about:addons' || lower === 'about:extensions') {
        setExtensionsOpen(true);
        return;
      }
      if (lower === 'about:source') {
        setOpenSourceOpen(true);
        return;
      }
      executeNavigation(activeTab.id, { kind: 'about', value: lower }, true);
      return;
    }
    if (looksLikeUrl(raw)) {
      const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
      executeNavigation(activeTab.id, { kind: 'page', value: url }, true);
    } else {
      executeNavigation(
        activeTab.id,
        { kind: 'search', value: raw, engine: activeTab.engine },
        true
      );
    }
  }, [
    initialSearchQuery,
    onConsumeInitialSearch,
    activeTab.id,
    activeTab.engine,
    executeNavigation,
    openDrawerSection,
  ]);

  const navigateFromInput = useCallback(
    (raw: string, engineOverride?: SearchEngineId) => {
      const trimmed = raw.trim();
      if (!trimmed) return;
      if (looksLikeAbout(trimmed)) {
        const lower = trimmed.toLowerCase();
        if (lower === 'about:history') {
          openDrawerSection('history');
          return;
        }
        if (lower === 'about:bookmarks') {
          openDrawerSection('bookmarks');
          return;
        }
        if (lower === 'about:settings') {
          openDrawerSection('interactions');
          return;
        }
        if (lower === 'about:downloads') {
          setDownloaderOpen(true);
          return;
        }
        if (lower === 'about:addons' || lower === 'about:extensions') {
          setExtensionsOpen(true);
          return;
        }
        if (lower === 'about:source') {
          setOpenSourceOpen(true);
          return;
        }
        executeNavigation(activeTab.id, { kind: 'about', value: lower }, true);
        return;
      }
      const engine = engineOverride || activeTab.engine;
      if (looksLikeUrl(trimmed)) {
        const url = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
        executeNavigation(activeTab.id, { kind: 'page', value: url }, true);
      } else {
        executeNavigation(
          activeTab.id,
          { kind: 'search', value: trimmed, engine },
          true
        );
      }
    },
    [activeTab.engine, activeTab.id, executeNavigation, openDrawerSection]
  );

  const handleBack = () => {
    if (activeTab.historyIndex <= 0) return;
    const targetIdx = activeTab.historyIndex - 1;
    const targetEntry = activeTab.history[targetIdx];
    updateTab(activeTab.id, (tab) => ({ ...tab, historyIndex: targetIdx }));
    executeNavigation(activeTab.id, targetEntry, false);
  };

  const handleForward = () => {
    if (activeTab.historyIndex >= activeTab.history.length - 1) return;
    const targetIdx = activeTab.historyIndex + 1;
    const targetEntry = activeTab.history[targetIdx];
    updateTab(activeTab.id, (tab) => ({ ...tab, historyIndex: targetIdx }));
    executeNavigation(activeTab.id, targetEntry, false);
  };

  const handleReload = () => {
    executeNavigation(activeTab.id, currentEntry, false);
  };

  const handleHome = () => {
    executeNavigation(activeTab.id, { kind: 'home', value: '' }, true);
  };

  const handleAddNewTab = useCallback(
    (isPrivate = false) => {
      const id = `tab-${Date.now()}`;
      setTabs((prev) => [
        ...prev,
        createHomeTab(id, customization.defaultZoom, isPrivate ? 'personal' : activeTab.containerId, {
          isPrivate,
          muted: customization.muteAllByDefault,
        }),
      ]);
      setActiveTabId(id);
      if (customization.autofocusAddressBar) {
        window.setTimeout(() => homeInputRef.current?.focus(), 60);
      }
    },
    [activeTab.containerId, customization.autofocusAddressBar, customization.defaultZoom, customization.muteAllByDefault]
  );

  const handleCloseTab = useCallback(
    (tabId: string) => {
      const target = tabs.find((t) => t.id === tabId);
      if (target?.pinned) return;
      if (target) {
        setClosedTabs((prev) => [target, ...prev].slice(0, 15));
      }
      if (splitTabId === tabId) {
        setSplitTabId(null);
      }
      if (tabs.length === 1) {
        const fresh = createHomeTab(`tab-${Date.now()}`, customization.defaultZoom, 'default', {
          muted: customization.muteAllByDefault,
        });
        setTabs([fresh]);
        setActiveTabId(fresh.id);
        return;
      }
      const idx = tabs.findIndex((t) => t.id === tabId);
      const nextTabs = tabs.filter((t) => t.id !== tabId);
      setTabs(nextTabs);
      if (activeTabId === tabId) {
        const fallbackTab = nextTabs[Math.max(0, idx - 1)] || nextTabs[0];
        setActiveTabId(fallbackTab.id);
      }
    },
    [activeTabId, customization.defaultZoom, customization.muteAllByDefault, splitTabId, tabs]
  );

  const handleRestoreLastClosedTab = useCallback(
    (specificId?: string) => {
      if (closedTabs.length === 0) return;
      const target = specificId
        ? closedTabs.find((t) => t.id === specificId) || closedTabs[0]
        : closedTabs[0];
      setClosedTabs((prev) => prev.filter((t) => t.id !== target.id));
      const newId = `tab-${Date.now()}`;
      setTabs((prev) => [...prev, { ...target, id: newId }]);
      setActiveTabId(newId);
    },
    [closedTabs]
  );

  const handleTogglePinTab = (tabId: string) => {
    setTabs((prev) => {
      const updated = prev.map((t) =>
        t.id === tabId ? { ...t, pinned: !t.pinned } : t
      );
      return [
        ...updated.filter((t) => t.pinned),
        ...updated.filter((t) => !t.pinned),
      ];
    });
  };

  const handleAddBookmark = (title: string, rawUrl: string) => {
    const url = normalizeBookmarkUrl(rawUrl);
    setCustomization((prev) => {
      const existing = prev.bookmarks.find(
        (b) => b.url.toLowerCase() === url.toLowerCase()
      );
      if (existing) return prev;
      return {
        ...prev,
        bookmarks: [
          ...prev.bookmarks,
          {
            id: `bm-${Date.now()}`,
            title: title.trim() || url.replace(/^https?:\/\//, '').split('/')[0],
            url,
            pinnedHome: true,
          },
        ],
      };
    });
  };

  const handleRemoveBookmark = (id: string) => {
    setCustomization((prev) => ({
      ...prev,
      bookmarks: prev.bookmarks.filter((b) => b.id !== id),
    }));
  };

  const currentBookmark =
    currentEntry.kind === 'page'
      ? customization.bookmarks.find(
          (b) =>
            b.url.toLowerCase() === normalizeBookmarkUrl(currentEntry.value).toLowerCase()
        )
      : undefined;

  const handleToggleCurrentBookmark = useCallback(() => {
    if (currentEntry.kind !== 'page') return;
    if (currentBookmark) {
      handleRemoveBookmark(currentBookmark.id);
    } else {
      handleAddBookmark(activeTab.title, currentEntry.value);
    }
  }, [activeTab.title, currentBookmark, currentEntry.kind, currentEntry.value]);

  const handleTakeScreenshot = useCallback(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = isDark ? '#09090b' : '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Header bar
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, 72);
    ctx.fillStyle = '#f97316';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText('Fires', 36, 46);
    ctx.fillStyle = '#a1a1aa';
    ctx.font = '18px monospace';
    ctx.fillText(currentEntry.value || 'Новая вкладка Fires', 130, 44);

    // Content card
    ctx.fillStyle = isDark ? '#18181b' : '#f8fafc';
    ctx.fillRect(48, 108, 1184, 540);
    ctx.strokeStyle = isDark ? '#27272a' : '#e2e8f0';
    ctx.strokeRect(48, 108, 1184, 540);

    ctx.fillStyle = isDark ? '#f8fafc' : '#09090b';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText((activeTab.title || 'Страница Fires').slice(0, 62), 84, 170);

    ctx.fillStyle = isDark ? '#cbd5e1' : '#334155';
    ctx.font = '20px sans-serif';
    const snippet =
      activeTab.pageData?.description ||
      activeTab.aiAnswer ||
      activeTab.pageData?.blocks?.[0]?.text ||
      'Снимок страницы создан встроенным инструментом Fires Screenshot.';
    const words = snippet.replace(/\s+/g, ' ').split(' ');
    let line = '';
    let y = 235;
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > 1080) {
        ctx.fillText(line, 84, y);
        line = w;
        y += 34;
        if (y > 580) break;
      } else {
        line = test;
      }
    }
    if (line && y <= 580) ctx.fillText(line, 84, y);

    ctx.fillStyle = '#64748b';
    ctx.font = '16px monospace';
    ctx.fillText(
      `Fires Engine 132.0 · ${new Date().toLocaleString('ru-RU')}`,
      84,
      622
    );

    canvas.toBlob((blob) => {
      if (!blob) return;
      const safeTitle = (activeTab.title || 'fires-shot')
        .replace(/[^a-zA-Zа-яА-Я0-9_-]+/g, '-')
        .slice(0, 32);
      const fileName = `${safeTitle}-${Date.now()}.png`;
      const id = `dl-${Date.now()}`;
      setDownloads((prev) => [
        {
          id,
          name: fileName,
          url: currentEntry.value || 'about:fires',
          source: 'direct',
          status: 'completed',
          priority: 'high',
          receivedBytes: blob.size,
          totalBytes: blob.size,
          speedBps: 0,
          mimeType: 'image/png',
          createdAt: new Date().toISOString(),
          verifiedSafe: true,
          blob,
        },
        ...prev,
      ]);
      setDownloaderOpen(true);
    }, 'image/png');
  }, [activeTab.aiAnswer, activeTab.pageData, activeTab.title, currentEntry.value, isDark]);

  // Global Keyboard Shortcuts inside Fires Browser
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (e.key === 'F12') {
        e.preventDefault();
        setDevtoolsOpen((v) => !v);
        return;
      }
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key === 't' && e.shiftKey) {
        e.preventDefault();
        handleRestoreLastClosedTab();
      } else if (key === 'p' && e.shiftKey) {
        e.preventDefault();
        handleAddNewTab(true);
      } else if (key === 't' && !e.shiftKey) {
        e.preventDefault();
        handleAddNewTab(false);
      } else if (key === 'w') {
        e.preventDefault();
        handleCloseTab(activeTab.id);
      } else if (key === 'f') {
        e.preventDefault();
        setFindOpen(true);
      } else if (key === 'j') {
        e.preventDefault();
        setDownloaderOpen((v) => !v);
      } else if (key === 'l') {
        e.preventDefault();
        (addressInputRef.current || homeInputRef.current)?.focus();
        (addressInputRef.current || homeInputRef.current)?.select();
      } else if (key === 'd') {
        e.preventDefault();
        handleToggleCurrentBookmark();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    activeTab.id,
    handleAddNewTab,
    handleCloseTab,
    handleRestoreLastClosedTab,
    handleToggleCurrentBookmark,
  ]);

  const handleSaveCurrentToNotes = () => {
    if (currentEntry.kind === 'page' && activeTab.pageData) {
      const p = activeTab.pageData;
      const body = [
        p.description,
        ...p.blocks.slice(0, 6).map((b) => b.text),
      ]
        .filter(Boolean)
        .join('\n\n');
      onSavePageToNotes(p.title, p.finalUrl, body || 'Страница сохранена из браузера Fires.');
      return;
    }
    if (currentEntry.kind === 'page') {
      onSavePageToNotes(activeTab.title, currentEntry.value, 'Страница сохранена из браузера Fires.');
      return;
    }
    if (currentEntry.kind === 'search') {
      const lines = activeTab.searchResults
        .slice(0, 5)
        .map((r) => `- ${r.title} (${r.url})`)
        .join('\n');
      const content = [activeTab.aiAnswer, lines].filter(Boolean).join('\n\n');
      onSavePageToNotes(
        `Поиск: ${currentEntry.value}`,
        getExternalEngineUrl(activeTab.engine, currentEntry.value),
        content || 'Поисковая выдача браузера Fires'
      );
    }
  };

  // Visual style computed tokens from customization
  const accent = useMemo(
    () => getAccentColors(customization.accentColor, isDark),
    [customization.accentColor, isDark]
  );

  const sortedTabs = useMemo(
    () => [...tabs.filter((t) => t.pinned), ...tabs.filter((t) => !t.pinned)],
    [tabs]
  );

  const radiusClasses = useMemo(() => {
    switch (customization.cornerRadius) {
      case 'sharp':
        return { card: 'rounded-sm', control: 'rounded-none', tab: 'rounded-none' };
      case 'soft':
        return { card: 'rounded-2xl', control: 'rounded-xl', tab: 'rounded-xl' };
      case 'rounded':
        return { card: 'rounded-3xl', control: 'rounded-2xl', tab: 'rounded-2xl' };
      default:
        return { card: 'rounded-xl', control: 'rounded-lg', tab: 'rounded-t-lg' };
    }
  }, [customization.cornerRadius]);

  const densitySpacing = useMemo(() => {
    switch (customization.density) {
      case 'compact':
        return { barPy: 'py-1', cardPad: 'p-4 sm:p-5', tabPy: 'py-1.5' };
      case 'comfortable':
        return { barPy: 'py-2.5', cardPad: 'p-7 sm:p-8', tabPy: 'py-2.5' };
      default:
        return { barPy: 'py-1.5', cardPad: 'p-5 sm:p-6', tabPy: 'py-2' };
    }
  }, [customization.density]);

  const fontStyle = useMemo<React.CSSProperties>(() => {
    const family =
      customization.fontFamily === 'serif'
        ? 'Georgia, "Times New Roman", serif'
        : customization.fontFamily === 'mono'
        ? '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace'
        : 'inherit';
    return {
      fontFamily: family,
      fontSize: `${customization.fontScale}%`,
    };
  }, [customization.fontFamily, customization.fontScale]);

  const activeGradientPreset = useMemo(
    () =>
      WALLPAPER_PRESETS.find((p) => p.id === customization.wallpaperPreset) ||
      WALLPAPER_PRESETS[0],
    [customization.wallpaperPreset]
  );

  const homeBackgroundStyle = useMemo<React.CSSProperties>(() => {
    if (customization.wallpaperType === 'gradient') {
      return {
        background: isDark ? activeGradientPreset.darkBg : activeGradientPreset.lightBg,
        backgroundSize:
          activeGradientPreset.id === 'technical-grid' ? '28px 28px' : undefined,
      };
    }
    return {};
  }, [activeGradientPreset, customization.wallpaperType, isDark]);

  const activeEngineMeta = ENGINES.find((e) => e.id === activeTab.engine) || ENGINES[0];
  const activeContainerMeta =
    FIRES_CONTAINERS.find((c) => c.id === activeTab.containerId) || FIRES_CONTAINERS[0];
  const activeDownloadsCount = downloads.filter(
    (d) => d.status === 'downloading' || d.status === 'queued'
  ).length;

  const activeExtEffects = useMemo(() => {
    const effects = new Set<string>();
    for (const id of installedExtIds) {
      const found = extensionsCatalog.find((e) => e.id === id);
      if (found) {
        effects.add(found.effectKey);
      } else {
        if (id === 'ext-mobile-reflow') effects.add('mobile-fit');
        if (id === 'ext-wiki-mobile-pro') effects.add('wiki-reader-clean');
        if (id === 'ext-github-mobile-wrap') effects.add('github-code-wrap');
        if (id === 'ext-dark-reader-mobile') effects.add('dark-reader');
        if (id === 'ext-ublock-fires-mobile') effects.add('adblock-plus');
        if (id === 'ext-gamedev-fps-hud') effects.add('gamedev-devtools');
      }
    }
    return effects;
  }, [extensionsCatalog, installedExtIds]);

  const buildProxyUrl = useCallback(
    (tab: BrowserTabState, url: string) => {
      const useMobileLayout = isCompactViewport || customization.uaMode === 'fires-mobile';
      const params = new URLSearchParams({
        url,
        etp: customization.etpLevel,
        httpsOnly: customization.httpsOnly ? '1' : '0',
        dnt: customization.doNotTrack ? '1' : '0',
        noImages: customization.blockImages ? '1' : '0',
        noJs: customization.disableJavaScript ? '1' : '0',
        muteAll: tab.muted || customization.muteAllByDefault ? '1' : '0',
        smoothScroll: customization.smoothScroll ? '1' : '0',
        ua: useMobileLayout ? 'fires-mobile' : 'fires-desktop',
        mobileViewport: useMobileLayout ? '1' : '0',
        extMobileFit: activeExtEffects.has('mobile-fit') ? '1' : '0',
        extWikiClean: activeExtEffects.has('wiki-reader-clean') ? '1' : '0',
        extGithubCode: activeExtEffects.has('github-code-wrap') ? '1' : '0',
        extDark: activeExtEffects.has('dark-reader') ? '1' : '0',
        extAdblock: activeExtEffects.has('adblock-plus') ? '1' : '0',
        extFps: activeExtEffects.has('gamedev-devtools') ? '1' : '0',
      });
      return `/api/proxy?${params.toString()}`;
    },
    [
      activeExtEffects,
      customization.blockImages,
      customization.disableJavaScript,
      customization.doNotTrack,
      customization.etpLevel,
      customization.httpsOnly,
      customization.muteAllByDefault,
      customization.smoothScroll,
      customization.uaMode,
      isCompactViewport,
    ]
  );

  const proxyIframeSrc = useMemo(() => {
    if (currentEntry.kind !== 'page') return '';
    return buildProxyUrl(activeTab, currentEntry.value);
  }, [activeTab, buildProxyUrl, currentEntry.kind, currentEntry.value]);

  const findMatchCount = useMemo(() => {
    const q = findQuery.trim().toLowerCase();
    if (!q) return 0;
    if (currentEntry.kind === 'search') {
      const text = [
        activeTab.aiAnswer || '',
        ...activeTab.searchResults.map((r) => `${r.title} ${r.snippet}`),
      ]
        .join(' ')
        .toLowerCase();
      return text.split(q).length - 1;
    }
    if (currentEntry.kind === 'page' && activeTab.pageData) {
      const text = [
        activeTab.pageData.title,
        activeTab.pageData.description,
        ...activeTab.pageData.blocks.map((b) => b.text),
      ]
        .join(' ')
        .toLowerCase();
      return text.split(q).length - 1;
    }
    return 0;
  }, [activeTab.aiAnswer, activeTab.pageData, activeTab.searchResults, currentEntry.kind, findQuery]);

  const splitTab = splitTabId ? tabs.find((t) => t.id === splitTabId && t.id !== activeTab.id) : null;
  const splitEntry = splitTab ? splitTab.history[splitTab.historyIndex] : null;

  const renderTabPill = (tab: BrowserTabState, vertical: boolean) => {
    const isActive = tab.id === activeTab.id;
    const container =
      FIRES_CONTAINERS.find((c) => c.id === tab.containerId) || FIRES_CONTAINERS[0];
    const entry = tab.history[tab.historyIndex];
    const hoverText = customization.hoverTabPreview
      ? `${tab.title}${entry?.value ? ` — ${entry.value}` : ''}${
          tab.trackersBlocked > 0 ? ` · Трекеры: ${tab.trackersBlocked}` : ''
        }`
      : tab.title;

    const styleVariantClasses = vertical
      ? `${radiusClasses.control} w-full border ${
          isActive
            ? 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-xs'
            : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-800/50'
        }`
      : customization.tabStyle === 'attached'
      ? `rounded-t-xl rounded-b-none border border-b-0 max-w-[235px] min-w-[125px] ${
          isActive
            ? 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 z-10'
            : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-800/50'
        }`
      : customization.tabStyle === 'minimal'
      ? `rounded-lg border-b-2 border-t-0 border-x-0 max-w-[235px] min-w-[120px] ${
          isActive
            ? 'bg-white/70 dark:bg-zinc-900/70 border-zinc-900 dark:border-zinc-100 text-zinc-950 dark:text-white'
            : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-200/40 dark:hover:bg-zinc-800/40'
        }`
      : `${
          customization.tabPosition === 'bottom' ? 'rounded-xl' : radiusClasses.tab
        } border max-w-[235px] min-w-[125px] ${
          isActive
            ? 'bg-white dark:bg-zinc-900 border-zinc-200/90 dark:border-zinc-700/80 text-zinc-950 dark:text-white shadow-xs'
            : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-800/45'
        }`;

    return (
      <div
        key={tab.id}
        className={`group flex items-center gap-1.5 px-3 ${densitySpacing.tabPy} text-xs font-medium transition-all ${styleVariantClasses}`}
        style={
          isActive && container.color !== 'transparent'
            ? { borderTopColor: vertical ? undefined : container.color, borderTopWidth: vertical ? undefined : '2px' }
            : undefined
        }
      >
        {tab.isPrivate && (
          <span title="Приватная вкладка" className="shrink-0 flex items-center">
            <EyeOff className="w-3 h-3 text-zinc-500 dark:text-zinc-300" />
          </span>
        )}

        {!tab.isPrivate && container.color !== 'transparent' && (
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: container.color }}
            title={`Контейнер: ${container.label}`}
          />
        )}

        <button
          type="button"
          onClick={() => setActiveTabId(tab.id)}
          className="flex-1 truncate text-left focus:outline-none"
          title={hoverText}
        >
          {tab.loading ? 'Загрузка...' : tab.title}
        </button>

        <button
          type="button"
          onClick={() =>
            updateTab(tab.id, (t) => ({ ...t, muted: !t.muted, reloadNonce: t.reloadNonce + 1 }))
          }
          title={tab.muted ? 'Включить звук вкладки' : 'Отключить звук вкладки'}
          aria-label={tab.muted ? 'Включить звук' : 'Отключить звук'}
          className={`p-0.5 rounded transition-opacity shrink-0 focus:outline-none ${
            tab.muted
              ? 'text-red-500 opacity-100'
              : 'text-zinc-400 opacity-0 group-hover:opacity-100 hover:text-zinc-800 dark:hover:text-zinc-200'
          }`}
        >
          {tab.muted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
        </button>

        <button
          type="button"
          onClick={() => handleTogglePinTab(tab.id)}
          title={tab.pinned ? 'Открепить вкладку' : 'Закрепить вкладку'}
          aria-label={tab.pinned ? `Открепить ${tab.title}` : `Закрепить ${tab.title}`}
          className={`p-0.5 rounded transition-opacity shrink-0 focus:outline-none ${
            tab.pinned
              ? 'text-zinc-800 dark:text-zinc-200 opacity-100'
              : 'text-zinc-400 opacity-0 group-hover:opacity-100 hover:text-zinc-800 dark:hover:text-zinc-200'
          }`}
        >
          {tab.pinned ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
        </button>

        {!tab.pinned && (
          <button
            type="button"
            onClick={() => handleCloseTab(tab.id)}
            aria-label={`Закрыть вкладку ${tab.title}`}
            className="p-0.5 rounded-full text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200/80 dark:hover:bg-zinc-700/80 shrink-0 focus:outline-none"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
    );
  };

  const showBookmarksNow =
    (customization.bookmarksBarMode === 'always' ||
      (customization.bookmarksBarMode === 'newtab' && currentEntry.kind === 'home')) &&
    customization.showBookmarksBar &&
    customization.bookmarks.length > 0;

  // Row 1: Dedicated full-width tab strip (Chrome + Proton minimalist style)
  const renderDedicatedTabRow = () => (
    <div
      className={`fires-tabstrip flex items-center gap-2 px-2.5 ${
        customization.tabStyle === 'attached' ? 'pt-1.5 pb-0' : 'py-1.5'
      } bg-zinc-100 dark:bg-[#09090b] border-b border-zinc-200/80 dark:border-zinc-800/80 shrink-0`}
    >
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="Открыть навигацию Firas"
        title="Рабочее пространство"
        className="flex items-center gap-1.5 p-1 rounded-lg hover:bg-zinc-200/70 dark:hover:bg-zinc-800/70 transition-colors shrink-0 focus:outline-none"
      >
        {customization.showLogo ? (
          <FiresLogo size={24} />
        ) : (
          <Layers className="w-4 h-4 text-zinc-600 dark:text-zinc-300" />
        )}
      </button>

      <div className="flex-1 min-w-0 flex items-center gap-1 overflow-x-auto no-scrollbar">
        {sortedTabs.map((tab) => renderTabPill(tab, false))}
        <button
          type="button"
          onClick={() => handleAddNewTab(false)}
          aria-label="Открыть новую вкладку (Ctrl+T)"
          title="Новая вкладка (Ctrl+T)"
          className="p-1.5 rounded-full text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-200/70 dark:hover:bg-zinc-800 shrink-0 transition-colors focus:outline-none"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {closedTabs.length > 0 && (
          <button
            type="button"
            onClick={() => handleRestoreLastClosedTab()}
            title="Восстановить закрытую вкладку (Ctrl+Shift+T)"
            aria-label="Восстановить закрытую вкладку"
            className="p-1.5 rounded-full text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-200/70 dark:hover:bg-zinc-800 transition-colors focus:outline-none"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          type="button"
          onClick={() => handleAddNewTab(true)}
          title="Приватная вкладка (Ctrl+Shift+P)"
          aria-label="Открыть приватную вкладку"
          className="hidden sm:inline-flex p-1.5 rounded-full text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-200/70 dark:hover:bg-zinc-800 transition-colors focus:outline-none"
        >
          <EyeOff className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );

  // Unified Overflow Menu Popover
  const renderUnifiedMenuPopover = () => (
    <div
      role="menu"
      aria-label="Меню Fires"
      className="absolute right-0 top-full mt-2 w-[min(18.5rem,calc(100vw-1rem))] rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl z-50 overflow-hidden text-xs"
    >
      {/* Quick action strip: Zoom & Theme & Private & Screenshot */}
      <div className="px-3.5 py-2.5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-2 bg-zinc-50/70 dark:bg-zinc-950/60">
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Уменьшить масштаб"
            onClick={() =>
              updateTab(activeTab.id, (tab) => ({
                ...tab,
                zoom: Math.max(75, tab.zoom - 10),
              }))
            }
            className="p-1.5 rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200/70 dark:hover:bg-zinc-800"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() =>
              updateTab(activeTab.id, (tab) => ({
                ...tab,
                zoom: customization.defaultZoom,
              }))
            }
            title="Сбросить масштаб"
            className="px-1.5 py-1 rounded text-[11px] font-mono tabular-nums text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200/70 dark:hover:bg-zinc-800"
          >
            {activeTab.zoom}%
          </button>
          <button
            type="button"
            aria-label="Увеличить масштаб"
            onClick={() =>
              updateTab(activeTab.id, (tab) => ({
                ...tab,
                zoom: Math.min(150, tab.zoom + 10),
              }))
            }
            className="p-1.5 rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200/70 dark:hover:bg-zinc-800"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-1">
          {onToggleTheme && (
            <button
              type="button"
              onClick={() => onToggleTheme()}
              title={isDark ? 'Включить светлую тему' : 'Включить тёмную тему'}
              className="p-1.5 rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200/70 dark:hover:bg-zinc-800"
            >
              {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              handleTakeScreenshot();
              setUnifiedMenuOpen(false);
            }}
            title="Снимок экрана"
            className="p-1.5 rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200/70 dark:hover:bg-zinc-800"
          >
            <Camera className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              checkNetwork();
            }}
            title={network.online ? `Онлайн (${network.latencyMs ?? 0} мс)` : 'Проверить сеть'}
            className="p-1.5 rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200/70 dark:hover:bg-zinc-800"
          >
            {network.online === false ? (
              <WifiOff className="w-3.5 h-3.5 text-red-500" />
            ) : (
              <Wifi className="w-3.5 h-3.5 text-emerald-500" />
            )}
          </button>
        </div>
      </div>

      {/* Main actions */}
      <div className="p-1.5 space-y-0.5 max-h-[65vh] overflow-y-auto">
        <button
          type="button"
          onClick={() => {
            setUnifiedMenuOpen(false);
            handleAddNewTab(true);
          }}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <span className="flex items-center gap-2.5">
            <EyeOff className="w-4 h-4 text-zinc-400" />
            <span>Новое приватное окно</span>
          </span>
          <span className="text-[10px] font-mono text-zinc-400">Ctrl+Shift+P</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setUnifiedMenuOpen(false);
            onOpenAiChat(activeTab.aiProvider);
          }}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <span className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-zinc-400" />
            <span>Нейрочат & Studio AI</span>
          </span>
          <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
        </button>

        <button
          type="button"
          onClick={() => {
            setUnifiedMenuOpen(false);
            onOpenMessengerFull();
          }}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <span className="flex items-center gap-2.5">
            <MessageSquare className="w-4 h-4 text-zinc-400" />
            <span>Мессенджер Firas</span>
          </span>
          {messengerBadgeCount > 0 ? (
            <span className="px-1.5 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-mono tabular-nums font-semibold">
              {messengerBadgeCount}
            </span>
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            setUnifiedMenuOpen(false);
            onOpenCloud();
          }}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <span className="flex items-center gap-2.5">
            <HardDrive className="w-4 h-4 text-zinc-400" />
            <span>Облако 1 ТБ · TeraBox</span>
          </span>
          <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
        </button>

        <button
          type="button"
          onClick={() => {
            setUnifiedMenuOpen(false);
            setDownloaderOpen(true);
          }}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <span className="flex items-center gap-2.5">
            <Download className="w-4 h-4 text-zinc-400" />
            <span>Загрузчик (GitHub & Play)</span>
          </span>
          <span className="text-[10px] font-mono text-zinc-400">Ctrl+J</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setUnifiedMenuOpen(false);
            setExtensionsOpen(true);
          }}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <span className="flex items-center gap-2.5">
            <Puzzle className="w-4 h-4 text-zinc-400" />
            <span>Расширения (Телефон / Планшет)</span>
          </span>
          <span className="text-[10px] font-mono text-zinc-400 tabular-nums">
            {installedExtIds.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            const nextMode =
              customization.uaMode === 'fires-mobile' ? 'fires-desktop' : 'fires-mobile';
            updateCustomization({ uaMode: nextMode });
            updateTab(activeTab.id, (tab) => ({ ...tab, reloadNonce: tab.reloadNonce + 1 }));
            setUnifiedMenuOpen(false);
          }}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <span className="flex items-center gap-2.5">
            {customization.uaMode === 'fires-mobile' ? (
              <Smartphone className="w-4 h-4 text-emerald-500" />
            ) : (
              <Monitor className="w-4 h-4 text-zinc-400" />
            )}
            <span>Режим сайтов</span>
          </span>
          <span className="text-[10px] font-mono text-zinc-400">
            {customization.uaMode === 'fires-mobile' ? 'Мобильный' : 'Авто / ПК'}
          </span>
        </button>

        <div className="my-1 border-t border-zinc-100 dark:border-zinc-800" />

        <button
          type="button"
          onClick={() => {
            setUnifiedMenuOpen(false);
            openDrawerSection('bookmarks');
          }}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <span className="flex items-center gap-2.5">
            <Star className="w-4 h-4 text-zinc-400" />
            <span>Закладки</span>
          </span>
          <span className="text-[10px] font-mono text-zinc-400">{customization.bookmarks.length}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setUnifiedMenuOpen(false);
            openDrawerSection('history');
          }}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <span className="flex items-center gap-2.5">
            <History className="w-4 h-4 text-zinc-400" />
            <span>Журнал истории</span>
          </span>
          <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
        </button>

        {tabs.length > 1 && (
          <button
            type="button"
            onClick={() => {
              setUnifiedMenuOpen(false);
              if (splitTabId) {
                setSplitTabId(null);
              } else {
                const other = tabs.find((t) => t.id !== activeTab.id);
                if (other) setSplitTabId(other.id);
              }
            }}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <span className="flex items-center gap-2.5">
              <Columns2 className="w-4 h-4 text-zinc-400" />
              <span>{splitTabId ? 'Закрыть Split View' : 'Разделить экран'}</span>
            </span>
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            setUnifiedMenuOpen(false);
            setFindOpen((v) => !v);
          }}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <span className="flex items-center gap-2.5">
            <Search className="w-4 h-4 text-zinc-400" />
            <span>Найти на странице</span>
          </span>
          <span className="text-[10px] font-mono text-zinc-400">Ctrl+F</span>
        </button>

        <div className="px-3 py-1.5 flex items-center justify-between gap-2">
          <span className="flex items-center gap-2.5 text-zinc-600 dark:text-zinc-300">
            <Layers className="w-4 h-4 text-zinc-400" />
            <span>Контейнер</span>
          </span>
          <select
            aria-label="Контейнер вкладки"
            value={activeTab.containerId}
            onChange={(e) =>
              updateTab(activeTab.id, (tab) => ({
                ...tab,
                containerId: e.target.value as FiresContainerId,
              }))
            }
            className="px-2 py-1 text-[11px] rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 focus:outline-none"
          >
            {FIRES_CONTAINERS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={() => {
            setUnifiedMenuOpen(false);
            openDrawerSection('engine');
          }}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <span className="flex items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Fires Shield</span>
          </span>
          <span className="text-[11px] font-mono text-zinc-400">{activeTab.trackersBlocked}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setUnifiedMenuOpen(false);
            setDevtoolsOpen((v) => !v);
          }}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <span className="flex items-center gap-2.5">
            <Terminal className="w-4 h-4 text-zinc-400" />
            <span>Консоль DevTools</span>
          </span>
          <span className="text-[10px] font-mono text-zinc-400">F12</span>
        </button>

        {isStaffRole(currentUser?.role) && currentUser && (
          <button
            type="button"
            onClick={() => {
              setUnifiedMenuOpen(false);
              onOpenAdminPanel();
            }}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-zinc-800 dark:text-zinc-100 font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <span className="flex items-center gap-2.5">
              {currentUser.role === 'owner' ? (
                <Crown className="w-4 h-4 text-amber-500" />
              ) : (
                <Shield className="w-4 h-4 text-zinc-500" />
              )}
              <span>{ROLE_LABEL_RU[currentUser.role]}</span>
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
          </button>
        )}

        <div className="my-1 border-t border-zinc-100 dark:border-zinc-800" />

        <button
          type="button"
          onClick={() => {
            setUnifiedMenuOpen(false);
            openDrawerSection('appearance');
          }}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl font-medium text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <span className="flex items-center gap-2.5">
            <Sliders className="w-4 h-4 text-zinc-500" />
            <span>Настройки и кастомизация</span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setUnifiedMenuOpen(false);
            setOpenSourceOpen(true);
          }}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <span className="flex items-center gap-2.5">
            <Code2 className="w-4 h-4 text-zinc-400" />
            <span>Открытый исходный код (MIT)</span>
          </span>
        </button>
      </div>
    </div>
  );

  // Row 2: Clean Minimalist Navigation + Pill Omnibox + Collapsible Unified Toolbar
  const renderNavigationToolbar = () => (
    <div
      className={`fires-navbar flex items-center gap-1 sm:gap-2 px-2 sm:px-3 ${densitySpacing.barPy} border-b border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shrink-0 min-w-0`}
    >
      {/* Left Navigation Buttons (borderless minimal icons) */}
      <div className="flex items-center gap-0.5 shrink-0">
        <button
          type="button"
          onClick={handleBack}
          disabled={activeTab.historyIndex <= 0}
          aria-label="Назад"
          className="p-1.5 rounded-full text-zinc-600 dark:text-zinc-300 disabled:opacity-30 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus:outline-none"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleForward}
          disabled={activeTab.historyIndex >= activeTab.history.length - 1}
          aria-label="Вперёд"
          className="hidden sm:inline-flex p-1.5 rounded-full text-zinc-600 dark:text-zinc-300 disabled:opacity-30 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus:outline-none"
        >
          <ArrowRight className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleReload}
          aria-label="Обновить страницу"
          className="p-1.5 rounded-full text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus:outline-none"
        >
          <RotateCw className={`w-4 h-4 ${activeTab.loading ? 'animate-spin' : ''}`} />
        </button>
        {customization.toolbarButtons.home && (
          <button
            type="button"
            onClick={handleHome}
            aria-label="На стартовую страницу Fires"
            className="hidden sm:inline-flex p-1.5 rounded-full text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus:outline-none"
          >
            <Home className="w-4 h-4" />
          </button>
        )}
      </div>

      {customization.flexibleSpaces && <div className="hidden md:block flex-1 max-w-10" />}

      {/* Center Omnibox Pill */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          navigateFromInput(addressInput);
        }}
        className={`fires-omnibox flex-1 min-w-0 flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 ${
          customization.cornerRadius === 'sharp' ? 'rounded-sm' : 'rounded-full'
        } bg-zinc-100 dark:bg-zinc-950/90 hover:bg-zinc-200/60 dark:hover:bg-zinc-800/70 focus-within:bg-white dark:focus-within:bg-zinc-950 ring-1 ring-transparent focus-within:ring-zinc-300 dark:focus-within:ring-zinc-700 transition-all`}
      >
        {activeTab.isPrivate ? (
          <EyeOff className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
        ) : currentEntry.kind === 'page' && customization.httpsOnly ? (
          <Lock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
        ) : (
          <Search className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
        )}

        <input
          ref={addressInputRef}
          type="text"
          value={addressInput}
          onChange={(e) => setAddressInput(e.target.value)}
          placeholder={`Поиск в ${activeEngineMeta.label} или URL...`}
          className="w-full min-w-0 bg-transparent text-xs sm:text-[13px] text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none"
        />

        {currentEntry.kind === 'page' && (
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onClick={() =>
                updateTab(activeTab.id, (tab) => ({
                  ...tab,
                  renderMode: tab.renderMode === 'reader' ? 'web' : 'reader',
                }))
              }
              title={activeTab.renderMode === 'reader' ? 'Обычный режим сайта' : 'Режим чтения'}
              className={`p-1 rounded-full transition-colors focus:outline-none ${
                activeTab.renderMode === 'reader'
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                  : 'text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleToggleCurrentBookmark}
              title={currentBookmark ? 'Убрать из закладок (Ctrl+D)' : 'В закладки (Ctrl+D)'}
              aria-label="Переключить закладку"
              className="hidden sm:inline-flex p-1 rounded-full text-zinc-400 hover:text-amber-500 transition-colors focus:outline-none"
            >
              <Star
                className={`w-3.5 h-3.5 ${
                  currentBookmark ? 'fill-amber-500 text-amber-500' : ''
                }`}
              />
            </button>
          </div>
        )}

        <select
          aria-label="Поисковая система"
          value={activeTab.engine}
          onChange={(e) => {
            const nextEngine = e.target.value as SearchEngineId;
            updateTab(activeTab.id, (tab) => ({ ...tab, engine: nextEngine }));
            if (currentEntry.kind === 'search' && currentEntry.value) {
              executeNavigation(
                activeTab.id,
                { kind: 'search', value: currentEntry.value, engine: nextEngine },
                true
              );
            }
          }}
          className="hidden sm:block text-[11px] font-medium bg-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 focus:outline-none shrink-0 cursor-pointer"
        >
          {ENGINES.map((eng) => (
            <option
              key={eng.id}
              value={eng.id}
              className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
            >
              {eng.label}
            </option>
          ))}
        </select>
      </form>

      {customization.flexibleSpaces && <div className="hidden md:block flex-1 max-w-10" />}

      {/* Right Toolbar Controls: Either Unified Single-Button Compact Mode OR Expanded Toolbar */}
      <div className="flex items-center gap-1 shrink-0">
        {!customization.compactToolbarMenu && (
          <div className="hidden md:flex items-center gap-1">
            {customization.toolbarButtons.containers && (
              <select
                aria-label="Контейнер вкладки"
                value={activeTab.containerId}
                onChange={(e) =>
                  updateTab(activeTab.id, (tab) => ({
                    ...tab,
                    containerId: e.target.value as FiresContainerId,
                  }))
                }
                className="px-2 py-1 text-xs rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 focus:outline-none"
              >
                {FIRES_CONTAINERS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            )}

            {customization.toolbarButtons.zoom && (
              <div className="flex items-center rounded-full bg-zinc-100 dark:bg-zinc-800 px-1">
                <button
                  type="button"
                  aria-label="Уменьшить масштаб"
                  onClick={() =>
                    updateTab(activeTab.id, (tab) => ({
                      ...tab,
                      zoom: Math.max(75, tab.zoom - 10),
                    }))
                  }
                  className="p-1 text-zinc-600 dark:text-zinc-300"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="px-1 text-[11px] font-mono tabular-nums text-zinc-700 dark:text-zinc-200">
                  {activeTab.zoom}%
                </span>
                <button
                  type="button"
                  aria-label="Увеличить масштаб"
                  onClick={() =>
                    updateTab(activeTab.id, (tab) => ({
                      ...tab,
                      zoom: Math.min(150, tab.zoom + 10),
                    }))
                  }
                  className="p-1 text-zinc-600 dark:text-zinc-300"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {customization.toolbarButtons.splitView && tabs.length > 1 && (
              <button
                type="button"
                onClick={() => {
                  if (splitTabId) setSplitTabId(null);
                  else {
                    const other = tabs.find((t) => t.id !== activeTab.id);
                    if (other) setSplitTabId(other.id);
                  }
                }}
                title="Разделение экрана"
                className={`p-1.5 rounded-full transition-colors ${
                  splitTabId
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                    : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                <Columns2 className="w-4 h-4" />
              </button>
            )}

            {customization.toolbarButtons.findInPage && (
              <button
                type="button"
                onClick={() => setFindOpen((v) => !v)}
                title="Поиск по странице (Ctrl+F)"
                className="p-1.5 rounded-full text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <Search className="w-4 h-4" />
              </button>
            )}

            {customization.toolbarButtons.screenshot && (
              <button
                type="button"
                onClick={handleTakeScreenshot}
                title="Снимок экрана"
                className="p-1.5 rounded-full text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <Camera className="w-4 h-4" />
              </button>
            )}

            {customization.toolbarButtons.devtools && (
              <button
                type="button"
                onClick={() => setDevtoolsOpen((v) => !v)}
                title="DevTools (F12)"
                className="p-1.5 rounded-full text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <Terminal className="w-4 h-4" />
              </button>
            )}

            {customization.toolbarButtons.cloud && (
              <button
                type="button"
                onClick={onOpenCloud}
                title="Облако 1 ТБ"
                className="p-1.5 rounded-full text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <HardDrive className="w-4 h-4" />
              </button>
            )}

            {customization.toolbarButtons.messenger && (
              <button
                type="button"
                onClick={onOpenMessengerFull}
                title="Мессенджер"
                className="relative p-1.5 rounded-full text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <MessageSquare className="w-4 h-4" />
                {messengerBadgeCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-600 text-white text-[9px] flex items-center justify-center font-mono">
                    {messengerBadgeCount}
                  </span>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={() => openDrawerSection('appearance')}
              title="Настройки и кастомизация"
              className="p-1.5 rounded-full text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <Sliders className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Essential subtle actions always accessible cleanly */}
        {currentEntry.kind !== 'about' && currentEntry.kind !== 'home' && (
          <button
            type="button"
            onClick={handleSaveCurrentToNotes}
            title="Сохранить страницу в Заметки"
            className="p-1.5 rounded-full text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus:outline-none"
          >
            <FilePlus className="w-4 h-4" />
          </button>
        )}

        {customization.toolbarButtons.downloads && (
          <button
            type="button"
            onClick={() => setDownloaderOpen(true)}
            title="Загрузчик Fires: GitHub & Google Play (Ctrl+J)"
            className="relative p-1.5 rounded-full text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus:outline-none"
          >
            <Download className="w-4 h-4" />
            {activeDownloadsCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 px-1 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-[9px] font-mono tabular-nums font-bold">
                {activeDownloadsCount}
              </span>
            )}
          </button>
        )}

        {customization.toolbarButtons.aiChat && (
          <button
            type="button"
            onClick={() => onOpenAiChat(activeTab.aiProvider)}
            title="Нейрочат и Studio AI"
            style={{ backgroundColor: accent.bg, color: accent.fg }}
            className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full hover:opacity-90 transition-opacity whitespace-nowrap shrink-0 focus:outline-none"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Нейрочат</span>
          </button>
        )}

        {/* Compact User Avatar Button */}
        <button
          type="button"
          onClick={() => onOpenAuth()}
          title={currentUser ? `Аккаунт: ${currentUser.displayName}` : 'Войти в аккаунт'}
          className="inline-flex items-center gap-1.5 p-1 sm:px-2 sm:py-1 rounded-full text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus:outline-none"
        >
          {currentUser ? (
            <UserAvatar name={currentUser.displayName} avatar={currentUser.avatar} size="xs" />
          ) : (
            <UserIcon className="w-4 h-4" />
          )}
          <span className="hidden lg:inline max-w-[90px] truncate">
            {currentUser ? currentUser.displayName : 'Войти'}
          </span>
        </button>

        {/* Unified Overflow Menu Button (combines secondary controls into 1 clean button) */}
        <div className="relative" ref={unifiedMenuRef}>
          <button
            type="button"
            onClick={() => setUnifiedMenuOpen((v) => !v)}
            aria-expanded={unifiedMenuOpen}
            aria-label="Ещё и настройки Fires"
            title="Меню инструментов и настроек Fires"
            className={`p-1.5 rounded-full transition-colors focus:outline-none ${
              unifiedMenuOpen
                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            <Menu className="w-4 h-4" />
          </button>
          {unifiedMenuOpen && renderUnifiedMenuPopover()}
        </div>
      </div>
    </div>
  );

  return (
    <div
      className="fires-browser-root h-screen supports-[height:100dvh]:h-dvh w-full flex flex-col bg-white dark:bg-[#09090b] text-zinc-900 dark:text-zinc-100 overflow-hidden"
      style={fontStyle}
    >
      {customization.customCss && (
        <style>{customization.customCss}</style>
      )}

      {/* Row 1: Dedicated Tab Strip (when tabPosition === 'top') */}
      {customization.tabPosition === 'top' && renderDedicatedTabRow()}

      {/* Row 2: Sleek Navigation + Pill Omnibox + Unified Menu */}
      {renderNavigationToolbar()}

      {browserConfig?.announcement && (
        <div className="px-4 py-1.5 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200/80 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-300 flex items-center justify-center gap-2 shrink-0">
          <Shield className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
          <span>{browserConfig.announcement}</span>
        </div>
      )}

      {/* Find In Page Bar (Ctrl+F) */}
      {findOpen && (
        <div className="px-4 py-1.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 flex items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 text-zinc-400" />
            <input
              type="text"
              autoFocus
              value={findQuery}
              onChange={(e) => setFindQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && findQuery.trim()) {
                  const winFind = (window as unknown as { find?: (q: string) => boolean }).find;
                  if (winFind) winFind(findQuery.trim());
                } else if (e.key === 'Escape') {
                  setFindOpen(false);
                }
              }}
              placeholder="Найти на странице..."
              className="flex-1 px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none"
            />
            {findQuery.trim() && (
              <span className="font-mono tabular-nums text-zinc-500 dark:text-zinc-400 shrink-0">
                Совпадений: {findMatchCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                const winFind = (window as unknown as { find?: (q: string, c?: boolean, b?: boolean) => boolean }).find;
                if (winFind && findQuery.trim()) winFind(findQuery.trim(), false, true);
              }}
              className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800"
              aria-label="Предыдущее"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                const winFind = (window as unknown as { find?: (q: string) => boolean }).find;
                if (winFind && findQuery.trim()) winFind(findQuery.trim());
              }}
              className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800"
              aria-label="Следующее"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setFindOpen(false)}
              className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800"
              aria-label="Закрыть поиск"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Bookmarks Bar (scrolls horizontally on phones without overlapping about:fires) */}
      {showBookmarksNow && (
        <div className="fires-bookmarks w-full px-3 py-1 border-b border-zinc-200/70 dark:border-zinc-800/70 bg-white/95 dark:bg-zinc-900/95 flex items-center justify-between gap-3 shrink-0 overflow-x-auto no-scrollbar touch-pan-x">
          <div className="flex items-center gap-1 shrink-0">
            {customization.bookmarks.map((bm) => (
              <button
                key={bm.id}
                type="button"
                onClick={() => navigateFromInput(bm.url)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors whitespace-nowrap shrink-0 focus:outline-none"
              >
                <Star className="w-3 h-3 text-amber-500 shrink-0" />
                <span>{bm.title}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => navigateFromInput('about:fires')}
              className="px-2 py-0.5 text-[11px] font-mono rounded-full text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 whitespace-nowrap shrink-0 focus:outline-none"
            >
              about:fires
            </button>
            <button
              type="button"
              onClick={() => setOpenSourceOpen(true)}
              className="px-2 py-0.5 text-[11px] font-medium rounded-full text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 whitespace-nowrap shrink-0 focus:outline-none"
            >
              Open Source (MIT)
            </button>
          </div>
        </div>
      )}

      {/* Middle Area (Supports Vertical Left Tabs + Main Viewport + Responsive Split View) */}
      <div className={`flex-1 flex min-h-0 overflow-hidden ${splitTab ? 'flex-col md:flex-row' : ''}`}>
        {customization.tabPosition === 'left' && (
          <aside className="w-36 sm:w-56 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-950 p-2 flex flex-col gap-2 overflow-y-auto">
            <div className="flex items-center justify-between px-1.5 py-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Вкладки ({sortedTabs.length})
              </span>
              <button
                type="button"
                onClick={() => handleAddNewTab(false)}
                aria-label="Открыть новую вкладку"
                className={`p-1 ${radiusClasses.control} text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-200/70 dark:hover:bg-slate-800 focus:outline-none`}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-1 flex-1">
              {sortedTabs.map((tab) => renderTabPill(tab, true))}
            </div>
          </aside>
        )}

        {/* Primary Viewport */}
        <div
          className={`flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden bg-white dark:bg-slate-900 relative ${
            customization.caretBrowsing ? 'select-text' : ''
          }`}
        >
          {/* MINIMALIST HOME (Google + Modern Browser Style) */}
          {currentEntry.kind === 'home' && (
            <div
              className="fires-home relative flex-1 min-w-0 flex flex-col justify-between px-4 sm:px-8 py-6 bg-white dark:bg-[#09090b] overflow-y-auto overflow-x-hidden gap-8"
              style={homeBackgroundStyle}
            >
              {customization.wallpaperType === 'custom' && customization.wallpaperUrl && (
                <>
                  <div
                    className="pointer-events-none absolute inset-0 bg-cover bg-center"
                    style={{
                      backgroundImage: `url(${JSON.stringify(customization.wallpaperUrl)})`,
                      filter:
                        customization.wallpaperBlur > 0
                          ? `blur(${customization.wallpaperBlur}px)`
                          : undefined,
                    }}
                  />
                  <div
                    className="pointer-events-none absolute inset-0"
                    style={{
                      backgroundColor: isDark
                        ? `rgba(9, 9, 11, ${customization.wallpaperDim / 100})`
                        : `rgba(255, 255, 255, ${Math.max(0.08, customization.wallpaperDim / 100)})`,
                    }}
                  />
                </>
              )}

              <div className="relative z-10 flex-1 w-full min-w-0 flex flex-col items-center justify-center py-6 gap-5">
                {customization.showClockWidget && (
                  <div className="text-center space-y-0.5">
                    <div className="text-4xl sm:text-5xl font-light tracking-tight font-mono tabular-nums text-zinc-900 dark:text-zinc-100">
                      {clockNow.toLocaleTimeString('ru-RU', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">
                      {clockNow.toLocaleDateString('ru-RU', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                      })}
                    </div>
                  </div>
                )}

                {/* Centered Brand Header (Logo optional via showLogo toggle) */}
                {(customization.showLogo || customization.customTitle || activeTab.isPrivate) && (
                  <div className="flex flex-col items-center gap-2 text-center">
                    <div className="flex items-center gap-3">
                      {customization.showLogo && <FiresLogo size={42} className="shrink-0" />}
                      {customization.customTitle && (
                        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-950 dark:text-white">
                          {customization.customTitle}
                        </h1>
                      )}
                      {activeTab.isPrivate && (
                        <span className="px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 text-[11px] font-medium">
                          Приватная
                        </span>
                      )}
                    </div>
                    {customization.customSubtitle && (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {customization.customSubtitle}
                      </p>
                    )}
                  </div>
                )}

                {/* Elevated Minimalist Search Bar */}
                <div className="w-full max-w-2xl space-y-3.5 min-w-0">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!homeQuery.trim()) return;
                      navigateFromInput(homeQuery);
                      setHomeQuery('');
                    }}
                    className={`flex items-center gap-2 px-3 sm:px-4 py-1.5 min-w-0 ${
                      customization.cornerRadius === 'sharp' ? 'rounded-sm' : 'rounded-full'
                    } border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm hover:shadow-md focus-within:shadow-md focus-within:border-zinc-300 dark:focus-within:border-zinc-700 transition-all`}
                  >
                    <Search className="w-4 h-4 text-zinc-400 shrink-0" />
                    <input
                      ref={homeInputRef}
                      type="text"
                      autoFocus={customization.autofocusAddressBar}
                      value={homeQuery}
                      onChange={(e) => setHomeQuery(e.target.value)}
                      placeholder="Поиск в интернете, URL или вопрос для нейросети..."
                      className="flex-1 min-w-0 py-2.5 bg-transparent text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none"
                    />
                    {customization.showEngineSelector && (
                      <select
                        aria-label="Поисковая система"
                        value={activeTab.engine}
                        onChange={(e) =>
                          updateTab(activeTab.id, (tab) => ({
                            ...tab,
                            engine: e.target.value as SearchEngineId,
                          }))
                        }
                        className="hidden sm:block text-xs font-medium bg-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 focus:outline-none cursor-pointer pr-1"
                      >
                        {ENGINES.map((eng) => (
                          <option
                            key={eng.id}
                            value={eng.id}
                            className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                          >
                            {eng.label}
                          </option>
                        ))}
                      </select>
                    )}
                    <button
                      type="submit"
                      style={{ backgroundColor: accent.bg, color: accent.fg }}
                      className={`px-4 py-2 text-xs font-medium ${
                        customization.cornerRadius === 'sharp' ? 'rounded-sm' : 'rounded-full'
                      } hover:opacity-90 transition-opacity whitespace-nowrap shrink-0 focus:outline-none`}
                    >
                      Найти
                    </button>
                  </form>

                  {/* Programming & General AI Switcher right below search (swipeable strip on phones) */}
                  {customization.showAiSwitcher && (
                    <div className="w-full flex items-center sm:flex-wrap sm:justify-center gap-1.5 overflow-x-auto no-scrollbar touch-pan-x snap-x snap-mandatory py-1 px-1">
                      {AI_PROVIDERS.map((ai) => {
                        const selected = activeTab.aiProvider === ai.id;
                        return (
                          <button
                            key={ai.id}
                            type="button"
                            onClick={() =>
                              updateTab(activeTab.id, (tab) => ({
                                ...tab,
                                aiProvider: ai.id,
                              }))
                            }
                            style={
                              selected
                                ? { backgroundColor: accent.bg, color: accent.fg }
                                : undefined
                            }
                            className={`snap-start px-3 py-1.5 sm:py-1 text-xs font-medium rounded-full transition-colors whitespace-nowrap shrink-0 focus:outline-none ${
                              selected
                                ? ''
                                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/70'
                            }`}
                          >
                            {ai.label}
                          </button>
                        );
                      })}
                      {customModels.map((cm) => {
                        const cid: AiProviderId = `custom:${cm.id}`;
                        const selected = activeTab.aiProvider === cid;
                        return (
                          <button
                            key={cm.id}
                            type="button"
                            onClick={() =>
                              updateTab(activeTab.id, (tab) => ({
                                ...tab,
                                aiProvider: cid,
                              }))
                            }
                            style={
                              selected
                                ? { backgroundColor: accent.bg, color: accent.fg }
                                : undefined
                            }
                            className={`snap-start px-3 py-1.5 sm:py-1 text-xs font-medium rounded-full transition-colors whitespace-nowrap shrink-0 focus:outline-none ${
                              selected
                                ? ''
                                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/70'
                            }`}
                          >
                            {cm.name}
                          </button>
                        );
                      })}

                      <span className="h-3.5 w-px bg-zinc-200 dark:bg-zinc-800 mx-0.5 hidden sm:inline-block" />

                      <button
                        type="button"
                        onClick={() => onOpenAiChat(activeTab.aiProvider)}
                        className="snap-start inline-flex items-center gap-1 px-3 py-1.5 sm:py-1 text-xs font-medium rounded-full border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors whitespace-nowrap shrink-0 focus:outline-none"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>
                          {activeTab.aiProvider === 'studio_ai'
                            ? 'Открыть Studio AI'
                            : 'Нейрочат'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setHomeAiOpen((v) => !v)}
                        className="snap-start px-2.5 py-1.5 sm:py-1 text-xs font-medium rounded-full text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors whitespace-nowrap shrink-0 focus:outline-none"
                      >
                        Быстрый ИИ
                      </button>
                    </div>
                  )}

                  {/* Quick Inline AI Mini-Chat */}
                  {homeAiOpen && (
                    <div
                      className={`${radiusClasses.card} border border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm p-4 space-y-3 shadow-sm`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                          <Sparkles className="w-4 h-4" />
                          <span>
                            {AI_PROVIDERS.find((a) => a.id === activeTab.aiProvider)?.label ||
                              customModels.find((m) => `custom:${m.id}` === activeTab.aiProvider)
                                ?.name ||
                              'Claude'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onOpenAiChat(activeTab.aiProvider)}
                            className="text-[11px] font-medium text-zinc-600 dark:text-zinc-300 hover:underline focus:outline-none"
                          >
                            Открыть полный Нейрочат
                          </button>
                          <button
                            type="button"
                            onClick={() => setHomeAiOpen(false)}
                            className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 focus:outline-none"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {activeTab.aiChatHistory.length > 0 && (
                        <div className="max-h-56 overflow-y-auto space-y-2 p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-100 dark:border-zinc-800">
                          {activeTab.aiChatHistory.map((m) => (
                            <div
                              key={m.id}
                              className={`text-xs leading-relaxed p-2.5 rounded-lg whitespace-pre-line ${
                                m.role === 'user'
                                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 ml-8'
                                  : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 mr-4'
                              }`}
                            >
                              {m.text.replace(/\*\*/g, '')}
                            </div>
                          ))}
                          {activeTab.aiChatSending && (
                            <div className="text-[11px] text-zinc-400 px-2">
                              Нейросеть отвечает...
                            </div>
                          )}
                        </div>
                      )}

                      {activeTab.aiError && (
                        <div className="text-xs text-red-600 dark:text-red-400">
                          {activeTab.aiError}
                        </div>
                      )}

                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (!homeAiInput.trim() || activeTab.aiChatSending) return;
                          const txt = homeAiInput.trim();
                          setHomeAiInput('');
                          sendUnlimitedAiChat(activeTab.id, txt);
                        }}
                        className="flex items-center gap-2"
                      >
                        <input
                          type="text"
                          value={homeAiInput}
                          onChange={(e) => setHomeAiInput(e.target.value)}
                          placeholder="Спросите о коде или любой задаче без ограничений..."
                          className={`flex-1 px-3 py-2 text-xs ${radiusClasses.control} border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none`}
                        />
                        <button
                          type="submit"
                          disabled={!homeAiInput.trim() || activeTab.aiChatSending}
                          style={{ backgroundColor: accent.bg, color: accent.fg }}
                          className={`inline-flex items-center gap-1 px-3.5 py-2 text-xs font-medium ${radiusClasses.control} disabled:opacity-40 focus:outline-none`}
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Отправить</span>
                        </button>
                      </form>
                    </div>
                  )}

                  {/* Minimalist Browser Shortcuts Strip (swipeable on phones so icons never overlap) */}
                  {customization.showHomeBookmarks && (
                    <div className="w-full pt-2 flex items-start sm:flex-wrap sm:justify-center gap-3.5 sm:gap-5 overflow-x-auto no-scrollbar touch-pan-x snap-x snap-mandatory px-1 pb-1">
                      {customization.bookmarks.slice(0, 5).map((bm) => (
                        <button
                          key={bm.id}
                          type="button"
                          onClick={() => navigateFromInput(bm.url)}
                          className="group w-16 shrink-0 snap-start flex flex-col items-center gap-1.5 text-center focus:outline-none"
                        >
                          <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-900 group-hover:bg-zinc-200/80 dark:group-hover:bg-zinc-800 flex items-center justify-center transition-colors">
                            <Star className="w-4 h-4 text-amber-500" />
                          </div>
                          <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 truncate w-full">
                            {bm.title}
                          </span>
                        </button>
                      ))}

                      <button
                        type="button"
                        onClick={() => onOpenAiChat('studio_ai')}
                        className="group w-16 shrink-0 snap-start flex flex-col items-center gap-1.5 text-center focus:outline-none"
                      >
                        <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-900 group-hover:bg-zinc-200/80 dark:group-hover:bg-zinc-800 flex items-center justify-center transition-colors">
                          <FiresLogo size={26} />
                        </div>
                        <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 truncate w-full">
                          Studio AI
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={onOpenMessengerFull}
                        className="group relative w-16 shrink-0 snap-start flex flex-col items-center gap-1.5 text-center focus:outline-none"
                      >
                        <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-900 group-hover:bg-zinc-200/80 dark:group-hover:bg-zinc-800 flex items-center justify-center transition-colors">
                          <MessageSquare className="w-4 h-4 text-zinc-700 dark:text-zinc-200" />
                        </div>
                        {messengerBadgeCount > 0 && (
                          <span className="absolute top-0 right-1.5 px-1 rounded-full bg-emerald-600 text-white text-[9px] font-mono tabular-nums">
                            {messengerBadgeCount}
                          </span>
                        )}
                        <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 truncate w-full">
                          Мессенджер
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={onOpenCloud}
                        className="group w-16 shrink-0 snap-start flex flex-col items-center gap-1.5 text-center focus:outline-none"
                      >
                        <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-900 group-hover:bg-zinc-200/80 dark:group-hover:bg-zinc-800 flex items-center justify-center transition-colors">
                          <HardDrive className="w-4 h-4 text-zinc-700 dark:text-zinc-200" />
                        </div>
                        <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 truncate w-full">
                          Облако 1 ТБ
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setDownloaderOpen(true)}
                        className="group w-16 shrink-0 snap-start flex flex-col items-center gap-1.5 text-center focus:outline-none"
                      >
                        <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-900 group-hover:bg-zinc-200/80 dark:group-hover:bg-zinc-800 flex items-center justify-center transition-colors">
                          <Download className="w-4 h-4 text-zinc-700 dark:text-zinc-200" />
                        </div>
                        <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 truncate w-full">
                          Загрузчик
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setExtensionsOpen(true)}
                        className="group w-16 shrink-0 snap-start flex flex-col items-center gap-1.5 text-center focus:outline-none"
                      >
                        <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-900 group-hover:bg-zinc-200/80 dark:group-hover:bg-zinc-800 flex items-center justify-center transition-colors">
                          <Puzzle className="w-4 h-4 text-zinc-700 dark:text-zinc-200" />
                        </div>
                        <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 truncate w-full">
                          Расширения
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setOpenSourceOpen(true)}
                        className="group w-16 shrink-0 snap-start flex flex-col items-center gap-1.5 text-center focus:outline-none"
                      >
                        <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-900 group-hover:bg-zinc-200/80 dark:group-hover:bg-zinc-800 flex items-center justify-center transition-colors">
                          <Sliders className="w-4 h-4 text-zinc-700 dark:text-zinc-200" />
                        </div>
                        <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 truncate w-full">
                          Open Source
                        </span>
                      </button>
                    </div>
                  )}

                  {/* Quick Search Examples (subtle text links when enabled) */}
                  {customization.showExamples && (
                    <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
                      {(browserConfig?.searchExamples?.length
                        ? browserConfig.searchExamples
                        : SEARCH_EXAMPLES
                      ).map((example) => (
                        <button
                          key={example}
                          type="button"
                          onClick={() => navigateFromInput(example)}
                          className="px-2.5 py-0.5 text-[11px] rounded-full text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus:outline-none"
                        >
                          {example}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Optional Compact Quick-Launch Card (only if explicitly enabled in settings) */}
                {customization.showQuickLaunch && (
                  <div className="w-full max-w-2xl">
                    <div
                      className={`${radiusClasses.card} border border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm px-4 py-3 flex flex-wrap items-center justify-between gap-3`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <MessageSquare className="w-4 h-4 text-zinc-500 shrink-0" />
                        <div className="text-xs text-zinc-600 dark:text-zinc-300 truncate">
                          {currentUser
                            ? `Мессенджер Firas · Онлайн: ${messengerOnlineCount + 1}`
                            : 'Мессенджер Firas · Общий чат и звонки'}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={onOpenMessengerFull}
                        className="px-3 py-1 text-xs font-medium rounded-full border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      >
                        Открыть
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Daily Updating News Strip at Bottom */}
              {customization.showNews && (
                <section
                  aria-label="Новости дня"
                  className="relative z-10 w-full max-w-5xl mx-auto pt-4 border-t border-zinc-200/70 dark:border-zinc-800/70"
                >
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                      <Newspaper className="w-3.5 h-3.5" />
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                        Новости дня
                      </span>
                      <span>·</span>
                      <span>
                        {dailyNews?.dateLabel ||
                          new Date().toLocaleDateString('ru-RU', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          })}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => fetchNews(true)}
                      disabled={newsLoading}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors focus:outline-none disabled:opacity-50"
                    >
                      <RotateCw className={`w-3 h-3 ${newsLoading ? 'animate-spin' : ''}`} />
                      <span>Обновить</span>
                    </button>
                  </div>

                  {newsLoading && !dailyNews ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {[0, 1, 2, 3].map((idx) => (
                        <div
                          key={idx}
                          className={`h-24 ${radiusClasses.card} border border-zinc-200/70 dark:border-zinc-800/70 bg-zinc-50 dark:bg-zinc-900 p-3.5 animate-pulse`}
                        />
                      ))}
                    </div>
                  ) : dailyNews && dailyNews.items.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {dailyNews.items.slice(0, 4).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() =>
                            executeNavigation(
                              activeTab.id,
                              { kind: 'page', value: item.url },
                              true
                            )
                          }
                          className={`group text-left ${radiusClasses.card} border border-zinc-200/80 dark:border-zinc-800/80 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm p-3.5 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors flex flex-col justify-between gap-2 focus:outline-none`}
                        >
                          <div className="flex items-center justify-between gap-2 text-[11px] text-zinc-400 dark:text-zinc-500">
                            <span className="truncate font-medium text-zinc-500 dark:text-zinc-400">
                              {item.source} · {item.category}
                            </span>
                            <span className="font-mono tabular-nums shrink-0">
                              {item.timeLabel}
                            </span>
                          </div>
                          <div className="text-xs sm:text-[13px] font-medium leading-snug text-zinc-900 dark:text-zinc-100 line-clamp-2 group-hover:underline">
                            {item.title}
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </section>
              )}
            </div>
          )}

          {/* ABOUT:FIRES — Own Fires Engine 132.0 Diagnostics & about:config */}
          {currentEntry.kind === 'about' && currentEntry.value === 'about:blank' && (
            <div className="flex-1 flex items-center justify-center bg-white dark:bg-zinc-950 p-6 text-xs text-zinc-400">
              Пустая страница · Fires
            </div>
          )}

          {currentEntry.kind === 'about' && currentEntry.value !== 'about:blank' && (
            <div
              className="flex-1 overflow-y-auto p-6 sm:p-8 bg-zinc-50 dark:bg-zinc-950"
              style={{ zoom: `${activeTab.zoom}%` }}
            >
              <div className="max-w-3xl mx-auto space-y-6">
                <div
                  className={`${radiusClasses.card} border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-4`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {customization.showLogo && <FiresLogo size={36} className="shrink-0" />}
                      <div>
                        <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                          about:fires — Ядро и конфигурация Fires
                        </h1>
                        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                          Независимый собственный движок Fires Engine 132.0 (FiresCore) · MIT Open Source
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setOpenSourceOpen(true)}
                        className={`px-3.5 py-2 text-xs font-medium ${radiusClasses.control} border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:outline-none`}
                      >
                        Исходный код (MIT)
                      </button>
                      <button
                        type="button"
                        onClick={() => openDrawerSection('engine')}
                        style={{ backgroundColor: accent.bg, color: accent.fg }}
                        className={`px-3.5 py-2 text-xs font-medium ${radiusClasses.control} focus:outline-none`}
                      >
                        Настроить ядро и дизайн
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
                    <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
                      <div className="text-slate-500 dark:text-slate-400">Движок рендеринга</div>
                      <div className="mt-1 font-semibold font-mono text-slate-900 dark:text-slate-100">
                        Fires Engine 132.0
                      </div>
                    </div>
                    <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
                      <div className="text-slate-500 dark:text-slate-400">Защита (Fires Shield)</div>
                      <div className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
                        {customization.etpLevel === 'strict'
                          ? 'Строгая блокировка'
                          : customization.etpLevel === 'standard'
                          ? 'Стандартная'
                          : 'Отключена'}
                      </div>
                    </div>
                    <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
                      <div className="text-slate-500 dark:text-slate-400">Контейнер вкладки</div>
                      <div className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
                        {activeContainerMeta.label}
                      </div>
                    </div>
                  </div>
                </div>

                {/* about:config live preferences */}
                <div
                  className={`${radiusClasses.card} border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden`}
                >
                  <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                      Параметры ядра (about:config)
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      Профиль FiresCore
                    </span>
                  </div>
                  <div className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                    {[
                      {
                        key: 'privacy.trackingprotection.enabled',
                        val: customization.etpLevel,
                        toggle: () =>
                          updateCustomization({
                            etpLevel:
                              customization.etpLevel === 'standard'
                                ? 'strict'
                                : customization.etpLevel === 'strict'
                                ? 'off'
                                : 'standard',
                          }),
                      },
                      {
                        key: 'dom.security.https_only_mode',
                        val: String(customization.httpsOnly),
                        toggle: () =>
                          updateCustomization({ httpsOnly: !customization.httpsOnly }),
                      },
                      {
                        key: 'privacy.donottrackheader.enabled',
                        val: String(customization.doNotTrack),
                        toggle: () =>
                          updateCustomization({ doNotTrack: !customization.doNotTrack }),
                      },
                      {
                        key: 'privacy.containers.isolation',
                        val: String(customization.isolateContainers),
                        toggle: () =>
                          updateCustomization({
                            isolateContainers: !customization.isolateContainers,
                          }),
                      },
                      {
                        key: 'media.autoplay.muted',
                        val: String(customization.muteAllByDefault),
                        toggle: () =>
                          updateCustomization({
                            muteAllByDefault: !customization.muteAllByDefault,
                          }),
                      },
                      {
                        key: 'general.smoothScroll',
                        val: String(customization.smoothScroll),
                        toggle: () =>
                          updateCustomization({ smoothScroll: !customization.smoothScroll }),
                      },
                      {
                        key: 'javascript.enabled',
                        val: String(!customization.disableJavaScript),
                        toggle: () =>
                          updateCustomization({
                            disableJavaScript: !customization.disableJavaScript,
                          }),
                      },
                      {
                        key: 'permissions.default.image',
                        val: customization.blockImages ? '2 (blocked)' : '1 (allow)',
                        toggle: () =>
                          updateCustomization({ blockImages: !customization.blockImages }),
                      },
                      {
                        key: 'general.useragent.profile',
                        val:
                          customization.uaMode === 'fires-mobile'
                            ? 'FiresEngine/132.0 (Android 14; Mobile; FiresCore/132.0)'
                            : 'FiresEngine/132.0 (Windows NT 10.0; Win64; x64; FiresCore/132.0)',
                        toggle: () =>
                          updateCustomization({
                            uaMode:
                              customization.uaMode === 'fires-desktop'
                                ? 'fires-mobile'
                                : 'fires-desktop',
                          }),
                      },
                      {
                        key: 'browser.tabs.tabPosition',
                        val: customization.tabPosition,
                        toggle: () =>
                          updateCustomization({
                            tabPosition:
                              customization.tabPosition === 'top'
                                ? 'left'
                                : customization.tabPosition === 'left'
                                ? 'bottom'
                                : 'top',
                          }),
                      },
                      {
                        key: 'browser.uidensity',
                        val: customization.density,
                        toggle: () =>
                          updateCustomization({
                            density:
                              customization.density === 'normal'
                                ? 'compact'
                                : customization.density === 'compact'
                                ? 'comfortable'
                                : 'normal',
                          }),
                      },
                    ].map((row) => (
                      <div
                        key={row.key}
                        className="px-5 py-2.5 flex items-center justify-between gap-4"
                      >
                        <span className="font-mono text-slate-800 dark:text-slate-200 truncate">
                          {row.key}
                        </span>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="font-mono text-slate-500 dark:text-slate-400 max-w-xs truncate">
                            {row.val}
                          </span>
                          <button
                            type="button"
                            onClick={row.toggle}
                            className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none"
                          >
                            Переключить
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SEARCH RESULTS */}
          {currentEntry.kind === 'search' && (
            <div
              className="flex-1 overflow-y-auto p-5 sm:p-8 bg-slate-50 dark:bg-slate-950"
              style={{ zoom: `${activeTab.zoom}%` }}
            >
              <div className="max-w-3xl mx-auto space-y-6">
                <section
                  aria-label="Ответ нейросети"
                  className={`${radiusClasses.card} border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 space-y-3.5`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div
                      className={`flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-slate-800 ${radiusClasses.control} max-w-full overflow-x-auto no-scrollbar sm:flex-wrap`}
                    >
                      {AI_PROVIDERS.map((ai) => {
                        const selected = activeTab.aiProvider === ai.id;
                        return (
                          <button
                            key={ai.id}
                            type="button"
                            onClick={() =>
                              fetchAiForQuery(activeTab.id, currentEntry.value, ai.id)
                            }
                            style={
                              selected
                                ? { backgroundColor: accent.bg, color: accent.fg }
                                : undefined
                            }
                            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                              selected
                                ? ''
                                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100'
                            }`}
                          >
                            {ai.label}
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {activeTab.aiModel && (
                        <span className="text-xs text-slate-400 dark:text-slate-500">
                          {activeTab.aiModel}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => onOpenAiChat(activeTab.aiProvider)}
                        style={{ backgroundColor: accent.bg, color: accent.fg }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-opacity hover:opacity-90 whitespace-nowrap"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>
                          {activeTab.aiProvider === 'studio_ai' ? 'Открыть Studio AI' : 'Чат / Своя ИИ'}
                        </span>
                      </button>
                      {AI_PROVIDERS.find((a) => a.id === activeTab.aiProvider)?.officialUrl && (
                        <a
                          href={AI_PROVIDERS.find((a) => a.id === activeTab.aiProvider)?.officialUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
                        >
                          <span>Официальное приложение</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      {activeTab.aiAnswer && (
                        <button
                          type="button"
                          onClick={() =>
                            onSavePageToNotes(
                              `${
                                AI_PROVIDERS.find((a) => a.id === activeTab.aiProvider)?.label ||
                                customModels.find((m) => `custom:${m.id}` === activeTab.aiProvider)
                                  ?.name ||
                                'Fires Assistant'
                              }: ${currentEntry.value}`,
                              getExternalEngineUrl(activeTab.engine, currentEntry.value),
                              activeTab.aiAnswer!
                            )
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
                        >
                          <FilePlus className="w-3 h-3" />
                          <span>В заметки</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {activeTab.aiRoutedTo && (
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Выбрано:{' '}
                      <strong className="text-slate-800 dark:text-slate-200">
                        {activeTab.aiRoutedTo}
                      </strong>
                      {activeTab.aiRouteReason && ` · ${activeTab.aiRouteReason}`}
                    </div>
                  )}

                  {activeTab.aiLoading ? (
                    <div className="space-y-2.5 py-1">
                      <div className="h-4 w-full rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
                      <div className="h-4 w-11/12 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
                      <div className="h-4 w-4/5 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
                    </div>
                  ) : activeTab.aiError ? (
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400">
                      <span>{activeTab.aiError}</span>
                      <button
                        type="button"
                        onClick={() =>
                          fetchAiForQuery(activeTab.id, currentEntry.value, activeTab.aiProvider)
                        }
                        className="px-3 py-1 rounded-md border border-slate-200 dark:border-slate-700 font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        Повторить
                      </button>
                    </div>
                  ) : activeTab.aiAnswer ? (
                    <div className="space-y-3">
                      <div className="space-y-2.5 text-sm leading-[1.65] text-slate-800 dark:text-slate-200">
                        {activeTab.aiAnswer
                          .split(/\n{2,}/)
                          .map((para) => para.replace(/\*\*/g, '').trim())
                          .filter(Boolean)
                          .map((para, idx) => (
                            <p key={idx} className="whitespace-pre-line">
                              {para}
                            </p>
                          ))}
                      </div>

                      {activeTab.aiChatHistory.length > 2 && (
                        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                          {activeTab.aiChatHistory.slice(2).map((m) => (
                            <div
                              key={m.id}
                              className={`text-xs leading-relaxed p-3 rounded-xl whitespace-pre-line ${
                                m.role === 'user'
                                  ? 'bg-black text-white dark:bg-slate-100 dark:text-slate-900 ml-8'
                                  : 'bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 mr-4'
                              }`}
                            >
                              {m.text.replace(/\*\*/g, '')}
                            </div>
                          ))}
                        </div>
                      )}

                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (!aiFollowUpInput.trim() || activeTab.aiChatSending) return;
                          const text = aiFollowUpInput.trim();
                          setAiFollowUpInput('');
                          sendUnlimitedAiChat(activeTab.id, text);
                        }}
                        className="pt-2 flex items-center gap-2"
                      >
                        <input
                          type="text"
                          value={aiFollowUpInput}
                          onChange={(e) => setAiFollowUpInput(e.target.value)}
                          placeholder="Уточнить или продолжить диалог с нейросетью (безлимит)..."
                          className={`flex-1 px-3 py-2 text-xs ${radiusClasses.control} border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none`}
                        />
                        <button
                          type="submit"
                          disabled={!aiFollowUpInput.trim() || activeTab.aiChatSending}
                          style={{ backgroundColor: accent.bg, color: accent.fg }}
                          className={`inline-flex items-center gap-1 px-3.5 py-2 text-xs font-medium ${radiusClasses.control} disabled:opacity-40 focus:outline-none`}
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>{activeTab.aiChatSending ? '...' : 'Спросить'}</span>
                        </button>
                      </form>
                    </div>
                  ) : null}
                </section>

                {/* Websites */}
                <div
                  className={`${radiusClasses.card} border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 space-y-4`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Сайты ({activeEngineMeta.label})
                      {!activeTab.loading && (
                        <span className="font-mono tabular-nums ml-1.5 text-slate-400">
                          · {activeTab.searchResults.length}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-1">
                      {ENGINES.map((eng) => (
                        <button
                          key={eng.id}
                          type="button"
                          onClick={() =>
                            executeNavigation(
                              activeTab.id,
                              { kind: 'search', value: currentEntry.value, engine: eng.id },
                              true
                            )
                          }
                          style={
                            activeTab.engine === eng.id
                              ? { backgroundColor: accent.bg, color: accent.fg }
                              : undefined
                          }
                          className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                            activeTab.engine === eng.id
                              ? ''
                              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          {eng.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {activeTab.loading ? (
                    <div className="space-y-4 py-2">
                      <div className="h-5 w-2/3 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
                      <div className="h-4 w-full rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
                      <div className="h-4 w-5/6 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
                    </div>
                  ) : activeTab.searchResults.length > 0 ? (
                    <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                      {activeTab.searchResults.map((item, idx) => (
                        <li key={`${item.url}-${idx}`} className="py-4 first:pt-1 last:pb-1">
                          <div className="text-xs text-slate-400 dark:text-slate-500 truncate">
                            {item.source} · {item.url}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              if (customization.openLinksInNewTab) {
                                const id = `tab-${Date.now()}`;
                                setTabs((prev) => [
                                  ...prev,
                                  createHomeTab(id, customization.defaultZoom, activeTab.containerId, {
                                    isPrivate: activeTab.isPrivate,
                                    muted: customization.muteAllByDefault,
                                  }),
                                ]);
                                setActiveTabId(id);
                                executeNavigation(id, { kind: 'page', value: item.url }, true);
                              } else {
                                executeNavigation(
                                  activeTab.id,
                                  { kind: 'page', value: item.url },
                                  true
                                );
                              }
                            }}
                            className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-100 hover:underline text-left"
                          >
                            {item.title}
                          </button>
                          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                            {item.snippet}
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="py-8 text-center space-y-3">
                      <p className="text-sm text-slate-600 dark:text-slate-300">
                        Сайты по этому запросу не найдены. Попробуйте Fires Mix.
                      </p>
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            executeNavigation(
                              activeTab.id,
                              { kind: 'search', value: currentEntry.value, engine: 'firas' },
                              true
                            )
                          }
                          style={{ backgroundColor: accent.bg, color: accent.fg }}
                          className={`px-4 py-2 text-xs font-medium ${radiusClasses.control}`}
                        >
                          Искать в Fires Mix
                        </button>
                        <a
                          href={getExternalEngineUrl(activeTab.engine, currentEntry.value)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`inline-flex items-center gap-1 px-4 py-2 text-xs font-medium ${radiusClasses.control} border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200`}
                        >
                          <span>Открыть внешний поиск</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* LIVE WEB PROXY MODE (Fires Engine) */}
          {currentEntry.kind === 'page' && activeTab.renderMode === 'web' && (
            <div className="flex-1 min-w-0 min-h-0 flex flex-col bg-white overflow-auto">
              <iframe
                key={`${activeTab.id}-${proxyIframeSrc}-${activeTab.reloadNonce}`}
                title={activeTab.title}
                src={proxyIframeSrc}
                sandbox="allow-forms allow-scripts allow-same-origin allow-popups"
                referrerPolicy="no-referrer"
                className="w-full flex-1 border-0 bg-white"
                style={{
                  transform:
                    activeTab.zoom !== 100
                      ? `scale(${activeTab.zoom / 100})`
                      : undefined,
                  transformOrigin: 'top left',
                  width:
                    activeTab.zoom !== 100
                      ? `${Math.round(10000 / activeTab.zoom)}%`
                      : '100%',
                  height:
                    activeTab.zoom !== 100
                      ? `${Math.round(10000 / activeTab.zoom)}%`
                      : '100%',
                }}
              />
            </div>
          )}

          {/* READER MODE */}
          {currentEntry.kind === 'page' && activeTab.renderMode === 'reader' && (
            <div
              className="flex-1 overflow-y-auto p-6 sm:p-8 bg-white dark:bg-slate-900"
              style={{
                fontFamily:
                  customization.readerFont === 'serif'
                    ? 'Georgia, "Times New Roman", serif'
                    : customization.readerFont === 'mono'
                    ? '"JetBrains Mono", ui-monospace, monospace'
                    : 'inherit',
                zoom: `${activeTab.zoom}%`,
              }}
            >
              <div className="max-w-3xl mx-auto">
                {activeTab.loading ? (
                  <div className="space-y-4 py-4">
                    <div className="h-6 w-2/3 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
                    <div className="h-4 w-full rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
                    <div className="h-4 w-5/6 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
                  </div>
                ) : activeTab.error ? (
                  <div className="py-10 px-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 space-y-4">
                    <div className="text-base font-semibold text-slate-900 dark:text-slate-100">
                      Не удалось отобразить страницу в режиме чтения
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      {activeTab.error}
                    </p>
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          executeNavigation(
                            activeTab.id,
                            {
                              kind: 'search',
                              value: currentEntry.value.replace(/^https?:\/\//, '').split('/')[0],
                              engine: 'firas',
                            },
                            true
                          )
                        }
                        style={{ backgroundColor: accent.bg, color: accent.fg }}
                        className={`px-4 py-2 text-xs font-medium ${radiusClasses.control}`}
                      >
                        Найти материалы о сайте
                      </button>
                      <a
                        href={currentEntry.value}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium ${radiusClasses.control} border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800`}
                      >
                        <span>Открыть во внешней вкладке</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                ) : activeTab.pageData ? (
                  <article className="space-y-6">
                    <header className="pb-5 border-b border-slate-200 dark:border-slate-800 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 dark:text-slate-500">
                        <span className="font-mono truncate">{activeTab.pageData.finalUrl}</span>
                        <a
                          href={activeTab.pageData.finalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-slate-700 dark:text-slate-300 hover:underline shrink-0"
                        >
                          <span>Оригинал</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                        {activeTab.pageData.title}
                      </h2>
                      {activeTab.pageData.description && (
                        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                          {activeTab.pageData.description}
                        </p>
                      )}
                    </header>

                    <div className="space-y-4" style={{ fontSize: `${customization.readerSize}px` }}>
                      {activeTab.pageData.blocks.length > 0 ? (
                        activeTab.pageData.blocks.map((block, idx) => {
                          if (block.type === 'h1' || block.type === 'h2') {
                            return (
                              <h3
                                key={idx}
                                className="pt-3 text-lg font-semibold text-slate-900 dark:text-slate-100"
                              >
                                {block.text}
                              </h3>
                            );
                          }
                          if (block.type === 'h3') {
                            return (
                              <h4
                                key={idx}
                                className="pt-2 text-base font-semibold text-slate-800 dark:text-slate-200"
                              >
                                {block.text}
                              </h4>
                            );
                          }
                          if (block.type === 'quote') {
                            return (
                              <blockquote
                                key={idx}
                                className="px-4 py-3 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-sm italic text-slate-700 dark:text-slate-300"
                              >
                                {block.text}
                              </blockquote>
                            );
                          }
                          if (block.type === 'li') {
                            return (
                              <div
                                key={idx}
                                className="flex items-start gap-2.5 leading-relaxed text-slate-700 dark:text-slate-300"
                              >
                                <span className="text-slate-400 select-none">•</span>
                                <span>{block.text}</span>
                              </div>
                            );
                          }
                          return (
                            <p
                              key={idx}
                              className="leading-[1.68] text-slate-700 dark:text-slate-300"
                            >
                              {block.text}
                            </p>
                          );
                        })
                      ) : (
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          Текстовые блоки на этой странице не обнаружены. Переключитесь в «Веб-сайт» или откройте оригинал.
                        </p>
                      )}
                    </div>

                    {activeTab.pageData.links.length > 0 && (
                      <section className="pt-6 border-t border-slate-200 dark:border-slate-800 space-y-3">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          Ссылки на странице
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {activeTab.pageData.links.map((link, idx) => (
                            <button
                              key={`${link.url}-${idx}`}
                              type="button"
                              onClick={() =>
                                executeNavigation(
                                  activeTab.id,
                                  { kind: 'page', value: link.url },
                                  true
                                )
                              }
                              className="text-left px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-600 text-xs font-medium text-slate-800 dark:text-slate-200 truncate transition-colors"
                              title={link.url}
                            >
                              {link.text}
                            </button>
                          ))}
                        </div>
                      </section>
                    )}
                  </article>
                ) : null}
              </div>
            </div>
          )}

          {/* Fires DevTools Inspector Panel (F12) */}
          {devtoolsOpen && (
            <div className="h-52 border-t border-slate-200 dark:border-slate-800 bg-slate-950 text-slate-100 flex flex-col shrink-0">
              <div className="px-3 py-1.5 border-b border-slate-800 flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-3 font-mono">
                  <span className="font-semibold text-orange-400">Fires DevTools</span>
                  <span className="text-slate-400">Движок: {activeTab.engineLabel}</span>
                  <span className="text-emerald-400">
                    Заблокировано трекеров: {activeTab.trackersBlocked}
                  </span>
                  <span className="text-slate-400">
                    HTTPS-Only: {customization.httpsOnly ? 'ON' : 'OFF'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setDevtoolsOpen(false)}
                  className="p-1 text-slate-400 hover:text-white"
                  aria-label="Закрыть DevTools"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-3 font-mono text-[11px] space-y-1">
                <div className="text-slate-400">
                  [FiresCore] Tab: {activeTab.id} · Container: {activeContainerMeta.label} · Zoom:{' '}
                  {activeTab.zoom}%
                </div>
                {devtoolsLogs.map((l) => (
                  <div
                    key={l.id}
                    className={
                      l.kind === 'error'
                        ? 'text-red-400'
                        : l.kind === 'result'
                        ? 'text-emerald-400'
                        : 'text-slate-200'
                    }
                  >
                    {l.text}
                  </div>
                ))}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const cmd = devtoolsInput.trim();
                  if (!cmd) return;
                  setDevtoolsInput('');
                  try {
                    const out =
                      cmd === 'navigator.userAgent'
                        ? customization.uaMode === 'fires-mobile'
                          ? 'FiresEngine/132.0 (Android 14; Mobile; FiresCore/132.0)'
                          : 'FiresEngine/132.0 (Windows NT 10.0; Win64; x64; FiresCore/132.0)'
                        : cmd === 'location.href'
                        ? currentEntry.value || 'about:fires'
                        : `FiresCore eval: "${cmd}" · вкладка "${activeTab.title}"`;
                    setDevtoolsLogs((prev) => [
                      ...prev,
                      { id: `d-${Date.now()}-c`, text: `> ${cmd}`, kind: 'log' },
                      { id: `d-${Date.now()}-r`, text: out, kind: 'result' },
                    ]);
                  } catch (err) {
                    setDevtoolsLogs((prev) => [
                      ...prev,
                      {
                        id: `d-${Date.now()}-e`,
                        text: err instanceof Error ? err.message : 'Error',
                        kind: 'error',
                      },
                    ]);
                  }
                }}
                className="px-3 py-1.5 border-t border-slate-800 flex items-center gap-2 font-mono text-xs"
              >
                <span className="text-orange-400">&gt;</span>
                <input
                  type="text"
                  value={devtoolsInput}
                  onChange={(e) => setDevtoolsInput(e.target.value)}
                  placeholder="Выполнить команду в Fires Console..."
                  className="flex-1 bg-transparent text-slate-100 focus:outline-none"
                />
              </form>
            </div>
          )}
        </div>

        {/* Optional Split View Secondary Pane */}
        {splitTab && splitEntry && (
          <div className="w-full h-1/2 md:h-auto md:w-1/2 border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-800 flex flex-col bg-white dark:bg-slate-900 overflow-hidden min-w-0 min-h-0">
            <div className="px-3 py-1.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {splitTab.title}
                </span>
                <span className="text-[11px] font-mono text-slate-400 truncate">
                  {splitEntry.value || 'home'}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <select
                  aria-label="Вкладка для разделённого экрана"
                  value={splitTab.id}
                  onChange={(e) => setSplitTabId(e.target.value)}
                  className="px-2 py-0.5 text-[11px] rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                >
                  {tabs
                    .filter((t) => t.id !== activeTab.id)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  onClick={() => setSplitTabId(null)}
                  className="p-1 rounded text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                  aria-label="Закрыть разделение экрана"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            {splitEntry.kind === 'page' ? (
              <iframe
                title={`Split: ${splitTab.title}`}
                src={buildProxyUrl(splitTab, splitEntry.value)}
                sandbox="allow-forms allow-scripts allow-same-origin allow-popups"
                referrerPolicy="no-referrer"
                className="w-full flex-1 border-0 bg-white"
              />
            ) : (
              <div className="flex-1 p-6 overflow-y-auto text-xs text-slate-600 dark:text-slate-300 space-y-2">
                <div className="font-semibold text-slate-900 dark:text-slate-100">
                  {splitTab.title}
                </div>
                {splitTab.aiAnswer && <p className="whitespace-pre-line">{splitTab.aiAnswer}</p>}
                {splitTab.searchResults.map((r, i) => (
                  <div key={i} className="py-2 border-b border-slate-200 dark:border-slate-800">
                    <div className="font-medium text-slate-900 dark:text-slate-100">{r.title}</div>
                    <div className="text-[11px] text-slate-500">{r.url}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Tab Bar (if tabPosition === 'bottom') */}
      {customization.tabPosition === 'bottom' && (
        <div className="flex items-center gap-1 px-3 pb-2 bg-slate-100 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 overflow-x-auto shrink-0">
          {sortedTabs.map((tab) => renderTabPill(tab, false))}
          <button
            type="button"
            onClick={() => handleAddNewTab(false)}
            aria-label="Открыть новую вкладку"
            className={`p-2 mt-1 ${radiusClasses.control} text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-800 shrink-0 focus:outline-none`}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Browser Customization & Settings Drawer */}
      <BrowserCustomizationDrawer
        isOpen={drawerOpen}
        initialSection={drawerSection}
        config={customization}
        theme={isDark ? 'dark' : 'light'}
        onToggleTheme={onToggleTheme}
        history={browsingHistory}
        closedTabs={closedTabs.map((t) => ({
          id: t.id,
          title: t.title,
          url: t.history[t.historyIndex]?.value || '',
          closedAt: new Date().toISOString(),
        }))}
        onChange={updateCustomization}
        onReset={resetCustomization}
        onAddBookmark={handleAddBookmark}
        onRemoveBookmark={handleRemoveBookmark}
        onNavigateUrl={(url) => navigateFromInput(url)}
        onRestoreClosedTab={handleRestoreLastClosedTab}
        onClearHistory={() => setBrowsingHistory([])}
        onOpenAboutFires={() => navigateFromInput('about:fires')}
        onOpenSourceCode={() => setOpenSourceOpen(true)}
        onClose={() => setDrawerOpen(false)}
      />

      {/* Open Source Code Inspector (MIT License) */}
      <OpenSourceModal
        isOpen={openSourceOpen}
        onClose={() => setOpenSourceOpen(false)}
      />

      {/* Unified Fires Downloader (GitHub + Google Play) */}
      <FiresDownloaderDrawer
        isOpen={downloaderOpen}
        downloads={downloads}
        speedLimitKbps={customization.downloadSpeedLimitKbps}
        maxConcurrent={customization.maxConcurrentDownloads}
        canSaveToCloud={Boolean(currentUser)}
        onChangeSpeedLimit={(kbps) =>
          updateCustomization({ downloadSpeedLimitKbps: kbps })
        }
        onChangeMaxConcurrent={(n) =>
          updateCustomization({ maxConcurrentDownloads: n })
        }
        onStartDownload={handleStartDownload}
        onPauseDownload={handlePauseDownload}
        onResumeDownload={handleResumeDownload}
        onCancelDownload={handleCancelDownload}
        onRemoveDownload={(id) =>
          setDownloads((prev) => prev.filter((d) => d.id !== id))
        }
        onSetPriority={(id, priority) =>
          setDownloads((prev) =>
            prev.map((d) => (d.id === id ? { ...d, priority } : d))
          )
        }
        onSaveFileToDisk={handleSaveDownloadToDisk}
        onSaveToCloud={handleSaveDownloadToCloud}
        onPauseAll={handlePauseAllDownloads}
        onClearCompleted={() =>
          setDownloads((prev) =>
            prev.filter(
              (d) =>
                d.status === 'downloading' ||
                d.status === 'paused' ||
                d.status === 'queued'
            )
          )
        }
        onOpenUrlInTab={(url) => navigateFromInput(url)}
        onClose={() => setDownloaderOpen(false)}
      />

      {/* Cross-Platform Mobile & Tablet Browser Extensions Drawer */}
      <ExtensionsDrawer
        isOpen={extensionsOpen}
        installedIds={installedExtIds}
        extensions={extensionsCatalog}
        loading={extensionsLoading}
        onRefreshCatalog={fetchExtensionsCatalog}
        onToggleInstall={(ext) => {
          setInstalledExtIds((prev) =>
            prev.includes(ext.id) ? prev.filter((id) => id !== ext.id) : [...prev, ext.id]
          );
          updateTab(activeTab.id, (tab) => ({ ...tab, reloadNonce: tab.reloadNonce + 1 }));
        }}
        onQueueDownload={(ext) => {
          handleStartDownload({
            name: ext.fileName,
            url: `/api/extensions/download/${encodeURIComponent(ext.id)}`,
            source: 'direct',
            packageOrRepo: `${ext.sourceLabel} · ${ext.platforms.join('/')}`,
            priority: 'high',
          });
          setDownloaderOpen(true);
        }}
        onClose={() => setExtensionsOpen(false)}
      />
    </div>
  );
};
