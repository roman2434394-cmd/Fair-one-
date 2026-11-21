import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Sparkles,
  Plus,
  Send,
  Trash2,
  Cpu,
  HardDrive,
  FilePlus,
  Paperclip,
  MessageSquare,
  Check,
  X,
  ExternalLink,
} from 'lucide-react';
import {
  AiChatMessage,
  AiChatThread,
  AiProviderId,
  BuiltInAiProviderId,
  CloudFileItem,
  CustomAiModel,
  CustomAiSpecialty,
  isStaffRole,
  UserProfile,
} from '../types/firas';
import { FiresLogo } from './FiresLogo';

interface AiStudioViewProps {
  currentUser: UserProfile | null;
  authToken: string | null;
  customModels: CustomAiModel[];
  initialProvider?: AiProviderId;
  onRefreshModels: () => Promise<void>;
  onSaveToNotes: (title: string, url: string, summary: string) => void;
  onOpenAuth: (mode?: 'login' | 'register', reason?: string) => void;
  onOpenCloud: () => void;
  onNotify: (message: string) => void;
}

const SPECIALTY_LABELS: Record<CustomAiSpecialty, string> = {
  universal: 'Универсальная',
  coding: 'Код и разработка',
  gamedev: 'Создание игр (2D/3D)',
  research: 'Поиск и факты',
  creative: 'Тексты и идеи',
  business: 'Бизнес и стратегия',
  study: 'Учёба и задачи',
};

const ENSEMBLE_OPTIONS: Array<{ id: BuiltInAiProviderId; label: string }> = [
  { id: 'google_studio_ai', label: 'Google Studio AI' },
  { id: 'claude', label: 'Claude' },
  { id: 'codex', label: 'Codex' },
  { id: 'deepseek', label: 'DeepSeek' },
  { id: 'deepseek_coder', label: 'DeepSeek Coder' },
  { id: 'codeium', label: 'Codeium' },
  { id: 'gemini', label: 'Gemini' },
  { id: 'chatgpt', label: 'ChatGPT' },
];

const BUILTIN_MODELS: Array<{
  id: BuiltInAiProviderId;
  label: string;
  desc: string;
  officialUrl?: string;
}> = [
  {
    id: 'google_studio_ai',
    label: 'Google Studio AI',
    desc: 'Код, WebGL / Three.js, создание игр и интерактивных приложений · безлимит',
    officialUrl: 'https://aistudio.google.com/',
  },
  {
    id: 'claude',
    label: 'Claude',
    desc: 'Глубокий анализ, архитектура, код и тексты · безлимит',
    officialUrl: 'https://claude.ai/',
  },
  {
    id: 'codex',
    label: 'Codex',
    desc: 'Игровая логика, алгоритмы, автогенерация и рефакторинг кода · безлимит',
    officialUrl: 'https://chatgpt.com/codex',
  },
  {
    id: 'studio_collab',
    label: 'Google Studio AI + Claude + Codex',
    desc: 'Объединение нейросетей с выбором ведущего движка (DeepSeek, Coder, Codex и др.)',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    desc: 'Глубокие рассуждения, аналитика, логика и задачи (DeepSeek-V3) · безлимит',
    officialUrl: 'https://chat.deepseek.com/',
  },
  {
    id: 'deepseek_coder',
    label: 'DeepSeek Coder',
    desc: 'Алгоритмы, игры, серверная логика и отладка кода · безлимит',
    officialUrl: 'https://chat.deepseek.com/',
  },
  {
    id: 'codeium',
    label: 'Codeium',
    desc: 'Нейросеть для программирования · код, рефакторинг, тесты',
    officialUrl: 'https://codeium.com/',
  },
  {
    id: 'studio_ai',
    label: 'Studio AI',
    desc: 'Студия создания нейросетей для кодинга, игр и ИИ-агентов',
  },
  {
    id: 'fire_assistant',
    label: 'Fires Assistant',
    desc: 'Умный выбор нейросети · код, игры, поиск и задачи · безлимит',
  },
  {
    id: 'gemini',
    label: 'Gemini',
    desc: 'Аналитика, факты, обучение · безлимит',
    officialUrl: 'https://gemini.google.com/',
  },
  {
    id: 'chatgpt',
    label: 'ChatGPT',
    desc: 'Тексты, диалоги, идеи · безлимит',
    officialUrl: 'https://chatgpt.com/',
  },
];

