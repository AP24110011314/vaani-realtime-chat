import { useState, useEffect, useRef } from 'react'
import {
  ArrowLeft,
  User,
  Users,
  Info,
  Search,
  X,
  ChevronUp,
  ChevronDown,
  Loader2,
} from 'lucide-react'
import { usePresence } from '../../hooks/usePresence'
import { formatLastSeen } from '../../lib/formatters'
import { searchApi } from '../../api/searchApi'

export default function ChatHeader({
  conversation,
  onBack,
  currentUserId,
  onToggleInfo,
  typingText,
  onSelectSearchMatch,
}) {
  const isGroup = conversation?.type === 'GROUP'
  const { title, avatarUrl, members, description } = conversation || {}

  const [isSearching, setIsSearching] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0)
  const [isSearchingLoading, setIsSearchingLoading] = useState(false)
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
    <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/80 backdrop-blur flex items-center justify-between gap-3 sticky top-0 z-10 select-none">
      {isSearching ? (
        /* In-Chat Search Bar */
        <div className="flex-1 flex items-center gap-2 animate-in fade-in">
          <div className="relative flex-1 flex items-center">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search in this chat..."
              className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl pl-9 pr-8 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
            {isSearchingLoading && (
              <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin absolute right-3" />
            )}
          </div>

          {activeSearchResults.length > 0 && (
            <div className="flex items-center gap-1 text-xs text-slate-400 whitespace-nowrap">
              <span>
                {currentMatchIndex + 1} of {activeSearchResults.length}
              </span>
              <button
                type="button"
                onClick={handlePrevMatch}
                className="p-1 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                title="Previous match"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleNextMatch}
                className="p-1 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                title="Next match"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          )}

          {searchQuery && !isSearchingLoading && activeSearchResults.length === 0 && (
            <span className="text-xs text-slate-500 whitespace-nowrap">No matches</span>
          )}

          <button
            type="button"
            onClick={handleCloseSearch}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
            title="Close search"
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

          {/* Action buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleOpenSearch}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
              title="Search in chat"
              aria-label="Search in chat"
            >
              <Search className="w-4 h-4" />
            </button>

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
        </>
      )}
    </div>
  )
}
