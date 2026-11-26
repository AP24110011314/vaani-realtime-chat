import { useEffect, useRef } from 'react'
import {
  Mic,
  MicOff,
  PhoneOff,
  RefreshCw,
  Video,
  VideoOff,
  Wifi,
} from 'lucide-react'
import { useCall } from '../../hooks/useCall'
import { formatCallDuration } from '../../lib/webrtc'
import UserAvatar from '../common/UserAvatar'

function qualityBadge(quality) {
  if (quality === 'poor') {
    return { label: 'Poor', dot: 'bg-red-500', text: 'text-red-400' }
  }
  if (quality === 'fair') {
    return { label: 'Fair', dot: 'bg-amber-400', text: 'text-amber-300' }
  }
  return { label: 'Good', dot: 'bg-emerald-400', text: 'text-emerald-300' }
}

export default function CallScreen() {
  const {
    callState,
    callType,
    peer,
    isMuted,
    isCameraOff,
    quality,
    durationSec,
    connectionState,
    endNotice,
    localStream,
    remoteStream,
    endCall,
    toggleMute,
    toggleCamera,
    flipCamera,
    clearEndNotice,
  } = useCall()

  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const remoteAudioRef = useRef(null)

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream
    }
  }, [localStream, isCameraOff, callState])

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream
    }
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream
    }
  }, [remoteStream, callState])

  if (callState === 'idle' && endNotice) {
    return (
      <div
        role="status"
        className="fixed bottom-5 right-5 z-50 glass-strong rounded-full px-4 py-2 text-xs font-semibold text-ink shadow-xl flex items-center gap-2 animate-modal-in"
      >
        <span>{endNotice}</span>
        <button
          type="button"
          onClick={clearEndNotice}
          className="text-ink-subtle hover:text-ink cursor-pointer"
          aria-label="Dismiss call notice"
        >
          ×
        </button>
      </div>
    )
  }

  if (!['outgoing', 'connecting', 'connected', 'reconnecting'].includes(callState)) {
    return null
  }

  const isVideo = callType === 'VIDEO'
  const qMeta = qualityBadge(quality)

  let statusLabel = 'Calling...'
  if (callState === 'connecting') statusLabel = 'Connecting...'
  else if (callState === 'reconnecting') statusLabel = 'Reconnecting...'
  else if (callState === 'connected') statusLabel = formatCallDuration(durationSec)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Active call"
      data-call-state={callState}
      data-connection-state={connectionState}
      className="fixed inset-0 z-50 bg-[#050B0E]/92 backdrop-blur-xl text-white flex flex-col justify-between p-4 sm:p-6"
    >
      {/* Hidden audio tag ensures remote audio always plays cleanly even when video renders separately */}
      <audio ref={remoteAudioRef} autoPlay playsInline />

      {/* Top Glass Status Bar */}
      <div className="relative z-20 flex items-center justify-between gap-3 max-w-4xl w-full mx-auto glass rounded-full px-4 py-2.5 bg-white/10 border-white/15">
        <div className="flex items-center gap-2.5 min-w-0">
          <UserAvatar
            src={peer?.avatarUrl}
            name={peer?.name}
            seed={peer?.id || peer?.name}
            size="sm"
          />
          <div className="min-w-0">
            <p className="text-sm font-bold text-white truncate">{peer?.name || 'Contact'}</p>
            <p className="text-[11px] text-white/75 tabular-nums">{statusLabel}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {callState === 'reconnecting' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-200 text-[11px] font-semibold">
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>Reconnecting</span>
            </span>
          )}
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 text-[11px] font-medium ${qMeta.text}`}
            title={`Connection quality: ${qMeta.label}`}
          >
            <span className={`w-2 h-2 rounded-full ${qMeta.dot}`} />
            <Wifi className="w-3 h-3" />
            <span>{qMeta.label}</span>
          </span>
        </div>
      </div>

      {/* Main Media Stage */}
      <div className="relative flex-1 my-4 max-w-4xl w-full mx-auto rounded-[28px] overflow-hidden bg-black/50 border border-white/10 flex items-center justify-center">
        {isVideo && remoteStream ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            data-testid="remote-video"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center gap-4 text-center p-6">
            <div className="relative">
              {callState === 'connected' && (
                <div className="absolute -inset-4 rounded-full bg-teal-400/20 animate-pulse" aria-hidden="true" />
              )}
              <UserAvatar
                src={peer?.avatarUrl}
                name={peer?.name}
                seed={peer?.id || peer?.name}
                size="xl"
              />
            </div>
            <div className="space-y-1">
              <p className="text-lg font-bold text-white">{peer?.name || 'Contact'}</p>
              <p className="text-xs text-white/70">{statusLabel}</p>
            </div>
          </div>
        )}

        {/* Picture-in-Picture Local Self View */}
        {isVideo && localStream && !isCameraOff && (
          <div className="absolute bottom-4 right-4 w-28 sm:w-40 aspect-video rounded-2xl overflow-hidden border border-white/25 shadow-2xl bg-black">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              data-testid="local-video"
              className="w-full h-full object-cover scale-x-[-1]"
            />
          </div>
        )}
      </div>

      {/* Bottom Glass Control Bar */}
      <div className="relative z-20 flex items-center justify-center gap-3 sm:gap-4 pb-2">
        <button
          type="button"
          onClick={toggleMute}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all cursor-pointer focus-accent ${
            isMuted
              ? 'bg-red-500/90 text-white'
              : 'bg-white/15 hover:bg-white/25 text-white'
          }`}
          aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        {isVideo && (
          <>
            <button
              type="button"
              onClick={toggleCamera}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all cursor-pointer focus-accent ${
                isCameraOff
                  ? 'bg-red-500/90 text-white'
                  : 'bg-white/15 hover:bg-white/25 text-white'
              }`}
              aria-label={isCameraOff ? 'Turn camera on' : 'Turn camera off'}
              title={isCameraOff ? 'Camera on' : 'Camera off'}
            >
              {isCameraOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
            </button>

            <button
              type="button"
              onClick={flipCamera}
              className="w-12 h-12 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-all cursor-pointer focus-accent"
              aria-label="Flip camera"
              title="Flip camera"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </>
        )}

        <button
          type="button"
          onClick={endCall}
          className="px-6 h-12 rounded-full bg-red-500 hover:bg-red-600 text-white font-semibold text-sm flex items-center gap-2 shadow-lg transition-transform hover:scale-105 cursor-pointer focus-accent"
          aria-label="End call"
        >
          <PhoneOff className="w-4 h-4" />
          <span>End</span>
        </button>
      </div>
    </div>
  )
}
