import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  MessageSquare,
  Phone,
  Video,
  Send,
  Users,
  Lock,
  Maximize2,
  Edit3,
  Search,
  UserPlus,
  UserCheck,
  UserX,
  Check,
  X,
  RefreshCw,
  AlertCircle,
  Plus,
  Server,
  HardDrive,
  Link2,
  Smartphone,
  ExternalLink,
  Shuffle,
  ShieldCheck,
} from 'lucide-react';
import {
  ExternalChannelId,
  FriendRequestItem,
  MessengerBridgeBinding,
  MessengerCallRecord,
  MessengerContact,
  MessengerMessage,
  MessengerServer,
  UserProfile,
} from '../types/firas';
import { UserAvatar } from './UserAvatar';

interface MessengerPanelProps {
  variant?: 'home' | 'full';
  currentUser: UserProfile | null;
  connected: boolean;
  serverReady: boolean;
  contacts: MessengerContact[];
  friends: MessengerContact[];
  incomingRequests: FriendRequestItem[];
  outgoingRequests: FriendRequestItem[];
  servers: MessengerServer[];
  messages: MessengerMessage[];
  callLogs: MessengerCallRecord[];
  typingByRoom: Record<string, string[]>;
  messengerError?: string | null;
  onClearError?: () => void;
  onRefresh?: () => void;
  onSendMessage: (
    roomId: string,
    text: string,
    channels?: ExternalChannelId[],
    targetPhone?: string
  ) => Promise<boolean>;
  onUpdateBridges: (payload: {
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
  onRouletteNext?: (excludeUserId?: string) => Promise<{
    ok: boolean;
    partner?: MessengerContact | null;
    roomId?: string | null;
    message?: string;
    error?: string;
  }>;
  onProfileUpdated?: (user: UserProfile) => void;
  onSendTyping: (roomId: string, active: boolean) => void;
  onCreateServer: (input: {
    name: string;
    description?: string;
    region?: string;
    color?: string;
  }) => Promise<{ ok: boolean; server?: MessengerServer; error?: string }>;
  onSendFriendRequest: (targetUserId: string) => Promise<{ ok: boolean; error?: string }>;
  onRespondFriendRequest: (requestId: string, decision: 'accept' | 'decline') => Promise<boolean>;
  onRemoveFriend: (friendId: string) => Promise<boolean>;
  onSearchUsers: (query: string) => Promise<MessengerContact[]>;
  onStartCall: (contact: MessengerContact, callType: 'audio' | 'video') => void;
  onRequireRegister: () => void;
  onRequireLogin: () => void;
  onEditProfile: () => void;
  onExpandFullScreen?: () => void;
  onOpenCloud?: () => void;
  onClose?: () => void;
}

const makeDmRoomId = (idA: string, idB: string): string =>
  `dm:${[idA, idB].sort().join(':')}`;

export const MessengerPanel: React.FC<MessengerPanelProps> = ({
  variant = 'full',
  currentUser,
  connected,
  serverReady,
  contacts,
  friends,
  incomingRequests,
  outgoingRequests,
  servers,
  messages,
  callLogs,
  typingByRoom,
  messengerError,
  onClearError,
  onRefresh,
  onSendMessage,
  onUpdateBridges,
  onSendBridgeCode,
  onVerifyBridgeCode,
  onRouletteNext,
  onProfileUpdated,
  onSendTyping,
  onCreateServer,
  onSendFriendRequest,
  onRespondFriendRequest,
  onRemoveFriend,
  onSearchUsers,
  onStartCall,
  onRequireRegister,
  onRequireLogin,
  onEditProfile,
  onExpandFullScreen,
  onOpenCloud,
  onClose,
}) => {
  const [sidebarTab, setSidebarTab] = useState<'chats' | 'friends' | 'add' | 'roulette'>('chats');
  const [mobilePane, setMobilePane] = useState<'list' | 'chat'>('chat');
  const [selectedRoomId, setSelectedRoomId] = useState<string>('general');
  const [showCreateServer, setShowCreateServer] = useState(false);
  const [newServerName, setNewServerName] = useState('');
  const [newServerRegion, setNewServerRegion] = useState('RU-Central');
  const [creatingServer, setCreatingServer] = useState(false);
  const [contactFilter, setContactFilter] = useState('');
  const [searchResults, setSearchResults] = useState<MessengerContact[] | null>(null);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [selectedChannels, setSelectedChannels] = useState<ExternalChannelId[]>(['firas']);
  const [targetPhoneOverride, setTargetPhoneOverride] = useState('');

  // 2-step Phone + Code Verification Bridge Binding Drawer (TG / WA / Viber / Chat-Roulette)
  const [showBridgePanel, setShowBridgePanel] = useState(false);
  const [editingPhoneBind, setEditingPhoneBind] = useState(false);
  const [bridgePhone, setBridgePhone] = useState('');
  const [tgConnected, setTgConnected] = useState(true);
  const [tgHandle, setTgHandle] = useState('');
  const [tgChatId, setTgChatId] = useState('');
  const [waConnected, setWaConnected] = useState(true);
  const [waPhone, setWaPhone] = useState('');
  const [vbConnected, setVbConnected] = useState(true);
  const [vbPhone, setVbPhone] = useState('');
  const [rouletteEnabled, setRouletteEnabled] = useState(true);
  const [savingBridges, setSavingBridges] = useState(false);
  const [bridgeChallengeId, setBridgeChallengeId] = useState<string | null>(null);
  const [bridgeVerifyCode, setBridgeVerifyCode] = useState('');
  const [sendingBridgeCode, setSendingBridgeCode] = useState(false);
  const [verifyingBridgeCode, setVerifyingBridgeCode] = useState(false);
  const [bridgeNotice, setBridgeNotice] = useState<string | null>(null);
  const [bridgeError, setBridgeError] = useState<string | null>(null);

  // Chat-Roulette state
  const [roulettePartner, setRoulettePartner] = useState<MessengerContact | null>(null);
  const [rouletteLoading, setRouletteLoading] = useState(false);
  const [rouletteMessage, setRouletteMessage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const b = currentUser?.bridges;
    setBridgePhone(b?.phone || '');
    setTgConnected(b ? Boolean(b.telegram?.connected ?? true) : true);
    setTgHandle(b?.telegram?.handle || '');
    setTgChatId(b?.telegram?.chatId || '');
    setWaConnected(b ? Boolean(b.whatsapp?.connected ?? true) : true);
    setWaPhone(b?.whatsapp?.phone || b?.phone || '');
    setVbConnected(b ? Boolean(b.viber?.connected ?? true) : true);
    setVbPhone(b?.viber?.phone || b?.phone || '');
    setRouletteEnabled(b ? Boolean(b.chatRoulette?.connected ?? true) : true);
  }, [currentUser]);

  const selectedServer = useMemo(() => {
    if (selectedRoomId === 'general') {
      return servers.find((s) => s.roomId === 'general') || null;
    }
    if (selectedRoomId.startsWith('server:')) {
      return servers.find((s) => s.roomId === selectedRoomId) || null;
    }
    return null;
  }, [selectedRoomId, servers]);

  const selectedContact = useMemo(() => {
    if (!currentUser || selectedRoomId === 'general' || selectedRoomId.startsWith('server:')) {
      return null;
    }
    return (
      contacts.find((c) => makeDmRoomId(currentUser.id, c.id) === selectedRoomId) ||
      (roulettePartner && makeDmRoomId(currentUser.id, roulettePartner.id) === selectedRoomId
        ? roulettePartner
        : null)
    );
  }, [contacts, currentUser, roulettePartner, selectedRoomId]);

  const handleCreateServerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newServerName.trim() || creatingServer) return;
    setCreatingServer(true);
    const res = await onCreateServer({
      name: newServerName.trim(),
      region: newServerRegion,
      color: 'indigo',
    });
    setCreatingServer(false);
    if (res.ok && res.server) {
      setSelectedRoomId(res.server.roomId);
      setSidebarTab('chats');
      setNewServerName('');
      setShowCreateServer(false);
    }
  };

  const roomMessages = useMemo(
    () => messages.filter((m) => m.roomId === selectedRoomId),
    [messages, selectedRoomId]
  );

  // When searching in the "Добавить в друзья" tab, query the server cleanly
  useEffect(() => {
    if (!currentUser || sidebarTab !== 'add') {
      setSearchResults(null);
      return;
    }
    let cancelled = false;
    setSearchingUsers(true);
    const timer = window.setTimeout(async () => {
      const users = await onSearchUsers(contactFilter.trim());
      if (!cancelled) {
        setSearchResults(users);
        setSearchingUsers(false);
      }
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [contactFilter, currentUser, onSearchUsers, sidebarTab, contacts]);

  const filteredContacts = useMemo(() => {
    const q = contactFilter.trim().toLowerCase();
    const base = sidebarTab === 'friends' ? friends : contacts;
    if (!q) return base;
    return base.filter(
      (c) =>
        c.displayName.toLowerCase().includes(q) ||
        c.username.toLowerCase().includes(q)
    );
  }, [contacts, friends, contactFilter, sidebarTab]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [roomMessages.length, selectedRoomId]);

  const handleDraftChange = (val: string) => {
    setDraft(val);
    onSendTyping(selectedRoomId, Boolean(val.trim()));
    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = window.setTimeout(() => {
      onSendTyping(selectedRoomId, false);
    }, 1800);
  };

  const toggleChannel = (ch: ExternalChannelId) => {
    if (ch === 'firas') return;
    setSelectedChannels((prev) =>
      prev.includes(ch) ? prev.filter((item) => item !== ch) : [...prev, ch]
    );
  };

  const handleSelectAllConnectedChannels = () => {
    const connectedList: ExternalChannelId[] = ['firas'];
    if (currentUser?.bridges?.telegram?.connected) connectedList.push('telegram');
    if (currentUser?.bridges?.whatsapp?.connected) connectedList.push('whatsapp');
    if (currentUser?.bridges?.viber?.connected) connectedList.push('viber');
    setSelectedChannels(connectedList);
  };

  const handleSendBridgeVerificationCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setBridgeError(null);
    setBridgeNotice(null);

    if (!onSendBridgeCode) {
      setSavingBridges(true);
      const res = await onUpdateBridges({
        phone: bridgePhone.trim(),
        telegramConnected: tgConnected,
        telegramHandle: tgHandle.trim(),
        telegramChatId: tgChatId.trim(),
        whatsappConnected: waConnected,
        whatsappPhone: waPhone.trim() || bridgePhone.trim(),
        viberConnected: vbConnected,
        viberPhone: vbPhone.trim() || bridgePhone.trim(),
        chatRouletteConnected: rouletteEnabled,
      });
      setSavingBridges(false);
      if (res.ok) {
        if (res.user && onProfileUpdated) onProfileUpdated(res.user);
        setBridgeNotice('Номер и привязка мессенджеров сохранены.');
      }
      return;
    }

    setSendingBridgeCode(true);
    const res = await onSendBridgeCode({
      phone: bridgePhone.trim(),
      telegramHandle: tgHandle.trim(),
      telegramChatId: tgChatId.trim(),
      telegram: tgConnected,
      whatsapp: waConnected,
      viber: vbConnected,
      chatRoulette: rouletteEnabled,
    });
    setSendingBridgeCode(false);

    if (!res.ok || !res.challengeId) {
      setBridgeError(res.error || 'Не удалось отправить код.');
      return;
    }

    setBridgeChallengeId(res.challengeId);
    setBridgeVerifyCode('');
    setBridgeNotice(
      res.deliveryMode === 'in-app' && res.demoCode
        ? `${res.message || 'Код отправлен.'} (код: ${res.demoCode})`
        : res.message || 'Код отправлен. Введите его ниже.'
    );
  };

  const handleConfirmBridgeCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onVerifyBridgeCode || !bridgeVerifyCode.trim()) return;
    setBridgeError(null);
    setVerifyingBridgeCode(true);
    const res = await onVerifyBridgeCode({
      challengeId: bridgeChallengeId || undefined,
      code: bridgeVerifyCode.trim(),
    });
    setVerifyingBridgeCode(false);

    if (!res.ok) {
      setBridgeError(res.error || 'Неверный код подтверждения.');
      return;
    }

    setBridgeChallengeId(null);
    setBridgeVerifyCode('');
    setEditingPhoneBind(false);
    if (res.user && onProfileUpdated) {
      onProfileUpdated(res.user);
    }
    setBridgeNotice(
      'Номер подтверждён! Теперь работают Чат-рулетка, WhatsApp, Viber и Telegram.'
    );
  };

  const handleFindRoulettePartner = async () => {
    if (!onRouletteNext || rouletteLoading) return;
    setRouletteLoading(true);
    setRouletteMessage(null);
    const res = await onRouletteNext(roulettePartner?.id);
    setRouletteLoading(false);

    if (!res.ok) {
      setRouletteMessage(res.error || 'Не удалось запустить Чат-рулетку.');
      return;
    }

    if (res.partner && res.roomId) {
      setRoulettePartner(res.partner);
      setSelectedRoomId(res.roomId);
      setRouletteMessage(`Собеседник найден: ${res.partner.displayName}`);
    } else {
      setRoulettePartner(null);
      setRouletteMessage(
        res.message || 'Сейчас нет других активных участников для Чат-рулетки.'
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || sending) return;
    const text = draft.trim();
    setSending(true);
    setDraft('');
    onSendTyping(selectedRoomId, false);
    const ok = await onSendMessage(
      selectedRoomId,
      text,
      selectedChannels,
      targetPhoneOverride.trim() || undefined
    );
    if (!ok) {
      setDraft(text);
    }
    setSending(false);
  };

  const handleAddFriend = async (userId: string) => {
    setBusyUserId(userId);
    await onSendFriendRequest(userId);
    setBusyUserId(null);
  };

  const handleRespondFriend = async (requestId: string, decision: 'accept' | 'decline') => {
    setBusyUserId(requestId);
    await onRespondFriendRequest(requestId, decision);
    setBusyUserId(null);
  };

  const handleRemoveFriend = async (friendId: string) => {
    setBusyUserId(friendId);
    await onRemoveFriend(friendId);
    setBusyUserId(null);
  };

  const onlineCount = contacts.filter((c) => c.online).length;
  const activeTypers = typingByRoom[selectedRoomId] || [];
  const directoryUsers = searchResults ?? contacts;

  // Mandatory Registration Gate when user is not registered / logged in
  if (!currentUser) {
    return (
      <section
        aria-label="Мессенджер Firas"
        className={
          variant === 'full'
            ? 'h-screen supports-[height:100dvh]:h-dvh w-full flex flex-col bg-slate-50 dark:bg-slate-950'
            : 'w-full max-w-4xl mx-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-xs'
        }
      >
        {variant === 'full' && (
          <div className="h-14 px-4 sm:px-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 flex items-center justify-center">
                <MessageSquare className="w-4 h-4" />
              </div>
              <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Мессенджер Firas
              </span>
            </div>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Закрыть мессенджер"
                title="Закрыть мессенджер и вернуться в браузер"
                className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        )}

        <div
          className={
            variant === 'full'
              ? 'flex-1 flex items-center justify-center p-4 sm:p-8'
              : ''
          }
        >
          <div
            className={
              variant === 'full'
                ? 'w-full max-w-xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-xs flex flex-col gap-6'
                : 'flex flex-col md:flex-row md:items-center justify-between gap-6'
            }
          >
            <div className="space-y-2.5 max-w-xl">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200">
                <Lock className="w-3.5 h-3.5" />
                <span>Обязательная регистрация</span>
              </div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                Мессенджер Firas — общий чат, друзья и звонки
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Чтобы писать в общий чат, добавлять друзей, переписываться и звонить,
                зарегистрируйтесь: придумайте никнейм и выберите свою аватарку.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 shrink-0">
              <button
                type="button"
                onClick={onRequireRegister}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors whitespace-nowrap focus:outline-none"
              >
                <UserPlus className="w-4 h-4" />
                <span>Зарегистрироваться</span>
              </button>
              <button
                type="button"
                onClick={onRequireLogin}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap focus:outline-none"
              >
                <span>Войти в аккаунт</span>
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label="Мессенджер Firas"
      className={
        variant === 'full'
          ? 'h-screen supports-[height:100dvh]:h-dvh w-full flex flex-col bg-white dark:bg-slate-900 overflow-hidden'
          : 'w-full max-w-5xl mx-auto h-[500px] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden flex flex-col'
      }
    >
      {/* Top Full-Screen Messenger Bar with Общий чат button & Close (X) */}
      <div className="h-14 px-3 sm:px-5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 flex items-center justify-center shrink-0">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
              Мессенджер Firas
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              <span
                className={`w-2 h-2 rounded-full ${
                  connected
                    ? 'bg-emerald-500'
                    : serverReady
                    ? 'bg-amber-500'
                    : 'bg-slate-400'
                }`}
              />
              <span className="truncate">
                {connected
                  ? 'Сервер подключён'
                  : serverReady
                  ? 'Сервер активен (синхронизация)'
                  : 'Подключение к серверу...'}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Switch: Общий чат / Друзья / Добавить в друзья */}
        <div className="hidden md:flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
          <button
            type="button"
            onClick={() => {
              setSelectedRoomId('general');
              setSidebarTab('chats');
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors focus:outline-none ${
              selectedRoomId === 'general' && sidebarTab === 'chats'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Общий чат</span>
          </button>

          <button
            type="button"
            onClick={() => setSidebarTab('friends')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors focus:outline-none ${
              sidebarTab === 'friends'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Друзья ({friends.length})</span>
            {incomingRequests.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-emerald-600 text-white text-[10px] font-semibold">
                +{incomingRequests.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setSidebarTab('add')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors focus:outline-none ${
              sidebarTab === 'add'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Добавить в друзья</span>
          </button>

          <button
            type="button"
            onClick={() => setSidebarTab('roulette')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors focus:outline-none ${
              sidebarTab === 'roulette'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <Shuffle className="w-3.5 h-3.5" />
            <span>Чат-рулетка</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowBridgePanel((v) => !v)}
            title="Привязка номера по коду для Чат-рулетки, WhatsApp, Viber и Telegram"
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors focus:outline-none ${
              showBridgePanel || currentUser.bridges?.phoneVerified
                ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
                : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {currentUser.bridges?.phoneVerified ? (
              <ShieldCheck className="w-3.5 h-3.5" />
            ) : (
              <Link2 className="w-3.5 h-3.5" />
            )}
            <span className="hidden md:inline">
              {currentUser.bridges?.phoneVerified
                ? 'Номер подтверждён'
                : 'Привязка номера'}
            </span>
          </button>

          {onOpenCloud && (
            <button
              type="button"
              onClick={onOpenCloud}
              title="Облачное хранилище 1 ТБ · TeraBox"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-xs font-medium focus:outline-none"
            >
              <HardDrive className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Облако 1 ТБ</span>
            </button>
          )}

          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              title="Обновить сообщения и друзей"
              className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}

          {variant === 'home' && onExpandFullScreen && (
            <button
              type="button"
              onClick={onExpandFullScreen}
              title="Открыть мессенджер на весь экран"
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Закрыть мессенджер"
              title="Закрыть мессенджер"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none"
            >
              <X className="w-4 h-4" />
              <span className="hidden sm:inline text-xs font-medium">Закрыть</span>
            </button>
          )}
        </div>
      </div>

      {/* Multi-Server Strip with + Additional Server button */}
      <div className="px-3 sm:px-5 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 flex items-center gap-1.5 overflow-x-auto shrink-0">
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 dark:text-slate-500 mr-1 shrink-0">
          <Server className="w-3.5 h-3.5" />
          <span>Серверы:</span>
        </span>
        {(servers.length > 0
          ? servers
          : [
              {
                id: 'srv-main',
                name: 'Основной сервер Firas',
                description: 'Общий чат',
                roomId: 'general',
                region: 'RU-Central',
                color: 'slate',
                createdBy: 'system',
                createdAt: '',
              },
            ]
        ).map((srv) => {
          const active = selectedRoomId === srv.roomId;
          return (
            <button
              key={srv.id}
              type="button"
              onClick={() => {
                setSelectedRoomId(srv.roomId);
                setSidebarTab('chats');
                setMobilePane('chat');
              }}
              title={srv.description}
              className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 focus:outline-none ${
                active
                  ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <span>{srv.name}</span>
              <span className="text-[10px] opacity-65 font-mono">{srv.region}</span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setShowCreateServer((v) => !v)}
          aria-label="Добавить дополнительный сервер"
          title="Создать дополнительный сервер (+)"
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg border border-dashed border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 focus:outline-none"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Сервер</span>
        </button>
      </div>

      {showBridgePanel && (
        <div className="px-4 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 space-y-3 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-slate-100">
              <Smartphone className="w-4 h-4" />
              <span>
                Привязка номера по коду (Чат-рулетка, WhatsApp, Viber и Telegram)
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowBridgePanel(false)}
              className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 focus:outline-none"
            >
              Свернуть
            </button>
          </div>

          {currentUser.bridges?.phoneVerified && !editingPhoneBind && !bridgeChallengeId ? (
            <div className="p-3 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/80 dark:bg-emerald-950/30 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-xs text-emerald-900 dark:text-emerald-200">
                <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <div className="font-semibold">
                    Номер подтверждён: {currentUser.bridges.phone}
                  </div>
                  <div className="text-[11px] opacity-85">
                    Активно:{' '}
                    {[
                      currentUser.bridges.chatRoulette?.connected ? 'Чат-рулетка' : null,
                      currentUser.bridges.whatsapp?.connected ? 'WhatsApp' : null,
                      currentUser.bridges.viber?.connected ? 'Viber' : null,
                      currentUser.bridges.telegram?.connected ? 'Telegram' : null,
                    ]
                      .filter(Boolean)
                      .join(' · ') || 'Все сервисы'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingPhoneBind(true);
                  setBridgeError(null);
                  setBridgeNotice(null);
                }}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-emerald-300 dark:border-emerald-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none"
              >
                Изменить номер
              </button>
            </div>
          ) : !bridgeChallengeId ? (
            <form onSubmit={handleSendBridgeVerificationCode} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
                <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-1.5">
                  <label className="block font-medium text-slate-700 dark:text-slate-200">
                    Номер телефона
                  </label>
                  <input
                    type="tel"
                    required
                    value={bridgePhone}
                    onChange={(e) => setBridgePhone(e.target.value)}
                    placeholder="+79991234567"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>

                <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-1.5">
                  <label className="block font-medium text-slate-700 dark:text-slate-200">
                    Telegram @username (необязательно)
                  </label>
                  <input
                    type="text"
                    value={tgHandle}
                    onChange={(e) => setTgHandle(e.target.value)}
                    placeholder="@username"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>

                <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-1.5">
                  <div className="font-medium text-slate-700 dark:text-slate-200">
                    Подключить после кода
                  </div>
                  <div className="flex flex-wrap items-center gap-3 pt-1 text-slate-700 dark:text-slate-300">
                    <label className="inline-flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rouletteEnabled}
                        onChange={(e) => setRouletteEnabled(e.target.checked)}
                        className="accent-slate-900 dark:accent-slate-100"
                      />
                      <span>Чат-рулетка</span>
                    </label>
                    <label className="inline-flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={waConnected}
                        onChange={(e) => setWaConnected(e.target.checked)}
                        className="accent-slate-900 dark:accent-slate-100"
                      />
                      <span>WhatsApp</span>
                    </label>
                    <label className="inline-flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={vbConnected}
                        onChange={(e) => setVbConnected(e.target.checked)}
                        className="accent-slate-900 dark:accent-slate-100"
                      />
                      <span>Viber</span>
                    </label>
                    <label className="inline-flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={tgConnected}
                        onChange={(e) => setTgConnected(e.target.checked)}
                        className="accent-slate-900 dark:accent-slate-100"
                      />
                      <span>Telegram</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Введите номер, получите 6-значный код и подтвердите привязку.
                </span>
                <div className="flex items-center gap-2">
                  {editingPhoneBind && (
                    <button
                      type="button"
                      onClick={() => setEditingPhoneBind(false)}
                      className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 focus:outline-none"
                    >
                      Отмена
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={sendingBridgeCode || savingBridges || !bridgePhone.trim()}
                    className="px-4 py-1.5 text-xs font-medium rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 disabled:opacity-50 focus:outline-none"
                  >
                    {sendingBridgeCode ? 'Отправка кода...' : 'Прислать код'}
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <form onSubmit={handleConfirmBridgeCode} className="space-y-3">
              {bridgeNotice && (
                <div className="px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-xs text-emerald-900 dark:text-emerald-200">
                  {bridgeNotice}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  value={bridgeVerifyCode}
                  onChange={(e) => setBridgeVerifyCode(e.target.value)}
                  placeholder="Введите 6-значный код"
                  className="flex-1 min-w-[180px] px-3 py-2 text-sm font-mono tracking-wider rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={verifyingBridgeCode || !bridgeVerifyCode.trim()}
                  className="px-4 py-2 text-xs font-medium rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 disabled:opacity-50 focus:outline-none"
                >
                  {verifyingBridgeCode ? 'Проверка...' : 'Подтвердить'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBridgeChallengeId(null);
                    setBridgeVerifyCode('');
                    setBridgeError(null);
                  }}
                  className="px-3 py-2 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 focus:outline-none"
                >
                  Другой номер
                </button>
              </div>
            </form>
          )}

          {bridgeError && (
            <div className="text-xs text-red-600 dark:text-red-400">{bridgeError}</div>
          )}
          {!bridgeChallengeId && bridgeNotice && !bridgeError && (
            <div className="text-xs text-emerald-700 dark:text-emerald-400">{bridgeNotice}</div>
          )}
        </div>
      )}

      {showCreateServer && (
        <form
          onSubmit={handleCreateServerSubmit}
          className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap items-center gap-2 shrink-0"
        >
          <input
            type="text"
            required
            minLength={2}
            value={newServerName}
            onChange={(e) => setNewServerName(e.target.value)}
            placeholder="Название нового сервера (напр. Игровой или VIP)..."
            className="flex-1 min-w-[200px] px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none"
          />
          <select
            aria-label="Регион сервера"
            value={newServerRegion}
            onChange={(e) => setNewServerRegion(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-200 focus:outline-none"
          >
            <option value="RU-Central">RU-Central</option>
            <option value="EU-North">EU-North</option>
            <option value="US-East">US-East</option>
          </select>
          <button
            type="submit"
            disabled={creatingServer || newServerName.trim().length < 2}
            className="px-3.5 py-1.5 text-xs font-medium rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 disabled:opacity-40 focus:outline-none"
          >
            {creatingServer ? 'Создание...' : 'Создать сервер'}
          </button>
          <button
            type="button"
            onClick={() => setShowCreateServer(false)}
            className="px-2.5 py-1.5 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 focus:outline-none"
          >
            Отмена
          </button>
        </form>
      )}

      {messengerError && (
        <div className="px-4 py-2 bg-red-50 dark:bg-red-950/40 border-b border-red-200 dark:border-red-900/60 flex items-center justify-between gap-3 text-xs text-red-700 dark:text-red-300 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="truncate">{messengerError}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                className="px-2.5 py-1 rounded-md bg-white dark:bg-slate-900 border border-red-200 dark:border-red-800 font-medium hover:bg-red-100 dark:hover:bg-red-900/30 focus:outline-none"
              >
                Повторить
              </button>
            )}
            {onClearError && (
              <button
                type="button"
                onClick={onClearError}
                aria-label="Скрыть ошибку"
                className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/40 focus:outline-none"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Split Area: Left Contacts/Friends Sidebar + Right Chat Window */}
      <div className="flex-1 min-h-0 flex flex-col md:flex-row">
        {/* Left Sidebar */}
        <aside
          className={`${
            mobilePane === 'list' ? 'flex flex-1' : 'hidden'
          } md:flex md:flex-none w-full md:w-80 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 flex-col bg-slate-50/70 dark:bg-slate-950/40 shrink-0 min-h-0`}
        >
          {/* Current User Profile Bar */}
          <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 bg-white dark:bg-slate-900">
            <div className="flex items-center gap-2.5 min-w-0">
              <UserAvatar
                name={currentUser.displayName}
                avatar={currentUser.avatar}
                size="md"
                online={connected}
              />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {currentUser.displayName}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  @{currentUser.username} · {connected ? 'В сети' : 'Онлайн'}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onEditProfile}
              title="Изменить никнейм и аватарку"
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none shrink-0"
            >
              <Edit3 className="w-4 h-4" />
            </button>
          </div>

          {/* Mobile/Compact Tabs */}
          <div className="grid grid-cols-4 gap-1 p-2 border-b border-slate-200/70 dark:border-slate-800/70 md:hidden">
            <button
              type="button"
              onClick={() => setSidebarTab('chats')}
              className={`py-1.5 text-[11px] font-medium rounded-lg transition-colors focus:outline-none ${
                sidebarTab === 'chats'
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                  : 'text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900'
              }`}
            >
              Чаты
            </button>
            <button
              type="button"
              onClick={() => setSidebarTab('friends')}
              className={`py-1.5 text-[11px] font-medium rounded-lg transition-colors focus:outline-none ${
                sidebarTab === 'friends'
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                  : 'text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900'
              }`}
            >
              Друзья ({friends.length})
              {incomingRequests.length > 0 ? ` +${incomingRequests.length}` : ''}
            </button>
            <button
              type="button"
              onClick={() => setSidebarTab('add')}
              className={`py-1.5 text-[11px] font-medium rounded-lg transition-colors focus:outline-none ${
                sidebarTab === 'add'
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                  : 'text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900'
              }`}
            >
              + Друзья
            </button>
            <button
              type="button"
              onClick={() => setSidebarTab('roulette')}
              className={`py-1.5 text-[11px] font-medium rounded-lg transition-colors focus:outline-none ${
                sidebarTab === 'roulette'
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                  : 'text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900'
              }`}
            >
              Рулетка
            </button>
          </div>

          {/* Search Input */}
          <div className="p-2.5 border-b border-slate-200/70 dark:border-slate-800/70">
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <input
                type="text"
                value={contactFilter}
                onChange={(e) => setContactFilter(e.target.value)}
                placeholder={
                  sidebarTab === 'add'
                    ? 'Поиск по никнейму или @логину...'
                    : 'Найти чат или друга...'
                }
                className="w-full bg-transparent text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
              />
            </div>
          </div>

          {/* Sidebar Body */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {/* Always show General Chat button in Chats & Friends */}
            {(sidebarTab === 'chats' || sidebarTab === 'friends') && (
              <button
                type="button"
                onClick={() => {
                  setSelectedRoomId('general');
                  setMobilePane('chat');
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-colors focus:outline-none ${
                  selectedRoomId === 'general'
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                    : 'hover:bg-slate-200/60 dark:hover:bg-slate-800/60 text-slate-800 dark:text-slate-200'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                    selectedRoomId === 'general'
                      ? 'bg-white/15 dark:bg-slate-900/15'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  <Users className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold truncate">Общий чат Firas</div>
                  <div
                    className={`text-[11px] truncate ${
                      selectedRoomId === 'general'
                        ? 'text-slate-300 dark:text-slate-600'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    Все участники · Онлайн: {onlineCount + 1}
                  </div>
                </div>
              </button>
            )}

            {/* Incoming Friend Requests */}
            {incomingRequests.length > 0 && sidebarTab !== 'chats' && (
              <div className="space-y-1.5 pt-1">
                <div className="px-2 text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  Входящие заявки ({incomingRequests.length})
                </div>
                {incomingRequests.map((reqItem) => (
                  <div
                    key={reqItem.id}
                    className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <UserAvatar
                        name={reqItem.user.displayName}
                        avatar={reqItem.user.avatar}
                        size="sm"
                        online={reqItem.user.online}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {reqItem.user.displayName}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          @{reqItem.user.username}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={busyUserId === reqItem.id}
                        onClick={() => handleRespondFriend(reqItem.id, 'accept')}
                        className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 text-[11px] font-medium rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 disabled:opacity-50 focus:outline-none"
                      >
                        <Check className="w-3 h-3" />
                        <span>Принять</span>
                      </button>
                      <button
                        type="button"
                        disabled={busyUserId === reqItem.id}
                        onClick={() => handleRespondFriend(reqItem.id, 'decline')}
                        className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 text-[11px] font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 focus:outline-none"
                      >
                        <X className="w-3 h-3" />
                        <span>Отклонить</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* CHAT-ROULETTE TAB */}
            {sidebarTab === 'roulette' ? (
              <div className="space-y-3 p-1">
                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-slate-100">
                    <Shuffle className="w-4 h-4" />
                    <span>Чат-рулетка Firas</span>
                  </div>

                  {!currentUser.bridges?.phoneVerified ? (
                    <div className="space-y-2.5">
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        Чтобы Чат-рулетка, WhatsApp и Viber работали, привяжите и подтвердите номер телефона по коду.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setShowBridgePanel(true);
                          setEditingPhoneBind(true);
                        }}
                        className="w-full py-2 text-xs font-medium rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 focus:outline-none"
                      >
                        Привязать номер по коду
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        Номер {currentUser.bridges.phone} подтверждён. Нажмите кнопку ниже, чтобы подобрать случайного собеседника для чата или видеозвонка.
                      </p>
                      <button
                        type="button"
                        disabled={rouletteLoading}
                        onClick={handleFindRoulettePartner}
                        className="w-full inline-flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 disabled:opacity-50 focus:outline-none"
                      >
                        <Shuffle className="w-3.5 h-3.5" />
                        <span>
                          {rouletteLoading
                            ? 'Поиск собеседника...'
                            : roulettePartner
                            ? 'Следующий собеседник'
                            : 'Найти собеседника'}
                        </span>
                      </button>

                      {rouletteMessage && (
                        <div className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                          {rouletteMessage}
                        </div>
                      )}

                      {roulettePartner && (
                        <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <UserAvatar
                              name={roulettePartner.displayName}
                              avatar={roulettePartner.avatar}
                              size="sm"
                              online={roulettePartner.online}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                                {roulettePartner.displayName}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                @{roulettePartner.username} · {roulettePartner.online ? 'в сети' : 'активен'}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => onStartCall(roulettePartner, 'audio')}
                              className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 text-[11px] font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none"
                            >
                              <Phone className="w-3 h-3" />
                              <span>Звонок</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onStartCall(roulettePartner, 'video')}
                              className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 text-[11px] font-medium rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 focus:outline-none"
                            >
                              <Video className="w-3 h-3" />
                              <span>Видео</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : sidebarTab === 'add' ? (
              <div className="space-y-1.5">
                <div className="px-2 pt-1 text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Люди в Firas ({directoryUsers.length})
                </div>

                {searchingUsers ? (
                  <div className="px-3 py-4 text-xs text-slate-500 dark:text-slate-400">
                    Поиск пользователей...
                  </div>
                ) : directoryUsers.length === 0 ? (
                  <div className="px-3 py-4 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Других зарегистрированных пользователей пока нет. Зарегистрируйте второй
                    аккаунт, чтобы добавить его в друзья.
                  </div>
                ) : (
                  directoryUsers.map((person) => {
                    const status = person.friendshipStatus || 'none';
                    return (
                      <div
                        key={person.id}
                        className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <UserAvatar
                            name={person.displayName}
                            avatar={person.avatar}
                            size="sm"
                            online={person.online}
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                              {person.displayName}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                              @{person.username} · {person.online ? 'в сети' : 'офлайн'}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {status === 'friends' ? (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedRoomId(makeDmRoomId(currentUser.id, person.id));
                                setSidebarTab('chats');
                                setMobilePane('chat');
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 focus:outline-none"
                            >
                              <MessageSquare className="w-3 h-3" />
                              <span>Чат</span>
                            </button>
                          ) : status === 'outgoing' ? (
                            <span className="px-2 py-1 text-[11px] font-medium rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                              Отправлена
                            </span>
                          ) : status === 'incoming' && person.friendRequestId ? (
                            <button
                              type="button"
                              disabled={busyUserId === person.friendRequestId}
                              onClick={() =>
                                handleRespondFriend(person.friendRequestId!, 'accept')
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 focus:outline-none"
                            >
                              <Check className="w-3 h-3" />
                              <span>Принять</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={busyUserId === person.id}
                              onClick={() => handleAddFriend(person.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 disabled:opacity-50 focus:outline-none"
                            >
                              <UserPlus className="w-3 h-3" />
                              <span>Добавить</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}

                {outgoingRequests.length > 0 && (
                  <div className="pt-2 space-y-1">
                    <div className="px-2 text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      Исходящие заявки ({outgoingRequests.length})
                    </div>
                    {outgoingRequests.map((reqItem) => (
                      <div
                        key={reqItem.id}
                        className="px-3 py-2 rounded-lg bg-slate-100/70 dark:bg-slate-900/60 text-xs text-slate-600 dark:text-slate-300 flex items-center justify-between"
                      >
                        <span className="truncate">{reqItem.user.displayName}</span>
                        <span className="text-[11px] text-slate-400">Ожидает ответа</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="px-2 pt-2 pb-1 flex items-center justify-between">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    {sidebarTab === 'friends'
                      ? `Друзья (${filteredContacts.length})`
                      : `Личные чаты (${filteredContacts.length})`}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSidebarTab('add')}
                    className="text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:underline focus:outline-none"
                  >
                    + Добавить друга
                  </button>
                </div>

                {filteredContacts.length === 0 ? (
                  <div className="px-3 py-4 text-xs text-slate-500 dark:text-slate-400 leading-relaxed space-y-2">
                    <p>
                      {sidebarTab === 'friends'
                        ? 'Список друзей пока пуст.'
                        : 'Других участников пока нет.'}
                    </p>
                    <button
                      type="button"
                      onClick={() => setSidebarTab('add')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-[11px] font-medium focus:outline-none"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Найти и добавить друзей</span>
                    </button>
                  </div>
                ) : (
                  filteredContacts.map((contact) => {
                    const dmId = makeDmRoomId(currentUser.id, contact.id);
                    const isSelected = selectedRoomId === dmId;
                    const lastMsg = [...messages]
                      .reverse()
                      .find((m) => m.roomId === dmId);

                    return (
                      <div
                        key={contact.id}
                        className={`group flex items-center gap-2 px-2.5 py-2 rounded-xl transition-colors ${
                          isSelected
                            ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                            : 'hover:bg-slate-200/60 dark:hover:bg-slate-800/60 text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedRoomId(dmId);
                            setMobilePane('chat');
                          }}
                          className="flex items-center gap-2.5 min-w-0 flex-1 text-left focus:outline-none"
                        >
                          <UserAvatar
                            name={contact.displayName}
                            avatar={contact.avatar}
                            size="sm"
                            online={contact.online}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-xs font-semibold truncate">
                                {contact.displayName}
                              </span>
                              {contact.isFriend && (
                                <UserCheck
                                  className={`w-3 h-3 shrink-0 ${
                                    isSelected
                                      ? 'text-emerald-300 dark:text-emerald-600'
                                      : 'text-emerald-600 dark:text-emerald-400'
                                  }`}
                                />
                              )}
                            </div>
                            <div
                              className={`text-[11px] truncate ${
                                isSelected
                                  ? 'text-slate-300 dark:text-slate-600'
                                  : 'text-slate-500 dark:text-slate-400'
                              }`}
                            >
                              {lastMsg
                                ? lastMsg.text
                                : `@${contact.username} · ${contact.online ? 'в сети' : 'офлайн'}`}
                            </div>
                          </div>
                        </button>

                        <div className="flex items-center gap-0.5 shrink-0">
                          {sidebarTab === 'friends' && (
                            <button
                              type="button"
                              disabled={busyUserId === contact.id}
                              onClick={() => handleRemoveFriend(contact.id)}
                              title="Удалить из друзей"
                              className={`p-1.5 rounded-lg transition-colors focus:outline-none ${
                                isSelected
                                  ? 'hover:bg-white/15 dark:hover:bg-slate-900/15'
                                  : 'text-slate-400 hover:text-red-600 hover:bg-slate-200 dark:hover:bg-slate-700'
                              }`}
                            >
                              <UserX className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onStartCall(contact, 'audio')}
                            title={`Позвонить ${contact.displayName}`}
                            className={`p-1.5 rounded-lg transition-colors focus:outline-none ${
                              isSelected
                                ? 'hover:bg-white/15 dark:hover:bg-slate-900/15'
                                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700'
                            }`}
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onStartCall(contact, 'video')}
                            title={`Видеозвонок ${contact.displayName}`}
                            className={`p-1.5 rounded-lg transition-colors focus:outline-none ${
                              isSelected
                                ? 'hover:bg-white/15 dark:hover:bg-slate-900/15'
                                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700'
                            }`}
                          >
                            <Video className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </>
            )}
          </div>
        </aside>

        {/* Right Chat Window */}
        <div
          className={`${
            mobilePane === 'chat' ? 'flex' : 'hidden'
          } md:flex flex-1 min-w-0 min-h-0 flex-col bg-white dark:bg-slate-900`}
        >
          {/* Chat Header */}
          <div className="px-3 sm:px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 sm:gap-3 shrink-0">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <button
                type="button"
                onClick={() => setMobilePane('list')}
                aria-label="К списку чатов и друзей"
                className="md:hidden p-2 -ml-1 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0 focus:outline-none"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              {selectedContact ? (
                <div className="flex items-center gap-2.5 min-w-0">
                <UserAvatar
                  name={selectedContact.displayName}
                  avatar={selectedContact.avatar}
                  size="sm"
                  online={selectedContact.online}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {selectedContact.displayName}
                    </span>
                    {selectedContact.isFriend && (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-medium">
                        Друг
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    @{selectedContact.username} ·{' '}
                    {selectedContact.online ? 'в сети' : 'не в сети'}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                  {selectedServer && selectedServer.roomId !== 'general' ? (
                    <Server className="w-4 h-4 text-slate-700 dark:text-slate-200" />
                  ) : (
                    <Users className="w-4 h-4 text-slate-700 dark:text-slate-200" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {selectedServer ? selectedServer.name : 'Общий чат Firas'}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {selectedServer
                      ? `${selectedServer.description} · ${selectedServer.region}`
                      : 'Общая комната всех зарегистрированных участников'}
                  </div>
                </div>
              </div>
            )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {selectedContact && !selectedContact.isFriend && selectedContact.friendshipStatus === 'none' && (
                <button
                  type="button"
                  disabled={busyUserId === selectedContact.id}
                  onClick={() => handleAddFriend(selectedContact.id)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">В друзья</span>
                </button>
              )}

              {selectedContact && (
                <>
                  <button
                    type="button"
                    onClick={() => onStartCall(selectedContact, 'audio')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Звонок</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onStartCall(selectedContact, 'video')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors focus:outline-none"
                  >
                    <Video className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Видео</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50 dark:bg-slate-950/30">
            {roomMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-6 py-8 space-y-2">
                <MessageSquare className="w-7 h-7 text-slate-300 dark:text-slate-700" />
                <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Сообщений пока нет
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                  {selectedContact
                    ? `Напишите ${selectedContact.displayName} — сообщение мгновенно доставится и сохранится на сервере.`
                    : 'Напишите первое сообщение в общий чат Firas.'}
                </p>
              </div>
            ) : (
              roomMessages.map((msg) => {
                const isMine = msg.senderId === currentUser.id;
                return (
                  <div
                    key={msg.id}
                    className={`flex items-end gap-2 ${isMine ? 'justify-end' : 'justify-start'}`}
                  >
                    {!isMine && (
                      <UserAvatar
                        name={msg.senderName}
                        avatar={msg.senderAvatar}
                        size="xs"
                      />
                    )}
                    <div
                      className={`max-w-[78%] rounded-2xl px-3.5 py-2 space-y-1 ${
                        isMine
                          ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 rounded-br-sm'
                          : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-bl-sm'
                      }`}
                    >
                      {!isMine && (
                        <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                          {msg.senderName}
                        </div>
                      )}
                      <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                        {msg.text}
                      </div>
                      {msg.bridgeResults && msg.bridgeResults.length > 1 && (
                        <div
                          className={`pt-1.5 mt-1 border-t text-[10px] flex flex-wrap items-center gap-1.5 ${
                            isMine
                              ? 'border-white/15 dark:border-slate-900/15 text-slate-200 dark:text-slate-700'
                              : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {msg.bridgeResults
                            .filter((r) => r.channel !== 'firas')
                            .map((r) => (
                              <span key={r.channel} className="inline-flex items-center gap-1">
                                <span>{r.detail}</span>
                                {r.launchUrl && (
                                  <a
                                    href={r.launchUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-0.5 underline font-medium"
                                  >
                                    <span>Открыть</span>
                                    <ExternalLink className="w-2.5 h-2.5" />
                                  </a>
                                )}
                              </span>
                            ))}
                        </div>
                      )}
                      <div
                        className={`text-[10px] text-right font-mono ${
                          isMine
                            ? 'text-slate-300 dark:text-slate-600'
                            : 'text-slate-400 dark:text-slate-500'
                        }`}
                      >
                        {new Date(msg.createdAt).toLocaleTimeString('ru-RU', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {selectedContact &&
              callLogs
                .filter(
                  (c) =>
                    (c.callerId === currentUser.id && c.calleeId === selectedContact.id) ||
                    (c.calleeId === currentUser.id && c.callerId === selectedContact.id)
                )
                .slice(-3)
                .map((c) => (
                  <div
                    key={c.id}
                    className="flex justify-center"
                  >
                    <span className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
                      {c.callType === 'video' ? 'Видеозвонок' : 'Аудиозвонок'} ·{' '}
                      {c.status === 'rejected'
                        ? 'отклонён'
                        : c.status === 'missed'
                        ? 'без ответа'
                        : c.durationSeconds
                        ? `${c.durationSeconds} сек.`
                        : 'завершён'}
                    </span>
                  </div>
                ))}

            <div ref={messagesEndRef} />
          </div>

          {/* Typing Indicator */}
          {activeTypers.length > 0 && (
            <div className="px-4 py-1 text-[11px] text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
              {activeTypers.join(', ')} печатает...
            </div>
          )}

          {/* Cross-Messenger Send Target Selector & Message Input */}
          <form
            onSubmit={handleSubmit}
            className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2 shrink-0"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-slate-500 dark:text-slate-400">Отправить в:</span>
                {(
                  [
                    { id: 'firas', label: 'Firas', bound: true },
                    {
                      id: 'telegram',
                      label: 'Telegram',
                      bound: Boolean(currentUser.bridges?.telegram?.connected),
                    },
                    {
                      id: 'whatsapp',
                      label: 'WhatsApp',
                      bound: Boolean(currentUser.bridges?.whatsapp?.connected),
                    },
                    {
                      id: 'viber',
                      label: 'Viber',
                      bound: Boolean(currentUser.bridges?.viber?.connected),
                    },
                  ] as Array<{ id: ExternalChannelId; label: string; bound: boolean }>
                ).map((ch) => {
                  const active = selectedChannels.includes(ch.id);
                  return (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => toggleChannel(ch.id)}
                      title={
                        ch.bound
                          ? `Отправлять также в ${ch.label}`
                          : `${ch.label} (привяжите номер вверху для полного моста)`
                      }
                      className={`px-2 py-0.5 rounded-md border font-medium transition-colors focus:outline-none ${
                        active
                          ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      {ch.label}
                      {ch.id !== 'firas' && !ch.bound ? ' (мост)' : ''}
                    </button>
                  );
                })}
                {(currentUser.bridges?.telegram?.connected ||
                  currentUser.bridges?.whatsapp?.connected ||
                  currentUser.bridges?.viber?.connected) && (
                  <button
                    type="button"
                    onClick={handleSelectAllConnectedChannels}
                    className="px-2 py-0.5 rounded-md border border-dashed border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none"
                  >
                    Во все привязанные
                  </button>
                )}
              </div>

              {selectedChannels.some((c) => c === 'whatsapp' || c === 'viber') && (
                <input
                  type="tel"
                  value={targetPhoneOverride}
                  onChange={(e) => setTargetPhoneOverride(e.target.value)}
                  placeholder="Номер получателя (+7...)"
                  className="px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 w-40 focus:outline-none"
                />
              )}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={draft}
                onChange={(e) => handleDraftChange(e.target.value)}
                placeholder={
                  selectedContact
                    ? `Написать ${selectedContact.displayName}...`
                    : 'Написать в общий чат...'
                }
                className="flex-1 px-3.5 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 dark:focus:border-slate-500"
              />
              <button
                type="submit"
                disabled={!draft.trim() || sending}
                aria-label="Отправить сообщение"
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors disabled:opacity-40 focus:outline-none shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">
                  {sending ? 'Отправка...' : 'Отправить'}
                </span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
};
