import React, { useEffect, useState } from 'react';
import {
  X,
  Shield,
  Crown,
  LogOut,
  CheckCircle2,
  KeyRound,
  ArrowLeft,
  Save,
  Server,
  Plus,
  Code2,
  Smartphone,
  ShieldCheck,
} from 'lucide-react';
import {
  isStaffRole,
  LoginConfirmationRequest,
  MessengerBridgeBinding,
  MessengerServer,
  ROLE_DESCRIPTION_RU,
  ROLE_LABEL_RU,
  UserProfile,
} from '../types/firas';
import { AvatarPicker, UserAvatar } from './UserAvatar';

interface AuthModalProps {
  isOpen: boolean;
  initialMode?: 'login' | 'register';
  reasonBanner?: string | null;
  currentUser: UserProfile | null;
  authToken?: string | null;
  servers?: MessengerServer[];
  onCreateServer?: (input: {
    name: string;
    description?: string;
    region?: string;
    color?: string;
  }) => Promise<{ ok: boolean; server?: MessengerServer; error?: string }>;
  onUpdateBridges?: (payload: {
    phone?: string;
    telegramConnected?: boolean;
    telegramHandle?: string;
    telegramChatId?: string;
    whatsappConnected?: boolean;
    whatsappPhone?: string;
    viberConnected?: boolean;
    viberPhone?: string;
    chatRouletteConnected?: boolean;
  }) => Promise<{
    ok: boolean;
    bridges?: MessengerBridgeBinding;
    user?: UserProfile;
    error?: string;
  }>;
  onSendBridgeCode?: (payload: {
    phone: string;
    telegramHandle?: string;
    telegramChatId?: string;
    telegram?: boolean;
    whatsapp?: boolean;
    viber?: boolean;
    chatRoulette?: boolean;
  }) => Promise<{
    ok: boolean;
    challengeId?: string;
    phone?: string;
    maskedPhone?: string;
    deliveryMode?: 'sms' | 'in-app';
    demoCode?: string;
    message?: string;
    error?: string;
  }>;
  onVerifyBridgeCode?: (payload: {
    challengeId?: string;
    code: string;
  }) => Promise<{
    ok: boolean;
    bridges?: MessengerBridgeBinding;
    user?: UserProfile;
    error?: string;
  }>;
  pendingConfirmations: LoginConfirmationRequest[];
  onRespondConfirmation: (challengeId: string, decision: 'approve' | 'reject') => Promise<void>;
  onClose: () => void;
  onAuthenticated: (token: string, user: UserProfile) => void;
  onProfileUpdated: (user: UserProfile) => void;
  onLogout: () => void;
  onOpenAdminPanel: () => void;
}

interface PendingChallengeState {
  challengeId: string;
  hasActiveSession: boolean;
  maskedAccount: string;
  maskedEmail: string;
}

const DEVICE_ID_KEY = 'firas-device-id';

function getOrCreateDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing && /^[a-zA-Z0-9_-]{8,80}$/.test(existing)) {
      return existing;
    }
    const bytes = new Uint8Array(12);
    window.crypto.getRandomValues(bytes);
    const created =
      'dev-' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    localStorage.setItem(DEVICE_ID_KEY, created);
    return created;
  } catch {
    return 'dev-browser-default';
  }
}

