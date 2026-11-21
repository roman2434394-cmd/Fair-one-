import React from 'react';
import {
  LayoutDashboard,
  CheckSquare,
  FileText,
  Activity,
  Search,
  Sun,
  Moon,
  X,
  Timer,
  Globe,
  Award,
  Shield,
  Sparkles,
  MessageSquare,
  HardDrive,
  User as UserIcon,
} from 'lucide-react';
import { isStaffRole, ROLE_LABEL_RU, UserProfile, WorkspaceView } from '../types/firas';
import { FiresLogo } from './FiresLogo';
import { UserAvatar } from './UserAvatar';

interface SidebarProps {
  activeView: WorkspaceView;
  onSelectView: (view: WorkspaceView) => void;
  activeTasksCount: number;
  notesCount: number;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onOpenCommandPalette: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  timerRunning: boolean;
  timerSecondsLeft: number;
  drawerOnly?: boolean;
  currentUser: UserProfile | null;
  onOpenAuth: () => void;
}

const formatClock = (totalSeconds: number): string => {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onSelectView,
  activeTasksCount,
  notesCount,
  theme,
  onToggleTheme,
  onOpenCommandPalette,
  mobileOpen,
  onCloseMobile,
  timerRunning,
  timerSecondsLeft,
  drawerOnly = false,
  currentUser,
  onOpenAuth,
}) => {
  const isBrowser = activeView === WorkspaceView.Browser;
  const isNotes = activeView === WorkspaceView.Notes;

  const navItems = [
    {
      id: WorkspaceView.Browser,
      label: 'Браузер',
      icon: Globe,
      count: null as number | null,
    },
    {
      id: WorkspaceView.AiChat,
      label: 'Нейрочат',
      icon: Sparkles,
      count: null as number | null,
    },
    {
      id: WorkspaceView.Messenger,
      label: 'Мессенджер',
      icon: MessageSquare,
      count: null as number | null,
    },
    {
      id: WorkspaceView.Cloud,
      label: 'Облако 1 ТБ',
      icon: HardDrive,
      count: null as number | null,
    },
    {
      id: WorkspaceView.Notes,
      label: 'Fires Заметки',
      icon: FileText,
      count: notesCount,
    },
    {
      id: WorkspaceView.Overview,
      label: 'Обзор дня',
      icon: LayoutDashboard,
      count: null as number | null,
    },
    {
      id: WorkspaceView.Tasks,
      label: 'Задачи',
      icon: CheckSquare,
      count: activeTasksCount,
    },
    {
      id: WorkspaceView.Forbes,
      label: 'Список Forbes',
      icon: Award,
      count: null as number | null,
    },
    {
      id: WorkspaceView.Rhythm,
      label: 'Ритм и фокус',
      icon: Activity,
      count: null as number | null,
    },
    ...(isStaffRole(currentUser?.role)
      ? [
          {
            id: WorkspaceView.Admin,
            label: 'Админ-панель',
            icon: Shield,
            count: null as number | null,
          },
        ]
      : []),
  ];

  const handleNavClick = (view: WorkspaceView) => {
    onSelectView(view);
    onCloseMobile();
  };

  const brandLabel = isBrowser
    ? 'Fires'
    : isNotes
    ? 'Fires Заметки'
    : 'Fires';

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 px-4 py-5 select-none">
      <div>
        <div className="flex items-center justify-between px-2 mb-6">
          <button
            type="button"
            onClick={() => handleNavClick(WorkspaceView.Browser)}
            className="flex items-center gap-2.5 text-left focus-visible:outline-none rounded-md"
          >
            <FiresLogo size={28} className="shrink-0" />
            <span className="text-lg font-bold tracking-tight whitespace-nowrap shrink-0 text-slate-900 dark:text-slate-100">
              {brandLabel}
            </span>
          </button>

          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Закрыть меню"
            className={`${
              drawerOnly ? '' : 'lg:hidden'
            } p-2 -mr-1 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            onOpenCommandPalette();
            onCloseMobile();
          }}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 mb-5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-sm text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-800 dark:hover:text-slate-200 transition-colors focus-visible:outline-none"
        >
          <span className="flex items-center gap-2 whitespace-nowrap">
            <Search className="w-4 h-4 shrink-0" />
            <span>Быстрый поиск</span>
          </span>
          <kbd className="font-mono text-xs text-slate-400 dark:text-slate-500">
            Ctrl K
          </kbd>
        </button>

        <nav aria-label="Основная навигация" className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none ${
                  isActive
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <span className="flex items-center gap-2.5 whitespace-nowrap">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </span>
                {item.count !== null && (
                  <span
                    className={`font-mono tabular-nums text-xs ${
                      isActive
                        ? 'text-slate-300 dark:text-slate-600'
                        : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
        {timerRunning && (
          <button
            type="button"
            onClick={() => handleNavClick(WorkspaceView.Overview)}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-left hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <span className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap">
              <Timer className="w-4 h-4 shrink-0" />
              <span>Идёт фокус-сессия</span>
            </span>
            <span className="font-mono tabular-nums text-xs font-semibold text-slate-900 dark:text-slate-100">
              {formatClock(timerSecondsLeft)}
            </span>
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            onOpenAuth();
            onCloseMobile();
          }}
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none"
        >
          <span className="flex items-center gap-2.5 min-w-0">
            {currentUser ? (
              <UserAvatar
                name={currentUser.displayName}
                avatar={currentUser.avatar}
                size="xs"
                online
              />
            ) : (
              <UserIcon className="w-4 h-4 shrink-0 text-slate-500 dark:text-slate-400" />
            )}
            <span className="truncate text-left">
              {currentUser ? currentUser.displayName : 'Войти в аккаунт'}
            </span>
          </span>
          <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 shrink-0 ml-2">
            {currentUser ? ROLE_LABEL_RU[currentUser.role] : 'Гость'}
          </span>
        </button>

        <button
          type="button"
          onClick={onToggleTheme}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-slate-100 transition-colors focus-visible:outline-none"
        >
          <span className="flex items-center gap-2.5 whitespace-nowrap">
            {theme === 'light' ? (
              <Moon className="w-4 h-4 shrink-0" />
            ) : (
              <Sun className="w-4 h-4 shrink-0" />
            )}
            <span>{theme === 'light' ? 'Тёмная тема' : 'Светлая тема'}</span>
          </span>
          <span className="text-xs text-slate-400 dark:text-slate-500">
            {theme === 'light' ? 'Выкл' : 'Вкл'}
          </span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {!drawerOnly && (
        <aside className="hidden lg:block w-[260px] shrink-0 h-screen sticky top-0">
          {sidebarContent}
        </aside>
      )}

      {mobileOpen && (
        <div
          className={`fixed inset-0 z-50 flex ${drawerOnly ? '' : 'lg:hidden'}`}
        >
          <div
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-[1px]"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 w-[272px] max-w-[85vw] h-full">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
