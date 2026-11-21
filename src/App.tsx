import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Plus,
  CheckCircle2,
  X,
  Globe,
  Search,
  Shield,
  KeyRound,
  User as UserIcon,
} from 'lucide-react';
import { INITIAL_FIRAS_STATE } from './data/initialData';
import {
  AiProviderId,
  BrowserPublicConfig,
  CustomAiModel,
  FirasNote,
  FirasState,
  FirasTask,
  ForbesEntry,
  isStaffRole,
  LoginConfirmationRequest,
  ROLE_LABEL_RU,
  TaskCategory,
  TaskPriority,
  UserProfile,
  WorkspaceView,
} from './types/firas';
import { Sidebar } from './components/Sidebar';
import { OverviewView } from './components/OverviewView';
import { TasksView } from './components/TasksView';
import { NotesView } from './components/NotesView';
import { RhythmView } from './components/RhythmView';
import { BrowserView } from './components/BrowserView';
import { ForbesView } from './components/ForbesView';
import { AdminView } from './components/AdminView';
import { CloudStorageView } from './components/CloudStorageView';
import { AiStudioView } from './components/AiStudioView';
import { AuthModal } from './components/AuthModal';
import { TaskModal } from './components/TaskModal';
import { CommandPalette } from './components/CommandPalette';
import { MessengerPanel } from './components/MessengerPanel';
import { CallOverlay } from './components/CallOverlay';
import { FiresLogo } from './components/FiresLogo';
import { UserAvatar } from './components/UserAvatar';
import { useMessenger } from './hooks/useMessenger';

const STORAGE_KEY = 'firas-workspace-v1';
const AUTH_TOKEN_KEY = 'firas-auth-token';
const AUTH_USER_KEY = 'firas-auth-user';
const DEVICE_ID_KEY = 'firas-device-id';

const loadCachedUser = (): UserProfile | null => {
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UserProfile;
    return parsed && parsed.id && parsed.email ? parsed : null;
  } catch {
    return null;
  }
};

const VIEW_TITLES: Record<WorkspaceView, string> = {
  [WorkspaceView.Overview]: 'Обзор дня',
  [WorkspaceView.Tasks]: 'Задачи',
  [WorkspaceView.Notes]: 'Fires Заметки',
  [WorkspaceView.Rhythm]: 'Ритм и фокус',
  [WorkspaceView.Browser]: 'Fires',
  [WorkspaceView.AiChat]: 'Нейрочат',
  [WorkspaceView.Messenger]: 'Мессенджер',
  [WorkspaceView.Cloud]: 'Облако 1 ТБ · TeraBox',
  [WorkspaceView.Forbes]: 'Список Forbes',
  [WorkspaceView.Admin]: 'Админ-панель',
};

const loadInitialState = (): FirasState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL_FIRAS_STATE;
    const parsed = JSON.parse(raw) as Partial<FirasState>;
    if (!parsed || !Array.isArray(parsed.tasks) || !Array.isArray(parsed.notes)) {
      return INITIAL_FIRAS_STATE;
    }
    return {
      tasks: parsed.tasks,
      notes: parsed.notes,
      habits: Array.isArray(parsed.habits) ? parsed.habits : INITIAL_FIRAS_STATE.habits,
      focusLog:
        Array.isArray(parsed.focusLog) && parsed.focusLog.length === 7
          ? parsed.focusLog
          : INITIAL_FIRAS_STATE.focusLog,
      bookmarks: Array.isArray(parsed.bookmarks)
        ? parsed.bookmarks
        : INITIAL_FIRAS_STATE.bookmarks,
      theme: parsed.theme === 'dark' ? 'dark' : 'light',
    };
  } catch {
    return INITIAL_FIRAS_STATE;
  }
};

