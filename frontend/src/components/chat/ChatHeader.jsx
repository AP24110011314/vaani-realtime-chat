import { ArrowLeft, User } from 'lucide-react'

export default function ChatHeader({ conversation, onBack, currentUserId }) {
  if (!conversation) return null

  const { title, avatarUrl, members, description } = conversation
  const peer = members?.find((m) => m.id !== currentUserId) || members?.[0]
  const isOnline = peer?.online

  return (
    <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/80 backdrop-blur flex items-center justify-between gap-3 sticky top-0 z-10">
      <div className="flex items-center gap-3 min-w-0">
        {/* Back Button (Mobile Only) */}
        <button
          onClick={onBack}
          className="md:hidden p-1.5 -ml-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          aria-label="Back to conversations"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        {/* Peer Avatar */}
        <div className="relative flex-shrink-0">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={title}
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-sm font-bold text-white shadow-inner">
              {title ? title.charAt(0).toUpperCase() : <User className="w-5 h-5" />}
            </div>
          )}
          {isOnline && (
            <span
              className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-900"
              title="Online"
            />
          )}
        </div>

        {/* Peer Info */}
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-white truncate leading-tight">
            {title}
          </h2>
          <p className="text-[11px] text-slate-400 truncate leading-tight mt-0.5">
            {isOnline ? (
              <span className="text-emerald-400 font-medium">Online</span>
            ) : (
              description || 'Offline'
            )}
          </p>
        </div>
      </div>
    </div>
  )
}
