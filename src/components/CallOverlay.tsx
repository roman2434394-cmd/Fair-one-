import React, { useEffect, useRef, useState } from 'react';
import {
  Phone,
  PhoneOff,
  Video,
  Mic,
  MicOff,
  VideoOff,
  X,
} from 'lucide-react';
import { ActiveCallState, IncomingCallOffer } from '../hooks/useMessenger';
import { UserAvatar } from './UserAvatar';

interface CallOverlayProps {
  incomingCall: IncomingCallOffer | null;
  activeCall: ActiveCallState | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  micMuted: boolean;
  camOff: boolean;
  callError: string | null;
  onAcceptIncoming: () => void;
  onRejectIncoming: () => void;
  onEndCall: () => void;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onClearError: () => void;
}

const formatDuration = (sec: number): string => {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

export const CallOverlay: React.FC<CallOverlayProps> = ({
  incomingCall,
  activeCall,
  localStream,
  remoteStream,
  micMuted,
  camOff,
  callError,
  onAcceptIncoming,
  onRejectIncoming,
  onEndCall,
  onToggleMic,
  onToggleCam,
  onClearError,
}) => {
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = remoteStream || null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream || null;
    }
  }, [remoteStream]);

  useEffect(() => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStream || null;
    }
  }, [localStream]);

  useEffect(() => {
    if (!activeCall || activeCall.status !== 'connected' || !activeCall.startedAt) {
      setElapsedSec(0);
      return;
    }
    const tick = () => {
      setElapsedSec(Math.max(0, Math.floor((Date.now() - activeCall.startedAt!) / 1000)));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [activeCall]);

  return (
    <>
      {/* Hidden audio element always keeps remote call audio playing cleanly */}
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      {/* Call error notice */}
      {callError && !activeCall && !incomingCall && (
        <div className="fixed bottom-4 left-4 z-50 max-w-sm rounded-xl border border-red-200 dark:border-red-900/60 bg-white dark:bg-slate-900 p-3.5 shadow-lg flex items-start gap-3">
          <div className="flex-1 text-xs text-red-700 dark:text-red-300 leading-relaxed">
            {callError}
          </div>
          <button
            type="button"
            onClick={onClearError}
            aria-label="Скрыть ошибку звонка"
            className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 focus:outline-none"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Incoming Call Modal / Banner */}
      {incomingCall && !activeCall && (
        <div
          role="dialog"
          aria-label="Входящий звонок"
          className="fixed top-4 right-4 z-50 w-full max-w-sm px-4 sm:px-0"
        >
          <div className="rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-xl space-y-3.5">
            <div className="flex items-center gap-3">
              <UserAvatar
                name={incomingCall.fromDisplayName}
                avatar={incomingCall.fromAvatar}
                size="md"
                online
              />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {incomingCall.fromDisplayName}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {incomingCall.callType === 'video'
                    ? 'Входящий видеозвонок...'
                    : 'Входящий аудиозвонок...'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onAcceptIncoming}
                className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors focus:outline-none"
              >
                {incomingCall.callType === 'video' ? (
                  <Video className="w-3.5 h-3.5" />
                ) : (
                  <Phone className="w-3.5 h-3.5" />
                )}
                <span>Ответить</span>
              </button>
              <button
                type="button"
                onClick={onRejectIncoming}
                className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors focus:outline-none"
              >
                <PhoneOff className="w-3.5 h-3.5" />
                <span>Отклонить</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active Audio / Video Call Bar */}
      {activeCall && (
        <div
          role="dialog"
          aria-label="Активный звонок"
          className="fixed bottom-4 right-4 z-50 w-full max-w-sm px-4 sm:px-0"
        >
          <div className="rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-900 text-white shadow-xl overflow-hidden">
            {activeCall.callType === 'video' && (
              <div className="relative h-52 bg-slate-950">
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="absolute bottom-2.5 right-2.5 w-24 h-20 rounded-lg object-cover border border-slate-700 bg-slate-900"
                />
              </div>
            )}

            <div className="p-4 space-y-3.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <UserAvatar
                    name={activeCall.peerName}
                    avatar={activeCall.peerAvatar}
                    size="md"
                    online
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">
                      {activeCall.peerName}
                    </div>
                    <div className="text-xs text-slate-300 font-mono tabular-nums">
                      {activeCall.status === 'ringing'
                        ? 'Вызов...'
                        : activeCall.status === 'connecting'
                        ? 'Подключение...'
                        : formatDuration(elapsedSec)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-center gap-2.5">
                <button
                  type="button"
                  onClick={onToggleMic}
                  aria-label={micMuted ? 'Включить микрофон' : 'Выключить микрофон'}
                  className={`p-2.5 rounded-full transition-colors focus:outline-none ${
                    micMuted
                      ? 'bg-red-600/80 text-white'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-100'
                  }`}
                >
                  {micMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>

                {activeCall.callType === 'video' && (
                  <button
                    type="button"
                    onClick={onToggleCam}
                    aria-label={camOff ? 'Включить камеру' : 'Выключить камеру'}
                    className={`p-2.5 rounded-full transition-colors focus:outline-none ${
                      camOff
                        ? 'bg-red-600/80 text-white'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-100'
                    }`}
                  >
                    {camOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                  </button>
                )}

                <button
                  type="button"
                  onClick={onEndCall}
                  aria-label="Завершить звонок"
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-red-600 hover:bg-red-700 text-white text-xs font-medium transition-colors focus:outline-none"
                >
                  <PhoneOff className="w-4 h-4" />
                  <span>Завершить</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
