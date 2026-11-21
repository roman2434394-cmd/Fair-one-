import React, { useEffect, useMemo, useState } from 'react';
import {
  Search,
  CheckSquare,
  FileText,
  LayoutDashboard,
  Activity,
  Globe,
  HardDrive,
  Sparkles,
  Award,
  X,
} from 'lucide-react';
import { FirasNote, FirasTask, WorkspaceView } from '../types/firas';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: FirasTask[];
  notes: FirasNote[];
  onNavigateView: (view: WorkspaceView) => void;
  onSelectNote: (noteId: string) => void;
  onFocusTask: (taskId: string) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  tasks,
  notes,
  onNavigateView,
  onSelectNote,
  onFocusTask,
}) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setQuery('');
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const normalized = query.trim().toLowerCase();

  const matchedTasks = useMemo(() => {
    if (!normalized) return tasks.slice(0, 4);
    return tasks
      .filter(
        (t) =>
          t.title.toLowerCase().includes(normalized) ||
          t.category.toLowerCase().includes(normalized)
      )
      .slice(0, 5);
  }, [tasks, normalized]);

  const matchedNotes = useMemo(() => {
    if (!normalized) return notes.slice(0, 3);
    return notes
      .filter(
        (n) =>
          n.title.toLowerCase().includes(normalized) ||
          n.content.toLowerCase().includes(normalized)
      )
      .slice(0, 5);
  }, [notes, normalized]);

  if (!isOpen) return null;

  const sections = [
    { id: WorkspaceView.Browser, label: 'Открыть браузер Fires', icon: Globe },
    { id: WorkspaceView.AiChat, label: 'Открыть Нейрочат и конструктор ИИ', icon: Sparkles },
    { id: WorkspaceView.Cloud, label: 'Облако 1 ТБ · TeraBox', icon: HardDrive },
    { id: WorkspaceView.Notes, label: 'Перейти в Fires Заметки', icon: FileText },
    { id: WorkspaceView.Overview, label: 'Перейти в Обзор дня', icon: LayoutDashboard },
    { id: WorkspaceView.Tasks, label: 'Перейти в Задачи', icon: CheckSquare },
    { id: WorkspaceView.Forbes, label: 'Открыть Список Forbes', icon: Award },
    { id: WorkspaceView.Rhythm, label: 'Перейти в Ритм и фокус', icon: Activity },
  ].filter((s) => !normalized || s.label.toLowerCase().includes(normalized));

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4 bg-slate-950/50 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-label="Быстрый поиск по Firas"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Найти задачу, заметку или раздел..."
            className="w-full bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть поиск"
            className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80">
          {sections.length > 0 && (
            <div className="p-2">
              <div className="px-2.5 py-1 text-xs font-medium text-slate-400 dark:text-slate-500">
                Разделы
              </div>
              {sections.map((section) => {
                const Icon = section.icon;
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => {
                      onNavigateView(section.id);
                      onClose();
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
                  >
                    <Icon className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>{section.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {matchedTasks.length > 0 && (
            <div className="p-2">
              <div className="px-2.5 py-1 text-xs font-medium text-slate-400 dark:text-slate-500">
                Задачи
              </div>
              {matchedTasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => {
                    onFocusTask(task.id);
                    onClose();
                  }}
                  className="w-full flex items-center justify-between gap-3 px-2.5 py-2 rounded-lg text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
                >
                  <span className="truncate">{task.title}</span>
                  <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0">
                    {task.category} · {task.estimatedMinutes} мин
                  </span>
                </button>
              ))}
            </div>
          )}

          {matchedNotes.length > 0 && (
            <div className="p-2">
              <div className="px-2.5 py-1 text-xs font-medium text-slate-400 dark:text-slate-500">
                Заметки
              </div>
              {matchedNotes.map((note) => (
                <button
                  key={note.id}
                  type="button"
                  onClick={() => {
                    onSelectNote(note.id);
                    onClose();
                  }}
                  className="w-full flex items-center justify-between gap-3 px-2.5 py-2 rounded-lg text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
                >
                  <span className="truncate">{note.title}</span>
                  <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0">
                    {note.category}
                  </span>
                </button>
              ))}
            </div>
          )}

          {sections.length === 0 && matchedTasks.length === 0 && matchedNotes.length === 0 && (
            <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
              По запросу «{query}» ничего не найдено.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
