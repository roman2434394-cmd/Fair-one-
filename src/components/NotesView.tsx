import React, { useMemo, useState } from 'react';
import { Plus, Pin, Trash2, Search } from 'lucide-react';
import { FirasNote, NoteCategory } from '../types/firas';

interface NotesViewProps {
  notes: FirasNote[];
  selectedNoteId: string | null;
  onSelectNote: (noteId: string) => void;
  onCreateNote: () => void;
  onUpdateNote: (
    noteId: string,
    patch: Partial<Pick<FirasNote, 'title' | 'content' | 'category' | 'pinned'>>
  ) => void;
  onDeleteNote: (noteId: string) => void;
}

const NOTE_CATEGORIES: NoteCategory[] = ['Идеи', 'Проекты', 'Рефлексия', 'Справочник'];

export const NotesView: React.FC<NotesViewProps> = ({
  notes,
  selectedNoteId,
  onSelectNote,
  onCreateNote,
  onUpdateNote,
  onDeleteNote,
}) => {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'Все' | NoteCategory>('Все');

  const filteredNotes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...notes]
      .filter((note) => {
        if (categoryFilter !== 'Все' && note.category !== categoryFilter) return false;
        if (
          q &&
          !note.title.toLowerCase().includes(q) &&
          !note.content.toLowerCase().includes(q)
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return b.updatedAt.localeCompare(a.updatedAt);
      });
  }, [notes, search, categoryFilter]);

  const activeNote =
    notes.find((n) => n.id === selectedNoteId) || filteredNotes[0] || null;

  const wordCount = activeNote
    ? activeNote.content
        .trim()
        .split(/\s+/)
        .filter(Boolean).length
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Заметки
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Чистое пространство для мыслей, конспектов и рабочих набросков
          </p>
        </div>

        <button
          type="button"
          onClick={onCreateNote}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg bg-slate-900 dark:bg-blue-600 text-white hover:bg-slate-800 dark:hover:bg-blue-500 transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Новая заметка</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch min-h-[560px]">
        {/* Left pane: notes index */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск по заметкам..."
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
              {(['Все', ...NOTE_CATEGORIES] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    categoryFilter === cat
                      ? 'bg-slate-900 text-white dark:bg-blue-600 dark:text-white'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800">
            {filteredNotes.length > 0 ? (
              filteredNotes.map((note) => {
                const isSelected = activeNote?.id === note.id;
                return (
                  <button
                    key={note.id}
                    type="button"
                    onClick={() => onSelectNote(note.id)}
                    className={`w-full text-left px-4 py-3.5 transition-colors ${
                      isSelected
                        ? 'bg-slate-100 dark:bg-slate-800/80'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                        {note.title || 'Без названия'}
                      </span>
                      {note.pinned && (
                        <Pin className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                      {note.content || 'Пустая заметка'}
                    </p>
                    <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
                      <span>{note.category}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">{note.updatedAt}</span>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                Заметок не найдено.
              </div>
            )}
          </div>
        </div>

        {/* Right pane: distraction-free editor */}
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col overflow-hidden">
          {activeNote ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3.5 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <select
                    aria-label="Категория заметки"
                    value={activeNote.category}
                    onChange={(e) =>
                      onUpdateNote(activeNote.id, {
                        category: e.target.value as NoteCategory,
                      })
                    }
                    className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    {NOTE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                  <span className="text-xs font-mono tabular-nums text-slate-400 dark:text-slate-500">
                    Обновлено {activeNote.updatedAt}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateNote(activeNote.id, { pinned: !activeNote.pinned })
                    }
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                      activeNote.pinned
                        ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-500'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Pin className="w-3.5 h-3.5" />
                    <span>{activeNote.pinned ? 'Закреплено' : 'Закрепить'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onDeleteNote(activeNote.id)}
                    aria-label="Удалить заметку"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-900 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors whitespace-nowrap shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Удалить</span>
                  </button>
                </div>
              </div>

              <div className="flex-1 flex flex-col p-6">
                <input
                  type="text"
                  value={activeNote.title}
                  onChange={(e) =>
                    onUpdateNote(activeNote.id, { title: e.target.value })
                  }
                  placeholder="Заголовок заметки..."
                  className="w-full text-xl font-bold tracking-tight bg-transparent text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none mb-4"
                />

                <textarea
                  value={activeNote.content}
                  onChange={(e) =>
                    onUpdateNote(activeNote.id, { content: e.target.value })
                  }
                  placeholder="Запишите главную мысль, тезисы или план..."
                  className="flex-1 w-full max-w-[72ch] min-h-[340px] bg-transparent text-[15px] leading-[1.68] text-slate-700 dark:text-slate-300 placeholder:text-slate-400 focus:outline-none resize-none"
                />
              </div>

              <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
                <span>Сохраняется автоматически</span>
                <span className="font-mono tabular-nums">
                  {wordCount} слов · {activeNote.content.length} симв.
                </span>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Выберите заметку слева или создайте новую
              </p>
              <button
                type="button"
                onClick={onCreateNote}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg bg-slate-900 dark:bg-blue-600 text-white hover:bg-slate-800 dark:hover:bg-blue-500 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Создать первую заметку</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
