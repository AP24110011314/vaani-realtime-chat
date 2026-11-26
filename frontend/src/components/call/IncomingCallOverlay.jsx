import { Phone, PhoneOff, Video, AlertCircle } from 'lucide-react'
import { useCall } from '../../hooks/useCall'
import UserAvatar from '../common/UserAvatar'

export default function IncomingCallOverlay() {
  const {
    callState,
    callType,
    peer,
    mediaError,
    acceptIncomingCall,
    declineIncomingCall,
    clearMediaError,
    startCall,
  } = useCall()

  // Show media error modal when caller or callee failed getUserMedia cleanly
  if (mediaError && callState === 'idle') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center glass-modal-backdrop p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Call media error"
          className="w-full max-w-sm glass-strong rounded-3xl p-6 space-y-4 shadow-2xl animate-modal-in text-center"
        >
          <div className="w-12 h-12 rounded-2xl bg-[var(--danger-bg)] text-[var(--danger-text)] flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-base font-bold text-ink">Unable to access media</h2>
            <p className="text-xs text-ink-muted leading-relaxed">{mediaError.message}</p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-1">
            {mediaError.requestedType === 'VIDEO' && mediaError.conversationId && (
              <button
                type="button"
                onClick={() => {
                  const target = {
                    conversationId: mediaError.conversationId,
                    peer: mediaError.peer,
                    type: 'AUDIO',
                  }
                  clearMediaError()
                  startCall(target)
                }}
                className="w-full sm:w-auto px-4 py-2 rounded-full text-xs font-semibold btn-accent cursor-pointer focus-accent"
              >
                Continue audio-only
              </button>
            )}
            <button
              type="button"
              onClick={clearMediaError}
              className="w-full sm:w-auto px-4 py-2 rounded-full text-xs font-semibold glass-subtle text-ink hover:bg-[var(--glass-bg-hover)] cursor-pointer focus-accent"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (callState !== 'incoming') return null

  const isVideo = callType === 'VIDEO'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center glass-modal-backdrop p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Incoming call"
        className="w-full max-w-sm glass-strong rounded-[32px] p-7 shadow-2xl animate-modal-in flex flex-col items-center text-center space-y-5"
      >
        <div className="relative">
          <div className="absolute -inset-3 rounded-full bg-[var(--accent-glow)] animate-ping opacity-35" aria-hidden="true" />
          <UserAvatar
            src={peer?.avatarUrl}
            name={peer?.name}
            seed={peer?.id || peer?.name}
            size="xl"
          />
        </div>

        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full accent-badge text-[11px] font-semibold">
            {isVideo ? <Video className="w-3 h-3" /> : <Phone className="w-3 h-3" />}
            <span>Incoming {isVideo ? 'video' : 'voice'} call</span>
          </div>
          <h2 className="text-xl font-bold text-ink">{peer?.name || 'Contact'}</h2>
        </div>

        {mediaError && (
          <div role="alert" className="w-full rounded-2xl p-3 bg-[var(--danger-bg)] text-[var(--danger-text)] text-xs space-y-2">
            <p>{mediaError.message}</p>
            {isVideo && (
              <button
                type="button"
                onClick={() => acceptIncomingCall({ audioOnlyFallback: true })}
                className="px-3 py-1 rounded-full text-[11px] font-semibold btn-accent cursor-pointer"
              >
                Answer audio-only
              </button>
            )}
          </div>
        )}

        <div className="flex items-center justify-center gap-5 pt-2 w-full">
          <button
            type="button"
            onClick={declineIncomingCall}
            className="flex flex-col items-center gap-1.5 group cursor-pointer focus-accent rounded-2xl p-1"
            aria-label="Decline call"
          >
            <span className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-lg transition-transform group-hover:scale-105">
              <PhoneOff className="w-6 h-6" />
            </span>
            <span className="text-xs font-medium text-ink-muted">Decline</span>
          </button>

          <button
            type="button"
            onClick={() => acceptIncomingCall({ audioOnlyFallback: false })}
            className="flex flex-col items-center gap-1.5 group cursor-pointer focus-accent rounded-2xl p-1"
            aria-label="Accept call"
          >
            <span className="w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center shadow-lg transition-transform group-hover:scale-105">
              {isVideo ? <Video className="w-6 h-6" /> : <Phone className="w-6 h-6" />}
            </span>
            <span className="text-xs font-medium text-ink-muted">Accept</span>
          </button>
        </div>
      </div>
    </div>
  )
}