const STUDIO_AI_CODING_TEMPLATES: Array<{
  name: string;
  tagline: string;
  specialty: CustomAiSpecialty;
  baseEngine: CustomAiModel['baseEngine'];
  ensembleEngines?: BuiltInAiProviderId[];
  systemPrompt: string;
}> = [
  {
    name: 'Google Studio AI + Claude + Codex (Игры)',
    tagline: 'Совместная разработка 2D/3D игр, физики, ИИ врагов и архитектуры',
    specialty: 'gamedev',
    baseEngine: 'ensemble',
    ensembleEngines: ['google_studio_ai', 'claude', 'codex'],
    systemPrompt:
      'Вы работаете совместно: Google Studio AI проектирует игровой цикл и графику, Claude строит чистую модульную архитектуру и состояния игры, а Codex пишет оптимизированный код физики, управления и коллизий.',
  },
  {
    name: 'Google Studio AI — WebGL и 2D/3D Игры',
    tagline: 'Игры на Canvas, Three.js, шейдеры и мобильное сенсорное управление',
    specialty: 'gamedev',
    baseEngine: 'google_studio_ai',
    systemPrompt:
      'Ты — специалист Google Studio AI по разработке браузерных игр (HTML5 Canvas, Three.js, WebGL). Пиши готовый игровой цикл requestAnimationFrame с адаптацией под телефон и ПК.',
  },
  {
    name: 'Codex — Игровой Движок & Геймдизайн',
    tagline: 'Механики Unity / Godot / TypeScript, спавнеры, баланс и физика',
    specialty: 'gamedev',
    baseEngine: 'codex',
    systemPrompt:
      'Ты — игровой программист Codex. Генерируй структурированный код игровых систем (ECS, физика прыжка, хитбоксы, инвентарь, мультиплеер-синхронизация).',
  },
  {
    name: 'TypeScript & React Архитектор',
    tagline: 'Строгая типизация, UI-компоненты и хуки без багов',
    specialty: 'coding',
    baseEngine: 'claude',
    systemPrompt:
      'Ты — senior TypeScript/React инженер. Пиши чистый модульный код с полной типизацией, проверяй edge-cases и избегай лишних зависимостей.',
  },
  {
    name: 'Codeium Pro Assistant',
    tagline: 'Быстрое написание кода, автодополнение и оптимизация',
    specialty: 'coding',
    baseEngine: 'codeium',
    systemPrompt:
      'Ты — нейросеть для быстрого программирования. Сразу выдавай готовые рабочие фрагменты кода, указывай сложность и быстрые правки.',
  },
  {
    name: 'Python / DeepSeek Coder Инженер',
    tagline: 'FastAPI, парсинг данных, алгоритмы и ML-пайплайны',
    specialty: 'coding',
    baseEngine: 'deepseek_coder',
    systemPrompt:
      'Ты — разработчик DeepSeek Coder. Создавай надёжный асинхронный backend-код, давай SQL-запросы и поясняй архитектуру API.',
  },
];