async function parseJsonSafe<T>(resp: Response): Promise<T | null> {
  try {
    const text = await resp.text();
    if (!text) return null;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  initialMode = 'login',
  reasonBanner,
  currentUser,
  authToken,
  servers = [],
  onCreateServer,
  onUpdateBridges,
  onSendBridgeCode,
  onVerifyBridgeCode,
  pendingConfirmations,
  onRespondConfirmation,
  onClose,
  onAuthenticated,
  onProfileUpdated,
  onLogout,
  onOpenAdminPanel,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [accountServer, setAccountServer] = useState<string>(() => {
    try {
      return localStorage.getItem('firas-account-server') || 'srv-main';
    } catch {
      return 'srv-main';
    }
  });
  const [showAddServer, setShowAddServer] = useState(false);
  const [newServerName, setNewServerName] = useState('');
  const [creatingServer, setCreatingServer] = useState(false);
  const [loginInput, setLoginInput] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [avatar, setAvatar] = useState('preset:slate');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingLoginHint, setExistingLoginHint] = useState<string | null>(null);

  // Profile editor state when logged in
  const [editNickname, setEditNickname] = useState('');
  const [editAvatar, setEditAvatar] = useState('preset:slate');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileNotice, setProfileNotice] = useState<string | null>(null);

  // 2-step Phone + Code Verification for Chat-Roulette, WhatsApp, Viber, Telegram
  const [bindPhone, setBindPhone] = useState('');
  const [bindTg, setBindTg] = useState('');
  const [bindWa, setBindWa] = useState(true);
  const [bindVb, setBindVb] = useState(true);
  const [bindRoulette, setBindRoulette] = useState(true);
  const [savingBind, setSavingBind] = useState(false);
  const [bindChallengeId, setBindChallengeId] = useState<string | null>(null);
  const [bindCodeInput, setBindCodeInput] = useState('');
  const [bindCodeBanner, setBindCodeBanner] = useState<string | null>(null);
  const [editingBindPhone, setEditingBindPhone] = useState(false);

  // Step 2: Account confirmation for 3rd+ unknown devices
  const [challenge, setChallenge] = useState<PendingChallengeState | null>(null);
  const [confirmCode, setConfirmCode] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');

  const handleSelectAccountServer = (val: string) => {
    setAccountServer(val);
    try {
      localStorage.setItem('firas-account-server', val);
    } catch {
      // ignore
    }
  };

  const handleQuickCreateServer = async () => {
    if (!onCreateServer || !newServerName.trim()) return;
    setCreatingServer(true);
    const res = await onCreateServer({
      name: newServerName.trim(),
      region: 'RU-Account',
      color: 'indigo',
    });
    setCreatingServer(false);
    if (res.ok && res.server) {
      handleSelectAccountServer(res.server.id);
      setNewServerName('');
      setShowAddServer(false);
      setProfileNotice(`Дополнительный сервер «${res.server.name}» добавлен.`);
    } else if (res.error) {
      setError(res.error);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setError(null);
      setProfileNotice(null);
    }
  }, [isOpen, initialMode]);

  useEffect(() => {
    if (currentUser) {
      setEditNickname(currentUser.displayName);
      setEditAvatar(currentUser.avatar || 'preset:slate');
      setBindPhone(currentUser.bridges?.phone || '');
      setBindTg(currentUser.bridges?.telegram?.handle || '');
      setBindWa(currentUser.bridges ? Boolean(currentUser.bridges.whatsapp?.connected ?? true) : true);
      setBindVb(currentUser.bridges ? Boolean(currentUser.bridges.viber?.connected ?? true) : true);
      setBindRoulette(
        currentUser.bridges ? Boolean(currentUser.bridges.chatRoulette?.connected ?? true) : true
      );
    }
  }, [currentUser]);

  const resetFormState = () => {
    setLoginInput('');
    setUsername('');
    setDisplayName('');
    setAvatar('preset:slate');
    setEmail('');
    setPassword('');
    setError(null);
    setExistingLoginHint(null);
    setChallenge(null);
    setConfirmCode('');
    setConfirmEmail('');
  };

  // Poll when waiting for approval from an active session of this account
  useEffect(() => {
    if (!isOpen || !challenge || !challenge.hasActiveSession || currentUser) return;

    let cancelled = false;
    const poll = async () => {
      try {
        const resp = await fetch(
          `/api/auth/challenge-status?id=${encodeURIComponent(challenge.challengeId)}`
        );
        if (!resp.ok || cancelled) return;
        const data = (await resp.json()) as {
          status?: 'pending' | 'approved' | 'rejected' | 'expired';
        };
        if (cancelled) return;

        if (data.status === 'approved') {
          const deviceId = getOrCreateDeviceId();
          const confirmResp = await fetch('/api/auth/confirm-login', {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'X-Firas-Device': deviceId,
            },
            body: JSON.stringify({ challengeId: challenge.challengeId, deviceId }),
          });
          const json = (await confirmResp.json()) as {
            token?: string;
            user?: UserProfile;
            deviceId?: string;
            error?: string;
          };
          if (!cancelled && confirmResp.ok && json.token && json.user) {
            if (json.deviceId) {
              try {
                localStorage.setItem(DEVICE_ID_KEY, json.deviceId);
              } catch {
                // ignore
              }
            }
            onAuthenticated(json.token, json.user);
            resetFormState();
            onClose();
          }
        } else if (data.status === 'rejected') {
          setChallenge(null);
          setError('Вход отклонён с активного устройства аккаунта.');
        } else if (data.status === 'expired') {
          setChallenge(null);
          setError('Время подтверждения истекло. Попробуйте войти снова.');
        }
      } catch {
        // Ignore transient network errors while polling
      }
    };

    const interval = window.setInterval(poll, 1800);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [isOpen, challenge, currentUser, onAuthenticated, onClose]);

  if (!isOpen) return null;

  const submitAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setExistingLoginHint(null);
    setLoading(true);
    try {
      const deviceId = getOrCreateDeviceId();
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const body =
        mode === 'login'
          ? { login: loginInput.trim(), password, deviceId }
          : {
              username: username.trim(),
              displayName: displayName.trim() || username.trim(),
              avatar,
              email: email.trim(),
              password,
              deviceId,
            };

      const resp = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Firas-Device': deviceId,
        },
        body: JSON.stringify(body),
      });
      const json =
        (await parseJsonSafe<{
          token?: string;
          user?: UserProfile;
          deviceId?: string;
          requiresConfirmation?: boolean;
          challengeId?: string;
          hasActiveSession?: boolean;
          maskedAccount?: string;
          maskedEmail?: string;
          accountExists?: boolean;
          existingLogin?: string;
          error?: string;
        }>(resp)) || {};

      if (mode === 'register' && resp.status === 409 && json.accountExists) {
        setError(
          json.error ||
            'Такой аккаунт уже существует. Войдите в него и подтвердите вход.'
        );
        setExistingLoginHint(json.existingLogin || username.trim() || email.trim());
        setLoading(false);
        return;
      }

      if (!resp.ok) {
        setError(
          json.error ||
            `Не удалось выполнить ${mode === 'register' ? 'регистрацию' : 'вход'} (код ${resp.status}).`
        );
        setLoading(false);
        return;
      }

      // 3rd+ unknown device requires confirmation
      if (json.requiresConfirmation && json.challengeId) {
        setChallenge({
          challengeId: json.challengeId,
          hasActiveSession: Boolean(json.hasActiveSession),
          maskedAccount: json.maskedAccount || loginInput.trim(),
          maskedEmail: json.maskedEmail || '',
        });
        setPassword('');
        setLoading(false);
        return;
      }

      if (json.token && json.user) {
        if (json.deviceId) {
          try {
            localStorage.setItem(DEVICE_ID_KEY, json.deviceId);
          } catch {
            // ignore
          }
        }
        onAuthenticated(json.token, json.user);
        resetFormState();
        onClose();
        return;
      }

      setError('Не удалось завершить авторизацию.');
    } catch {
      setError('Ошибка соединения с сервером.');
    } finally {
      setLoading(false);
    }
  };

  const submitConfirmation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!challenge) return;
    setError(null);
    setLoading(true);
    try {
      const deviceId = getOrCreateDeviceId();
      const resp = await fetch('/api/auth/confirm-login', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Firas-Device': deviceId,
        },
        body: JSON.stringify({
          challengeId: challenge.challengeId,
          code: confirmCode.trim() || undefined,
          confirmEmail: confirmEmail.trim() || undefined,
          deviceId,
        }),
      });
      const json =
        (await parseJsonSafe<{
          token?: string;
          user?: UserProfile;
          deviceId?: string;
          error?: string;
        }>(resp)) || {};
      if (!resp.ok || !json.token || !json.user) {
        setError(json.error || 'Не удалось подтвердить вход.');
        setLoading(false);
        return;
      }
      if (json.deviceId) {
        try {
          localStorage.setItem(DEVICE_ID_KEY, json.deviceId);
        } catch {
          // ignore
        }
      }
      onAuthenticated(json.token, json.user);
      resetFormState();
      onClose();
    } catch {
      setError('Ошибка соединения при подтверждении входа.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setSavingProfile(true);
    setError(null);
    setProfileNotice(null);
    try {
      const resp = await fetch('/api/auth/profile', {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          displayName: editNickname.trim(),
          avatar: editAvatar,
        }),
      });
      const json =
        (await parseJsonSafe<{ user?: UserProfile; error?: string }>(resp)) || {};
      if (!resp.ok || !json.user) {
        setError(json.error || 'Не удалось обновить профиль.');
        setSavingProfile(false);
        return;
      }
      onProfileUpdated(json.user);
      setProfileNotice('Никнейм и аватарка сохранены.');
    } catch {
      setError('Ошибка соединения при сохранении профиля.');
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Аккаунт Firas"
    >
      <div className="w-full max-w-md max-h-[92vh] overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {currentUser
              ? 'Профиль аккаунта и мессенджера'
              : challenge
              ? 'Подтверждение входа'
              : mode === 'login'
              ? 'Вход в аккаунт Firas'
              : 'Регистрация для мессенджера'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть окно аккаунта"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {currentUser ? (
          <div className="p-5 space-y-4">
            <div className="flex items-start gap-3.5 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
              <UserAvatar
                name={currentUser.displayName}
                avatar={currentUser.avatar}
                size="lg"
                online
              />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {currentUser.displayName}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200">
                    {currentUser.role === 'owner' && <Crown className="w-3 h-3" />}
                    {currentUser.role === 'developer' && <Code2 className="w-3 h-3" />}
                    <span>{ROLE_LABEL_RU[currentUser.role]}</span>
                  </span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  @{currentUser.username} · {currentUser.email}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {ROLE_DESCRIPTION_RU[currentUser.role]}
                </div>
                <div className="text-[11px] text-slate-400 dark:text-slate-500">
                  Сессия сохранена · Устройств:{' '}
                  <span className="font-mono">{currentUser.trustedDevicesCount ?? 1}</span>
                </div>
              </div>
            </div>

            {(onUpdateBridges || onSendBridgeCode) && (
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100">
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Привязка номера (Чат-рулетка, WhatsApp, Viber, TG)</span>
                  </div>
                  {currentUser.bridges?.phoneVerified && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Подтверждён</span>
                    </span>
                  )}
                </div>

                {currentUser.bridges?.phoneVerified && !editingBindPhone && !bindChallengeId ? (
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-300">
                    <span className="truncate">
                      {currentUser.bridges.phone} · Чат-рулетка, WhatsApp, Viber, Telegram
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingBindPhone(true);
                        setBindCodeBanner(null);
                      }}
                      className="px-2.5 py-1 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0 focus:outline-none"
                    >
                      Изменить
                    </button>
                  </div>
                ) : !bindChallengeId ? (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <input
                        type="tel"
                        value={bindPhone}
                        onChange={(e) => setBindPhone(e.target.value)}
                        placeholder="Телефон (+7999...)"
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none"
                      />
                      <input
                        type="text"
                        value={bindTg}
                        onChange={(e) => setBindTg(e.target.value)}
                        placeholder="Telegram (@username)"
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none"
                      />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex flex-wrap items-center gap-3 text-slate-600 dark:text-slate-300">
                        <label className="inline-flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={bindRoulette}
                            onChange={(e) => setBindRoulette(e.target.checked)}
                            className="accent-slate-900 dark:accent-slate-100"
                          />
                          <span>Чат-рулетка</span>
                        </label>
                        <label className="inline-flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={bindWa}
                            onChange={(e) => setBindWa(e.target.checked)}
                            className="accent-slate-900 dark:accent-slate-100"
                          />
                          <span>WhatsApp</span>
                        </label>
                        <label className="inline-flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={bindVb}
                            onChange={(e) => setBindVb(e.target.checked)}
                            className="accent-slate-900 dark:accent-slate-100"
                          />
                          <span>Viber</span>
                        </label>
                      </div>
                      <button
                        type="button"
                        disabled={savingBind || !bindPhone.trim()}
                        onClick={async () => {
                          setError(null);
                          setBindCodeBanner(null);
                          if (onSendBridgeCode) {
                            setSavingBind(true);
                            const res = await onSendBridgeCode({
                              phone: bindPhone.trim(),
                              telegramHandle: bindTg.trim(),
                              telegram: true,
                              whatsapp: bindWa,
                              viber: bindVb,
                              chatRoulette: bindRoulette,
                            });
                            setSavingBind(false);
                            if (res.ok && res.challengeId) {
                              setBindChallengeId(res.challengeId);
                              setBindCodeInput('');
                              setBindCodeBanner(
                                res.deliveryMode === 'in-app' && res.demoCode
                                  ? `${res.message || 'Код отправлен.'} (код: ${res.demoCode})`
                                  : res.message || 'Код отправлен. Введите его ниже.'
                              );
                            } else if (res.error) {
                              setError(res.error);
                            }
                            return;
                          }
                          if (onUpdateBridges) {
                            setSavingBind(true);
                            const res = await onUpdateBridges({
                              phone: bindPhone.trim(),
                              telegramConnected: Boolean(bindTg.trim() || bindPhone.trim()),
                              telegramHandle: bindTg.trim(),
                              whatsappConnected: bindWa,
                              whatsappPhone: bindPhone.trim(),
                              viberConnected: bindVb,
                              viberPhone: bindPhone.trim(),
                              chatRouletteConnected: bindRoulette,
                            });
                            setSavingBind(false);
                            if (res.ok && res.user) {
                              onProfileUpdated(res.user);
                              setProfileNotice('Привязка номера сохранена.');
                            } else if (res.error) {
                              setError(res.error);
                            }
                          }
                        }}
                        className="px-3 py-1 text-xs font-medium rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 disabled:opacity-50 focus:outline-none"
                      >
                        {savingBind ? '...' : onSendBridgeCode ? 'Прислать код' : 'Привязать'}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="space-y-2">
                    {bindCodeBanner && (
                      <div className="px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-[11px] text-emerald-900 dark:text-emerald-200">
                        {bindCodeBanner}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={bindCodeInput}
                        onChange={(e) => setBindCodeInput(e.target.value)}
                        placeholder="Введите 6-значный код"
                        className="flex-1 px-2.5 py-1.5 text-xs font-mono tracking-wider rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none"
                      />
                      <button
                        type="button"
                        disabled={savingBind || !bindCodeInput.trim()}
                        onClick={async () => {
                          if (!onVerifyBridgeCode) return;
                          setError(null);
                          setSavingBind(true);
                          const res = await onVerifyBridgeCode({
                            challengeId: bindChallengeId || undefined,
                            code: bindCodeInput.trim(),
                          });
                          setSavingBind(false);
                          if (res.ok && res.user) {
                            setBindChallengeId(null);
                            setBindCodeInput('');
                            setBindCodeBanner(null);
                            setEditingBindPhone(false);
                            onProfileUpdated(res.user);
                            setProfileNotice(
                              'Номер подтверждён! Чат-рулетка, WhatsApp, Viber и Telegram активны.'
                            );
                          } else {
                            setError(res.error || 'Неверный код.');
                          }
                        }}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 disabled:opacity-50 focus:outline-none"
                      >
                        {savingBind ? '...' : 'Подтвердить'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setBindChallengeId(null);
                          setBindCodeInput('');
                          setBindCodeBanner(null);
                        }}
                        className="px-2 py-1.5 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 focus:outline-none"
                      >
                        Назад
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* + Additional Servers Selector in Account */}
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100">
                  <Server className="w-3.5 h-3.5" />
                  <span>Серверы аккаунтов</span>
                </span>
                {onCreateServer && (
                  <button
                    type="button"
                    onClick={() => setShowAddServer((v) => !v)}
                    className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Сервер</span>
                  </button>
                )}
              </div>

              <select
                aria-label="Выбор сервера аккаунтов"
                value={accountServer}
                onChange={(e) => handleSelectAccountServer(e.target.value)}
                className="w-full px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none"
              >
                <option value="srv-main">Основной сервер аккаунтов #1 (RU-Central)</option>
                <option value="srv-backup-eu">Резервный сервер аккаунтов #2 (EU-North)</option>
                {servers
                  .filter((s) => s.id !== 'srv-main')
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.region})
                    </option>
                  ))}
              </select>

              {showAddServer && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={newServerName}
                    onChange={(e) => setNewServerName(e.target.value)}
                    placeholder="Название нового сервера..."
                    className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                  <button
                    type="button"
                    disabled={creatingServer || newServerName.trim().length < 2}
                    onClick={handleQuickCreateServer}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 disabled:opacity-40 focus:outline-none"
                  >
                    {creatingServer ? '...' : 'Добавить'}
                  </button>
                </div>
              )}
            </div>

            <form
              onSubmit={handleSaveProfile}
              className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3"
            >
              <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                Никнейм и аватарка в мессенджере
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Никнейм
                </label>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={60}
                  value={editNickname}
                  onChange={(e) => setEditNickname(e.target.value)}
                  placeholder="Ваш никнейм"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-slate-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                  Аватарка
                </label>
                <AvatarPicker
                  name={editNickname || currentUser.username}
                  value={editAvatar}
                  onChange={setEditAvatar}
                />
              </div>

              {profileNotice && (
                <div className="px-3 py-2 rounded-lg border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/40 text-xs text-emerald-700 dark:text-emerald-300">
                  {profileNotice}
                </div>
              )}

              {error && (
                <div className="px-3 py-2 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 text-xs text-red-700 dark:text-red-300">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={savingProfile}
                className="w-full inline-flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors disabled:opacity-50 focus:outline-none"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{savingProfile ? 'Сохранение...' : 'Сохранить никнейм и аватарку'}</span>
              </button>
            </form>

            {pendingConfirmations.length > 0 && (
              <div className="space-y-2.5">
                {pendingConfirmations.map((req) => (
                  <div
                    key={req.id}
                    className="p-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/70 space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                        Запрос входа в @{req.targetUsername}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-mono text-xs font-semibold tracking-wider">
                        {req.code}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Подтвердите вход или передайте 6-значный код выше.
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onRespondConfirmation(req.id, 'approve')}
                        className="flex-1 py-1.5 text-xs font-medium rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 focus:outline-none"
                      >
                        Подтвердить
                      </button>
                      <button
                        type="button"
                        onClick={() => onRespondConfirmation(req.id, 'reject')}
                        className="flex-1 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none"
                      >
                        Отклонить
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {isStaffRole(currentUser.role) && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAdminPanel();
                }}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors focus:outline-none"
              >
                <Shield className="w-4 h-4" />
                <span>Открыть панель управления</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                onLogout();
                onClose();
              }}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none"
            >
              <LogOut className="w-4 h-4" />
              <span>Выйти из аккаунта</span>
            </button>
          </div>
        ) : challenge ? (
          <form onSubmit={submitConfirmation} className="p-5 space-y-4">
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                <KeyRound className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                <span>Аккаунт @{challenge.maskedAccount} уже существует</span>
              </div>
              {challenge.hasActiveSession ? (
                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  В этот аккаунт уже выполнен вход на другом устройстве. Нажмите{' '}
                  <strong className="font-medium text-slate-900 dark:text-slate-100">
                    «Подтвердить»
                  </strong>{' '}
                  в активном окне аккаунта или введите 6-значный код оттуда ниже.
                </p>
              ) : (
                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  Для подтверждения входа в существующий аккаунт укажите привязанный email ({challenge.maskedEmail}).
                </p>
              )}
            </div>

            {challenge.hasActiveSession ? (
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  6-значный код из активного аккаунта
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={confirmCode}
                  onChange={(e) => setConfirmCode(e.target.value)}
                  placeholder="000000"
                  className="w-full px-3 py-2 text-sm font-mono tracking-widest rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 dark:focus:border-slate-500"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Email аккаунта
                </label>
                <input
                  type="email"
                  required
                  value={confirmEmail}
                  onChange={(e) => setConfirmEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 dark:focus:border-slate-500"
                />
              </div>
            )}

            {error && (
              <div className="px-3 py-2 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 text-xs text-red-700 dark:text-red-300">
                {error}
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setChallenge(null);
                  setConfirmCode('');
                  setConfirmEmail('');
                  setError(null);
                }}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Назад</span>
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors disabled:opacity-50 focus:outline-none"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{loading ? 'Проверка...' : 'Подтвердить вход'}</span>
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={submitAuth} className="p-5 space-y-4">
            {reasonBanner && (
              <div className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
                {reasonBanner}
              </div>
            )}

            <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                  setExistingLoginHint(null);
                }}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors focus:outline-none ${
                  mode === 'login'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                Вход
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setError(null);
                  setExistingLoginHint(null);
                }}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors focus:outline-none ${
                  mode === 'register'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                Регистрация
              </button>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                Сервер авторизации
              </label>
              <select
                aria-label="Сервер авторизации"
                value={accountServer}
                onChange={(e) => handleSelectAccountServer(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-none"
              >
                <option value="srv-main">Основной сервер Firas #1 (RU-Central)</option>
                <option value="srv-backup-eu">Дополнительный сервер #2 (EU-North)</option>
                <option value="srv-dev">Сервер разработчиков #3 (RU-Dev)</option>
              </select>
            </div>

            {mode === 'login' ? (
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Логин или Email
                </label>
                <input
                  type="text"
                  required
                  value={loginInput}
                  onChange={(e) => setLoginInput(e.target.value)}
                  placeholder="Ваш логин или email"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 dark:focus:border-slate-500"
                />
              </div>
            ) : (
              <>
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 space-y-2.5">
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Аватарка и никнейм для мессенджера
                  </div>
                  <AvatarPicker
                    name={displayName || username || 'F'}
                    value={avatar}
                    onChange={setAvatar}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                      Никнейм
                    </label>
                    <input
                      type="text"
                      required
                      minLength={2}
                      maxLength={60}
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Придумайте никнейм"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 dark:focus:border-slate-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                      Логин (@username)
                    </label>
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="ivan_petrov"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 dark:focus:border-slate-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 dark:focus:border-slate-500"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                Пароль
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Минимум 4 символа"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 dark:focus:border-slate-500"
              />
            </div>

            {error && (
              <div className="px-3 py-2.5 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 text-xs text-red-700 dark:text-red-300 space-y-2">
                <div>{error}</div>
                {existingLoginHint && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setLoginInput(existingLoginHint);
                      setPassword('');
                      setError(null);
                      setExistingLoginHint(null);
                    }}
                    className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none"
                  >
                    Войти в @{existingLoginHint}
                  </button>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 text-sm font-medium rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors disabled:opacity-50 focus:outline-none"
            >
              {loading
                ? 'Подождите...'
                : mode === 'login'
                ? 'Войти'
                : 'Зарегистрироваться и открыть мессенджер'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
