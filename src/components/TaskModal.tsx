import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { FirasTask, TaskCategory, TaskPriority } from '../types/firas';

interface TaskModalProps {
  isOpen: boolean;
  editingTask: FirasTask | null;
  onClose: () => void;
  onSave: (data: {
    id?: string;
    title: string;
    description: string;
    priority: TaskPriority;
    category: TaskCategory;
    dueDate: string;
    estimatedMinutes: number;
  }) => void;
}

const CATEGORIES: TaskCategory[] = ['Работа', 'Стратегия', 'Обучение', 'Личное'];
const DURATIONS = [15, 25, 45, 50, 60, 90];

export const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  editingTask,
  onClose,
  onSave,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>(TaskPriority.Medium);
  const [category, setCategory] = useState<TaskCategory>('Работа');
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [estimatedMinutes, setEstimatedMinutes] = useState(25);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    if (editingTask) {
      setTitle(editingTask.title);
      setDescription(editingTask.description);
      setPriority(editingTask.priority);
      setCategory(editingTask.category);
      setDueDate(editingTask.dueDate);
      setEstimatedMinutes(editingTask.estimatedMinutes);
    } else {
      setTitle('');
      setDescription('');
      setPriority(TaskPriority.Medium);
      setCategory('Работа');
      setDueDate(new Date().toISOString().slice(0, 10));
      setEstimatedMinutes(25);
    }
    setError('');
  }, [isOpen, editingTask]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setError('Укажите название задачи.');
      return;
    }
    onSave({
      id: editingTask?.id,
      title: trimmed,
      description: description.trim(),
      priority,
      category,
      dueDate,
      estimatedMinutes,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-modal-title"
    >
      <div className="w-full max-w-lg rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2
            id="task-modal-title"
            className="text-base font-semibold text-slate-900 dark:text-slate-100"
          >
            {editingTask ? 'Редактировать задачу' : 'Новая задача'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть окно"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label
              htmlFor="task-title-input"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Название
            </label>
            <input
              id="task-title-input"
              type="text"
              autoFocus
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (error) setError('');
              }}
              placeholder="Например: Подготовить структуру презентации"
              className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
            />
            {error && (
              <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{error}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="task-desc-input"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Контекст или критерий готовности
            </label>
            <textarea
              id="task-desc-input"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Краткие детали, ссылки или следующий конкретный шаг"
              className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="task-category-select"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Направление
              </label>
              <select
                id="task-category-select"
                value={category}
                onChange={(e) => setCategory(e.target.value as TaskCategory)}
                className="w-full px-3 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="task-priority-select"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Приоритет
              </label>
              <select
                id="task-priority-select"
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full px-3 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value={TaskPriority.High}>Высокий</option>
                <option value={TaskPriority.Medium}>Средний</option>
                <option value={TaskPriority.Normal}>Обычный</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="task-date-input"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Срок
              </label>
              <input
                id="task-date-input"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2.5 text-sm font-mono tabular-nums rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label
                htmlFor="task-duration-select"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Оценка времени
              </label>
              <select
                id="task-duration-select"
                value={estimatedMinutes}
                onChange={(e) => setEstimatedMinutes(Number(e.target.value))}
                className="w-full px-3 py-2.5 text-sm font-mono tabular-nums rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {DURATIONS.map((mins) => (
                  <option key={mins} value={mins}>
                    {mins} мин
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-900 dark:bg-blue-600 text-white hover:bg-slate-800 dark:hover:bg-blue-500 transition-colors whitespace-nowrap"
            >
              {editingTask ? 'Сохранить изменения' : 'Добавить задачу'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