export default function App() {
  const [state, setState] = useState<FirasState>(loadInitialState);
  const [activeView, setActiveView] = useState<WorkspaceView>(WorkspaceView.Browser);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(
    () => loadInitialState().notes[0]?.id ?? null
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<FirasTask | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingBrowserQuery, setPendingBrowserQuery] = useState<string | null>(null);
  const [topSearchInput, setTopSearchInput] = useState('');

  // Account & Admin state
  const [authToken, setAuthToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem(AUTH_TOKEN_KEY);
    } catch {
      return null;
    }
  });
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(loadCachedUser);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');
  const [authModalReason, setAuthModalReason] = useState<string | null>(null);
  const [browserConfig, setBrowserConfig] = useState<BrowserPublicConfig | null>(null);
  const [pendingConfirmations, setPendingConfirmations] = useState<LoginConfirmationRequest[]>([]);
  const [customModels, setCustomModels] = useState<CustomAiModel[]>([]);
  const [aiChatInitialProvider, setAiChatInitialProvider] = useState<AiProviderId | undefined>(
    undefined
  );

  const messenger = useMessenger(currentUser, authToken);

  const openAuthModal = (mode: 'login' | 'register' = 'login', reason?: string) => {
    setAuthModalMode(mode);
    setAuthModalReason(reason || null);
    setAuthModalOpen(true);
  };

  const openAiChat = (provider?: AiProviderId) => {
    setAiChatInitialProvider(provider);
    setActiveView(WorkspaceView.AiChat);
  };

  // Focus timer state
  const [timerMinutes, setTimerMinutes] = useState(25);
  const [timerSecondsLeft, setTimerSecondsLeft] = useState(25 * 60);
  const [timerRunning, setTimerRunning] = useState(false);
  const [activeFocusTaskId, setActiveFocusTaskId] = useState<string | null>(
    () => loadInitialState().tasks.find((t) => !t.completed)?.id ?? null
  );

  // Persist workspace state
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage quota errors gracefully
    }
  }, [state]);

  // Sync Tailwind dark mode class
  useEffect(() => {
    document.documentElement.classList.toggle('dark', state.theme === 'dark');
  }, [state.theme]);

  // Global Cmd/Ctrl+K shortcut
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Auto-dismiss transient notice
  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(id);
  }, [notice]);

  // Fetch public browser config & restore authenticated session
  useEffect(() => {
    fetch('/api/public-config')
      .then((r) => (r.ok ? r.json() : null))
      .then((cfg: BrowserPublicConfig | null) => {
        if (cfg) setBrowserConfig(cfg);
      })
      .catch(() => {});
  }, []);

  const refreshCustomModels = useCallback(async () => {
    try {
      const resp = await fetch('/api/ai/models', {
        credentials: 'include',
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      });
      if (!resp.ok) return;
      const json = (await resp.json()) as { models?: CustomAiModel[] };
      if (Array.isArray(json.models)) {
        setCustomModels(json.models);
      }
    } catch {
      // ignore transient errors
    }
  }, [authToken]);

  useEffect(() => {
    refreshCustomModels();
  }, [refreshCustomModels, currentUser?.id]);

  const didRestoreSessionRef = useRef(false);

  useEffect(() => {
    if (didRestoreSessionRef.current) return;
    didRestoreSessionRef.current = true;

    const headers: Record<string, string> = {};
    let initialToken: string | null = null;
    try {
      initialToken = localStorage.getItem(AUTH_TOKEN_KEY);
      if (initialToken) {
        headers.Authorization = `Bearer ${initialToken}`;
      }
      const devId = localStorage.getItem(DEVICE_ID_KEY);
      if (devId) headers['X-Firas-Device'] = devId;
    } catch {
      // ignore
    }

    fetch('/api/auth/me', {
      credentials: 'include',
      headers,
    })
      .then(async (r) => {
        if (!r.ok) return;
        const data = (await r.json()) as {
          user: UserProfile | null;
          token?: string;
          deviceId?: string;
        };
        if (data.user) {
          setCurrentUser(data.user);
          try {
            localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
            if (data.token && data.token !== initialToken) {
              localStorage.setItem(AUTH_TOKEN_KEY, data.token);
              setAuthToken(data.token);
            }
            if (data.deviceId) {
              localStorage.setItem(DEVICE_ID_KEY, data.deviceId);
            }
          } catch {
            // ignore
          }
        } else {
          setAuthToken(null);
          setCurrentUser(null);
          try {
            localStorage.removeItem(AUTH_TOKEN_KEY);
            localStorage.removeItem(AUTH_USER_KEY);
          } catch {
            // ignore
          }
        }
      })
      .catch(() => {
        // Keep cached session on transient network/startup blips
      });
  }, []);

  useEffect(() => {
    if (!authToken && !currentUser) {
      setPendingConfirmations([]);
      return;
    }

    let cancelled = false;
    const fetchPending = async () => {
      try {
        const resp = await fetch('/api/auth/pending-confirmations', {
          credentials: 'include',
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
        });
        if (!resp.ok || cancelled) return;
        const json = (await resp.json()) as { requests?: LoginConfirmationRequest[] };
        if (!cancelled) {
          setPendingConfirmations(Array.isArray(json.requests) ? json.requests : []);
        }
      } catch {
        // Ignore transient network errors
      }
    };

    fetchPending();
    const interval = window.setInterval(fetchPending, 2500);
    window.addEventListener('focus', fetchPending);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener('focus', fetchPending);
    };
  }, [authToken, currentUser]);

  const handleRespondConfirmation = async (
    challengeId: string,
    decision: 'approve' | 'reject'
  ) => {
    if (!authToken && !currentUser) return;
    try {
      const resp = await fetch('/api/auth/respond-confirmation', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({ challengeId, decision }),
      });
      if (resp.ok) {
        setPendingConfirmations((prev) => prev.filter((item) => item.id !== challengeId));
        setNotice(
          decision === 'approve'
            ? 'Вход в аккаунт подтверждён.'
            : 'Запрос на вход отклонён.'
        );
      }
    } catch {
      // Ignore network errors
    }
  };

  const handleAuthenticated = (token: string, user: UserProfile) => {
    setAuthToken(token);
    setCurrentUser(user);
    setAuthModalReason(null);
    try {
      localStorage.setItem(AUTH_TOKEN_KEY, token);
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    } catch {
      // ignore
    }
    setNotice(
      isStaffRole(user.role)
        ? `Вы вошли как ${ROLE_LABEL_RU[user.role]} (${user.displayName}).`
        : `Вы вошли в аккаунт (${user.displayName}).`
    );
  };

  const handleProfileUpdated = (updated: UserProfile) => {
    setCurrentUser(updated);
    try {
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
    setNotice(`Профиль обновлён: ${updated.displayName}.`);
  };

  const handleLogout = () => {
    const tokenToInvalidate = authToken;
    fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
      headers: tokenToInvalidate ? { Authorization: `Bearer ${tokenToInvalidate}` } : {},
    }).catch(() => {});
    setAuthToken(null);
    setCurrentUser(null);
    setPendingConfirmations([]);
    try {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(AUTH_USER_KEY);
    } catch {
      // ignore
    }
    if (activeView === WorkspaceView.Admin) {
      setActiveView(WorkspaceView.Browser);
    }
    setNotice('Вы вышли из аккаунта.');
  };

  const recordCompletedFocus = useCallback(
    (minutesToLog: number) => {
      const todayKey = new Date().toISOString().slice(0, 10);
      const validMinutes = Math.max(1, minutesToLog);

      setState((prev) => {
        const updatedLog = prev.focusLog.map((entry, idx) => {
          const todayIdx = (new Date().getDay() + 6) % 7;
          if (entry.dateKey === todayKey || idx === todayIdx) {
            return {
              ...entry,
              minutes: entry.minutes + validMinutes,
              sessions: entry.sessions + 1,
            };
          }
          return entry;
        });

        const updatedTasks = activeFocusTaskId
          ? prev.tasks.map((task) =>
              task.id === activeFocusTaskId
                ? { ...task, focusSessionsCompleted: task.focusSessionsCompleted + 1 }
                : task
            )
          : prev.tasks;

        return {
          ...prev,
          focusLog: updatedLog,
          tasks: updatedTasks,
        };
      });

      setNotice(`Фокус-сессия завершена: +${validMinutes} мин добавлено в дневной итог.`);
    },
    [activeFocusTaskId]
  );

  // Countdown tick
  useEffect(() => {
    if (!timerRunning) return;
    const interval = window.setInterval(() => {
      setTimerSecondsLeft((prev) => {
        if (prev <= 1) {
          setTimerRunning(false);
          recordCompletedFocus(timerMinutes);
          return timerMinutes * 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [timerRunning, timerMinutes, recordCompletedFocus]);

  const handleSelectTimerDuration = (minutes: number) => {
    setTimerRunning(false);
    setTimerMinutes(minutes);
    setTimerSecondsLeft(minutes * 60);
  };

  const handleResetTimer = () => {
    setTimerRunning(false);
    setTimerSecondsLeft(timerMinutes * 60);
  };

  const handleCompleteSessionNow = () => {
    const elapsedSeconds = timerMinutes * 60 - timerSecondsLeft;
    const elapsedMinutes = Math.max(1, Math.round(elapsedSeconds / 60));
    setTimerRunning(false);
    setTimerSecondsLeft(timerMinutes * 60);
    recordCompletedFocus(elapsedMinutes);
  };

  // Task operations
  const handleToggleTask = (taskId: string) => {
    setState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) =>
        t.id === taskId ? { ...t, completed: !t.completed } : t
      ),
    }));
  };

  const handleQuickAddTask = (title: string) => {
    const todayKey = new Date().toISOString().slice(0, 10);
    const newTask: FirasTask = {
      id: `t-${Date.now()}`,
      title,
      description: '',
      completed: false,
      priority: TaskPriority.Medium,
      category: 'Работа',
      dueDate: todayKey,
      estimatedMinutes: 25,
      focusSessionsCompleted: 0,
      createdAt: todayKey,
    };
    setState((prev) => ({ ...prev, tasks: [newTask, ...prev.tasks] }));
  };

  const handleSaveTaskModal = (data: {
    id?: string;
    title: string;
    description: string;
    priority: TaskPriority;
    category: TaskCategory;
    dueDate: string;
    estimatedMinutes: number;
  }) => {
    const todayKey = new Date().toISOString().slice(0, 10);
    if (data.id) {
      setState((prev) => ({
        ...prev,
        tasks: prev.tasks.map((t) =>
          t.id === data.id
            ? {
                ...t,
                title: data.title,
                description: data.description,
                priority: data.priority,
                category: data.category,
                dueDate: data.dueDate,
                estimatedMinutes: data.estimatedMinutes,
              }
            : t
        ),
      }));
    } else {
      const created: FirasTask = {
        id: `t-${Date.now()}`,
        title: data.title,
        description: data.description,
        completed: false,
        priority: data.priority,
        category: data.category,
        dueDate: data.dueDate,
        estimatedMinutes: data.estimatedMinutes,
        focusSessionsCompleted: 0,
        createdAt: todayKey,
      };
      setState((prev) => ({ ...prev, tasks: [created, ...prev.tasks] }));
    }
  };

  const handleDeleteTask = (taskId: string) => {
    setState((prev) => ({
      ...prev,
      tasks: prev.tasks.filter((t) => t.id !== taskId),
    }));
    if (activeFocusTaskId === taskId) {
      setActiveFocusTaskId(null);
    }
  };

  const handleStartFocusForTask = (taskId: string) => {
    setActiveFocusTaskId(taskId);
    setActiveView(WorkspaceView.Overview);
    setTimerRunning(true);
  };

  // Note operations
  const handleCreateNote = () => {
    const todayKey = new Date().toISOString().slice(0, 10);
    const created: FirasNote = {
      id: `n-${Date.now()}`,
      title: 'Новая заметка',
      content: '',
      category: 'Идеи',
      pinned: false,
      updatedAt: todayKey,
    };
    setState((prev) => ({ ...prev, notes: [created, ...prev.notes] }));
    setSelectedNoteId(created.id);
    setActiveView(WorkspaceView.Notes);
  };

  const handleUpdateNote = (
    noteId: string,
    patch: Partial<Pick<FirasNote, 'title' | 'content' | 'category' | 'pinned'>>
  ) => {
    const todayKey = new Date().toISOString().slice(0, 10);
    setState((prev) => ({
      ...prev,
      notes: prev.notes.map((n) =>
        n.id === noteId ? { ...n, ...patch, updatedAt: todayKey } : n
      ),
    }));
  };

  const handleDeleteNote = (noteId: string) => {
    setState((prev) => {
      const remaining = prev.notes.filter((n) => n.id !== noteId);
      if (selectedNoteId === noteId) {
        setSelectedNoteId(remaining[0]?.id ?? null);
      }
      return { ...prev, notes: remaining };
    });
  };

  const handleSaveWebPageToNotes = (title: string, url: string, summary: string) => {
    const todayKey = new Date().toISOString().slice(0, 10);
    const created: FirasNote = {
      id: `n-${Date.now()}`,
      title,
      content: `Источник: ${url}\n\n${summary}`,
      category: 'Справочник',
      pinned: false,
      updatedAt: todayKey,
    };
    setState((prev) => ({ ...prev, notes: [created, ...prev.notes] }));
    setSelectedNoteId(created.id);
    setNotice(`Материал «${title}» сохранён в Fires Заметки.`);
  };

  const handleSaveForbesToNotes = (entry: ForbesEntry) => {
    const todayKey = new Date().toISOString().slice(0, 10);
    const created: FirasNote = {
      id: `n-${Date.now()}`,
      title: `Forbes: ${entry.nameRu}`,
      content: [
        `Позиция в рейтинге (${entry.regionGroup === 'global' ? 'Мир' : 'Россия'}): #${entry.rank}`,
        `Состояние: $${entry.netWorthBillions.toFixed(1)} млрд`,
        `Страна: ${entry.countryRu}`,
        `Отрасль: ${entry.industry}`,
        `Активы: ${entry.source}`,
        '',
        entry.bio,
      ].join('\n'),
      category: 'Справочник',
      pinned: false,
      updatedAt: todayKey,
    };
    setState((prev) => ({ ...prev, notes: [created, ...prev.notes] }));
    setSelectedNoteId(created.id);
    setNotice(`Досье «${entry.nameRu}» сохранено в Fires Заметки.`);
  };

  // Habit operations
  const handleToggleHabitDay = (habitId: string, dayIndex: number) => {
    setState((prev) => ({
      ...prev,
      habits: prev.habits.map((h) => {
        if (h.id !== habitId) return h;
        const nextDays = [...h.weekDays] as [
          boolean,
          boolean,
          boolean,
          boolean,
          boolean,
          boolean,
          boolean
        ];
        nextDays[dayIndex] = !nextDays[dayIndex];
        return { ...h, weekDays: nextDays };
      }),
    }));
  };

  const handleToggleHabitToday = (habitId: string) => {
    const todayDayIndex = (new Date().getDay() + 6) % 7;
    handleToggleHabitDay(habitId, todayDayIndex);
  };

  const handleAddHabit = (name: string, targetDaysPerWeek: number) => {
    setState((prev) => ({
      ...prev,
      habits: [
        ...prev.habits,
        {
          id: `h-${Date.now()}`,
          name,
          targetDaysPerWeek,
          weekDays: [false, false, false, false, false, false, false],
        },
      ],
    }));
  };

  const handleDeleteHabit = (habitId: string) => {
    setState((prev) => ({
      ...prev,
      habits: prev.habits.filter((h) => h.id !== habitId),
    }));
  };

  const handleExportWorkspace = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `firas-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setNotice('Резервная копия рабочего пространства сохранена в JSON.');
  };

  const handleResetWorkspace = () => {
    setState(INITIAL_FIRAS_STATE);
    setSelectedNoteId(INITIAL_FIRAS_STATE.notes[0]?.id ?? null);
    setTimerRunning(false);
    setTimerMinutes(25);
    setTimerSecondsLeft(25 * 60);
    setNotice('Данные сброшены к исходному набору.');
  };

  const handleTopSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = topSearchInput.trim();
    if (!trimmed) {
      setActiveView(WorkspaceView.Browser);
      return;
    }
    setPendingBrowserQuery(trimmed);
    setActiveView(WorkspaceView.Browser);
    setTopSearchInput('');
  };

  const todayKey = new Date().toISOString().slice(0, 10);
  const todayDayIndex = (new Date().getDay() + 6) % 7;
  const todayFocusLog =
    state.focusLog.find((d) => d.dateKey === todayKey) || state.focusLog[todayDayIndex];

  const activeTasksCount = state.tasks.filter((t) => !t.completed).length;
  const isBrowserActive = activeView === WorkspaceView.Browser;
  const isMessengerActive = activeView === WorkspaceView.Messenger;
  const isNotesActive = activeView === WorkspaceView.Notes;

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <Sidebar
        activeView={activeView}
        onSelectView={setActiveView}
        activeTasksCount={activeTasksCount}
        notesCount={state.notes.length}
        theme={state.theme}
        onToggleTheme={() =>
          setState((prev) => ({
            ...prev,
            theme: prev.theme === 'light' ? 'dark' : 'light',
          }))
        }
        onOpenCommandPalette={() => setCommandOpen(true)}
        mobileOpen={drawerOpen}
        onCloseMobile={() => setDrawerOpen(false)}
        timerRunning={timerRunning}
        timerSecondsLeft={timerSecondsLeft}
        drawerOnly={isBrowserActive || isMessengerActive}
        currentUser={currentUser}
        onOpenAuth={() => setAuthModalOpen(true)}
      />

      {isBrowserActive ? (
        <div className="flex-1 min-w-0 relative">
          <BrowserView
            initialSearchQuery={pendingBrowserQuery}
            onConsumeInitialSearch={() => setPendingBrowserQuery(null)}
            onSavePageToNotes={handleSaveWebPageToNotes}
            onOpenMenu={() => setDrawerOpen(true)}
            theme={state.theme}
            onToggleTheme={() =>
              setState((prev) => ({
                ...prev,
                theme: prev.theme === 'light' ? 'dark' : 'light',
              }))
            }
            currentUser={currentUser}
            authToken={authToken}
            browserConfig={browserConfig}
            customModels={customModels}
            onOpenAuth={openAuthModal}
            onOpenAdminPanel={() => setActiveView(WorkspaceView.Admin)}
            onOpenMessengerFull={() => setActiveView(WorkspaceView.Messenger)}
            onOpenCloud={() => setActiveView(WorkspaceView.Cloud)}
            onOpenAiChat={openAiChat}
            messengerBadgeCount={messenger.incomingRequests.length}
            messengerOnlineCount={messenger.contacts.filter((c) => c.online).length}
          />
        </div>
      ) : isMessengerActive ? (
        <div className="flex-1 min-w-0 h-screen supports-[height:100dvh]:h-dvh overflow-hidden">
          <MessengerPanel
            variant="full"
            currentUser={currentUser}
            connected={messenger.connected}
            serverReady={messenger.serverReady}
            contacts={messenger.contacts}
            friends={messenger.friends}
            incomingRequests={messenger.incomingRequests}
            outgoingRequests={messenger.outgoingRequests}
            servers={messenger.servers}
            messages={messenger.messages}
            callLogs={messenger.callLogs}
            typingByRoom={messenger.typingByRoom}
            messengerError={messenger.messengerError}
            onClearError={messenger.clearMessengerError}
            onRefresh={messenger.refreshBootstrap}
            onSendMessage={messenger.sendMessage}
            onUpdateBridges={messenger.updateBridges}
            onSendBridgeCode={messenger.sendBridgeCode}
            onVerifyBridgeCode={messenger.verifyBridgeCode}
            onRouletteNext={messenger.findRoulettePartner}
            onProfileUpdated={handleProfileUpdated}
            onSendTyping={messenger.sendTyping}
            onCreateServer={messenger.createServer}
            onSendFriendRequest={messenger.sendFriendRequest}
            onRespondFriendRequest={messenger.respondFriendRequest}
            onRemoveFriend={messenger.removeFriend}
            onSearchUsers={messenger.searchUsers}
            onStartCall={messenger.startCall}
            onRequireRegister={() =>
              openAuthModal(
                'register',
                'Для доступа к мессенджеру, друзьям и звонкам нужна обязательная регистрация. Придумайте никнейм и выберите аватарку.'
              )
            }
            onRequireLogin={() => openAuthModal('login')}
            onEditProfile={() => openAuthModal('login')}
            onOpenCloud={() => setActiveView(WorkspaceView.Cloud)}
            onClose={() => setActiveView(WorkspaceView.Browser)}
          />
        </div>
      ) : (
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Top contextual bar */}
          <header className="sticky top-0 z-30 h-14 sm:h-16 px-3 sm:px-8 flex items-center justify-between gap-2 sm:gap-4 bg-slate-50/90 dark:bg-slate-950/90 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                aria-label="Открыть меню Fires"
                className="lg:hidden p-0.5 rounded-lg flex items-center justify-center hover:opacity-90 transition-opacity shrink-0 focus:outline-none"
              >
                <FiresLogo size={30} className="shrink-0" />
              </button>

              <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm min-w-0">
                {isNotesActive ? (
                  <span className="font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap truncate">
                    Fires Заметки
                  </span>
                ) : (
                  <>
                    <span className="font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0">
                      Fires
                    </span>
                    <span className="text-slate-400 dark:text-slate-600 shrink-0" aria-hidden="true">
                      /
                    </span>
                    <span className="text-slate-600 dark:text-slate-300 truncate">
                      {VIEW_TITLES[activeView]}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Search bar + Browser button */}
            <form
              onSubmit={handleTopSearchSubmit}
              className="hidden md:flex items-center gap-2 flex-1 max-w-md mx-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus-within:border-slate-400 dark:focus-within:border-slate-500 transition-colors"
            >
              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <input
                type="text"
                value={topSearchInput}
                onChange={(e) => setTopSearchInput(e.target.value)}
                placeholder="Поиск в интернете или URL сайта..."
                className="w-full bg-transparent text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0"
              >
                <Globe className="w-3 h-3" />
                <span>Браузер</span>
              </button>
            </form>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <button
                type="button"
                onClick={() => openAuthModal('login')}
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 focus:outline-none"
              >
                {currentUser ? (
                  <UserAvatar
                    name={currentUser.displayName}
                    avatar={currentUser.avatar}
                    size="xs"
                  />
                ) : (
                  <UserIcon className="w-3.5 h-3.5 shrink-0" />
                )}
                <span className="max-w-[76px] sm:max-w-[140px] truncate">
                  {currentUser ? currentUser.displayName : 'Войти'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveView(WorkspaceView.Browser)}
                className="md:hidden inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 whitespace-nowrap shrink-0"
              >
                <Globe className="w-3.5 h-3.5 shrink-0" />
                <span>Браузер</span>
              </button>

              {isNotesActive ? (
                <button
                  type="button"
                  onClick={handleCreateNote}
                  aria-label="Новая заметка"
                  className="inline-flex items-center gap-1.5 px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs font-medium rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors whitespace-nowrap shrink-0"
                >
                  <Plus className="w-4 h-4 shrink-0" />
                  <span className="hidden sm:inline">Новая заметка</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setEditingTask(null);
                    setTaskModalOpen(true);
                  }}
                  aria-label="Новая задача"
                  className={`${
                    activeView === WorkspaceView.Tasks || activeView === WorkspaceView.Overview
                      ? 'inline-flex'
                      : 'hidden sm:inline-flex'
                  } items-center gap-1.5 px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs font-medium rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors whitespace-nowrap shrink-0`}
                >
                  <Plus className="w-4 h-4 shrink-0" />
                  <span className="hidden sm:inline">Новая задача</span>
                </button>
              )}
            </div>
          </header>

          {/* Main viewport */}
          <main className="flex-1 w-full max-w-[1200px] mx-auto px-4 sm:px-8 py-8">
            {notice && (
              <div
                role="status"
                className="mb-6 flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/40 text-sm text-emerald-900 dark:text-emerald-200"
              >
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span>{notice}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setNotice(null)}
                  aria-label="Скрыть уведомление"
                  className="p-1 rounded hover:bg-emerald-100 dark:hover:bg-emerald-900/40"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {activeView === WorkspaceView.Overview && (
              <OverviewView
                tasks={state.tasks}
                notes={state.notes}
                habits={state.habits}
                todayFocusLog={todayFocusLog}
                timerMinutes={timerMinutes}
                timerSecondsLeft={timerSecondsLeft}
                timerRunning={timerRunning}
                activeFocusTaskId={activeFocusTaskId}
                onSelectTimerDuration={handleSelectTimerDuration}
                onToggleTimer={() => setTimerRunning((r) => !r)}
                onResetTimer={handleResetTimer}
                onCompleteSessionNow={handleCompleteSessionNow}
                onSelectFocusTask={setActiveFocusTaskId}
                onToggleTask={handleToggleTask}
                onQuickAddTask={handleQuickAddTask}
                onToggleHabitToday={handleToggleHabitToday}
                onOpenNote={(noteId) => {
                  setSelectedNoteId(noteId);
                  setActiveView(WorkspaceView.Notes);
                }}
                onNavigateView={setActiveView}
              />
            )}

            {activeView === WorkspaceView.Tasks && (
              <TasksView
                tasks={state.tasks}
                activeFocusTaskId={activeFocusTaskId}
                onToggleTask={handleToggleTask}
                onDeleteTask={handleDeleteTask}
                onOpenCreateModal={() => {
                  setEditingTask(null);
                  setTaskModalOpen(true);
                }}
                onOpenEditModal={(task) => {
                  setEditingTask(task);
                  setTaskModalOpen(true);
                }}
                onStartFocusForTask={handleStartFocusForTask}
              />
            )}

            {activeView === WorkspaceView.Notes && (
              <NotesView
                notes={state.notes}
                selectedNoteId={selectedNoteId}
                onSelectNote={setSelectedNoteId}
                onCreateNote={handleCreateNote}
                onUpdateNote={handleUpdateNote}
                onDeleteNote={handleDeleteNote}
              />
            )}

            {activeView === WorkspaceView.Rhythm && (
              <RhythmView
                habits={state.habits}
                focusLog={state.focusLog}
                onToggleHabitDay={handleToggleHabitDay}
                onAddHabit={handleAddHabit}
                onDeleteHabit={handleDeleteHabit}
                onExportWorkspace={handleExportWorkspace}
                onResetWorkspace={handleResetWorkspace}
              />
            )}


            {activeView === WorkspaceView.AiChat && (
              <AiStudioView
                currentUser={currentUser}
                authToken={authToken}
                customModels={customModels}
                initialProvider={aiChatInitialProvider}
                onRefreshModels={refreshCustomModels}
                onSaveToNotes={handleSaveWebPageToNotes}
                onOpenAuth={openAuthModal}
                onOpenCloud={() => setActiveView(WorkspaceView.Cloud)}
                onNotify={setNotice}
              />
            )}

            {activeView === WorkspaceView.Cloud && (
              <CloudStorageView
                currentUser={currentUser}
                authToken={authToken}
                customModels={customModels}
                onOpenAiChat={openAiChat}
                onOpenAuth={openAuthModal}
                onNotify={setNotice}
              />
            )}

            {activeView === WorkspaceView.Forbes && (
              <ForbesView
                onOpenInBrowser={(query) => {
                  setPendingBrowserQuery(query);
                  setActiveView(WorkspaceView.Browser);
                }}
                onSaveToNotes={handleSaveForbesToNotes}
              />
            )}

            {activeView === WorkspaceView.Admin &&
              (isStaffRole(currentUser?.role) && currentUser && authToken ? (
                <AdminView
                  token={authToken}
                  currentUser={currentUser}
                  onConfigUpdated={setBrowserConfig}
                  onNotify={setNotice}
                />
              ) : (
                <div className="max-w-md mx-auto my-12 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-center space-y-4">
                  <Shield className="w-8 h-8 mx-auto text-slate-500" />
                  <div className="space-y-1">
                    <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                      Требуются права доступа
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Войдите в аккаунт руководства системы (от Менеджера до Владельца).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openAuthModal('login')}
                    className="px-4 py-2 text-xs font-medium rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900"
                  >
                    Войти в аккаунт
                  </button>
                </div>
              ))}
          </main>
        </div>
      )}

      {pendingConfirmations.length > 0 && currentUser && (
        <div
          role="dialog"
          aria-label="Подтверждение входа в аккаунт"
          className="fixed bottom-4 right-4 z-50 w-full max-w-sm space-y-2.5 px-4 sm:px-0"
        >
          {pendingConfirmations.map((req) => (
            <div
              key={req.id}
              className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-lg space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-slate-100">
                  <KeyRound className="w-4 h-4 shrink-0 text-slate-600 dark:text-slate-300" />
                  <span>Запрос входа в @{req.targetUsername}</span>
                </div>
                <span className="px-2 py-0.5 rounded bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-mono text-xs font-semibold tracking-wider">
                  {req.code}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Кто-то ввёл пароль от вашего аккаунта. Подтвердите вход или отклоните его.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleRespondConfirmation(req.id, 'approve')}
                  className="flex-1 py-1.5 text-xs font-medium rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 focus:outline-none"
                >
                  Подтвердить
                </button>
                <button
                  type="button"
                  onClick={() => handleRespondConfirmation(req.id, 'reject')}
                  className="flex-1 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none"
                >
                  Отклонить
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <CallOverlay
        incomingCall={messenger.incomingCall}
        activeCall={messenger.activeCall}
        localStream={messenger.localStream}
        remoteStream={messenger.remoteStream}
        micMuted={messenger.micMuted}
        camOff={messenger.camOff}
        callError={messenger.callError}
        onAcceptIncoming={messenger.acceptIncomingCall}
        onRejectIncoming={messenger.rejectIncomingCall}
        onEndCall={messenger.endActiveCall}
        onToggleMic={messenger.toggleMic}
        onToggleCam={messenger.toggleCam}
        onClearError={messenger.clearCallError}
      />

      <AuthModal
        isOpen={authModalOpen}
        initialMode={authModalMode}
        reasonBanner={authModalReason}
        currentUser={currentUser}
        authToken={authToken}
        servers={messenger.servers}
        onCreateServer={messenger.createServer}
        onUpdateBridges={messenger.updateBridges}
        onSendBridgeCode={messenger.sendBridgeCode}
        onVerifyBridgeCode={messenger.verifyBridgeCode}
        pendingConfirmations={pendingConfirmations}
        onRespondConfirmation={handleRespondConfirmation}
        onClose={() => {
          setAuthModalOpen(false);
          setAuthModalReason(null);
        }}
        onAuthenticated={handleAuthenticated}
        onProfileUpdated={handleProfileUpdated}
        onLogout={handleLogout}
        onOpenAdminPanel={() => setActiveView(WorkspaceView.Admin)}
      />

      <TaskModal
        isOpen={taskModalOpen}
        editingTask={editingTask}
        onClose={() => {
          setTaskModalOpen(false);
          setEditingTask(null);
        }}
        onSave={handleSaveTaskModal}
      />

      <CommandPalette
        isOpen={commandOpen}
        onClose={() => setCommandOpen(false)}
        tasks={state.tasks}
        notes={state.notes}
        onNavigateView={setActiveView}
        onSelectNote={(noteId) => {
          setSelectedNoteId(noteId);
          setActiveView(WorkspaceView.Notes);
        }}
        onFocusTask={(taskId) => {
          setActiveFocusTaskId(taskId);
          setActiveView(WorkspaceView.Overview);
        }}
      />
    </div>
  );
}
