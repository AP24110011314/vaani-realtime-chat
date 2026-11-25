import { useState, useMemo, useEffect, useRef } from 'react'
import { Link } from 'react-router'
import {
  Search,
  SquarePen,
  Users,
  LogOut,
  Settings,
  X,
  Archive,
  Loader2,
  SearchX,
  AtSign,
} from 'lucide-react'
import ConversationList from './ConversationList'
import UserSearchModal from './UserSearchModal'
import GroupCreateModal from './GroupCreateModal'
import UserAvatar from '../common/UserAvatar'
import VanniLogo from '../common/VanniLogo'
import { useAuth } from '../../hooks/useAuth'
import { searchApi } from '../../api/searchApi'
import { conversationApi } from '../../api/conversationApi'
import { useQuery } from '@tanstack/react-query'
import { formatConversationDate } from '../../lib/formatters'

export default function Sidebar({
  conversations = [],
  activeId,
  onSelectConversation,
  onStartDirectChat,
  onUpdateSettings,
  isLoading,
  isSearchModalOpen: controlledSearchOpen,
  onSearchModalOpenChange,
  isGroupModalOpen: controlledGroupOpen,
  onGroupModalOpenChange,
}) {
  const { user, logout } = useAuth()
  const [filterText, setFilterText] = useState('')
  const [filterTab, setFilterTab] = useState('all') // 'all' | 'unread' | 'archived'
  const [internalSearchOpen, setInternalSearchOpen] = useState(false)
  const [internalGroupOpen, setInternalGroupOpen] = useState(false)
  const [globalSearchResults, setGlobalSearchResults] = useState([])
  const [isSearchingGlobal, setIsSearchingGlobal] = useState(false)
  const [searchView, setSearchView] = useState('chats') // 'chats' | 'messages'
  const searchInputRef = useRef(null)

  const isSearchModalOpen =
    controlledSearchOpen !== undefined ? controlledSearchOpen : internalSearchOpen
  const setIsSearchModalOpen = (val) => {
    setInternalSearchOpen(val)
    onSearchModalOpenChange?.(val)
  }

  const isGroupModalOpen =
    controlledGroupOpen !== undefined ? controlledGroupOpen : internalGroupOpen
  const setIsGroupModalOpen = (val) => {
    setInternalGroupOpen(val)
    onGroupModalOpenChange?.(val)
  }

  const shortcutLabel =
    typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform || '')
      ? '⌘K'
      : 'Ctrl K'

  // Keyboard shortcut: Ctrl+K / Cmd+K focuses search input
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Query archived conversations when 'archived' tab is selected
  const { data: archivedConversations = [], isLoading: isLoadingArchived } = useQuery({
    queryKey: ['conversations', 'archived'],
    queryFn: () => conversationApi.list(true),
    enabled: filterTab === 'archived',
  })

  // Global message search debounce — only run search when query is non-empty
  useEffect(() => {
    if (!filterText.trim()) return

    const timer = setTimeout(async () => {
      setIsSearchingGlobal(true)
      try {
        const results = await searchApi.searchMessages(filterText.trim())
        setGlobalSearchResults(results || [])
      } catch {
        setGlobalSearchResults([])
      } finally {
        setIsSearchingGlobal(false)
      }
    }, 350)

    return () => clearTimeout(timer)
  }, [filterText])

  const displayedGlobalSearchResults = filterText.trim() ? globalSearchResults : []
  const currentConversations = filterTab === 'archived' ? archivedConversations : conversations

  const totalUnread = useMemo(() => {
    return conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0)
  }, [conversations])

  const totalMentionUnread = useMemo(() => {
    return conversations.reduce((sum, c) => sum + (c.mentionUnreadCount || 0), 0)
  }, [conversations])

  const filteredConversations = useMemo(() => {
    let list = currentConversations
    if (filterTab === 'unread') {
      list = list.filter((c) => (c.unreadCount || 0) > 0)
    } else if (filterTab === 'mentions') {
      list = list.filter((c) => (c.mentionUnreadCount || 0) > 0)
    }
    if (!filterText.trim()) return list
    const q = filterText.toLowerCase()
    return list.filter((c) => c.title?.toLowerCase().includes(q))
  }, [currentConversations, filterText, filterTab])

  const activeTabIndex =
    filterTab === 'unread' ? 1 : filterTab === 'mentions' ? 2 : filterTab === 'archived' ? 3 : 0

  return (
    <aside className="w-full h-full flex flex-col select-none">
      {/* Brand + Profile + Compact Glass Action Group */}
      <div className="px-4 pt-3.5 pb-3 border-b border-[var(--glass-border)] space-y-3">
        <div className="flex items-center justify-between gap-2">
          <VanniLogo size="sm" />
          <div
            className="glass-subtle rounded-2xl p-1 flex items-center gap-0.5"
            role="toolbar"
            aria-label="Workspace actions"
          >
            <button
              type="button"
              onClick={() => setIsGroupModalOpen(true)}
              className="p-1.5 text-ink-muted hover:text-ink hover:bg-[var(--glass-bg-hover)] rounded-xl transition-all active:scale-95 focus-accent cursor-pointer"
              title="New Group"
              aria-label="New Group"
            >
              <Users className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setIsSearchModalOpen(true)}
              className="p-1.5 text-ink-muted hover:text-ink hover:bg-[var(--glass-bg-hover)] rounded-xl transition-all active:scale-95 focus-accent cursor-pointer"
              title="New Chat"
              aria-label="New Chat"
            >
              <SquarePen className="w-4 h-4" />
            </button>
            <Link
              to="/settings"
              className="p-1.5 text-ink-muted hover:text-ink hover:bg-[var(--glass-bg-hover)] rounded-xl transition-all active:scale-95 focus-accent"
              title="Settings"
              aria-label="Settings"
            >
              <Settings className="w-4 h-4" />
            </Link>
            <button
              type="button"
              onClick={logout}
              className="p-1.5 text-ink-muted hover:text-[var(--danger-text)] hover:bg-[var(--danger-bg)] rounded-xl transition-all active:scale-95 focus-accent cursor-pointer"
              title="Log Out"
              aria-label="Log Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Profile chip */}
        <Link
          to="/profile"
          className="flex items-center gap-3 min-w-0 p-1.5 -mx-1.5 rounded-2xl glass-row-hover transition-all group focus-accent"
          title="Edit Profile"
        >
          <UserAvatar
            src={user?.avatarUrl}
            name={user?.name}
            seed={user?.id || user?.email}
            size="md"
            isOnline={true}
            gradientRing={true}
          />
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-bold text-ink truncate leading-tight group-hover:text-accent-text transition-colors">
              {user?.name}
            </h2>
            <p className="text-[11px] text-ink-muted truncate leading-tight mt-0.5">
              {user?.email}
            </p>
          </div>
        </Link>
      </div>

      {/* Pill-Shaped Glass Search Input */}
      <div className="px-3.5 pt-3 pb-2.5">
        <div className="relative flex items-center">
          <Search className="absolute left-3.5 w-4 h-4 text-ink-subtle pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Search chats or messages..."
            className="glass-input w-full rounded-full pl-9 pr-14 py-2 text-xs"
          />
          {filterText ? (
            <button
              type="button"
              onClick={() => {
                setFilterText('')
                setSearchView('chats')
              }}
              className="absolute right-3 p-1 text-ink-subtle hover:text-ink rounded-full transition-colors focus-accent cursor-pointer"
              title="Clear search"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <kbd className="absolute right-2.5 px-1.5 py-0.5 text-[10px] font-medium text-ink-subtle glass-subtle rounded-full pointer-events-none">
              {shortcutLabel}
            </kbd>
          )}
        </div>

        {/* Search Mode Toggle */}
        {filterText.trim() && (
          <div className="flex items-center gap-1.5 mt-2.5 text-[11px]">
            <button
              type="button"
              onClick={() => setSearchView('chats')}
              className={`px-3 py-1 rounded-full font-semibold transition-all cursor-pointer focus-accent ${
                searchView === 'chats'
                  ? 'glass-strong text-accent-text border-[var(--accent-soft-border)]'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              Chats ({filteredConversations.length})
            </button>
            <button
              type="button"
              onClick={() => setSearchView('messages')}
              className={`px-3 py-1 rounded-full font-semibold flex items-center gap-1 transition-all cursor-pointer focus-accent ${
                searchView === 'messages'
                  ? 'glass-strong text-accent-text border-[var(--accent-soft-border)]'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              <span>Messages</span>
              {isSearchingGlobal ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <span className="tabular-nums">({displayedGlobalSearchResults.length})</span>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Segmented Filter Tabs with Sliding Glass Thumb */}
      {!filterText.trim() && (
        <div className="px-3.5 pb-2.5 border-b border-[var(--glass-border)]">
          <div className="relative grid grid-cols-4 p-1 rounded-2xl glass-subtle">
            <div
              aria-hidden="true"
              className="absolute top-1 bottom-1 left-1 w-[calc((100%-0.5rem)/4)] rounded-xl glass-strong transition-transform duration-200 ease-out"
              style={{ transform: `translateX(${activeTabIndex * 100}%)` }}
            />
            <button
              type="button"
              onClick={() => setFilterTab('all')}
              className={`relative z-10 py-1.5 rounded-xl text-[11px] font-semibold transition-colors cursor-pointer focus-accent ${
                filterTab === 'all' ? 'text-accent-text' : 'text-ink-muted hover:text-ink'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('unread')}
              className={`relative z-10 flex items-center justify-center gap-1 py-1.5 rounded-xl text-[11px] font-semibold transition-colors cursor-pointer focus-accent ${
                filterTab === 'unread' ? 'text-accent-text' : 'text-ink-muted hover:text-ink'
              }`}
            >
              <span>Unread</span>
              {totalUnread > 0 && (
                <span className="text-[9px] px-1.5 py-0.2 rounded-full font-bold accent-badge tabular-nums">
                  {totalUnread}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('mentions')}
              className={`relative z-10 flex items-center justify-center gap-1 py-1.5 rounded-xl text-[11px] font-semibold transition-colors cursor-pointer focus-accent ${
                filterTab === 'mentions' ? 'text-accent-text' : 'text-ink-muted hover:text-ink'
              }`}
              title="Conversations with unread @mentions"
            >
              <AtSign className="w-3 h-3" />
              <span>Mentions</span>
              {totalMentionUnread > 0 && (
                <span className="text-[9px] px-1.5 py-0.2 rounded-full font-bold accent-badge tabular-nums">
                  {totalMentionUnread}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('archived')}
              className={`relative z-10 flex items-center justify-center gap-1 py-1.5 rounded-xl text-[11px] font-semibold transition-colors cursor-pointer focus-accent ${
                filterTab === 'archived' ? 'text-accent-text' : 'text-ink-muted hover:text-ink'
              }`}
            >
              <Archive className="w-3 h-3" />
              <span>Archived</span>
            </button>
          </div>
        </div>
      )}

      {/* View: Global Message Search Results */}
      {filterText.trim() && searchView === 'messages' ? (
        <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
          {displayedGlobalSearchResults.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <div className="w-12 h-12 rounded-2xl glass-subtle flex items-center justify-center text-accent-text mb-3">
                {isSearchingGlobal ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <SearchX className="w-5 h-5" />
                )}
              </div>
              <p className="text-xs font-semibold text-ink mb-1">
                {isSearchingGlobal ? 'Searching messages...' : 'No matching messages'}
              </p>
              <p className="text-[11px] text-ink-muted max-w-[200px]">
                {isSearchingGlobal
                  ? 'Looking across your conversations.'
                  : 'Try another keyword or switch back to Chats.'}
              </p>
            </div>
          ) : (
            displayedGlobalSearchResults.map((msg) => (
              <button
                key={msg.id}
                onClick={() => onSelectConversation?.(msg.conversationId)}
                className="w-full flex flex-col p-3 rounded-2xl glass-row-hover border border-transparent text-left transition-all focus-accent cursor-pointer"
              >
                <div className="flex items-center justify-between text-[11px] text-ink-muted mb-1">
                  <span className="font-semibold text-accent-text">
                    {msg.sender?.name || 'User'}
                  </span>
                  <span className="tabular-nums">{formatConversationDate(msg.createdAt)}</span>
                </div>
                <p className="text-xs text-ink line-clamp-2 leading-relaxed">
                  {msg.previewText || msg.content}
                </p>
              </button>
            ))
          )}
        </div>
      ) : (
        /* View: Conversations List */
        <ConversationList
          conversations={filteredConversations}
          activeId={activeId}
          onSelectConversation={onSelectConversation}
          onOpenNewChat={() => setIsSearchModalOpen(true)}
          isLoading={filterTab === 'archived' ? isLoadingArchived : isLoading}
          currentUserId={user?.id}
          onUpdateSettings={onUpdateSettings}
          hasSearchQuery={Boolean(filterText.trim())}
        />
      )}

      {/* User Search & New Chat Modal */}
      <UserSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        onSelectUser={onStartDirectChat}
      />

      {/* New Group Modal */}
      <GroupCreateModal
        isOpen={isGroupModalOpen}
        onClose={() => setIsGroupModalOpen(false)}
        onCreated={(newGroup) => {
          onSelectConversation?.(newGroup.id)
        }}
      />
    </aside>
  )
}
