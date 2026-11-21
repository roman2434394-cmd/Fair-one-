import React, { useEffect, useMemo, useState } from 'react';
import { X, Code2, FileCode2, Copy, Check, Download, Scale, Search } from 'lucide-react';

interface OpenSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SourceFileEntry {
  path: string;
  sizeBytes: number;
}

export const OpenSourceModal: React.FC<OpenSourceModalProps> = ({ isOpen, onClose }) => {
  const [files, setFiles] = useState<SourceFileEntry[]>([]);
  const [selectedPath, setSelectedPath] = useState<string>('src/components/FiresLogo.tsx');
  const [fileContent, setFileContent] = useState<string>('');
  const [loadingTree, setLoadingTree] = useState(false);
  const [loadingFile, setLoadingFile] = useState(false);
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoadingTree(true);
    setError(null);
    fetch('/api/opensource/tree')
      .then((r) => r.json())
      .then((data: { files?: SourceFileEntry[]; error?: string }) => {
        if (Array.isArray(data.files)) {
          setFiles(data.files);
          if (data.files.length > 0 && !data.files.some((f) => f.path === selectedPath)) {
            setSelectedPath(data.files[0].path);
          }
        } else if (data.error) {
          setError(data.error);
        }
      })
      .catch(() => setError('Не удалось загрузить список исходных файлов.'))
      .finally(() => setLoadingTree(false));
  }, [isOpen, selectedPath]);

  useEffect(() => {
    if (!isOpen || !selectedPath) return;
    setLoadingFile(true);
    setError(null);
    fetch(`/api/opensource/file?path=${encodeURIComponent(selectedPath)}`)
      .then((r) => r.json())
      .then((data: { content?: string; error?: string }) => {
        if (typeof data.content === 'string') {
          setFileContent(data.content);
        } else {
          setError(data.error || 'Не удалось прочитать файл.');
        }
      })
      .catch(() => setError('Ошибка загрузки файла исходного кода.'))
      .finally(() => setLoadingFile(false));
  }, [isOpen, selectedPath]);

  const filteredFiles = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return files;
    return files.filter((f) => f.path.toLowerCase().includes(q));
  }, [files, search]);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (!fileContent) return;
    navigator.clipboard.writeText(fileContent).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    });
  };

  const handleDownloadFile = () => {
    if (!fileContent) return;
    const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = selectedPath.split('/').pop() || 'source.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-[2px] p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Открытый исходный код Fires"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl h-[84vh] rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-black dark:bg-zinc-100 text-white dark:text-black flex items-center justify-center shrink-0">
              <Code2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                Открытый исходный код Fires Browser
              </h2>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center gap-2 truncate">
                <span className="inline-flex items-center gap-1">
                  <Scale className="w-3 h-3" />
                  <span>Лицензия MIT</span>
                </span>
                <span>·</span>
                <span className="font-mono tabular-nums">{files.length} файлов</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть просмотр кода"
            className="p-2 rounded-lg text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:outline-none"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-12 overflow-hidden">
          {/* File Tree */}
          <aside className="md:col-span-4 border-b md:border-b-0 md:border-r border-zinc-200 dark:border-zinc-800 flex flex-col min-h-0 bg-zinc-50 dark:bg-zinc-900/50">
            <div className="p-3 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950">
                <Search className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Найти файл (напр. BrowserView)..."
                  className="w-full bg-transparent text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-0.5 max-h-48 md:max-h-none">
              {loadingTree ? (
                <div className="p-3 text-xs text-zinc-400">Загрузка дерева исходников...</div>
              ) : (
                filteredFiles.map((file) => {
                  const active = file.path === selectedPath;
                  return (
                    <button
                      key={file.path}
                      type="button"
                      onClick={() => setSelectedPath(file.path)}
                      className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs text-left transition-colors focus:outline-none ${
                        active
                          ? 'bg-black text-white dark:bg-zinc-100 dark:text-black font-medium'
                          : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/60 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <FileCode2 className="w-3.5 h-3.5 shrink-0 opacity-75" />
                        <span className="font-mono truncate">{file.path}</span>
                      </span>
                      <span className="font-mono tabular-nums text-[10px] opacity-60 shrink-0">
                        {(file.sizeBytes / 1024).toFixed(1)}K
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          {/* Code Viewer */}
          <section className="md:col-span-8 flex flex-col min-h-0 bg-white dark:bg-zinc-950">
            <div className="px-4 py-2.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3 shrink-0 bg-zinc-50/70 dark:bg-zinc-900/40">
              <span className="font-mono text-xs font-medium text-zinc-800 dark:text-zinc-200 truncate">
                {selectedPath}
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:outline-none"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Скопировано' : 'Копировать'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadFile}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-black dark:bg-zinc-100 text-white dark:text-black hover:opacity-90 focus:outline-none"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Скачать файл</span>
                </button>
              </div>
            </div>

            {error && (
              <div className="p-4 text-xs text-red-600 dark:text-red-400">{error}</div>
            )}

            <div className="flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed text-zinc-800 dark:text-zinc-200">
              {loadingFile ? (
                <div className="text-zinc-400">Чтение файла...</div>
              ) : (
                <pre className="whitespace-pre-wrap break-words">{fileContent}</pre>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
