import { useState } from 'react'
import { formatConversationDate } from '../../lib/formatters'
import {
  User,
  Users,
  Check,
  CheckCheck,
  Pin,
  BellOff,
  MoreVertical,
  Archive,
  Bell,
} from 'lucide-react'
import { usePresence } from '../../hooks/usePresence'

export default function ConversationItem({
  conversation,
  isActive,
  onClick,
  currentUserId,
  onUpdateSettings,
}) {
  const { type, title, avatarUrl, lastMessage, unreadCount, members, pinned, muted, archived } =
    conversation
  const [showMenu, setShowMenu] = useState(false)
  const isGroup = type === 'GROUP'

  // Resolve peer if direct chat
  const peer = !isGroup ? members?.find((m) => m.id !== currentUserId) || members?.[0] : null
  const peerPresence = usePresence(peer?.id)
  const isOnline = !isGroup && (peerPresence?.online ?? peer?.online)

  // Last message sender check
  const isLastMsgMine = lastMessage?.sender?.id === currentUserId
  const lastMsgStatus = lastMessage?.status

  // Format snippet
  let snippet = 'No messages yet'
  if (lastMessage) {
    if (lastMessage.deleted) {
      snippet = 'This message was deleted'
    } else if (lastMessage.messageType === 'SYSTEM' || lastMessage.type === 'SYSTEM') {
      snippet = lastMessage.content || ''
    } else if (isLastMsgMine) {
      snippet = `You: ${lastMessage.content || (lastMessage.attachments?.length ? 'Sent an attachment' : '')}`
    } else if (isGroup && lastMessage.sender?.name) {
      snippet = `${lastMessage.sender.name}: ${lastMessage.content || (lastMessage.attachments?.length ? 'Sent an attachment' : '')}`
    } else {
      snippet = lastMessage.content || (lastMessage.attachments?.length ? 'Sent an attachment' : '')
    }
  }

  const timestamp = lastMessage?.createdAt
    ? formatConversationDate(lastMessage.createdAt)
    : ''

  const handleMenuClick = (e) => {
    e.stopPropagation()
    setShowMenu((prev) => !prev)
  }

  const handleTogglePin = (e) => {
    e.stopPropagation()
    setShowMenu(false)
    onUpdateSettings?.(conversation.id, { pinned: !pinned })
  }

  const handleToggleMute = (e) => {
    e.stopPropagation()
    setShowMenu(false)
    onUpdateSettings?.(conversation.id, { muted: !muted })
  }

  const handleToggleArchive = (e) => {
    e.stopPropagation()
    setShowMenu(false)
    onUpdateSettings?.(conversation.id, { archived: !archived })
  }

  return (
    <div className="relative group">
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
            <div className="flex items-center gap-1.5 min-w-0">
              {pinned && (
                <Pin className="w-3.5 h-3.5 text-indigo-400 fill-indigo-400 rotate-45 flex-shrink-0" />
              )}
              {muted && (
                <BellOff className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
              )}
              <span
                className={`text-sm font-semibold truncate ${
                  isActive ? 'text-white' : 'text-slate-200'
                }`}
              >
                {title}
              </span>
            </div>
            {timestamp && (
              <span className="text-[11px] text-slate-400 whitespace-nowrap">
                {timestamp}
              </span>
            )}
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 min-w-0 flex-1">
              {isLastMsgMine && lastMessage && (
                <span className="shrink-0">
                  {lastMsgStatus === 'READ' ? (
                    <CheckCheck className="w-3.5 h-3.5 text-sky-400 inline" aria-label="Read" />
                  ) : lastMsgStatus === 'DELIVERED' ? (
                    <CheckCheck className="w-3.5 h-3.5 text-slate-400 inline" aria-label="Delivered" />
                  ) : (
                    <Check className="w-3.5 h-3.5 text-slate-400 inline" aria-label="Sent" />
                  )}
                </span>
              )}
              <p className="text-xs text-slate-400 truncate flex-1 leading-snug">
                {snippet}
              </p>
            </div>
            {unreadCount > 0 && (
              <span className="flex-shrink-0 bg-indigo-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
        </div>
      </button>

      {/* 3-dots Menu Button (Hover) */}
      <button
        type="button"
        onClick={handleMenuClick}
        className="absolute right-2 top-2 p-1 text-slate-500 hover:text-white rounded-lg hover:bg-slate-700/60 opacity-0 group-hover:opacity-100 transition-opacity z-10"
        title="Chat options"
        aria-label="Chat options"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {/* Dropdown Menu */}
      {showMenu && (
        <div
          className="absolute right-2 top-8 w-40 bg-slate-900 border border-slate-700 rounded-xl shadow-xl z-30 py-1 text-xs text-slate-200 animate-in fade-in"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={handleTogglePin}
            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-800 transition-colors text-left"
          >
            <Pin className="w-3.5 h-3.5 text-indigo-400" />
            <span>{pinned ? 'Unpin chat' : 'Pin chat'}</span>
          </button>
          <button
            type="button"
            onClick={handleToggleMute}
            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-800 transition-colors text-left"
          >
            {muted ? (
              <>
                <Bell className="w-3.5 h-3.5 text-indigo-400" />
                <span>Unmute chat</span>
              </>
            ) : (
              <>
                <BellOff className="w-3.5 h-3.5 text-slate-400" />
                <span>Mute chat</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleToggleArchive}
            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-800 transition-colors text-left"
          >
            <Archive className="w-3.5 h-3.5 text-slate-400" />
            <span>{archived ? 'Unarchive chat' : 'Archive chat'}</span>
          </button>
        </div>
      )}
    </div>
  )
}
