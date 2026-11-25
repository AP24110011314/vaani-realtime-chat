import { useState } from 'react'
import { formatConversationDate } from '../../lib/formatters'
import {
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
import UserAvatar from '../common/UserAvatar'

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
        className={`relative w-full flex items-center gap-3 p-3 rounded-2xl transition-all duration-150 text-left border cursor-pointer focus-accent ${
          isActive
            ? 'glass-row-active text-ink pl-3.5'
            : 'glass-row glass-row-hover text-ink-muted'
        }`}
      >
        {/* Active accent vertical pill bar */}
        {isActive && (
          <span
            aria-hidden="true"
            className="absolute left-1 top-3 bottom-3 w-1 rounded-full accent-ring"
          />
        )}

        {/* Avatar with online indicator */}
        {isGroup && !avatarUrl ? (
          <div className="relative flex-shrink-0 w-11 h-11 rounded-full accent-badge flex items-center justify-center shadow-inner">
            <Users className="w-5 h-5" />
          </div>
        ) : (
          <UserAvatar
            src={avatarUrl}
            name={title}
            seed={peer?.id || conversation.id || title}
            size="md"
            isOnline={isOnline}
          />
        )}

        {/* Details */}
        <div className="flex-1 min-w-0 pr-5">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-1.5 min-w-0">
              {pinned && (
                <Pin className="w-3.5 h-3.5 text-accent-text fill-current rotate-45 flex-shrink-0" />
              )}
              {muted && (
                <BellOff className="w-3.5 h-3.5 text-ink-subtle flex-shrink-0" />
              )}
              <span
                className={`text-sm font-semibold truncate ${
                  isActive ? 'text-ink' : 'text-ink'
                }`}
              >
                {title}
              </span>
            </div>
            {timestamp && (
              <span className="text-[11px] text-ink-subtle whitespace-nowrap tabular-nums">
                {timestamp}
              </span>
            )}
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 min-w-0 flex-1">
              {isLastMsgMine && lastMessage && (
                <span className="shrink-0">
                  {lastMsgStatus === 'READ' ? (
                    <CheckCheck className="w-3.5 h-3.5 text-accent-text inline" aria-label="Read" />
                  ) : lastMsgStatus === 'DELIVERED' ? (
                    <CheckCheck className="w-3.5 h-3.5 text-ink-subtle inline" aria-label="Delivered" />
                  ) : (
                    <Check className="w-3.5 h-3.5 text-ink-subtle inline" aria-label="Sent" />
                  )}
                </span>
              )}
              <p className="text-xs text-ink-muted truncate flex-1 leading-snug">
                {snippet}
              </p>
            </div>
            {unreadCount > 0 && (
              <span className="flex-shrink-0 accent-badge text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center tabular-nums shadow-xs">
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
        className="absolute right-2 top-2.5 p-1 text-ink-subtle hover:text-ink rounded-xl hover:bg-[var(--glass-bg-hover)] opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity z-10 focus-accent cursor-pointer"
        title="Chat options"
        aria-label="Chat options"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {/* Dropdown Menu */}
      {showMenu && (
        <div
          className="absolute right-2 top-9 w-44 glass-strong rounded-2xl z-30 py-1.5 text-xs text-ink animate-modal-in"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={handleTogglePin}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-[var(--glass-bg-hover)] transition-colors text-left cursor-pointer"
          >
            <Pin className="w-3.5 h-3.5 text-accent-text" />
            <span>{pinned ? 'Unpin chat' : 'Pin chat'}</span>
          </button>
          <button
            type="button"
            onClick={handleToggleMute}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-[var(--glass-bg-hover)] transition-colors text-left cursor-pointer"
          >
            {muted ? (
              <>
                <Bell className="w-3.5 h-3.5 text-accent-text" />
                <span>Unmute chat</span>
              </>
            ) : (
              <>
                <BellOff className="w-3.5 h-3.5 text-ink-muted" />
                <span>Mute chat</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleToggleArchive}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-[var(--glass-bg-hover)] transition-colors text-left cursor-pointer"
          >
            <Archive className="w-3.5 h-3.5 text-ink-muted" />
            <span>{archived ? 'Unarchive chat' : 'Archive chat'}</span>
          </button>
        </div>
      )}
    </div>
  )
}
