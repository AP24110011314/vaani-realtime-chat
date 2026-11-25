import ConversationItem from './ConversationItem'
import { SearchX } from 'lucide-react'

export default function ConversationList({
  conversations = [],
  activeId,
  onSelectConversation,
  onOpenNewChat,
  isLoading,
  currentUserId,
  onUpdateSettings,
  hasSearchQuery = false,
}) {
  if (isLoading) {
    return (
      <div className="space-y-2 p-2.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="flex items-center gap-3.5 p-3 rounded-2xl glass-subtle"
          >
            <div className="w-11 h-11 rounded-full glass-skeleton flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 glass-skeleton rounded-full w-1/2" />
              <div className="h-2.5 glass-skeleton rounded-full w-3/4" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (conversations.length === 0) {
    if (hasSearchQuery) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="relative w-14 h-14 rounded-2xl glass-strong flex items-center justify-center mb-4">
            <SearchX className="w-6 h-6 text-accent-text" />
          </div>
          <h3 className="text-sm font-semibold text-ink mb-1">No matching chats</h3>
          <p className="text-xs text-ink-muted max-w-[210px] leading-relaxed">
            No conversations match your filter. Try a different name or search inside messages.
          </p>
        </div>
      )
    }

    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        {/* Layered floating glass illustration */}
        <div className="relative w-24 h-20 mb-4 flex items-center justify-center" aria-hidden="true">
          <div className="absolute left-1 top-1 w-14 h-10 rounded-2xl rounded-bl-sm glass-strong animate-float-slow flex items-center justify-center gap-1 px-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-solid)]" />
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-solid)] opacity-70" />
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-solid)] opacity-45" />
          </div>
          <div className="absolute right-1 bottom-1 w-14 h-10 rounded-2xl rounded-br-sm accent-badge shadow-md animate-float-delayed flex items-center justify-center">
            <span className="w-6 h-1.5 rounded-full bg-current opacity-85" />
          </div>
        </div>
        <h3 className="text-sm font-bold text-ink mb-1">No conversations yet</h3>
        <p className="text-xs text-ink-muted mb-5 max-w-[210px] leading-relaxed">
          Start a direct chat with your friends or team members.
        </p>
        <button
          type="button"
          onClick={onOpenNewChat}
          className="px-4 py-2 rounded-full btn-accent text-xs font-semibold cursor-pointer focus-accent"
        >
          Start a Chat
        </button>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
      {conversations.map((conv) => (
        <ConversationItem
          key={conv.id}
          conversation={conv}
          isActive={String(conv.id) === String(activeId)}
          onClick={() => onSelectConversation(conv.id)}
          currentUserId={currentUserId}
          onUpdateSettings={onUpdateSettings}
        />
      ))}
    </div>
  )
}
