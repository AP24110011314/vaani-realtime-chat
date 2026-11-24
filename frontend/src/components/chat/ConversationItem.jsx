import { formatConversationDate } from '../../lib/formatters'
import { User, Users } from 'lucide-react'
import { usePresence } from '../../hooks/usePresence'

export default function ConversationItem({ conversation, isActive, onClick, currentUserId }) {
  const { type, title, avatarUrl, lastMessage, unreadCount, members } = conversation
  const isGroup = type === 'GROUP'

  // Resolve peer if direct chat
  const peer = !isGroup ? members?.find((m) => m.id !== currentUserId) || members?.[0] : null
  const peerPresence = usePresence(peer?.id)
  const isOnline = !isGroup && (peerPresence?.online ?? peer?.online)

  // Format snippet
  let snippet = 'No messages yet'
  if (lastMessage) {
    if (lastMessage.deleted) {
      snippet = 'This message was deleted'
    } else if (lastMessage.messageType === 'SYSTEM' || lastMessage.type === 'SYSTEM') {
      snippet = lastMessage.content || ''
    } else if (lastMessage.sender?.id === currentUserId) {
      snippet = `You: ${lastMessage.content || ''}`
    } else if (isGroup && lastMessage.sender?.name) {
      snippet = `${lastMessage.sender.name}: ${lastMessage.content || ''}`
    } else {
      snippet = lastMessage.content || ''
    }
  }

  const timestamp = lastMessage?.createdAt
    ? formatConversationDate(lastMessage.createdAt)
    : ''

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3.5 p-3 rounded-xl transition-all text-left border ${
        isActive
          ? 'bg-slate-800/90 border-indigo-500/50 shadow-md shadow-black/20'
          : 'bg-transparent border-transparent hover:bg-slate-800/40 text-slate-300'
      }`}
    >
      {/* Avatar with online indicator */}
      <div className="relative flex-shrink-0">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={title}
            className="w-12 h-12 rounded-full object-cover"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-sm font-bold text-white shadow-inner">
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
            className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-slate-900"
            title="Online"
          />
        )}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1 mb-1">
          <span className={`text-sm font-semibold truncate ${isActive ? 'text-white' : 'text-slate-200'}`}>
            {title}
          </span>
          {timestamp && (
            <span className="text-[11px] text-slate-400 whitespace-nowrap">
              {timestamp}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-slate-400 truncate flex-1 leading-snug">
            {snippet}
          </p>
          {unreadCount > 0 && (
            <span className="flex-shrink-0 bg-indigo-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}
