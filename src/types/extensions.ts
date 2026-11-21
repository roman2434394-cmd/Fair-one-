export type ExtensionSourceStore =
  | 'fires-addons'
  | 'github-releases'
  | 'openwebx'
  | 'fdroid-webext';

export type ExtensionPlatform = 'mobile' | 'tablet' | 'desktop';

export type ExtensionEffectKey =
  | 'mobile-fit'
  | 'wiki-reader-clean'
  | 'github-code-wrap'
  | 'dark-reader'
  | 'adblock-plus'
  | 'gamedev-devtools'
  | 'privacy-cloak';

export interface BrowserExtensionItem {
  id: string;
  name: string;
  author: string;
  version: string;
  summary: string;
  category: 'mobile' | 'coding' | 'privacy' | 'reading' | 'gamedev';
  sourceStore: ExtensionSourceStore;
  sourceLabel: string;
  sourceUrl: string;
  platforms: ExtensionPlatform[];
  packageFormat: 'xpi' | 'zip';
  fileName: string;
  sizeLabel: string;
  permissions: string[];
  effectKey: ExtensionEffectKey;
}

export const EXTENSION_SOURCE_LABELS: Record<ExtensionSourceStore, string> = {
  'fires-addons': 'Fires Add-ons Store',
  'github-releases': 'GitHub Releases',
  openwebx: 'OpenWebX Store',
  'fdroid-webext': 'F-Droid WebExt',
};

export const FIRES_INSTALLED_EXTENSIONS_KEY = 'fires-installed-extensions-v1';

export const DEFAULT_ENABLED_EXTENSIONS: string[] = [
  'ext-mobile-reflow',
  'ext-wiki-mobile-pro',
  'ext-github-mobile-wrap',
];

export function loadInstalledExtensions(): string[] {
  try {
    const raw = localStorage.getItem(FIRES_INSTALLED_EXTENSIONS_KEY);
    if (!raw) return DEFAULT_ENABLED_EXTENSIONS;
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : DEFAULT_ENABLED_EXTENSIONS;
  } catch {
    return DEFAULT_ENABLED_EXTENSIONS;
  }
}

export function saveInstalledExtensions(ids: string[]): void {
  try {
    localStorage.setItem(FIRES_INSTALLED_EXTENSIONS_KEY, JSON.stringify(ids));
  } catch {
    // ignore storage quota
  }
}
