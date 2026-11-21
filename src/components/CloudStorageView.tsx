import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Cloud,
  Upload,
  FolderPlus,
  Link2,
  ExternalLink,
  Download,
  Trash2,
  Search,
  HardDrive,
  FileText,
  Film,
  Archive,
  File as FileIcon,
  Lock,
  Sparkles,
  Cpu,
  Send,
} from 'lucide-react';
import {
  AiProviderId,
  CloudFileItem,
  CloudStorageSummary,
  CustomAiModel,
  UserProfile,
} from '../types/firas';

interface CloudStorageViewProps {
  currentUser: UserProfile | null;
  authToken: string | null;
  customModels: CustomAiModel[];
  onOpenAiChat: (provider?: AiProviderId) => void;
  onOpenAuth: (mode?: 'login' | 'register', reason?: string) => void;
  onNotify: (msg: string) => void;
}

const TB_BYTES = 1099511627776; // 1 TB

function formatSize(bytes: number): string {
  if (bytes <= 0) return '0 Б';
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} ГБ`;
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} КБ`;
  }
  return `${bytes} Б`;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
    reader.readAsDataURL(file);
  });
}

export const CloudStorageView: React.FC<CloudStorageViewProps> = ({
  currentUser,
  authToken,
  customModels,
  onOpenAiChat,
  onOpenAuth,
  onNotify,
}) => {
  const [summary, setSummary] = useState<CloudStorageSummary>({
    quotaBytes: TB_BYTES,
    usedBytes: 0,
    files: [],
    folders: ['Документы', 'Медиа', 'TeraBox 1 ТБ'],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Upload & folder state
  const [uploading, setUploading] = useState(false);
  const [targetFolder, setTargetFolder] = useState('Документы');
  const [newFolderName, setNewFolderName] = useState('');
  const [showFolderForm, setShowFolderForm] = useState(false);

  // TeraBox link form
  const [showTeraboxForm, setShowTeraboxForm] = useState(false);
  const [tbName, setTbName] = useState('');
  const [tbUrl, setTbUrl] = useState('');
  const [tbSizeGb, setTbSizeGb] = useState('5');
  const [savingTb, setSavingTb] = useState(false);

  // Cloud Fires Assistant / Custom AI analysis state
  const [aiProvider, setAiProvider] = useState<AiProviderId>('fire_assistant');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiSaveFile, setAiSaveFile] = useState(true);
  const [aiRunning, setAiRunning] = useState(false);
  const [aiAnswer, setAiAnswer] = useState<{
    text: string;
    model: string;
    routedTo?: string;
    routeReason?: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const authHeaders = useCallback((): Record<string, string> => {
    return authToken ? { Authorization: `Bearer ${authToken}` } : {};
  }, [authToken]);

  const loadFiles = useCallback(async () => {
    if (!currentUser) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch('/api/cloud/files', {
        credentials: 'include',
        headers: authHeaders(),
      });
      const json = (await resp.json()) as CloudStorageSummary & { error?: string };
      if (!resp.ok) {
        setError(json.error || 'Не удалось загрузить облачное хранилище.');
        setLoading(false);
        return;
      }
      setSummary({
        quotaBytes: json.quotaBytes || TB_BYTES,
        usedBytes: json.usedBytes || 0,
        files: Array.isArray(json.files) ? json.files : [],
        folders: Array.isArray(json.folders) ? json.folders : ['Документы', 'Медиа', 'TeraBox 1 ТБ'],
      });
    } catch {
      setError('Ошибка соединения с сервером облачного хранилища.');
    } finally {
      setLoading(false);
    }
  }, [authHeaders, currentUser]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const [dragActive, setDragActive] = useState(false);

  const uploadFilesList = async (filesList: FileList | File[]) => {
    if (!currentUser) return;
    const filesArr = Array.from(filesList);
    if (filesArr.length === 0) return;

    setUploading(true);
    setError(null);
    let uploadedCount = 0;

    try {
      for (const file of filesArr) {
        if (file.size === 0) {
          setError(`Файл «${file.name}» пустой и не может быть загружен.`);
          continue;
        }
        if (file.size > 25 * 1024 * 1024) {
          setError(
            `Файл «${file.name}» больше 25 МБ. Для крупных файлов до 1 ТБ используйте кнопку «Подключить TeraBox».`
          );
          continue;
        }
        const dataBase64 = await fileToBase64(file);
        const resp = await fetch('/api/cloud/upload', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders(),
          },
          body: JSON.stringify({
            name: file.name,
            folder: targetFolder,
            mimeType: file.type || 'application/octet-stream',
            dataBase64,
          }),
        });
        const json = (await resp.json()) as CloudStorageSummary & {
          file?: CloudFileItem;
          error?: string;
        };
        if (!resp.ok) {
          setError(json.error || `Не удалось загрузить файл «${file.name}».`);
          continue;
        }
        uploadedCount += 1;
        setSummary({
          quotaBytes: json.quotaBytes || TB_BYTES,
          usedBytes: json.usedBytes || 0,
          files: json.files || [],
          folders: json.folders || summary.folders,
        });
      }
      if (uploadedCount === 1) {
        onNotify(`Файл «${filesArr[0].name}» загружен в Облако 1 ТБ.`);
      } else if (uploadedCount > 1) {
        onNotify(`Загружено файлов в Облако 1 ТБ: ${uploadedCount}.`);
      }
    } catch {
      setError('Ошибка при загрузке файлов в облако.');
    } finally {
      setUploading(false);
    }
  };

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = '';
    await uploadFilesList(files);
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newFolderName.trim();
    if (!trimmed) return;
    try {
      const resp = await fetch('/api/cloud/folders', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(),
        },
        body: JSON.stringify({ folder: trimmed }),
      });
      const json = (await resp.json()) as CloudStorageSummary & { error?: string };
      if (resp.ok) {
        setSummary((prev) => ({
          ...prev,
          folders: json.folders || prev.folders,
        }));
        setTargetFolder(trimmed);
        setSelectedFolder(trimmed);
        setNewFolderName('');
        setShowFolderForm(false);
      } else {
        setError(json.error || 'Не удалось создать папку.');
      }
    } catch {
      setError('Ошибка соединения с облаком.');
    }
  };

  const handleSaveTerabox = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tbName.trim() || !tbUrl.trim()) return;
    setSavingTb(true);
    setError(null);
    try {
      const resp = await fetch('/api/cloud/terabox', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(),
        },
        body: JSON.stringify({
          name: tbName.trim(),
          externalUrl: tbUrl.trim(),
          sizeGb: Number(tbSizeGb) || 1,
          folder: 'TeraBox 1 ТБ',
        }),
      });
      const json = (await resp.json()) as CloudStorageSummary & { error?: string };
      if (!resp.ok) {
        setError(json.error || 'Не удалось сохранить ссылку TeraBox.');
        setSavingTb(false);
        return;
      }
      setSummary({
        quotaBytes: json.quotaBytes || TB_BYTES,
        usedBytes: json.usedBytes || 0,
        files: json.files || [],
        folders: json.folders || summary.folders,
      });
      setTbName('');
      setTbUrl('');
      setShowTeraboxForm(false);
      onNotify('Ресурс TeraBox добавлен в ваше облако 1 ТБ.');
    } catch {
      setError('Ошибка при сохранении ссылки TeraBox.');
    } finally {
      setSavingTb(false);
    }
  };

  const handleDownload = async (item: CloudFileItem) => {
    if (item.source === 'terabox' && item.externalUrl) {
      window.open(item.externalUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    try {
      const resp = await fetch(`/api/cloud/files/${encodeURIComponent(item.id)}/download`, {
        credentials: 'include',
        headers: authHeaders(),
      });
      if (!resp.ok) {
        setError('Не удалось скачать файл.');
        return;
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = item.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError('Ошибка при скачивании файла.');
    }
  };

  const handleDelete = async (item: CloudFileItem) => {
    try {
      const resp = await fetch(`/api/cloud/files/${encodeURIComponent(item.id)}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: authHeaders(),
      });
      const json = (await resp.json()) as CloudStorageSummary & { error?: string };
      if (!resp.ok) {
        setError(json.error || 'Не удалось удалить файл.');
        return;
      }
      setSummary({
        quotaBytes: json.quotaBytes || TB_BYTES,
        usedBytes: json.usedBytes || 0,
        files: json.files || [],
        folders: json.folders || summary.folders,
      });
      onNotify(`Удалено: «${item.name}».`);
    } catch {
      setError('Ошибка при удалении.');
    }
  };

  const handleRunCloudAi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPrompt.trim() || aiRunning) return;
    setAiRunning(true);
    setError(null);
    try {
      const resp = await fetch('/api/cloud/ai-analyze', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(),
        },
        body: JSON.stringify({
          prompt: aiPrompt.trim(),
          provider: aiProvider,
          saveAsFile: aiSaveFile,
        }),
      });
      const json = (await resp.json()) as {
        answer?: string;
        model?: string;
        routedTo?: string;
        routeReason?: string;
        savedFile?: CloudFileItem;
        files?: CloudFileItem[];
        folders?: string[];
        usedBytes?: number;
        quotaBytes?: number;
        error?: string;
      };
      if (!resp.ok || !json.answer) {
        setError(json.error || 'Не удалось выполнить запрос нейросети по облаку.');
        setAiRunning(false);
        return;
      }
      setAiAnswer({
        text: json.answer,
        model: json.model || 'Fires Assistant',
        routedTo: json.routedTo,
        routeReason: json.routeReason,
      });
      if (json.savedFile) {
        setSummary((prev) => ({
          quotaBytes: json.quotaBytes || prev.quotaBytes,
          usedBytes: typeof json.usedBytes === 'number' ? json.usedBytes : prev.usedBytes,
          files: Array.isArray(json.files) ? json.files : [json.savedFile!, ...prev.files],
          folders: Array.isArray(json.folders) ? json.folders : prev.folders,
        }));
        onNotify(`Ответ сохранён в облако: ${json.savedFile.name}`);
      }
    } catch {
      setError('Ошибка соединения с ИИ в облаке.');
    } finally {
      setAiRunning(false);
    }
  };

  const filteredFiles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return summary.files.filter((f) => {
      if (selectedFolder !== 'all' && f.folder !== selectedFolder) return false;
      if (categoryFilter !== 'all' && f.category !== categoryFilter) return false;
      if (q && !f.name.toLowerCase().includes(q) && !f.folder.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [categoryFilter, searchQuery, selectedFolder, summary.files]);

  if (!currentUser) {
    return (
      <div className="max-w-lg mx-auto my-12 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center space-y-4">
        <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 flex items-center justify-center">
          <Lock className="w-5 h-5" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
          Облачное хранилище 1 ТБ · TeraBox
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Войдите в аккаунт Firas, чтобы загружать файлы, создавать папки и подключать ссылки TeraBox на 1 ТБ.
        </p>
        <button
          type="button"
          onClick={() => onOpenAuth('login')}
          className="px-5 py-2.5 text-xs font-medium rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900"
        >
          Войти в аккаунт
        </button>
      </div>
    );
  }

  const usedPercent = Math.min(100, (summary.usedBytes / summary.quotaBytes) * 100);

  const renderCategoryIcon = (cat: CloudFileItem['category']) => {
    switch (cat) {
      case 'terabox':
        return <Cloud className="w-4 h-4 text-sky-600 dark:text-sky-400" />;
      case 'ai-model':
        return <Cpu className="w-4 h-4 text-violet-600 dark:text-violet-400" />;
      case 'media':
        return <Film className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />;
      case 'archive':
        return <Archive className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
      case 'document':
        return <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
      default:
        return <FileIcon className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & 1 TB Quota Card */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 flex items-center justify-center shrink-0">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                Облачное хранилище 1 ТБ · TeraBox
              </h1>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Персональный диск Firas + интеграция с TeraBox (1024 ГБ бесплатно) для файлов и резервных копий.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleUploadFile}
              className="hidden"
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors disabled:opacity-50 focus:outline-none"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{uploading ? 'Загрузка...' : 'Импорт / Загрузить файлы'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowTeraboxForm((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none"
            >
              <Link2 className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
              <span>Подключить TeraBox</span>
            </button>

            <a
              href="https://www.terabox.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <span>Открыть TeraBox 1 ТБ</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Quota Bar + Drag & Drop Import Zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            if (e.dataTransfer.files?.length) {
              void uploadFilesList(e.dataTransfer.files);
            }
          }}
          className={`space-y-2.5 p-3 rounded-xl border transition-colors ${
            dragActive
              ? 'border-black dark:border-slate-200 bg-slate-100/80 dark:bg-slate-800/60'
              : 'border-dashed border-slate-200 dark:border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-slate-700 dark:text-slate-300">
              Занято: <span className="font-mono tabular-nums">{formatSize(summary.usedBytes)}</span> из{' '}
              <span className="font-mono tabular-nums font-semibold">1.00 ТБ (1024 ГБ)</span>
            </span>
            <span className="font-mono tabular-nums text-slate-400">
              Свободно: {formatSize(Math.max(0, summary.quotaBytes - summary.usedBytes))} · Перетащите файлы сюда (до 25 МБ)
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-slate-900 dark:bg-slate-100 transition-all"
              style={{ width: `${Math.max(usedPercent, summary.usedBytes > 0 ? 1.5 : 0)}%` }}
            />
          </div>
        </div>

        {/* TeraBox Link Form */}
        {showTeraboxForm && (
          <form
            onSubmit={handleSaveTerabox}
            className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/60 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                Добавить папку или файл из TeraBox (1 ТБ)
              </div>
              <a
                href="https://www.terabox.com/wap/home"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-sky-600 dark:text-sky-400 hover:underline inline-flex items-center gap-1"
              >
                <span>Получить 1024 ГБ в TeraBox</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <input
                type="text"
                required
                value={tbName}
                onChange={(e) => setTbName(e.target.value)}
                placeholder="Название (напр. Архив проекта)"
                className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none"
              />
              <input
                type="text"
                required
                value={tbUrl}
                onChange={(e) => setTbUrl(e.target.value)}
                placeholder="https://terabox.com/s/..."
                className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none"
              />
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0.1"
                  max="1024"
                  step="0.1"
                  value={tbSizeGb}
                  onChange={(e) => setTbSizeGb(e.target.value)}
                  className="w-24 px-2.5 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none"
                />
                <span className="text-xs text-slate-500">ГБ</span>
                <button
                  type="submit"
                  disabled={savingTb}
                  className="flex-1 py-2 px-3 text-xs font-medium rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 disabled:opacity-50 focus:outline-none"
                >
                  {savingTb ? '...' : 'Сохранить'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Meta-AI & Custom Neural Nets in Cloud 1 TB */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Нейросеть в Облаке · Fires Assistant
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Ищет среди Claude, Gemini, ChatGPT и DeepSeek лучшую модель под задачу и сохраняет ответы в Облако 1 ТБ
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onOpenAiChat(aiProvider)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none"
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Открыть Нейрочат и конструктор ИИ</span>
          </button>
        </div>

        <form onSubmit={handleRunCloudAi} className="space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Выбор нейросети для облака"
              value={aiProvider}
              onChange={(e) => setAiProvider(e.target.value as AiProviderId)}
              className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none"
            >
              <option value="fire_assistant">Fires Assistant (лучшая под задачу)</option>
              <option value="claude">Claude</option>
              <option value="codeium">Codeium (Кодинг)</option>
              <option value="studio_ai">Studio AI (Конструктор ИИ)</option>
              <option value="deepseek">DeepSeek Coder</option>
              <option value="gemini">Gemini</option>
              <option value="chatgpt">ChatGPT</option>
              {customModels.map((cm) => (
                <option key={cm.id} value={`custom:${cm.id}`}>
                  {cm.name}
                </option>
              ))}
            </select>

            <input
              type="text"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="Спросите Fires Assistant о ваших файлах или поставьте любую задачу..."
              className="flex-1 min-w-[220px] px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none"
            />

            <button
              type="submit"
              disabled={!aiPrompt.trim() || aiRunning}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 disabled:opacity-40 focus:outline-none"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{aiRunning ? 'Анализ...' : 'Запустить ИИ'}</span>
            </button>
          </div>

          <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={aiSaveFile}
              onChange={(e) => setAiSaveFile(e.target.checked)}
              className="accent-slate-900 dark:accent-slate-100"
            />
            <span>Автоматически сохранить ответ нейросети файлом (.md) в Облако 1 ТБ</span>
          </label>
        </form>

        {aiAnswer && (
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 space-y-1.5">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              <strong className="text-slate-800 dark:text-slate-200">
                {aiAnswer.routedTo || aiAnswer.model}
              </strong>
              {aiAnswer.routeReason && ` · ${aiAnswer.routeReason}`}
            </div>
            <div className="text-xs leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-line">
              {aiAnswer.text.replace(/\*\*/g, '')}
            </div>
          </div>
        )}
      </div>

      {/* Folders & Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedFolder('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors focus:outline-none ${
              selectedFolder === 'all'
                ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300'
            }`}
          >
            Все файлы ({summary.files.length})
          </button>
          {summary.folders.map((folder) => (
            <button
              key={folder}
              type="button"
              onClick={() => {
                setSelectedFolder(folder);
                setTargetFolder(folder);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors focus:outline-none ${
                selectedFolder === folder
                  ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300'
              }`}
            >
              {folder}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowFolderForm((v) => !v)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-dashed border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span>Папка</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <select
            aria-label="Категория файлов"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none"
          >
            <option value="all">Все типы</option>
            <option value="ai-model">Модели ИИ (.ai.json)</option>
            <option value="terabox">TeraBox ссылки</option>
            <option value="document">Документы</option>
            <option value="media">Медиа</option>
            <option value="archive">Архивы</option>
          </select>

          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск файлов..."
              className="w-36 bg-transparent text-xs text-slate-900 dark:text-slate-100 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {showFolderForm && (
        <form onSubmit={handleCreateFolder} className="flex items-center gap-2 max-w-sm">
          <input
            type="text"
            required
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Название новой папки..."
            className="flex-1 px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none"
          />
          <button
            type="submit"
            className="px-4 py-2 text-xs font-medium rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900"
          >
            Создать
          </button>
        </form>
      )}

      {/* Files List */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            <div className="h-10 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
            <div className="h-10 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <Cloud className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-700" />
            <div className="text-sm font-medium text-slate-700 dark:text-slate-200">
              В этом разделе пока нет файлов
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Загрузите файл напрямую на сервер Firas или прикрепите папку из TeraBox, чтобы пользоваться 1 ТБ облачного пространства.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {filteredFiles.map((item) => (
              <div
                key={item.id}
                className="px-4 py-3.5 flex flex-wrap items-center justify-between gap-3 hover:bg-slate-50/70 dark:hover:bg-slate-950/40"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                    {renderCategoryIcon(item.category)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {item.name}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-2">
                      <span>{item.folder}</span>
                      <span>·</span>
                      <span className="font-mono">{formatSize(item.sizeBytes)}</span>
                      <span>·</span>
                      <span>
                        {item.source === 'terabox' ? 'TeraBox 1 ТБ' : 'Облако Firas'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleDownload(item)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none"
                  >
                    {item.source === 'terabox' ? (
                      <>
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Открыть</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-3.5 h-3.5" />
                        <span>Скачать</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(item)}
                    aria-label={`Удалить ${item.name}`}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
