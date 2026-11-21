import React, { useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Check,
  Plus,
  ArrowRight,
  Pin,
  Globe,
  Award,
} from 'lucide-react';
import {
  DailyFocusLog,
  FirasHabit,
  FirasNote,
  FirasTask,
  TaskPriority,
  WorkspaceView,
} from '../types/firas';

interface OverviewViewProps {
  tasks: FirasTask[];
  notes: FirasNote[];
  habits: FirasHabit[];
  todayFocusLog: DailyFocusLog | undefined;
  timerMinutes: number;
  timerSecondsLeft: number;
  timerRunning: boolean;
  activeFocusTaskId: string | null;
  onSelectTimerDuration: (minutes: number) => void;
  onToggleTimer: () => void;
  onResetTimer: () => void;
  onCompleteSessionNow: () => void;
  onSelectFocusTask: (taskId: string | null) => void;
  onToggleTask: (taskId: string) => void;
  onQuickAddTask: (title: string) => void;
  onToggleHabitToday: (habitId: string) => void;
  onOpenNote: (noteId: string) => void;
  onNavigateView: (view: WorkspaceView) => void;
}

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  [TaskPriority.High]: 'Высокий приоритет',
  [TaskPriority.Medium]: 'Средний приоритет',
  [TaskPriority.Normal]: 'Обычный приоритет',
};

