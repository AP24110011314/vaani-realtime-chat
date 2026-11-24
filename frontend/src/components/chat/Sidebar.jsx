import { useState, useMemo } from 'react'
import { Search, SquarePen, Users, LogOut, X } from 'lucide-react'
import ConversationList from './ConversationList'
import UserSearchModal from './UserSearchModal'
import GroupCreateModal from './GroupCreateModal'
import { useAuth } from '../../hooks/useAuth'

export default function Sidebar({
  conversations = [],
  activeId,
  onSelectConversation,
  onStartDirectChat,
  isLoading,
}) {
  const { user, logout } = useAuth()
  const [filterText, setFilterText] = useState('')
  const [filterTab, setFilterTab] = useState('all') // 'all' | 'unread'
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false)
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false)

  const totalUnread = useMemo(() => {
    return conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0)
  }, [conversations])

  const filteredConversations = useMemo(() => {
    let list = conversations
    if (filterTab === 'unread') {
      list = list.filter((c) => (c.unreadCount || 0) > 0)
    }
    if (!filterText.trim()) return list
    const q = filterText.toLowerCase()
    return list.filter((c) => c.title?.toLowerCase().includes(q))
  }, [conversations, filterText, filterTab])

  return (
    <aside className="w-full h-full flex flex-col bg-slate-900 border-r border-slate-800 select-none">
      {/* Sidebar Header */}
      <div className="p-3.5 border-b border-slate-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative flex-shrink-0">
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name}
                className="w-9 h-9 rounded-full object-cover"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-xs font-bold text-white shadow-inner">
                {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </div>
            )}
            <span
              className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-slate-900"
              title="Online"
            />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-white truncate leading-tight">
              {user?.name}
            </h2>
            <p className="text-[11px] text-slate-400 truncate leading-tight">
              {user?.email}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsGroupModalOpen(true)}
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
            title="New Group"
            aria-label="New Group"
          >
            <Users className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsSearchModalOpen(true)}
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
            title="New Chat"
            aria-label="New Chat"
          >
            <SquarePen className="w-4 h-4" />
          </button>
          <button
            onClick={logout}
            className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-xl transition-colors"
            title="Log Out"
            aria-label="Log Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search Input for Existing Chats */}
      <div className="p-3 border-b border-slate-800/80">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Search chats..."
            className="w-full bg-slate-950/70 border border-slate-800 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
          {filterText && (
            <button
              onClick={() => setFilterText('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs: All vs Unread */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-slate-800/60 bg-slate-900/60">
        <button
          type="button"
          onClick={() => setFilterTab('all')}
          className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
            filterTab === 'all'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          All
        </button>
        <button
          type="button"
          onClick={() => setFilterTab('unread')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
            filterTab === 'unread'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <span>Unread</span>
          {totalUnread > 0 && (
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                filterTab === 'unread' ? 'bg-indigo-700 text-white' : 'bg-indigo-600/40 text-indigo-300'
              }`}
            >
              {totalUnread}
            </span>
          )}
        </button>
      </div>

      {/* Conversations List */}
      <ConversationList
        conversations={filteredConversations}
        activeId={activeId}
        onSelectConversation={onSelectConversation}
        onOpenNewChat={() => setIsSearchModalOpen(true)}
        isLoading={isLoading}
        currentUserId={user?.id}
      />

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
