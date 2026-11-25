import { useState, useEffect, useRef } from 'react'
import {
  ArrowLeft,
  Users,
  Info,
  Search,
  X,
  ChevronUp,
  ChevronDown,
  Loader2,
  Ban,
  UserCheck,
} from 'lucide-react'
import { usePresence } from '../../hooks/usePresence'
import { formatLastSeen } from '../../lib/formatters'
import { searchApi } from '../../api/searchApi'
import { userApi } from '../../api/userApi'
import UserAvatar from '../common/UserAvatar'

export default function ChatHeader({
  conversation,
  onBack,
  currentUserId,
  onToggleInfo,
  onBlockChange,
  typingText,
  onSelectSearchMatch,
  pendingJoinCount = 0,
}) {
  const isGroup = conversation?.type === 'GROUP'
  const { title, avatarUrl, members, description } = conversation || {}

  const [isSearching, setIsSearching] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0)
  const [isSearchingLoading, setIsSearchingLoading] = useState(false)
  const [isTogglingBlock, setIsTogglingBlock] = useState(false)
  const [isPeerBlocked, setIsPeerBlocked] = useState(false)
  const searchInputRef = useRef(null)

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

  const trimmedQuery = searchQuery.trim()
  const activeSearchResults = isSearching && trimmedQuery ? searchResults : []

  // Handle in-chat search debounced
  useEffect(() => {
    if (!isSearching || !trimmedQuery || !conversation?.id) {
      return
    }

    const timer = setTimeout(async () => {
      setIsSearchingLoading(true)
      try {
        const results = await searchApi.searchMessages(trimmedQuery, {
          conversationId: conversation.id,
        })
        setSearchResults(results || [])
        setCurrentMatchIndex(0)
        if (results && results.length > 0) {
          onSelectSearchMatch?.(results[0].id)
        }
      } catch {
        setSearchResults([])
      } finally {
        setIsSearchingLoading(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [trimmedQuery, isSearching, conversation?.id, onSelectSearchMatch])

  const handleNextMatch = () => {
    if (activeSearchResults.length === 0) return
    const nextIdx = (currentMatchIndex + 1) % activeSearchResults.length
    setCurrentMatchIndex(nextIdx)
    onSelectSearchMatch?.(activeSearchResults[nextIdx].id)
  }

  const handlePrevMatch = () => {
    if (activeSearchResults.length === 0) return
    const prevIdx = (currentMatchIndex - 1 + activeSearchResults.length) % activeSearchResults.length
    setCurrentMatchIndex(prevIdx)
    onSelectSearchMatch?.(activeSearchResults[prevIdx].id)
  }

  const handleOpenSearch = () => {
    setIsSearching(true)
    setTimeout(() => searchInputRef.current?.focus(), 50)
  }

  const handleCloseSearch = () => {
    setIsSearching(false)
    setSearchQuery('')
    setSearchResults([])
    setCurrentMatchIndex(0)
  }

  if (!conversation) return null

  return (
    <div className="px-4 py-3 border-b border-[var(--glass-border)] bg-[var(--glass-bg-subtle)] flex items-center justify-between gap-3 sticky top-0 z-10 select-none">
      {isSearching ? (
        /* In-Chat Search Bar */
        <div className="flex-1 flex items-center gap-2 animate-msg-in">
          <div className="relative flex-1 flex items-center">
            <Search className="w-4 h-4 text-ink-subtle absolute left-3.5 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search in this chat..."
              className="glass-input w-full rounded-full pl-9 pr-8 py-1.5 text-xs"
            />
            {isSearchingLoading && (
              <Loader2 className="w-3.5 h-3.5 text-accent-text animate-spin absolute right-3" />
            )}
          </div>

          {activeSearchResults.length > 0 && (
            <div className="flex items-center gap-1 text-xs text-ink-muted whitespace-nowrap tabular-nums">
              <span>
                {currentMatchIndex + 1} of {activeSearchResults.length}
              </span>
              <button
                type="button"
                onClick={handlePrevMatch}
                className="p-1.5 hover:text-ink hover:bg-[var(--glass-bg-hover)] rounded-xl transition-colors focus-accent cursor-pointer"
                title="Previous match"
                aria-label="Previous match"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleNextMatch}
                className="p-1.5 hover:text-ink hover:bg-[var(--glass-bg-hover)] rounded-xl transition-colors focus-accent cursor-pointer"
                title="Next match"
                aria-label="Next match"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          )}

          {searchQuery && !isSearchingLoading && activeSearchResults.length === 0 && (
            <span className="text-xs text-ink-subtle whitespace-nowrap">No matches</span>
          )}

          <button
            type="button"
            onClick={handleCloseSearch}
            className="p-1.5 text-ink-muted hover:text-ink hover:bg-[var(--glass-bg-hover)] rounded-xl transition-colors focus-accent cursor-pointer"
            title="Close search"
            aria-label="Close search"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        /* Standard Header Info */
        <>
          <div className="flex items-center gap-3 min-w-0">
            {/* Back Button (Mobile Only) */}
            <button
              onClick={onBack}
              className="md:hidden p-1.5 -ml-1 text-ink-muted hover:text-ink hover:bg-[var(--glass-bg-hover)] rounded-xl transition-colors focus-accent cursor-pointer"
              title="Back to conversations"
              aria-label="Back to conversations"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            {/* Avatar with optional online indicator */}
            {isGroup ? (
              avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={title}
                  className="w-10 h-10 rounded-full object-cover shadow-sm flex-shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-full accent-badge flex items-center justify-center shadow-inner flex-shrink-0">
                  <Users className="w-5 h-5" />
                </div>
              )
            ) : (
              <UserAvatar
                src={avatarUrl}
                name={title}
                seed={peer?.id || conversation.id || title}
                size="md"
                isOnline={isOnline}
              />
            )}

            {/* Conversation Info */}
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-ink truncate leading-tight">
                {title}
              </h2>
              <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                {typingText ? (
                  <>
                    <span className="inline-flex items-center gap-0.5 flex-shrink-0" aria-hidden="true">
                      <span className="w-1 h-1 rounded-full bg-[var(--accent-solid)] animate-typing-dot" />
                      <span className="w-1 h-1 rounded-full bg-[var(--accent-solid)] animate-typing-dot [animation-delay:150ms]" />
                      <span className="w-1 h-1 rounded-full bg-[var(--accent-solid)] animate-typing-dot [animation-delay:300ms]" />
                    </span>
                    <p className="text-[11px] truncate leading-tight text-accent-text font-semibold">
                      {subtitle}
                    </p>
                  </>
                ) : (
                  <p
                    className={`text-[11px] truncate leading-tight ${
                      isOnline
                        ? 'text-[var(--success-text)] font-semibold'
                        : 'text-ink-muted'
                    }`}
                  >
                    {subtitle}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Glass Action Button Group */}
          <div className="glass-subtle rounded-2xl p-1 flex items-center gap-0.5">
            <button
              onClick={handleOpenSearch}
              className="p-1.5 text-ink-muted hover:text-ink hover:bg-[var(--glass-bg-hover)] rounded-xl transition-all active:scale-95 focus-accent cursor-pointer"
              title="Search in chat"
              aria-label="Search in chat"
            >
              <Search className="w-4 h-4" />
            </button>

            {!isGroup && peer?.id && (
              <button
                type="button"
                disabled={isTogglingBlock}
                onClick={async () => {
                  setIsTogglingBlock(true)
                  try {
                    if (isPeerBlocked) {
                      await userApi.unblock(peer.id)
                      setIsPeerBlocked(false)
                      onBlockChange?.(false)
                    } else {
                      await userApi.block(peer.id)
                      setIsPeerBlocked(true)
                      onBlockChange?.(true)
                    }
                  } catch {
                    // Ignore error
                  } finally {
                    setIsTogglingBlock(false)
                  }
                }}
                className={`p-1.5 rounded-xl transition-all active:scale-95 focus-accent cursor-pointer disabled:opacity-50 ${
                  isPeerBlocked
                    ? 'text-[var(--success-text)] hover:bg-[var(--success-bg)]'
                    : 'text-ink-muted hover:text-[var(--danger-text)] hover:bg-[var(--danger-bg)]'
                }`}
                title={isPeerBlocked ? 'Unblock user' : 'Block user'}
                aria-label={isPeerBlocked ? 'Unblock user' : 'Block user'}
              >
                {isPeerBlocked ? <UserCheck className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
              </button>
            )}

            {isGroup && onToggleInfo && (
              <button
                onClick={onToggleInfo}
                className="relative p-1.5 text-ink-muted hover:text-ink hover:bg-[var(--glass-bg-hover)] rounded-xl transition-all active:scale-95 focus-accent cursor-pointer"
                title="Group Info"
                aria-label="Group Info"
              >
                <Info className="w-4 h-4" />
                {pendingJoinCount > 0 && (
                  <span
                    className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-1 rounded-full text-[9px] font-bold accent-badge flex items-center justify-center tabular-nums"
                    aria-label={`${pendingJoinCount} pending join requests`}
                  >
                    {pendingJoinCount}
                  </span>
                )}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
