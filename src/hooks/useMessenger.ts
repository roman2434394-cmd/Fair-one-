import { useCallback, useEffect, useRef, useState } from 'react';
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

export interface ActiveCallState {
  callId: string;
  peerId: string;
  peerName: string;
  peerAvatar?: string;
  callType: 'audio' | 'video';
  direction: 'outgoing' | 'incoming';
  status: 'ringing' | 'connecting' | 'connected';
  startedAt?: number;
}

export interface IncomingCallOffer {
  callId: string;
  fromUserId: string;
  fromUsername: string;
  fromDisplayName: string;
  fromAvatar?: string;
  callType: 'audio' | 'video';
  sdp: RTCSessionDescriptionInit;
}

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

async function parseJsonSafe<T>(resp: Response): Promise<T | null> {
  try {
    const text = await resp.text();
    if (!text) return null;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export function useMessenger(
  currentUser: UserProfile | null,
  authToken: string | null
) {
  const currentUserId = currentUser?.id ?? null;

  const [connected, setConnected] = useState(false);
  const [serverReady, setServerReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [contacts, setContacts] = useState<MessengerContact[]>([]);
  const [friends, setFriends] = useState<MessengerContact[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequestItem[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequestItem[]>([]);
  const [servers, setServers] = useState<MessengerServer[]>([]);
  const [messages, setMessages] = useState<MessengerMessage[]>([]);
  const [callLogs, setCallLogs] = useState<MessengerCallRecord[]>([]);
  const [typingByRoom, setTypingByRoom] = useState<Record<string, string[]>>({});
  const [messengerError, setMessengerError] = useState<string | null>(null);

  const [incomingCall, setIncomingCall] = useState<IncomingCallOffer | null>(null);
  const [activeCall, setActiveCall] = useState<ActiveCallState | null>(null);
  const [micMuted, setMicMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [callError, setCallError] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const activeCallRef = useRef<ActiveCallState | null>(null);
  const incomingCallRef = useRef<IncomingCallOffer | null>(null);

  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  useEffect(() => {
    incomingCallRef.current = incomingCall;
  }, [incomingCall]);

  const authHeaders = useCallback((): Record<string, string> => {
    return authToken ? { Authorization: `Bearer ${authToken}` } : {};
  }, [authToken]);

  const sendWs = useCallback((payload: unknown): boolean => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
      return true;
    }
    return false;
  }, []);

  const cleanupRtc = useCallback(() => {
    if (pcRef.current) {
      try {
        pcRef.current.onicecandidate = null;
        pcRef.current.ontrack = null;
        pcRef.current.onconnectionstatechange = null;
        pcRef.current.close();
      } catch {
        // ignore close errors
      }
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      for (const track of localStreamRef.current.getTracks()) {
        try {
          track.stop();
        } catch {
          // ignore
        }
      }
      localStreamRef.current = null;
    }
    pendingIceRef.current = [];
    setLocalStream(null);
    setRemoteStream(null);
    setMicMuted(false);
    setCamOff(false);
  }, []);

  const refreshBootstrap = useCallback(async () => {
    if (!currentUserId) {
      setContacts([]);
      setFriends([]);
      setIncomingRequests([]);
      setOutgoingRequests([]);
      setServers([]);
      setMessages([]);
      setCallLogs([]);
      setServerReady(false);
      return;
    }
    setLoading(true);
    try {
      const resp = await fetch('/api/messenger/bootstrap', {
        credentials: 'include',
        headers: authHeaders(),
      });
      const data = await parseJsonSafe<{
        contacts?: MessengerContact[];
        friends?: MessengerContact[];
        incomingRequests?: FriendRequestItem[];
        outgoingRequests?: FriendRequestItem[];
        servers?: MessengerServer[];
        messages?: MessengerMessage[];
        callLogs?: MessengerCallRecord[];
        onlineUserIds?: string[];
        error?: string;
      }>(resp);

      if (!resp.ok || !data) {
        if (resp.status >= 500) {
          setMessengerError(data?.error || 'Сервер мессенджера временно недоступен.');
        }
        return;
      }

      setServerReady(true);
      setMessengerError(null);
      const onlineSet = new Set(data.onlineUserIds || []);
      const applyOnline = (c: MessengerContact): MessengerContact => ({
        ...c,
        online: onlineSet.has(c.id),
      });
      setContacts((data.contacts || []).map(applyOnline));
      setFriends((data.friends || []).map(applyOnline));
      setIncomingRequests(
        (data.incomingRequests || []).map((r) => ({
          ...r,
          user: applyOnline(r.user),
        }))
      );
      setOutgoingRequests(
        (data.outgoingRequests || []).map((r) => ({
          ...r,
          user: applyOnline(r.user),
        }))
      );
      if (Array.isArray(data.servers)) {
        setServers(data.servers);
      }
      setMessages(data.messages || []);
      setCallLogs(data.callLogs || []);
    } catch {
      setMessengerError('Не удалось подключиться к серверу мессенджера.');
    } finally {
      setLoading(false);
    }
  }, [authHeaders, currentUserId]);

  const flushPendingIce = useCallback(async (pc: RTCPeerConnection) => {
    const queued = [...pendingIceRef.current];
    pendingIceRef.current = [];
    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        // ignore malformed candidate
      }
    }
  }, []);

  const createPeerConnection = useCallback(
    (callId: string, peerId: string): RTCPeerConnection => {
      const pc = new RTCPeerConnection(RTC_CONFIG);
      const remote = new MediaStream();
      setRemoteStream(remote);

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendWs({
            type: 'call:ice',
            callId,
            targetUserId: peerId,
            candidate: event.candidate.toJSON(),
          });
        }
      };

      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
        } else {
          remote.addTrack(event.track);
          setRemoteStream(new MediaStream(remote.getTracks()));
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          setActiveCall((prev) =>
            prev && prev.callId === callId
              ? { ...prev, status: 'connected', startedAt: prev.startedAt || Date.now() }
              : prev
          );
        } else if (
          pc.connectionState === 'failed' ||
          pc.connectionState === 'closed'
        ) {
          cleanupRtc();
          setActiveCall(null);
        }
      };

      pcRef.current = pc;
      return pc;
    },
    [cleanupRtc, sendWs]
  );

  // Immediately load messenger state on login, and poll gently when WS isn't connected
  useEffect(() => {
    if (!currentUserId) return;
    refreshBootstrap();
    const interval = window.setInterval(() => {
      if (!connected) {
        refreshBootstrap();
      }
    }, 3500);
    return () => window.clearInterval(interval);
  }, [connected, currentUserId, refreshBootstrap]);

  // Connect WebSocket when authenticated
  useEffect(() => {
    if (!currentUserId) {
      setConnected(false);
      setServerReady(false);
      setContacts([]);
      setFriends([]);
      setIncomingRequests([]);
      setOutgoingRequests([]);
      setServers([]);
      setMessages([]);
      setCallLogs([]);
      setIncomingCall(null);
      setActiveCall(null);
      setMessengerError(null);
      cleanupRtc();
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      return;
    }

    let closedByEffect = false;
    let reconnectTimer: number | null = null;
    let heartbeatTimer: number | null = null;

    const connect = () => {
      if (closedByEffect) return;
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const tokenQuery = authToken ? `?token=${encodeURIComponent(authToken)}` : '';
      const ws = new WebSocket(`${proto}//${window.location.host}/ws/messenger${tokenQuery}`);
      wsRef.current = ws;

      ws.onopen = () => {
        if (closedByEffect) {
          ws.close();
          return;
        }
        setConnected(true);
        setServerReady(true);
        setMessengerError(null);
        refreshBootstrap();
        heartbeatTimer = window.setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 25000);
      };

      ws.onmessage = async (event) => {
        let packet: Record<string, unknown>;
        try {
          packet = JSON.parse(String(event.data)) as Record<string, unknown>;
        } catch {
          return;
        }
        const type = String(packet.type || '');

        if (type === 'init' || type === 'presence:update') {
          const onlineSet = new Set(
            Array.isArray(packet.onlineUserIds)
              ? (packet.onlineUserIds as string[])
              : []
          );
          const patchOnline = (list: MessengerContact[]) =>
            list.map((c) => ({ ...c, online: onlineSet.has(c.id) }));
          setContacts(patchOnline);
          setFriends(patchOnline);
          setIncomingRequests((prev) =>
            prev.map((r) => ({ ...r, user: { ...r.user, online: onlineSet.has(r.user.id) } }))
          );
          setOutgoingRequests((prev) =>
            prev.map((r) => ({ ...r, user: { ...r.user, online: onlineSet.has(r.user.id) } }))
          );
          return;
        }

        if (type === 'user:updated' || type === 'friends:updated') {
          refreshBootstrap();
          return;
        }

        if (type === 'servers:updated' && Array.isArray(packet.servers)) {
          setServers(packet.servers as MessengerServer[]);
          return;
        }

        if (type === 'message:new') {
          const incoming = packet.message as MessengerMessage | undefined;
          if (!incoming || !incoming.id) return;
          setMessages((prev) => {
            if (prev.some((m) => m.id === incoming.id)) return prev;
            return [...prev, incoming];
          });
          return;
        }

        if (type === 'typing') {
          const roomId = String(packet.roomId || '');
          const nickname = String(packet.nickname || '');
          const active = Boolean(packet.active);
          if (!roomId || !nickname) return;
          setTypingByRoom((prev) => {
            const list = prev[roomId] || [];
            const nextList = active
              ? Array.from(new Set([...list, nickname]))
              : list.filter((n) => n !== nickname);
            return { ...prev, [roomId]: nextList };
          });
          return;
        }

        if (type === 'call:offer') {
          const offer: IncomingCallOffer = {
            callId: String(packet.callId || ''),
            fromUserId: String(packet.fromUserId || ''),
            fromUsername: String(packet.fromUsername || ''),
            fromDisplayName: String(packet.fromDisplayName || 'Собеседник'),
            fromAvatar: typeof packet.fromAvatar === 'string' ? packet.fromAvatar : undefined,
            callType: packet.callType === 'video' ? 'video' : 'audio',
            sdp: packet.sdp as RTCSessionDescriptionInit,
          };
          if (activeCallRef.current) {
            sendWs({
              type: 'call:reject',
              callId: offer.callId,
              targetUserId: offer.fromUserId,
            });
            return;
          }
          setCallError(null);
          setIncomingCall(offer);
          return;
        }

        if (type === 'call:answer') {
          const callId = String(packet.callId || '');
          const pc = pcRef.current;
          if (pc && activeCallRef.current?.callId === callId && packet.sdp) {
            try {
              await pc.setRemoteDescription(
                new RTCSessionDescription(packet.sdp as RTCSessionDescriptionInit)
              );
              await flushPendingIce(pc);
              setActiveCall((prev) =>
                prev && prev.callId === callId
                  ? { ...prev, status: 'connected', startedAt: Date.now() }
                  : prev
              );
            } catch {
              setCallError('Не удалось установить голосовое/видео соединение.');
              cleanupRtc();
              setActiveCall(null);
            }
          }
          return;
        }

        if (type === 'call:ice') {
          const callId = String(packet.callId || '');
          const candidate = packet.candidate as RTCIceCandidateInit | undefined;
          const pc = pcRef.current;
          if (!candidate || activeCallRef.current?.callId !== callId) return;
          if (pc && pc.remoteDescription) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch {
              // ignore
            }
          } else {
            pendingIceRef.current.push(candidate);
          }
          return;
        }

        if (type === 'call:unavailable') {
          const reason = String(packet.reason || 'Собеседник недоступен.');
          setCallError(reason);
          cleanupRtc();
          setActiveCall(null);
          return;
        }

        if (type === 'call:reject' || type === 'call:hangup') {
          const callId = String(packet.callId || '');
          if (incomingCallRef.current?.callId === callId) {
            setIncomingCall(null);
          }
          if (activeCallRef.current?.callId === callId) {
            if (type === 'call:reject') {
              setCallError('Собеседник отклонил звонок.');
            }
            cleanupRtc();
            setActiveCall(null);
            refreshBootstrap();
          }
        }
      };

      ws.onclose = () => {
        if (heartbeatTimer) {
          window.clearInterval(heartbeatTimer);
          heartbeatTimer = null;
        }
        setConnected(false);
        if (!closedByEffect) {
          reconnectTimer = window.setTimeout(connect, 2500);
        }
      };
    };

    connect();

    return () => {
      closedByEffect = true;
      if (heartbeatTimer) window.clearInterval(heartbeatTimer);
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      cleanupRtc();
    };
  }, [currentUserId, authToken, cleanupRtc, flushPendingIce, refreshBootstrap, sendWs]);

  const sendMessage = useCallback(
    async (
      roomId: string,
      text: string,
      channels?: ExternalChannelId[],
      targetPhone?: string
    ): Promise<boolean> => {
      const trimmed = text.trim();
      if (!trimmed || !currentUserId) return false;
      const clientId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      try {
        const resp = await fetch('/api/messenger/messages', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders(),
          },
          body: JSON.stringify({
            roomId,
            text: trimmed,
            clientId,
            channels,
            targetPhone,
          }),
        });
        const json = await parseJsonSafe<{ message?: MessengerMessage; error?: string }>(resp);
        if (!resp.ok || !json?.message) {
          setMessengerError(json?.error || 'Не удалось отправить сообщение на сервер.');
          return false;
        }
        const savedMessage = json.message;
        setMessengerError(null);
        setMessages((prev) => {
          if (prev.some((m) => m.id === savedMessage.id)) return prev;
          return [...prev, savedMessage];
        });
        return true;
      } catch {
        if (
          sendWs({
            type: 'message:send',
            roomId,
            text: trimmed,
            clientId,
            channels,
            targetPhone,
          })
        ) {
          return true;
        }
        setMessengerError('Нет связи с сервером сообщений.');
        return false;
      }
    },
    [authHeaders, currentUserId, sendWs]
  );

  const updateBridges = useCallback(
    async (payload: {
      phone?: string;
      telegramConnected?: boolean;
      telegramHandle?: string;
      telegramChatId?: string;
      whatsappConnected?: boolean;
      whatsappPhone?: string;
      viberConnected?: boolean;
      viberPhone?: string;
    }): Promise<{
      ok: boolean;
      bridges?: MessengerBridgeBinding;
      user?: UserProfile;
      error?: string;
    }> => {
      if (!currentUserId) return { ok: false, error: 'Требуется вход в аккаунт.' };
      try {
        const resp = await fetch('/api/messenger/bridges', {
          method: 'PUT',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders(),
          },
          body: JSON.stringify(payload),
        });
        const json = await parseJsonSafe<{
          bridges?: MessengerBridgeBinding;
          user?: UserProfile;
          error?: string;
        }>(resp);
        if (!resp.ok || !json?.bridges) {
          const err = json?.error || 'Не удалось сохранить привязку мессенджеров.';
          setMessengerError(err);
          return { ok: false, error: err };
        }
        setMessengerError(null);
        await refreshBootstrap();
        return { ok: true, bridges: json.bridges, user: json.user };
      } catch {
        const err = 'Ошибка соединения при сохранении привязки.';
        setMessengerError(err);
        return { ok: false, error: err };
      }
    },
    [authHeaders, currentUserId, refreshBootstrap]
  );

  const sendBridgeCode = useCallback(
    async (payload: {
      phone: string;
      telegramHandle?: string;
      telegramChatId?: string;
      telegram?: boolean;
      whatsapp?: boolean;
      viber?: boolean;
      chatRoulette?: boolean;
    }): Promise<{
      ok: boolean;
      challengeId?: string;
      phone?: string;
      maskedPhone?: string;
      deliveryMode?: 'sms' | 'in-app';
      demoCode?: string;
      message?: string;
      error?: string;
    }> => {
      if (!currentUserId) return { ok: false, error: 'Требуется вход в аккаунт.' };
      try {
        const resp = await fetch('/api/messenger/bridges/send-code', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders(),
          },
          body: JSON.stringify(payload),
        });
        const json = await parseJsonSafe<{
          ok?: boolean;
          challengeId?: string;
          phone?: string;
          maskedPhone?: string;
          deliveryMode?: 'sms' | 'in-app';
          demoCode?: string;
          message?: string;
          error?: string;
        }>(resp);
        if (!resp.ok || !json?.ok) {
          const err = json?.error || 'Не удалось отправить код подтверждения.';
          return { ok: false, error: err };
        }
        return {
          ok: true,
          challengeId: json.challengeId,
          phone: json.phone,
          maskedPhone: json.maskedPhone,
          deliveryMode: json.deliveryMode,
          demoCode: json.demoCode,
          message: json.message,
        };
      } catch {
        return { ok: false, error: 'Ошибка соединения при отправке кода.' };
      }
    },
    [authHeaders, currentUserId]
  );

  const verifyBridgeCode = useCallback(
    async (payload: {
      challengeId?: string;
      code: string;
    }): Promise<{
      ok: boolean;
      bridges?: MessengerBridgeBinding;
      user?: UserProfile;
      error?: string;
    }> => {
      if (!currentUserId) return { ok: false, error: 'Требуется вход в аккаунт.' };
      try {
        const resp = await fetch('/api/messenger/bridges/verify-code', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders(),
          },
          body: JSON.stringify(payload),
        });
        const json = await parseJsonSafe<{
          ok?: boolean;
          bridges?: MessengerBridgeBinding;
          user?: UserProfile;
          error?: string;
        }>(resp);
        if (!resp.ok || !json?.ok || !json.bridges) {
          return { ok: false, error: json?.error || 'Неверный код подтверждения.' };
        }
        await refreshBootstrap();
        return { ok: true, bridges: json.bridges, user: json.user };
      } catch {
        return { ok: false, error: 'Ошибка соединения при проверке кода.' };
      }
    },
    [authHeaders, currentUserId, refreshBootstrap]
  );

  const findRoulettePartner = useCallback(
    async (
      excludeUserId?: string
    ): Promise<{
      ok: boolean;
      partner?: MessengerContact | null;
      roomId?: string | null;
      message?: string;
      error?: string;
    }> => {
      if (!currentUserId) return { ok: false, error: 'Требуется вход в аккаунт.' };
      try {
        const resp = await fetch('/api/messenger/roulette/next', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders(),
          },
          body: JSON.stringify({ excludeUserId }),
        });
        const json = await parseJsonSafe<{
          ok?: boolean;
          partner?: MessengerContact | null;
          roomId?: string | null;
          message?: string;
          error?: string;
        }>(resp);
        if (!resp.ok) {
          return { ok: false, error: json?.error || 'Не удалось подобрать собеседника.' };
        }
        return {
          ok: true,
          partner: json?.partner ?? null,
          roomId: json?.roomId ?? null,
          message: json?.message,
        };
      } catch {
        return { ok: false, error: 'Ошибка соединения с сервером Чат-рулетки.' };
      }
    },
    [authHeaders, currentUserId]
  );

  const sendFriendRequest = useCallback(
    async (targetUserId: string): Promise<{ ok: boolean; error?: string }> => {
      if (!currentUserId) return { ok: false, error: 'Требуется вход в аккаунт.' };
      try {
        const resp = await fetch('/api/friends/request', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders(),
          },
          body: JSON.stringify({ targetUserId }),
        });
        const json = await parseJsonSafe<{ ok?: boolean; error?: string }>(resp);
        if (!resp.ok) {
          const err = json?.error || 'Не удалось отправить заявку в друзья.';
          setMessengerError(err);
          return { ok: false, error: err };
        }
        await refreshBootstrap();
        return { ok: true };
      } catch {
        const err = 'Ошибка соединения с сервером друзей.';
        setMessengerError(err);
        return { ok: false, error: err };
      }
    },
    [authHeaders, currentUserId, refreshBootstrap]
  );

  const respondFriendRequest = useCallback(
    async (requestId: string, decision: 'accept' | 'decline'): Promise<boolean> => {
      if (!currentUserId) return false;
      try {
        const resp = await fetch('/api/friends/respond', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders(),
          },
          body: JSON.stringify({ requestId, decision }),
        });
        if (!resp.ok) {
          const json = await parseJsonSafe<{ error?: string }>(resp);
          setMessengerError(json?.error || 'Не удалось обработать заявку в друзья.');
          return false;
        }
        await refreshBootstrap();
        return true;
      } catch {
        setMessengerError('Ошибка соединения с сервером друзей.');
        return false;
      }
    },
    [authHeaders, currentUserId, refreshBootstrap]
  );

  const removeFriend = useCallback(
    async (friendId: string): Promise<boolean> => {
      if (!currentUserId) return false;
      try {
        const resp = await fetch(`/api/friends/${encodeURIComponent(friendId)}`, {
          method: 'DELETE',
          credentials: 'include',
          headers: authHeaders(),
        });
        if (!resp.ok) return false;
        await refreshBootstrap();
        return true;
      } catch {
        setMessengerError('Ошибка при удалении из друзей.');
        return false;
      }
    },
    [authHeaders, currentUserId, refreshBootstrap]
  );

  const searchUsers = useCallback(
    async (query: string): Promise<MessengerContact[]> => {
      if (!currentUserId) return [];
      try {
        const resp = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`, {
          credentials: 'include',
          headers: authHeaders(),
        });
        const json = await parseJsonSafe<{ users?: MessengerContact[] }>(resp);
        return resp.ok && json?.users ? json.users : [];
      } catch {
        return [];
      }
    },
    [authHeaders, currentUserId]
  );

  const createServer = useCallback(
    async (input: {
      name: string;
      description?: string;
      region?: string;
      color?: string;
    }): Promise<{ ok: boolean; server?: MessengerServer; error?: string }> => {
      if (!currentUserId) return { ok: false, error: 'Требуется вход в аккаунт.' };
      try {
        const resp = await fetch('/api/messenger/servers', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders(),
          },
          body: JSON.stringify(input),
        });
        const json = await parseJsonSafe<{
          server?: MessengerServer;
          servers?: MessengerServer[];
          error?: string;
        }>(resp);
        if (!resp.ok || !json?.server) {
          const err = json?.error || 'Не удалось создать сервер.';
          setMessengerError(err);
          return { ok: false, error: err };
        }
        if (Array.isArray(json.servers)) {
          setServers(json.servers);
        }
        setMessengerError(null);
        return { ok: true, server: json.server };
      } catch {
        const err = 'Ошибка соединения при создании сервера.';
        setMessengerError(err);
        return { ok: false, error: err };
      }
    },
    [authHeaders, currentUserId]
  );

  const sendTyping = useCallback(
    (roomId: string, active: boolean) => {
      sendWs({ type: 'typing', roomId, active });
    },
    [sendWs]
  );

  const startCall = useCallback(
    async (contact: MessengerContact, callType: 'audio' | 'video') => {
      if (!currentUserId) return;
      if (!contact.online) {
        setCallError(`${contact.displayName} сейчас не в сети.`);
        return;
      }
      setCallError(null);
      const callId = `call-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: callType === 'video',
        });
      } catch {
        setCallError(
          callType === 'video'
            ? 'Нет доступа к камере или микрофону. Разрешите доступ в браузере.'
            : 'Нет доступа к микрофону. Разрешите доступ в браузере.'
        );
        return;
      }

      localStreamRef.current = stream;
      setLocalStream(stream);
      setActiveCall({
        callId,
        peerId: contact.id,
        peerName: contact.displayName,
        peerAvatar: contact.avatar,
        callType,
        direction: 'outgoing',
        status: 'ringing',
      });

      const pc = createPeerConnection(callId, contact.id);
      for (const track of stream.getTracks()) {
        pc.addTrack(track, stream);
      }

      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendWs({
          type: 'call:offer',
          callId,
          callType,
          targetUserId: contact.id,
          sdp: pc.localDescription,
        });
      } catch {
        setCallError('Не удалось начать звонок.');
        cleanupRtc();
        setActiveCall(null);
      }
    },
    [cleanupRtc, createPeerConnection, currentUserId, sendWs]
  );

  const acceptIncomingCall = useCallback(async () => {
    const offer = incomingCallRef.current;
    if (!offer) return;
    setCallError(null);

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: offer.callType === 'video',
      });
    } catch {
      setCallError('Нет доступа к микрофону или камере для ответа на звонок.');
      sendWs({
        type: 'call:reject',
        callId: offer.callId,
        targetUserId: offer.fromUserId,
      });
      setIncomingCall(null);
      return;
    }

    localStreamRef.current = stream;
    setLocalStream(stream);
    setIncomingCall(null);
    setActiveCall({
      callId: offer.callId,
      peerId: offer.fromUserId,
      peerName: offer.fromDisplayName,
      peerAvatar: offer.fromAvatar,
      callType: offer.callType,
      direction: 'incoming',
      status: 'connecting',
    });

    const pc = createPeerConnection(offer.callId, offer.fromUserId);
    for (const track of stream.getTracks()) {
      pc.addTrack(track, stream);
    }

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer.sdp));
      await flushPendingIce(pc);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      sendWs({
        type: 'call:answer',
        callId: offer.callId,
        targetUserId: offer.fromUserId,
        sdp: pc.localDescription,
      });
      setActiveCall((prev) =>
        prev && prev.callId === offer.callId
          ? { ...prev, status: 'connected', startedAt: Date.now() }
          : prev
      );
    } catch {
      setCallError('Не удалось подключиться к звонку.');
      cleanupRtc();
      setActiveCall(null);
    }
  }, [cleanupRtc, createPeerConnection, flushPendingIce, sendWs]);

  const rejectIncomingCall = useCallback(() => {
    const offer = incomingCallRef.current;
    if (!offer) return;
    sendWs({
      type: 'call:reject',
      callId: offer.callId,
      targetUserId: offer.fromUserId,
    });
    setIncomingCall(null);
  }, [sendWs]);

  const endActiveCall = useCallback(() => {
    const call = activeCallRef.current;
    if (call) {
      sendWs({
        type: 'call:hangup',
        callId: call.callId,
        targetUserId: call.peerId,
      });
    }
    cleanupRtc();
    setActiveCall(null);
    refreshBootstrap();
  }, [cleanupRtc, refreshBootstrap, sendWs]);

  const toggleMic = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const nextMuted = !micMuted;
    for (const t of stream.getAudioTracks()) {
      t.enabled = !nextMuted;
    }
    setMicMuted(nextMuted);
  }, [micMuted]);

  const toggleCam = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const nextOff = !camOff;
    for (const t of stream.getVideoTracks()) {
      t.enabled = !nextOff;
    }
    setCamOff(nextOff);
  }, [camOff]);

  return {
    connected,
    serverReady,
    loading,
    contacts,
    friends,
    incomingRequests,
    outgoingRequests,
    servers,
    messages,
    callLogs,
    typingByRoom,
    messengerError,
    incomingCall,
    activeCall,
    micMuted,
    camOff,
    callError,
    localStream,
    remoteStream,
    sendMessage,
    updateBridges,
    sendBridgeCode,
    verifyBridgeCode,
    findRoulettePartner,
    sendTyping,
    createServer,
    sendFriendRequest,
    respondFriendRequest,
    removeFriend,
    searchUsers,
    startCall,
    acceptIncomingCall,
    rejectIncomingCall,
    endActiveCall,
    toggleMic,
    toggleCam,
    clearCallError: () => setCallError(null),
    clearMessengerError: () => setMessengerError(null),
    refreshBootstrap,
  };
}
