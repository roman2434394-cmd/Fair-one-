import React, { useCallback, useEffect, useState } from 'react';
import {
  UserPlus,
  Ban,
  CheckCircle2,
  Trash2,
  Sliders,
  Users,
  History,
  Crown,
  Code2,
} from 'lucide-react';
import {
  ALL_ROLES_ASC,
  AdminAuditEntry,
  BrowserPublicConfig,
  isStaffRole,
  ROLE_DESCRIPTION_RU,
  ROLE_LABEL_RU,
  ROLE_LEVEL,
  UserProfile,
  UserRole,
} from '../types/firas';

interface AdminViewProps {
  token: string;
  currentUser: UserProfile;
  onConfigUpdated: (config: BrowserPublicConfig) => void;
  onNotify: (message: string) => void;
}

const ASSIGNABLE_ROLES: UserRole[] = ALL_ROLES_ASC.filter((r) => r !== 'owner');

export const AdminView: React.FC<AdminViewProps> = ({
  token,
  currentUser,
  onConfigUpdated,
  onNotify,
}) => {
  const [activeTab, setActiveTab] = useState<'users' | 'browser' | 'audit'>('users');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [auditLog, setAuditLog] = useState<AdminAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create account form
  const [newUsername, setNewUsername] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('client');
  const [creating, setCreating] = useState(false);

  // Browser config form
  const [announcement, setAnnouncement] = useState('');
  const [examplesText, setExamplesText] = useState('');
  const [blockedText, setBlockedText] = useState('');
  const [aiEnabled, setAiEnabled] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);

  const actorLevel = ROLE_LEVEL[currentUser.role];
  const allowedCreateRoles = ASSIGNABLE_ROLES.filter((r) => ROLE_LEVEL[r] < actorLevel);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch('/api/admin/overview', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = (await resp.json()) as {
        users?: UserProfile[];
        config?: BrowserPublicConfig;
        auditLog?: AdminAuditEntry[];
        error?: string;
      };
      if (!resp.ok) {
        setError(json.error || 'Не удалось загрузить панель управления.');
        setLoading(false);
        return;
      }
      setUsers(json.users || []);
      setAuditLog(json.auditLog || []);
      if (json.config) {
        setAnnouncement(json.config.announcement);
        setExamplesText(json.config.searchExamples.join(', '));
        setBlockedText(json.config.blockedDomains.join(', '));
        setAiEnabled(json.config.aiEnabled);
      }
    } catch {
      setError('Ошибка соединения с сервером.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const resp = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          username: newUsername.trim(),
          displayName: newDisplayName.trim(),
          email: newEmail.trim(),
          password: newPassword,
          role: newRole,
        }),
      });
      const json = (await resp.json()) as { user?: UserProfile; error?: string };
      if (!resp.ok || !json.user) {
        setError(json.error || 'Не удалось создать аккаунт.');
        setCreating(false);
        return;
      }
      setNewUsername('');
      setNewDisplayName('');
      setNewEmail('');
      setNewPassword('');
      setNewRole('client');
      onNotify(`Аккаунт @${json.user.username} создан (${ROLE_LABEL_RU[json.user.role]}).`);
      await loadOverview();
    } catch {
      setError('Ошибка при создании аккаунта.');
    } finally {
      setCreating(false);
    }
  };

  const handleSetRole = async (target: UserProfile, nextRole: UserRole) => {
    if (target.role === nextRole) return;
    setError(null);
    try {
      const resp = await fetch(`/api/admin/users/${target.id}/role`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role: nextRole }),
      });
      const json = (await resp.json()) as { user?: UserProfile; error?: string };
      if (!resp.ok) {
        setError(json.error || 'Не удалось изменить роль.');
        return;
      }
      onNotify(`Аккаунту @${target.username} назначена роль «${ROLE_LABEL_RU[nextRole]}».`);
      await loadOverview();
    } catch {
      setError('Ошибка при обновлении роли.');
    }
  };

  const handleToggleStatus = async (target: UserProfile) => {
    const nextStatus = target.status === 'blocked' ? 'active' : 'blocked';
    setError(null);
    try {
      const resp = await fetch(`/api/admin/users/${target.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: nextStatus }),
      });
      const json = (await resp.json()) as { error?: string };
      if (!resp.ok) {
        setError(json.error || 'Не удалось изменить статус аккаунта.');
        return;
      }
      onNotify(
        nextStatus === 'blocked'
          ? `Аккаунт @${target.username} заблокирован.`
          : `Аккаунт @${target.username} разблокирован.`
      );
      await loadOverview();
    } catch {
      setError('Ошибка при изменении статуса.');
    }
  };

  const handleDeleteUser = async (target: UserProfile) => {
    setError(null);
    try {
      const resp = await fetch(`/api/admin/users/${target.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = (await resp.json()) as { error?: string };
      if (!resp.ok) {
        setError(json.error || 'Не удалось удалить аккаунт.');
        return;
      }
      onNotify(`Аккаунт @${target.username} удалён.`);
      await loadOverview();
    } catch {
      setError('Ошибка при удалении аккаунта.');
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    setError(null);
    try {
      const searchExamples = examplesText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const blockedDomains = blockedText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const resp = await fetch('/api/admin/config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          announcement: announcement.trim(),
          searchExamples,
          blockedDomains,
          aiEnabled,
        }),
      });
      const json = (await resp.json()) as {
        config?: BrowserPublicConfig;
        error?: string;
      };
      if (!resp.ok || !json.config) {
        setError(json.error || 'Не удалось сохранить настройки.');
        setSavingConfig(false);
        return;
      }
      onConfigUpdated(json.config);
      onNotify('Настройки браузера Fires обновлены.');
      await loadOverview();
    } catch {
      setError('Ошибка при сохранении настроек.');
    } finally {
      setSavingConfig(false);
    }
  };

  const staffCount = users.filter((u) => isStaffRole(u.role)).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Управление системой
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Иерархия из 11 уровней: от Клиента и Участника до Директора, Программиста и Владельца.
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
          <span className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            Ваша роль:{' '}
            <strong className="text-slate-900 dark:text-slate-100">
              {ROLE_LABEL_RU[currentUser.role]}
            </strong>
          </span>
          <span className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            Аккаунтов:{' '}
            <strong className="font-mono text-slate-900 dark:text-slate-100">{users.length}</strong>
          </span>
          <span className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            Руководство:{' '}
            <strong className="font-mono text-slate-900 dark:text-slate-100">{staffCount}</strong>
          </span>
        </div>
      </div>

      {/* 11-Level Role Hierarchy Strip */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-2.5">
        <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
          Лестница ролей системы (уровень 1 → 11)
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
          {ALL_ROLES_ASC.map((roleId, index) => {
            const isMine = currentUser.role === roleId;
            return (
              <div
                key={roleId}
                title={ROLE_DESCRIPTION_RU[roleId]}
                className={`px-2.5 py-2 rounded-lg border text-xs transition-colors ${
                  isMine
                    ? 'border-slate-900 dark:border-slate-100 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between gap-1 font-semibold">
                  <span className="truncate">{ROLE_LABEL_RU[roleId]}</span>
                  <span className="font-mono text-[10px] opacity-70 shrink-0">
                    #{index + 1}
                  </span>
                </div>
                <div
                  className={`mt-0.5 text-[10px] line-clamp-1 ${
                    isMine ? 'opacity-85' : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {ROLE_DESCRIPTION_RU[roleId]}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('users')}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg transition-colors focus:outline-none ${
            activeTab === 'users'
              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Аккаунты и роли</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('browser')}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg transition-colors focus:outline-none ${
            activeTab === 'browser'
              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Управление браузером</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('audit')}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg transition-colors focus:outline-none ${
            activeTab === 'audit'
              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Журнал действий</span>
        </button>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-3">
          <div className="h-5 w-1/3 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
          <div className="h-12 w-full rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
          <div className="h-12 w-full rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
        </div>
      ) : activeTab === 'users' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Users table / list */}
          <div className="lg:col-span-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Зарегистрированные аккаунты
              </h2>
            </div>

            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {users.map((u) => {
                const isSelf = u.id === currentUser.id;
                const isOwner = u.role === 'owner';
                const canManageTarget =
                  !isSelf && !isOwner && ROLE_LEVEL[u.role] < actorLevel;
                const isBlocked = u.status === 'blocked';
                const isHighlighted = isStaffRole(u.role);

                return (
                  <div
                    key={u.id}
                    className="p-4 sm:px-5 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {u.displayName}
                        </span>
                        <span className="text-xs font-mono text-slate-400">
                          @{u.username}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-md border ${
                            isOwner
                              ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
                              : isHighlighted
                              ? 'border-slate-400 dark:border-slate-500 text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800'
                              : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {isOwner && <Crown className="w-3 h-3" />}
                          {u.role === 'developer' && <Code2 className="w-3 h-3" />}
                          <span>{ROLE_LABEL_RU[u.role]}</span>
                        </span>
                        {isBlocked && (
                          <span className="px-2 py-0.5 text-[11px] font-medium rounded-md border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40">
                            Заблокирован
                          </span>
                        )}
                        {isSelf && (
                          <span className="text-[11px] text-slate-400">(вы)</span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {u.email}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {canManageTarget ? (
                        <>
                          <select
                            aria-label={`Роль для ${u.username}`}
                            value={u.role}
                            onChange={(e) => handleSetRole(u, e.target.value as UserRole)}
                            className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
                          >
                            {allowedCreateRoles.map((roleOpt) => (
                              <option key={roleOpt} value={roleOpt}>
                                {ROLE_LABEL_RU[roleOpt]}
                              </option>
                            ))}
                          </select>

                          <button
                            type="button"
                            onClick={() => handleToggleStatus(u)}
                            title={isBlocked ? 'Разблокировать' : 'Заблокировать'}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none"
                          >
                            {isBlocked ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Разблок.</span>
                              </>
                            ) : (
                              <>
                                <Ban className="w-3.5 h-3.5" />
                                <span>Блок</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteUser(u)}
                            aria-label={`Удалить аккаунт ${u.username}`}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <span className="text-[11px] text-slate-400 dark:text-slate-500">
                          {isOwner ? 'Высший уровень доступа' : isSelf ? 'Текущий аккаунт' : 'Выше или равен по уровню'}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Add new user with role */}
          <form
            onSubmit={handleCreateAccount}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4 h-fit"
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <UserPlus className="w-4 h-4" />
              <span>Создать аккаунт</span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Логин
                </label>
                <input
                  type="text"
                  required
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="moderator"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-slate-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Имя
                </label>
                <input
                  type="text"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  placeholder="Мария Соколова"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-slate-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="maria@example.com"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-slate-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Пароль
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Минимум 4 символа"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-slate-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Начальная роль
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none"
                >
                  {allowedCreateRoles.map((roleOpt) => (
                    <option key={roleOpt} value={roleOpt}>
                      {ROLE_LABEL_RU[roleOpt]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={creating}
              className="w-full py-2.5 text-sm font-medium rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors disabled:opacity-50 focus:outline-none"
            >
              {creating ? 'Создание...' : 'Добавить аккаунт'}
            </button>
          </form>
        </div>
      ) : activeTab === 'browser' ? (
        <form
          onSubmit={handleSaveConfig}
          className="max-w-2xl rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5"
        >
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Объявление в браузере Fires (показывается всем)
            </label>
            <input
              type="text"
              value={announcement}
              onChange={(e) => setAnnouncement(e.target.value)}
              placeholder="Оставьте пустым, чтобы скрыть баннер..."
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-slate-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Примеры запросов на стартовом экране (через запятую)
            </label>
            <input
              type="text"
              value={examplesText}
              onChange={(e) => setExamplesText(e.target.value)}
              placeholder="яблоко, список Forbes, курс доллара"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-slate-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Заблокированные домены в прокси-браузере (через запятую)
            </label>
            <input
              type="text"
              value={blockedText}
              onChange={(e) => setBlockedText(e.target.value)}
              placeholder="example.com, blocked-site.org"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-slate-400"
            />
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              Сайты из этого списка не откроются внутри браузера Fires для всех пользователей.
            </p>
          </div>

          <label className="flex items-center justify-between gap-4 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 cursor-pointer">
            <div>
              <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                Разрешить ответы нейросетей (Fires Assistant / Claude / Gemini / ChatGPT / DeepSeek)
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Если выключить, обычные пользователи видят только веб-сайты (у персонала ИИ остаётся).
              </div>
            </div>
            <input
              type="checkbox"
              checked={aiEnabled}
              onChange={(e) => setAiEnabled(e.target.checked)}
              className="w-4 h-4 accent-slate-900 dark:accent-slate-100"
            />
          </label>

          <button
            type="submit"
            disabled={savingConfig}
            className="px-5 py-2.5 text-sm font-medium rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors disabled:opacity-50 focus:outline-none"
          >
            {savingConfig ? 'Сохранение...' : 'Сохранить настройки'}
          </button>
        </form>
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-200 dark:divide-slate-800">
          {auditLog.map((entry) => (
            <div
              key={entry.id}
              className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-2 text-sm"
            >
              <div>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {entry.actorName}:
                </span>{' '}
                <span className="text-slate-600 dark:text-slate-300">{entry.action}</span>
              </div>
              <span className="text-xs font-mono text-slate-400 dark:text-slate-500">
                {new Date(entry.createdAt).toLocaleString('ru-RU')}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
