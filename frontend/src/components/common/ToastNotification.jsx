import { MessageSquare, X } from 'lucide-react'

export default function ToastNotification({ toast, onSelect, onDismiss }) {
  if (!toast) return null

  return (
    <div
      role="alert"
      className="fixed top-4 right-4 z-50 max-w-sm w-full animate-in slide-in-from-top duration-200"
    >
      <div
        onClick={() => onSelect(toast.conversationId)}
        className="cursor-pointer flex items-start gap-3 p-3.5 bg-slate-900/95 border border-indigo-500/40 rounded-2xl shadow-2xl backdrop-blur-md hover:border-indigo-500 transition-colors"
      >
        <div className="w-9 h-9 rounded-xl bg-indigo-600/30 text-indigo-300 flex items-center justify-center shrink-0">
          <MessageSquare className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0 pr-1">
          <div className="flex items-center justify-between">
            <h5 className="text-xs font-bold text-white truncate">{toast.senderName}</h5>
            <span className="text-[10px] text-indigo-400">New message</span>
          </div>
          <p className="text-xs text-slate-300 truncate mt-0.5">{toast.content || 'Sent an attachment'}</p>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onDismiss()
          }}
          className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