export const AiStudioView: React.FC<AiStudioViewProps> = ({
  currentUser,
  authToken,
  customModels,
  initialProvider,
  onRefreshModels,
  onSaveToNotes,
  onOpenAuth,
  onOpenCloud,
  onNotify,
}) => {
  const [threads, setThreads] = useState<AiChatThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [guestMessages, setGuestMessages] = useState<AiChatMessage[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<AiProviderId>(
    initialProvider || 'fire_assistant'
  );
  const [activeLeadEngine, setActiveLeadEngine] = useState<BuiltInAiProviderId | 'auto'>('auto');
  const [cloudFiles, setCloudFiles] = useState<CloudFileItem[]>([]);
  const [attachedFileId, setAttachedFileId] = useState<string>('');
  const [prompt, setPrompt] = useState('');
  const [sending, setSending] = useState(false);
  const [savingToCloudId, setSavingToCloudId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Builder state for creating user's own neural net
  const [builderOpen, setBuilderOpen] = useState(false);
  const [modelName, setModelName] = useState('');
  const [modelTagline, setModelTagline] = useState('');
  const [modelSpecialty, setModelSpecialty] = useState<CustomAiSpecialty>('gamedev');
  const [modelBaseEngine, setModelBaseEngine] =
    useState<CustomAiModel['baseEngine']>('ensemble');
  const [ensembleEngines, setEnsembleEngines] = useState<BuiltInAiProviderId[]>([
    'google_studio_ai',
    'claude',
    'codex',
  ]);
  const [modelLeadEngine, setModelLeadEngine] = useState<BuiltInAiProviderId | 'auto'>('auto');
  const [modelPrompt, setModelPrompt] = useState('');
  const [modelPublic, setModelPublic] = useState(true);
  const [modelSaveCloud, setModelSaveCloud] = useState(true);
  const [creatingModel, setCreatingModel] = useState(false);

  useEffect(() => {
    if (initialProvider) {
      setSelectedProvider(initialProvider);
      if (initialProvider === 'studio_ai') {
        setBuilderOpen(true);
      }
    }
  }, [initialProvider]);

  const authHeaders = useCallback((): Record<string, string> => {
    return authToken ? { Authorization: `Bearer ${authToken}` } : {};
  }, [authToken]);

  const loadThreadsAndFiles = useCallback(async () => {
    if (!currentUser) {
      setThreads([]);
      setCloudFiles([]);
      return;
    }
    try {
      const [chatsResp, filesResp] = await Promise.all([
        fetch('/api/ai/chats', { credentials: 'include', headers: authHeaders() }),
        fetch('/api/cloud/files', { credentials: 'include', headers: authHeaders() }),
      ]);
      if (chatsResp.ok) {
        const data = (await chatsResp.json()) as { threads?: AiChatThread[] };
        const list = Array.isArray(data.threads) ? data.threads : [];
        setThreads(list);
        setActiveThreadId((prev) => {
          if (prev && list.some((t) => t.id === prev)) return prev;
          return list[0]?.id ?? null;
        });
      }
      if (filesResp.ok) {
        const fdata = (await filesResp.json()) as { files?: CloudFileItem[] };
        setCloudFiles(Array.isArray(fdata.files) ? fdata.files : []);
      }
    } catch {
      // ignore transient errors
    }
  }, [authHeaders, currentUser]);

  useEffect(() => {
    loadThreadsAndFiles();
  }, [loadThreadsAndFiles]);

  const activeThread = useMemo(
    () => threads.find((t) => t.id === activeThreadId) || null,
    [threads, activeThreadId]
  );

  const visibleMessages = currentUser ? activeThread?.messages || [] : guestMessages;

  const activeCustomModel = useMemo(() => {
    if (!selectedProvider.startsWith('custom:')) return null;
    const cid = selectedProvider.slice(7);
    return customModels.find((m) => m.id === cid) || null;
  }, [customModels, selectedProvider]);

  const isEnsembleActive =
    selectedProvider === 'studio_collab' ||
    Boolean(
      activeCustomModel &&
        (activeCustomModel.baseEngine === 'ensemble' ||
          (Array.isArray(activeCustomModel.ensembleEngines) &&
            activeCustomModel.ensembleEngines.length > 1))
    );

  useEffect(() => {
    if (activeCustomModel?.leadEngine) {
      setActiveLeadEngine(activeCustomModel.leadEngine);
    } else {
      setActiveLeadEngine('auto');
    }
  }, [activeCustomModel]);

  const activeModelMeta = useMemo(() => {
    if (activeCustomModel) {
      return {
        title: activeCustomModel.name,
        subtitle: `${SPECIALTY_LABELS[activeCustomModel.specialty]} · ${activeCustomModel.tagline}`,
        officialUrl: undefined,
      };
    }
    const builtIn =
      BUILTIN_MODELS.find((b) => b.id === selectedProvider) || BUILTIN_MODELS[0];
    return {
      title: builtIn.label,
      subtitle: builtIn.desc,
      officialUrl: builtIn.officialUrl,
    };
  }, [activeCustomModel, selectedProvider]);

  const handleNewChat = () => {
    setActiveThreadId(null);
    setGuestMessages([]);
    setError(null);
  };

  const handleSelectThread = (thread: AiChatThread) => {
    setActiveThreadId(thread.id);
    setSelectedProvider(thread.provider || 'fire_assistant');
    setError(null);
  };

  const handleDeleteThread = async (threadId: string) => {
    try {
      const resp = await fetch(`/api/ai/chats/${encodeURIComponent(threadId)}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: authHeaders(),
      });
      if (resp.ok) {
        const data = (await resp.json()) as { threads?: AiChatThread[] };
        const nextList = Array.isArray(data.threads) ? data.threads : [];
        setThreads(nextList);
        if (activeThreadId === threadId) {
          setActiveThreadId(nextList[0]?.id ?? null);
        }
      }
    } catch {
      setError('Не удалось удалить диалог.');
    }
  };

  const handleCreateCustomModel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      onOpenAuth('login', 'Войдите в аккаунт, чтобы создать свою нейросеть.');
      return;
    }
    if (modelName.trim().length < 2 || modelPrompt.trim().length < 5) {
      setError('Укажите название нейросети (от 2 символов) и инструкцию (от 5 символов).');
      return;
    }
    setCreatingModel(true);
    setError(null);
    try {
      const resp = await fetch('/api/ai/models', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(),
        },
        body: JSON.stringify({
          name: modelName.trim(),
          tagline: modelTagline.trim(),
          specialty: modelSpecialty,
          baseEngine: modelBaseEngine,
          ensembleEngines: modelBaseEngine === 'ensemble' ? ensembleEngines : undefined,
          leadEngine:
            modelBaseEngine === 'ensemble' && modelLeadEngine !== 'auto'
              ? modelLeadEngine
              : undefined,
          systemPrompt: modelPrompt.trim(),
          isPublic: modelPublic,
          savedToCloud: modelSaveCloud,
        }),
      });
      const json = (await resp.json()) as { model?: CustomAiModel; error?: string };
      if (!resp.ok || !json.model) {
        setError(json.error || 'Не удалось создать нейросеть.');
        setCreatingModel(false);
        return;
      }
      await onRefreshModels();
      await loadThreadsAndFiles();
      setSelectedProvider(`custom:${json.model.id}`);
      setModelName('');
      setModelTagline('');
      setModelPrompt('');
      setBuilderOpen(false);
      onNotify(
        modelSaveCloud
          ? `Нейросеть «${json.model.name}» создана и сохранена в Облако 1 ТБ.`
          : `Нейросеть «${json.model.name}» создана и готова к работе.`
      );
    } catch {
      setError('Ошибка соединения при создании нейросети.');
    } finally {
      setCreatingModel(false);
    }
  };

  const handleDeleteCustomModel = async (model: CustomAiModel) => {
    try {
      const resp = await fetch(`/api/ai/models/${encodeURIComponent(model.id)}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: authHeaders(),
      });
      if (!resp.ok) {
        const json = (await resp.json()) as { error?: string };
        setError(json.error || 'Не удалось удалить нейросеть.');
        return;
      }
      if (selectedProvider === `custom:${model.id}`) {
        setSelectedProvider('fire_assistant');
      }
      await onRefreshModels();
      onNotify(`Нейросеть «${model.name}» удалена.`);
    } catch {
      setError('Ошибка при удалении нейросети.');
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setError(null);
    setPrompt('');

    try {
      if (currentUser) {
        const targetThreadId = activeThreadId || `thr-${Date.now()}`;
        const resp = await fetch('/api/ai/chats', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders(),
          },
          body: JSON.stringify({
            threadId: targetThreadId,
            provider: selectedProvider,
            leadEngine:
              isEnsembleActive && activeLeadEngine !== 'auto' ? activeLeadEngine : undefined,
            prompt: trimmed,
            cloudFileId: attachedFileId || undefined,
          }),
        });
        const json = (await resp.json()) as {
          thread?: AiChatThread;
          threads?: AiChatThread[];
          error?: string;
        };
        if (!resp.ok || !json.thread) {
          setPrompt(trimmed);
          setError(json.error || 'Не удалось получить ответ нейросети.');
          setSending(false);
          return;
        }
        if (Array.isArray(json.threads)) {
          setThreads(json.threads);
        } else {
          setThreads((prev) => [
            json.thread!,
            ...prev.filter((t) => t.id !== json.thread!.id),
          ]);
        }
        setActiveThreadId(json.thread.id);
      } else {
        const userMsg: AiChatMessage = {
          id: `u-${Date.now()}`,
          role: 'user',
          text: trimmed,
          createdAt: new Date().toISOString(),
        };
        const nextHistory = [...guestMessages, userMsg];
        setGuestMessages(nextHistory);

        const resp = await fetch('/api/ai-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: selectedProvider,
            leadEngine:
              isEnsembleActive && activeLeadEngine !== 'auto' ? activeLeadEngine : undefined,
            messages: nextHistory.map((m) => ({ role: m.role, text: m.text })),
          }),
        });
        const json = (await resp.json()) as {
          answer?: string;
          model?: string;
          routedTo?: string;
          routeReason?: string;
          error?: string;
        };
        if (!resp.ok || !json.answer) {
          setError(json.error || 'Не удалось получить ответ нейросети.');
          setSending(false);
          return;
        }
        const assistantMsg: AiChatMessage = {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: json.answer,
          model: json.model,
          routedTo: json.routedTo,
          routeReason: json.routeReason,
          createdAt: new Date().toISOString(),
        };
        setGuestMessages((prev) => [...prev, assistantMsg]);
      }
    } catch {
      setPrompt(trimmed);
      setError('Ошибка соединения с сервером нейросети.');
    } finally {
      setSending(false);
    }
  };

  const handleSaveMessageToCloud = async (msg: AiChatMessage) => {
    if (!currentUser) {
      onOpenAuth('login', 'Войдите, чтобы сохранять ответы в Облако 1 ТБ.');
      return;
    }
    setSavingToCloudId(msg.id);
    try {
      const content = `# Ответ нейросети (${msg.model || activeModelMeta.title})\n\n${msg.text}`;
      const base64 = btoa(unescape(encodeURIComponent(content)));
      const resp = await fetch('/api/cloud/upload', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(),
        },
        body: JSON.stringify({
          name: `AI-чат-${new Date().toISOString().slice(0, 10)}.md`,
          folder: 'Документы',
          mimeType: 'text/markdown',
          dataBase64: `data:text/markdown;base64,${base64}`,
        }),
      });
      if (resp.ok) {
        await loadThreadsAndFiles();
        onNotify('Ответ сохранён в Облако 1 ТБ (папка «Документы»).');
      } else {
        setError('Не удалось сохранить ответ в облако.');
      }
    } catch {
      setError('Ошибка при сохранении ответа в облако.');
    } finally {
      setSavingToCloudId(null);
    }
  };

  return (
    <div className="space-y-4 min-w-0">
      {/* Header Bar */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <FiresLogo size={40} className="shrink-0" />
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 leading-snug">
              Studio AI · Google Studio AI, Claude, Codex и DeepSeek
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Кодинг и создание игр · Объединение нейросетей с выбором движка · Облако 1 ТБ
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0 pb-0.5 sm:pb-0">
          <button
            type="button"
            onClick={() => setBuilderOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors whitespace-nowrap shrink-0 focus:outline-none"
          >
            <Cpu className="w-3.5 h-3.5 shrink-0" />
            <span>+ Создать нейросеть</span>
          </button>

          <button
            type="button"
            onClick={onOpenCloud}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 focus:outline-none"
          >
            <HardDrive className="w-3.5 h-3.5 shrink-0" />
            <span>Облако 1 ТБ</span>
          </button>
        </div>
      </div>

      {/* Custom Neural Net Builder Drawer */}
      {builderOpen && (
        <form
          onSubmit={handleCreateCustomModel}
          className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-4"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 text-sm font-semibold text-slate-900 dark:text-slate-100 min-w-0">
              <FiresLogo size={24} className="shrink-0" />
              <span className="truncate">Studio AI · Конструктор нейросетей для кода и игр</span>
            </div>
            <button
              type="button"
              onClick={() => setBuilderOpen(false)}
              aria-label="Закрыть конструктор нейросети"
              className="p-1.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 shrink-0 focus:outline-none"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* One-click coding & gamedev presets (horizontally swipeable on phone) */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Быстрые шаблоны для создания игр и программирования:
            </div>
            <div className="flex items-center sm:flex-wrap gap-1.5 overflow-x-auto no-scrollbar pb-1">
              {STUDIO_AI_CODING_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.name}
                  type="button"
                  onClick={() => {
                    setModelName(tpl.name);
                    setModelTagline(tpl.tagline);
                    setModelSpecialty(tpl.specialty);
                    setModelBaseEngine(tpl.baseEngine);
                    if (tpl.ensembleEngines) {
                      setEnsembleEngines(tpl.ensembleEngines);
                    }
                    setModelPrompt(tpl.systemPrompt);
                  }}
                  className="px-2.5 py-1.5 text-[11px] font-medium rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left whitespace-nowrap shrink-0 focus:outline-none"
                >
                  {tpl.name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                Название нейросети
              </label>
              <input
                type="text"
                required
                minLength={2}
                maxLength={48}
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                placeholder="Напр. GameStudio + Codex"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                Специализация
              </label>
              <select
                value={modelSpecialty}
                onChange={(e) => setModelSpecialty(e.target.value as CustomAiSpecialty)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none"
              >
                {(Object.keys(SPECIALTY_LABELS) as CustomAiSpecialty[]).map((key) => (
                  <option key={key} value={key}>
                    {SPECIALTY_LABELS[key]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                Базовый движок
              </label>
              <select
                value={modelBaseEngine}
                onChange={(e) =>
                  setModelBaseEngine(e.target.value as CustomAiModel['baseEngine'])
                }
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none"
              >
                <option value="ensemble">Объединить нейросети (выбор движка)</option>
                <option value="google_studio_ai">Google Studio AI (Код и Игры)</option>
                <option value="claude">Claude (Архитектура)</option>
                <option value="codex">Codex (Игровой код)</option>
                <option value="deepseek">DeepSeek (DeepSeek-V3)</option>
                <option value="deepseek_coder">DeepSeek Coder (Код и алгоритмы)</option>
                <option value="codeium">Codeium (Кодинг)</option>
                <option value="studio_ai">Studio AI (Кодинг-студия)</option>
                <option value="gemini">Gemini</option>
                <option value="chatgpt">ChatGPT</option>
                <option value="auto">Автовыбор (Fires Assistant)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                Краткое описание
              </label>
              <input
                type="text"
                maxLength={120}
                value={modelTagline}
                onChange={(e) => setModelTagline(e.target.value)}
                placeholder="Для создания игр и программирования"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none"
              />
            </div>
          </div>

          {modelBaseEngine === 'ensemble' && (
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  Какие нейросети объединить вместе:
                </span>
                <div className="flex items-center gap-3 overflow-x-auto no-scrollbar max-w-full">
                  <button
                    type="button"
                    onClick={() =>
                      setEnsembleEngines(ENSEMBLE_OPTIONS.map((opt) => opt.id))
                    }
                    className="text-[11px] font-semibold text-slate-900 dark:text-slate-100 underline whitespace-nowrap shrink-0 hover:opacity-80 focus:outline-none"
                  >
                    Объединить все нейросети
                  </button>
                  <button
                    type="button"
                    onClick={() => setEnsembleEngines(['google_studio_ai', 'claude', 'codex'])}
                    className="text-[11px] font-medium text-slate-600 dark:text-slate-300 underline whitespace-nowrap shrink-0 hover:opacity-80 focus:outline-none"
                  >
                    Google Studio AI + Claude + Codex
                  </button>
                </div>
              </div>

              <div className="flex items-center sm:flex-wrap gap-1.5 overflow-x-auto no-scrollbar pb-1">
                {ENSEMBLE_OPTIONS.map((opt) => {
                  const picked = ensembleEngines.includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() =>
                        setEnsembleEngines((prev) =>
                          prev.includes(opt.id)
                            ? prev.length > 1
                              ? prev.filter((x) => x !== opt.id)
                              : prev
                            : [...prev, opt.id]
                        )
                      }
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border whitespace-nowrap shrink-0 transition-colors focus:outline-none ${
                        picked
                          ? 'border-black bg-black text-white dark:border-white dark:bg-white dark:text-black'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label
                  htmlFor="builder-lead-engine"
                  className="text-xs font-medium text-slate-700 dark:text-slate-200 shrink-0"
                >
                  Через какой движок делать результат (напр. DeepSeek или DeepSeek Coder):
                </label>
                <select
                  id="builder-lead-engine"
                  value={modelLeadEngine}
                  onChange={(e) =>
                    setModelLeadEngine(e.target.value as BuiltInAiProviderId | 'auto')
                  }
                  className="w-full sm:w-auto sm:min-w-[230px] px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none"
                >
                  <option value="auto">Все на равных (автосинтез)</option>
                  <option value="deepseek">DeepSeek (универсальный)</option>
                  <option value="deepseek_coder">DeepSeek Coder (код и игры)</option>
                  <option value="google_studio_ai">Google Studio AI</option>
                  <option value="claude">Claude</option>
                  <option value="codex">Codex</option>
                  <option value="codeium">Codeium</option>
                  <option value="gemini">Gemini</option>
                  <option value="chatgpt">ChatGPT</option>
                </select>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
              Характер, знания и инструкции вашей нейросети
            </label>
            <textarea
              rows={3}
              required
              minLength={5}
              value={modelPrompt}
              onChange={(e) => setModelPrompt(e.target.value)}
              placeholder="Опишите, как должна отвечать ваша нейросеть, какие задачи решать лучше всего и в каком стиле..."
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-300">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={modelSaveCloud}
                  onChange={(e) => setModelSaveCloud(e.target.checked)}
                  className="accent-slate-900 dark:accent-slate-100"
                />
                <span>Сохранить в Облако 1 ТБ (.ai.json)</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={modelPublic}
                  onChange={(e) => setModelPublic(e.target.checked)}
                  className="accent-slate-900 dark:accent-slate-100"
                />
                <span>Учитывать в поиске Fires Assistant</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={creatingModel}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 disabled:opacity-50 focus:outline-none"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{creatingModel ? 'Создание...' : 'Создать свою нейросеть'}</span>
            </button>
          </div>
        </form>
      )}

      {error && (
        <div className="px-4 py-2.5 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 text-xs text-red-700 dark:text-red-300 flex items-center justify-between gap-2">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="p-1 hover:opacity-70 focus:outline-none"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Split Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:min-h-[600px]">
        {/* Left Rail: Models & Threads (horizontal swipeable strips on mobile so cards never stack/overlap) */}
        <aside className="lg:col-span-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 sm:p-4 flex flex-col gap-4 sm:gap-5 min-w-0">
          {/* Model Switcher */}
          <div className="space-y-2 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Выбор нейросети (безлимит)
              </span>
              <span className="lg:hidden text-[11px] text-slate-400">
                Свайп →
              </span>
            </div>
            <div className="flex flex-row lg:flex-col gap-2 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-1 lg:pb-0">
              {BUILTIN_MODELS.map((m) => {
                const active = selectedProvider === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedProvider(m.id)}
                    className={`w-[215px] sm:w-[235px] lg:w-full shrink-0 snap-start text-left px-3 py-2 rounded-xl border transition-colors focus:outline-none ${
                      active
                        ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    <div className="text-xs font-semibold truncate">{m.label}</div>
                    <div
                      className={`text-[11px] mt-0.5 line-clamp-1 ${
                        active ? 'opacity-80' : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {m.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* User-Created Custom Neural Nets */}
          <div className="space-y-2 min-w-0">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Созданные нейросети ({customModels.length})
              </span>
              <button
                type="button"
                onClick={() => setBuilderOpen(true)}
                className="text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:underline focus:outline-none"
              >
                + Создать
              </button>
            </div>
            {customModels.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Создайте свою нейросеть со своими правилами и специализацией.
              </p>
            ) : (
              <div className="flex flex-row lg:flex-col gap-2 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-1 lg:pb-0 lg:max-h-48 lg:overflow-y-auto lg:pr-0.5">
                {customModels.map((cm) => {
                  const cid: AiProviderId = `custom:${cm.id}`;
                  const active = selectedProvider === cid;
                  const canDelete =
                    currentUser &&
                    (cm.ownerId === currentUser.id || isStaffRole(currentUser.role));
                  return (
                    <div
                      key={cm.id}
                      className={`w-[215px] sm:w-[235px] lg:w-full shrink-0 snap-start flex items-center gap-1.5 px-2.5 py-2 rounded-xl border transition-colors ${
                        active
                          ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
                          : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedProvider(cid)}
                        className="flex-1 min-w-0 text-left focus:outline-none"
                      >
                        <div className="text-xs font-semibold truncate">{cm.name}</div>
                        <div
                          className={`text-[11px] truncate ${
                            active ? 'opacity-80' : 'text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {SPECIALTY_LABELS[cm.specialty]} · @{cm.ownerName}
                        </div>
                      </button>
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => handleDeleteCustomModel(cm)}
                          aria-label={`Удалить ${cm.name}`}
                          className={`p-1 rounded-md shrink-0 focus:outline-none ${
                            active
                              ? 'hover:bg-white/15 dark:hover:bg-slate-900/15'
                              : 'text-slate-400 hover:text-red-600'
                          }`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Saved Chat Threads */}
          <div className="flex-1 min-h-0 flex flex-col space-y-2 border-t border-slate-200 dark:border-slate-800 pt-3 sm:pt-4 min-w-0">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                История чатов
              </span>
              <button
                type="button"
                onClick={handleNewChat}
                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none"
              >
                <Plus className="w-3 h-3" />
                <span>Новый чат</span>
              </button>
            </div>

            <div className="flex flex-row lg:flex-col gap-1.5 overflow-x-auto no-scrollbar pb-1 lg:pb-0 lg:flex-1 lg:overflow-y-auto lg:max-h-56">
              {threads.length === 0 ? (
                <div className="text-xs text-slate-500 dark:text-slate-400 py-1.5">
                  {currentUser
                    ? 'Задайте первый вопрос — диалог сохранится автоматически.'
                    : 'Войдите, чтобы сохранять историю диалогов.'}
                </div>
              ) : (
                threads.map((thr) => {
                  const active = thr.id === activeThreadId;
                  return (
                    <div
                      key={thr.id}
                      className={`max-w-[210px] lg:max-w-none lg:w-full shrink-0 flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs transition-colors ${
                        active
                          ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800/70 lg:border-0'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleSelectThread(thr)}
                        className="flex-1 min-w-0 flex items-center gap-2 text-left focus:outline-none"
                      >
                        <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-60" />
                        <span className="truncate">{thr.title}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteThread(thr.id)}
                        aria-label={`Удалить чат ${thr.title}`}
                        className="p-1 rounded text-slate-400 hover:text-red-600 shrink-0 focus:outline-none"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </aside>

        {/* Right Chat Canvas */}
        <section className="lg:col-span-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col overflow-hidden min-h-[460px] lg:min-h-[600px] min-w-0">
          {/* Active Model Bar */}
          <div className="px-4 sm:px-5 py-3 border-b border-slate-200 dark:border-slate-800 space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {activeModelMeta.title}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {activeModelMeta.subtitle}
                </div>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
                {activeModelMeta.officialUrl && (
                  <a
                    href={activeModelMeta.officialUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
                  >
                    <span>Официальное приложение</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={handleNewChat}
                  className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 focus:outline-none"
                >
                  + Новый чат
                </button>
              </div>
            </div>

            {isEnsembleActive && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 shrink-0">
                  Делать объединённый запрос через движок:
                </span>
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                  {[
                    { id: 'auto' as const, label: 'Все вместе' },
                    { id: 'deepseek' as const, label: 'DeepSeek' },
                    { id: 'deepseek_coder' as const, label: 'DeepSeek Coder' },
                    { id: 'google_studio_ai' as const, label: 'Google Studio AI' },
                    { id: 'claude' as const, label: 'Claude' },
                    { id: 'codex' as const, label: 'Codex' },
                  ].map((opt) => {
                    const picked = activeLeadEngine === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setActiveLeadEngine(opt.id)}
                        className={`px-2.5 py-1 text-[11px] font-medium rounded-md border whitespace-nowrap shrink-0 transition-colors focus:outline-none ${
                          picked
                            ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
                            : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Messages Stream */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-slate-50/40 dark:bg-slate-950/30">
            {visibleMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-8 sm:py-12 space-y-3 max-w-md mx-auto w-full">
                <FiresLogo size={38} className="shrink-0" />
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Начните диалог с {activeModelMeta.title}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Задавайте задачи по программированию и созданию игр, прикрепляйте файлы из Облака 1 ТБ или объединяйте нейросети с выбором движка (DeepSeek, DeepSeek Coder, Codex и др.).
                </p>
                <div className="w-full flex items-center sm:flex-wrap sm:justify-center gap-2 overflow-x-auto no-scrollbar pt-2 pb-1">
                  {[
                    'Создай 2D игру-платформер на HTML5 Canvas с врагами',
                    'Собери 3D сцену на Three.js с управлением под телефон и ПК',
                    'Напиши функцию на TypeScript для сортировки задач',
                  ].map((ex) => (
                    <button
                      key={ex}
                      type="button"
                      onClick={() => setPrompt(ex)}
                      className="max-w-[240px] sm:max-w-none shrink-0 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700 text-left sm:text-center focus:outline-none"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              visibleMessages.map((msg) => {
                const isUser = msg.role === 'user';
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 space-y-2 ${
                        isUser
                          ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 rounded-br-sm'
                          : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-sm'
                      }`}
                    >
                      {!isUser && (msg.routedTo || msg.model) && (
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-1.5">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {msg.routedTo || msg.model}
                          </span>
                          {msg.routeReason && (
                            <>
                              <span>·</span>
                              <span>{msg.routeReason}</span>
                            </>
                          )}
                        </div>
                      )}

                      <div className="text-sm leading-relaxed whitespace-pre-line break-words">
                        {msg.text.replace(/\*\*/g, '')}
                      </div>

                      {!isUser && (
                        <div className="pt-1 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                          <span className="font-mono tabular-nums">
                            {new Date(msg.createdAt).toLocaleTimeString('ru-RU', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                onSaveToNotes(
                                  `ИИ-чат: ${msg.routedTo || activeModelMeta.title}`,
                                  '',
                                  msg.text
                                )
                              }
                              className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300 hover:underline focus:outline-none"
                            >
                              <FilePlus className="w-3 h-3" />
                              <span>В заметки</span>
                            </button>
                            <button
                              type="button"
                              disabled={savingToCloudId === msg.id}
                              onClick={() => handleSaveMessageToCloud(msg)}
                              className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300 hover:underline disabled:opacity-50 focus:outline-none"
                            >
                              <HardDrive className="w-3 h-3" />
                              <span>
                                {savingToCloudId === msg.id ? 'Сохранение...' : 'В Облако 1 ТБ'}
                              </span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            {sending && (
              <div className="text-xs text-slate-500 dark:text-slate-400 px-2">
                {selectedProvider === 'fire_assistant'
                  ? 'Fires Assistant подбирает лучшую нейросеть и формирует ответ...'
                  : 'Нейросеть отвечает...'}
              </div>
            )}
          </div>

          {/* Composer + Cloud File Attachment */}
          <form
            onSubmit={handleSend}
            className="p-3.5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2.5"
          >
            {currentUser && cloudFiles.length > 0 && (
              <div className="flex items-center gap-2 text-xs">
                <Paperclip className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <select
                  aria-label="Прикрепить файл из Облака 1 ТБ"
                  value={attachedFileId}
                  onChange={(e) => setAttachedFileId(e.target.value)}
                  className="max-w-xs px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-200 focus:outline-none"
                >
                  <option value="">Без файла из Облака 1 ТБ</option>
                  {cloudFiles.map((cf) => (
                    <option key={cf.id} value={cf.id}>
                      {cf.folder}: {cf.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={`Напишите запрос для ${activeModelMeta.title}...`}
                className="flex-1 min-w-0 px-3 sm:px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-slate-400"
              />
              <button
                type="submit"
                disabled={!prompt.trim() || sending}
                className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-xs font-medium rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 disabled:opacity-40 transition-colors focus:outline-none shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                <span className="hidden xs:inline sm:inline">{sending ? 'Думает...' : 'Отправить'}</span>
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
};