const formatClock = (totalSeconds: number): string => {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

export const OverviewView: React.FC<OverviewViewProps> = ({
  tasks,
  notes,
  habits,
  todayFocusLog,
  timerMinutes,
  timerSecondsLeft,
  timerRunning,
  activeFocusTaskId,
  onSelectTimerDuration,
  onToggleTimer,
  onResetTimer,
  onCompleteSessionNow,
  onSelectFocusTask,
  onToggleTask,
  onQuickAddTask,
  onToggleHabitToday,
  onOpenNote,
  onNavigateView,
}) => {
  const [quickTitle, setQuickTitle] = useState('');

  const todayKey = new Date().toISOString().slice(0, 10);
  const todayDayIndex = (new Date().getDay() + 6) % 7;

  const activeTasks = tasks.filter((t) => !t.completed);
  const completedTasksCount = tasks.filter((t) => t.completed).length;
  const totalTasksCount = tasks.length;

  const priorityTasks = [...activeTasks]
    .sort((a, b) => {
      const weight = { high: 0, medium: 1, normal: 2 };
      return weight[a.priority] - weight[b.priority];
    })
    .slice(0, 5);

  const pinnedNotes = notes.filter((n) => n.pinned).slice(0, 3);
  const totalHabitChecksThisWeek = habits.reduce(
    (acc, h) => acc + h.weekDays.filter(Boolean).length,
    0
  );
  const totalHabitTargets = habits.reduce((acc, h) => acc + h.targetDaysPerWeek, 0);
  const rhythmPercent =
    totalHabitTargets > 0
      ? Math.min(100, Math.round((totalHabitChecksThisWeek / totalHabitTargets) * 100))
      : 0;

  const totalSeconds = timerMinutes * 60;
  const progressPercent =
    totalSeconds > 0 ? Math.round(((totalSeconds - timerSecondsLeft) / totalSeconds) * 100) : 0;

  const selectedFocusTask = tasks.find((t) => t.id === activeFocusTaskId) || null;

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = quickTitle.trim();
    if (!trimmed) return;
    onQuickAddTask(trimmed);
    setQuickTitle('');
  };

  const formattedDate = new Intl.DateTimeFormat('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 capitalize">
            {formattedDate}
          </p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Фокус и дела на сегодня
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => onNavigateView(WorkspaceView.Browser)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Открыть браузер</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigateView(WorkspaceView.Forbes)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
          >
            <Award className="w-3.5 h-3.5" />
            <span>Список Forbes</span>
          </button>
        </div>
      </div>

      {/* 4-column metric strip */}
      <section
        aria-label="Ключевые показатели дня"
        className="grid grid-cols-2 lg:grid-cols-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800"
      >
        <div className="p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Задачи выполнены
          </div>
          <div className="mt-2 text-2xl font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {completedTasksCount} / {totalTasksCount}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            На дату {todayKey}
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Фокус сегодня
          </div>
          <div className="mt-2 text-2xl font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {todayFocusLog?.minutes ?? 0} мин
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Завершено сессий: <span className="font-mono tabular-nums">{todayFocusLog?.sessions ?? 0}</span>
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Заметки в базе
          </div>
          <div className="mt-2 text-2xl font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {notes.length}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Закреплённых: <span className="font-mono tabular-nums">{pinnedNotes.length}</span>
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Недельный ритм
          </div>
          <div className="mt-2 text-2xl font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {rhythmPercent}%
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {totalHabitChecksThisWeek} из {totalHabitTargets} отметок
          </div>
        </div>
      </section>

      {/* Main 2-column workspace */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left column: Priority tasks & Quick Add */}
        <div className="xl:col-span-7 space-y-6">
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Приоритеты на сегодня
              </h2>
              <button
                type="button"
                onClick={() => onNavigateView(WorkspaceView.Tasks)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 dark:text-blue-400 hover:underline whitespace-nowrap shrink-0"
              >
                <span>Все задачи</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <form
              onSubmit={handleQuickSubmit}
              className="flex items-center gap-3 px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40"
            >
              <input
                type="text"
                value={quickTitle}
                onChange={(e) => setQuickTitle(e.target.value)}
                placeholder="Быстро добавить задачу на сегодня..."
                className="w-full bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!quickTitle.trim()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-900 dark:bg-blue-600 text-white disabled:opacity-40 hover:bg-slate-800 dark:hover:bg-blue-500 transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Добавить</span>
              </button>
            </form>

            {priorityTasks.length > 0 ? (
              <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                {priorityTasks.map((task) => {
                  const isFocused = activeFocusTaskId === task.id;
                  return (
                    <li
                      key={task.id}
                      className="flex items-start justify-between gap-4 px-6 py-4 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <div className="flex items-start gap-3.5 min-w-0">
                        <button
                          type="button"
                          onClick={() => onToggleTask(task.id)}
                          aria-label={`Отметить задачу «${task.title}»`}
                          className="mt-0.5 w-5 h-5 rounded border border-slate-300 dark:border-slate-600 flex items-center justify-center shrink-0 hover:border-blue-600 dark:hover:border-blue-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                        >
                          {task.completed && (
                            <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                          )}
                        </button>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                            {task.title}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
                            <span
                              className={
                                task.priority === TaskPriority.High
                                  ? 'text-amber-700 dark:text-amber-400 font-medium'
                                  : ''
                              }
                            >
                              {PRIORITY_LABELS[task.priority]}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>{task.category}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums">
                              {task.estimatedMinutes} мин
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => onSelectFocusTask(isFocused ? null : task.id)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                          isFocused
                            ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-500'
                            : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        {isFocused ? 'В фокусе' : 'Выбрать для фокуса'}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="px-6 py-10 text-center">
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Все текущие задачи выполнены.
                </p>
                <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                  Добавьте новую задачу выше или перейдите в раздел «Задачи».
                </p>
              </div>
            )}
          </section>

          {/* Daily habits quick strip */}
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Привычки на сегодня
              </h2>
              <button
                type="button"
                onClick={() => onNavigateView(WorkspaceView.Rhythm)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 dark:text-blue-400 hover:underline whitespace-nowrap shrink-0"
              >
                <span>Недельный трекер</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            {habits.length > 0 ? (
              <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                {habits.map((habit) => {
                  const doneToday = habit.weekDays[todayDayIndex];
                  const doneCount = habit.weekDays.filter(Boolean).length;
                  return (
                    <li
                      key={habit.id}
                      className="flex items-center justify-between gap-4 px-6 py-3.5"
                    >
                      <button
                        type="button"
                        onClick={() => onToggleHabitToday(habit.id)}
                        className="flex items-center gap-3 text-left min-w-0 flex-1 group"
                      >
                        <span
                          className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                            doneToday
                              ? 'bg-emerald-600 border-emerald-600 text-white'
                              : 'border-slate-300 dark:border-slate-600 group-hover:border-emerald-600'
                          }`}
                        >
                          {doneToday && <Check className="w-3.5 h-3.5" />}
                        </span>
                        <span
                          className={`text-sm truncate ${
                            doneToday
                              ? 'text-slate-400 dark:text-slate-500 line-through'
                              : 'text-slate-800 dark:text-slate-200'
                          }`}
                        >
                          {habit.name}
                        </span>
                      </button>
                      <span className="font-mono tabular-nums text-xs text-slate-500 dark:text-slate-400 shrink-0">
                        {doneCount} / {habit.targetDaysPerWeek} за неделю
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="px-6 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                Привычки ещё не добавлены.
              </div>
            )}
          </section>
        </div>

        {/* Right column: Focus Timer & Pinned Notes */}
        <div className="xl:col-span-5 space-y-6">
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
            <div className="flex items-center justify-between gap-3 mb-5">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Таймер глубокой работы
              </h2>
              <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                {[25, 45, 60].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => onSelectTimerDuration(mins)}
                    className={`px-2.5 py-1 text-xs font-mono tabular-nums font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      timerMinutes === mins
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    {mins} м
                  </button>
                ))}
              </div>
            </div>

            <div className="py-4 text-center">
              <div
                aria-live="polite"
                className="text-5xl sm:text-6xl font-semibold font-mono tabular-nums tracking-tight text-slate-900 dark:text-slate-100"
              >
                {formatClock(timerSecondsLeft)}
              </div>
              <div className="mt-3 text-xs text-slate-500 dark:text-slate-400 truncate max-w-full">
                {selectedFocusTask
                  ? `Задача: ${selectedFocusTask.title}`
                  : 'Свободная сессия без привязки к задаче'}
              </div>
            </div>

            <div className="mt-4 h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-blue-600 dark:bg-blue-500 transition-[width] duration-200"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={onToggleTimer}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg bg-slate-900 dark:bg-blue-600 text-white hover:bg-slate-800 dark:hover:bg-blue-500 transition-colors whitespace-nowrap shrink-0"
              >
                {timerRunning ? (
                  <>
                    <Pause className="w-4 h-4" />
                    <span>Пауза</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    <span>Начать фокус</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onResetTimer}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Сбросить</span>
              </button>

              {progressPercent > 0 && (
                <button
                  type="button"
                  onClick={onCompleteSessionNow}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-lg border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors whitespace-nowrap shrink-0"
                >
                  <Check className="w-4 h-4" />
                  <span>Засчитать</span>
                </button>
              )}
            </div>
          </section>

          {/* Pinned notes */}
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Закреплённые заметки
              </h2>
              <button
                type="button"
                onClick={() => onNavigateView(WorkspaceView.Notes)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 dark:text-blue-400 hover:underline whitespace-nowrap shrink-0"
              >
                <span>Все заметки</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {pinnedNotes.length > 0 ? (
              <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                {pinnedNotes.map((note) => (
                  <li key={note.id}>
                    <button
                      type="button"
                      onClick={() => onOpenNote(note.id)}
                      className="w-full text-left px-6 py-4 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                          {note.title}
                        </span>
                        <Pin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      </div>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                        {note.content}
                      </p>
                      <div className="mt-2 flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
                        <span>{note.category}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">{note.updatedAt}</span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-6 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                Закрепите важные заметки, чтобы держать их под рукой.
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
