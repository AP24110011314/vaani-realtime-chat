import { ArrowLeft, User, Users, Info } from 'lucide-react'
import { usePresence } from '../../hooks/usePresence'
import { formatLastSeen } from '../../lib/formatters'

export default function ChatHeader({
  conversation,
  onBack,
  currentUserId,
  onToggleInfo,
  typingText,
}) {
  const isGroup = conversation?.type === 'GROUP'
  const { title, avatarUrl, members, description } = conversation || {}

  // Resolve peer if direct chat
  const peer = !isGroup
    ? members?.find((m) => m.id !== currentUserId) || members?.[0]
    : null
  const presence = usePresence(peer?.id)
  const isOnline = !isGroup && (presence?.online ?? peer?.online)

  let subtitle = description || 'Offline'
  if (typingText) {
    subtitle = typingText
  } else if (isGroup) {
    subtitle = `${members?.length || 0} members`
  } else if (isOnline) {
    subtitle = 'Online'
  } else if (presence?.lastSeenAt) {
    subtitle = formatLastSeen(presence.lastSeenAt)
  }

  if (!conversation) return null

  return (
    <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/80 backdrop-blur flex items-center justify-between gap-3 sticky top-0 z-10 select-none">
      <div className="flex items-center gap-3 min-w-0">
        {/* Back Button (Mobile Only) */}
        <button
          onClick={onBack}
          className="md:hidden p-1.5 -ml-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          aria-label="Back to conversations"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        {/* Avatar with optional online indicator */}
        <div className="relative flex-shrink-0">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={title}
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-sm font-bold text-white shadow-inner">
              {isGroup ? (
                <Users className="w-5 h-5 text-indigo-100" />
              ) : title ? (
                title.charAt(0).toUpperCase()
              ) : (
                <User className="w-5 h-5" />
              )}
            </div>
          )}
          {isOnline && (
            <span
              className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-900"
              title="Online"
            />
          )}
        </div>

        {/* Conversation Info */}
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-white truncate leading-tight">
            {title}
          </h2>
          <p
            className={`text-[11px] truncate leading-tight mt-0.5 ${
              typingText
                ? 'text-indigo-400 animate-pulse font-medium'
                : isOnline
                ? 'text-emerald-400 font-medium'
                : 'text-slate-400'
            }`}
          >
            {subtitle}
          </p>
        </div>
      </div>

      {/* Group Info Action */}
      {isGroup && onToggleInfo && (
        <button
          onClick={onToggleInfo}
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
          title="Group Info"
          aria-label="Group Info"
        >
          <Info className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}
