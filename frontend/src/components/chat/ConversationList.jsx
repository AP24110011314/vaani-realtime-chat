import ConversationItem from './ConversationItem'
import { MessageSquarePlus } from 'lucide-react'

export default function ConversationList({
  conversations = [],
  activeId,
  onSelectConversation,
  onOpenNewChat,
  isLoading,
  currentUserId,
  onUpdateSettings,
}) {
  if (isLoading) {
    return (
      <div className="space-y-2 p-3">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="flex items-center gap-3.5 p-3 rounded-xl bg-slate-800/30 animate-pulse"
          >
            <div className="w-12 h-12 rounded-full bg-slate-700/60 flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-slate-700/60 rounded w-1/2" />
              <div className="h-3 bg-slate-700/40 rounded w-3/4" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (conversations.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-400">
        <div className="w-14 h-14 rounded-2xl bg-slate-800/60 flex items-center justify-center text-slate-400 mb-4 border border-slate-700/40">
          <MessageSquarePlus className="w-7 h-7 text-indigo-400" />
        </div>
        <h3 className="text-sm font-semibold text-slate-200 mb-1">No conversations yet</h3>
        <p className="text-xs text-slate-400 mb-5 max-w-[200px]">
          Start a direct chat with your friends or team members.
        </p>
        <button
          onClick={onOpenNewChat}
          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors shadow-lg shadow-indigo-600/20"
        >
          Start a Chat
        </button>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-2 space-y-1">
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
